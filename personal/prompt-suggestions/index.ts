import {
  createAgentSession,
  SessionManager,
  type AgentSession,
  type AutocompleteProviderFactory,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  bindChildSessionExtensions,
  childToolPolicy,
  createChildResources,
  shutdownAndDisposeChildSession,
} from "../shared/child-session.ts";

// Derive the AutocompleteProvider type from the factory (it isn't directly
// exported by pi-coding-agent, but the factory param gives it to us).
type AutocompleteProvider = Parameters<AutocompleteProviderFactory>[0];

type AgentMessage = AgentSession["messages"][number];

/** How much of the last assistant message to feed the suggester. */
const CONTEXT_CHARS = 2000;
/** How much of the user's last message to feed the suggester. */
const USER_CONTEXT_CHARS = 1500;
/** Hard cap on how long a single suggestion call may run. */
const SUGGESTION_TIMEOUT_MS = 30_000;
const MAX_SUGGESTIONS = 3;

const SUGGESTER_SYSTEM_PROMPT = [
  "You write the NEXT prompt a user would type into a coding agent, based on the",
  "conversation shown (their last message and the assistant's last reply).",
  "Be SPECIFIC: each suggestion MUST reference a concrete detail from the reply —",
  "a file name, function/symbol, command, error, option, or the exact topic",
  "discussed. Do NOT write generic prompts like 'explain more', 'continue', or",
  "'what next'. Tie every suggestion to something actually said or done.",
  "Adapt to the reply:",
  "- if the assistant asked a question, suggest concrete likely answers;",
  "- if it gave an explanation, suggest the natural next probe on THAT topic;",
  "- if it changed code (edited files), suggest how to verify or extend it.",
  'Reply with 2-3 suggestions as STRICT JSON: {"suggestions":["...","..."]}.',
  "Each <= 100 chars, written exactly as the user would type it (imperative mood,",
  "no leading quotes, no numbering, no markdown fences). If there is genuinely",
  "no useful follow-up, return an empty array.",
].join(" ");

export default function promptSuggestions(pi: ExtensionAPI) {
  let providerInstalled = false;
  let cachedSuggestions: string[] = [];
  let lastUserText = "";
  let lastAssistantText = "";
  let runCounter = 0;
  let activeRunId = 0;

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return; // ignore headless child sessions
    if (!providerInstalled) {
      ctx.ui.addAutocompleteProvider((current) => makeProvider(current));
      providerInstalled = true;
    }
  });

  pi.on("session_shutdown", async () => {
    cachedSuggestions = [];
  });

  // Track the most recent user + assistant text so the suggester has context.
  pi.on("message_end", (event, ctx) => {
    if (!ctx.hasUI) return; // ignore headless child sessions
    const text = assistantText(event.message);
    if (!text) return;
    const role = (event.message as { role?: string }).role;
    if (role === "user") lastUserText = text.slice(0, USER_CONTEXT_CHARS);
    else if (role === "assistant")
      lastAssistantText = text.slice(0, CONTEXT_CHARS);
  });

  // Generate + cache suggestions once the agent settles.
  pi.on("agent_settled", (_event, ctx) => {
    if (!ctx.hasUI) return; // ignore headless child sessions
    if (!ctx.model) return;
    void generateAndCache(ctx);
  });

  // The user submitted (Enter): drop stale suggestions until the next reply.
  pi.on("turn_start", (_event, ctx) => {
    if (!ctx.hasUI) return; // ignore headless child sessions
    cachedSuggestions = [];
  });

  /** Wrap the built-in provider with LLM-generated prompt suggestions. */
  function makeProvider(current: AutocompleteProvider): AutocompleteProvider {
    return {
      // We don't add trigger characters; suggestions surface via Tab (force).
      triggerCharacters: [],
      // Allow Tab to trigger when we have suggestions ready.
      shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
        if (cachedSuggestions.length > 0) return true;
        return (
          current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ??
          true
        );
      },
      async getSuggestions(lines, cursorLine, cursorCol, opts) {
        if (cachedSuggestions.length > 0) {
          const line = lines[cursorLine] ?? "";
          const typed = line.slice(0, cursorCol).trim();
          const lower = typed.toLowerCase();
          const items = cachedSuggestions
            .filter((s) => !lower || s.toLowerCase().includes(lower))
            .slice(0, MAX_SUGGESTIONS)
            .map((value) => ({ value, label: value }));
          if (items.length > 0) {
            return { items, prefix: typed };
          }
        }
        // No suggestions (or none match) — defer to built-in file/command completion.
        return current.getSuggestions(lines, cursorLine, cursorCol, opts);
      },
      applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
        if (cachedSuggestions.includes(item.value)) {
          const line = lines[cursorLine] ?? "";
          const before = line.slice(0, cursorCol);
          const after = line.slice(cursorCol);
          const newBefore =
            prefix && before.endsWith(prefix)
              ? before.slice(0, before.length - prefix.length) + item.value
              : before + item.value;
          const newLines = lines.slice();
          newLines[cursorLine] = newBefore + after;
          return { lines: newLines, cursorLine, cursorCol: newBefore.length };
        }
        return current.applyCompletion(
          lines,
          cursorLine,
          cursorCol,
          item,
          prefix,
        );
      },
    };
  }

  async function generateAndCache(ctx: ExtensionContext) {
    const runId = ++runCounter;
    activeRunId = runId;
    try {
      const suggestions = await generateSuggestions(ctx);
      if (activeRunId !== runId) return; // a newer turn superseded us
      cachedSuggestions = suggestions;
    } catch {
      // best-effort: a failed/aborted suggestion call just leaves no suggestions
    }
  }

  /** One headless turn that asks the model for follow-up prompts as JSON. */
  async function generateSuggestions(ctx: ExtensionContext): Promise<string[]> {
    const resources = await createChildResources({
      cwd: ctx.cwd,
      projectTrusted: ctx.isProjectTrusted(),
      appendSystemPrompt: [SUGGESTER_SYSTEM_PROMPT],
    });

    let session: AgentSession | undefined;
    try {
      ({ session } = await createAgentSession({
        cwd: ctx.cwd,
        ...(ctx.model ? { model: ctx.model } : {}),
        modelRegistry: ctx.modelRegistry,
        resourceLoader: resources.loader,
        settingsManager: resources.settingsManager,
        sessionManager: SessionManager.inMemory(ctx.cwd),
        ...childToolPolicy(),
      }));

      await bindChildSessionExtensions(session);

      const settled = await raceWithTimeout(
        runOneTurn(session, buildPrompt(lastUserText, lastAssistantText)),
        SUGGESTION_TIMEOUT_MS,
      );
      return settled ? extractSuggestions(session.messages) : [];
    } finally {
      if (session) await shutdownAndDisposeChildSession(session);
    }
  }
}

// ---------------------------------------------------------------- prompt -----

function buildPrompt(lastUserText: string, lastAssistantText: string): string {
  const user = lastUserText.trim();
  const reply = lastAssistantText.trim();
  if (!user && !reply) {
    return "Suggest 2-3 short, specific prompts a developer might start a coding session with.";
  }
  const parts: string[] = [];
  if (user) parts.push(`User's last message:\n"""\n${user}\n"""`);
  if (reply) parts.push(`Assistant's last reply:\n"""\n${reply}\n"""`);
  return `${parts.join("\n\n")}\n\nBased on the above, suggest 2-3 specific follow-up prompts as JSON.`;
}

// --------------------------------------------------------------- helpers ----

function assistantText(message: AgentMessage): string | undefined {
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text: unknown }).text)
          : "",
      )
      .join("\n");
  }
  return undefined;
}

/** Run one prompt and resolve when the session goes idle. */
function runOneTurn(session: AgentSession, prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    const off = session.subscribe((event) => {
      // agent_end always precedes agent_settled; either means the loop completed.
      if (event.type === "agent_end" || event.type === "agent_settled") {
        off();
        finish(true);
      }
    });
    session.prompt(prompt).catch(() => finish(false));
  });
}

function raceWithTimeout<T>(p: Promise<T>, ms: number): Promise<T | false> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
    timer.unref?.();
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** Pull the JSON object out of the last assistant message, tolerantly. */
function extractSuggestions(messages: AgentMessage[]): string[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const text = assistantText(messages[i]);
    if (!text) continue;
    const parsed = tryParseSuggestions(text);
    if (parsed) return parsed.slice(0, MAX_SUGGESTIONS);
  }
  return [];
}

function tryParseSuggestions(text: string): string[] | null {
  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.unshift(fenced[1]);
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) candidates.unshift(brace[0]);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.trim()) as { suggestions?: unknown };
      if (Array.isArray(parsed.suggestions)) {
        return parsed.suggestions
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}
