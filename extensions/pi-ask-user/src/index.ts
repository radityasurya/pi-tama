import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { getKeybindings, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { Type, type Static } from "typebox";
import {
  ASK_USER_PARAMETER_DESCRIPTIONS,
  ASK_USER_PROMPT_GUIDELINES,
  ASK_USER_PROMPT_SNIPPET,
  ASK_USER_TOOL_DESCRIPTION,
  buildAskUserResultMessage,
  type AskUserOutcome,
} from "./prompt.ts";
import {
  createAskUserState,
  handleKey,
  isDigitKey,
  LineEdit,
  optionCount,
  renderLineEdit,
  type AskUserOption,
  type AskUserResult,
  type AskUserState,
} from "./question.ts";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;

const OptionSchema = Type.Object({
  label: Type.String({
    description: ASK_USER_PARAMETER_DESCRIPTIONS.optionLabel,
  }),
  description: Type.Optional(
    Type.String({
      description: ASK_USER_PARAMETER_DESCRIPTIONS.optionDescription,
    }),
  ),
});

const AskUserParams = Type.Object({
  question: Type.String({
    description: ASK_USER_PARAMETER_DESCRIPTIONS.question,
  }),
  options: Type.Array(OptionSchema, {
    minItems: MIN_OPTIONS,
    maxItems: MAX_OPTIONS,
    description: ASK_USER_PARAMETER_DESCRIPTIONS.options,
  }),
});

export type AskUserInput = Static<typeof AskUserParams>;

export interface AskUserDetails {
  readonly question: string;
  readonly options: string[];
  readonly answer: string | null;
  readonly wasCustom: boolean;
  readonly cancelled: boolean;
}

function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

interface QuestionComponent {
  render(width: number): string[];
  invalidate(): void;
  handleInput(data: string): void;
}

/**
 * Build the popup component. `done` resolves the custom() promise with the
 * selection result. The component is a plain duck-typed object satisfying pi's
 * structural `Component` interface.
 */
function createQuestionComponent(
  question: string,
  options: ReadonlyArray<AskUserOption>,
  theme: Theme,
  signal: AbortSignal | undefined,
  done: (result: AskUserResult) => void,
): QuestionComponent {
  let state: AskUserState = createAskUserState(question, options);
  const edit = new LineEdit();
  let settled = false;
  let cachedLines: string[] | undefined;

  const finish = (result: AskUserResult) => {
    if (settled) return;
    settled = true;
    signal?.removeEventListener("abort", onAbort);
    done(result);
  };

  function onAbort() {
    finish(null);
  }

  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) queueMicrotask(onAbort);

  function refresh() {
    cachedLines = undefined;
  }

  function handleInput(data: string) {
    let key:
      | { type: "up" }
      | { type: "down" }
      | { type: "enter" }
      | { type: "escape" }
      | { type: "digit"; value: number }
      | { type: "text"; data: string };

    const kb = getKeybindings();
    if (kb.matches(data, "tui.select.up")) key = { type: "up" };
    else if (kb.matches(data, "tui.select.down")) key = { type: "down" };
    else if (kb.matches(data, "tui.select.confirm")) key = { type: "enter" };
    else if (kb.matches(data, "tui.select.cancel")) key = { type: "escape" };
    else {
      const digit = isDigitKey(data);
      if (digit !== undefined) key = { type: "digit", value: digit };
      else key = { type: "text", data };
    }

    const outcome = handleKey(state, key);
    state = outcome.state;

    if (outcome.feedEditor && state.editMode) {
      edit.handle(data);
    }

    if (outcome.result !== undefined) {
      finish(outcome.result);
    }
    refresh();
  }

  function render(width: number): string[] {
    if (cachedLines) return cachedLines;
    const lines: string[] = [];
    const add = (s: string) => lines.push(truncateToWidth(s, width));

    const title = " Question ";
    add(
      theme.fg(
        "accent",
        `─${title}${"─".repeat(Math.max(0, width - title.length - 1))}`,
      ),
    );
    for (const line of wrapText(state.question, Math.max(10, width - 2))) {
      add(` ${theme.fg("text", theme.bold(line))}`);
    }
    lines.push("");

    for (let i = 0; i < state.options.length; i++) {
      const opt = state.options[i]!;
      const selected = i === state.selectedIndex;
      const prefix = selected ? theme.fg("accent", " ❯ ") : "   ";
      const marker = opt.label === "Write my own answer…" ? "✎" : `${i + 1}.`;
      const label = `${marker} ${opt.label}`;
      const labelColor =
        selected || (opt.label === "Write my own answer…" && state.editMode)
          ? theme.fg("accent", label)
          : theme.fg(
              opt.label === "Write my own answer…" ? "muted" : "text",
              label,
            );
      add(prefix + labelColor);
      if (opt.description) {
        add(`      ${theme.fg("muted", opt.description)}`);
      }
    }

    if (state.editMode) {
      lines.push("");
      add(theme.fg("muted", " Your answer:"));
      const { before, after } = renderLineEdit(edit);
      add(` ${before}${theme.fg("accent", "▏")}${after}`);
    }

    lines.push("");
    add(
      state.editMode
        ? theme.fg("dim", " Enter submit • Esc back to options")
        : theme.fg(
            "dim",
            ` ↑↓ or 1-${optionCount(state)} select • Enter confirm • Esc dismiss`,
          ),
    );
    add(theme.fg("accent", "─".repeat(width)));

    cachedLines = lines;
    return lines;
  }

  return { render, invalidate: refresh, handleInput };
}

function reply(params: AskUserInput, outcome: AskUserOutcome) {
  const text = buildAskUserResultMessage(outcome);
  const details: AskUserDetails = {
    question: params.question,
    options: params.options.map((o) => o.label),
    answer: "answer" in outcome ? outcome.answer : null,
    wasCustom: outcome.kind === "custom",
    cancelled: outcome.kind === "cancelled" || outcome.kind === "dismissed",
  };
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

export default function piAskUser(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "ask_user",
    label: "Ask User",
    description: ASK_USER_TOOL_DESCRIPTION,
    promptSnippet: ASK_USER_PROMPT_SNIPPET,
    promptGuidelines: ASK_USER_PROMPT_GUIDELINES,
    parameters: AskUserParams,

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (
        params.options.length < MIN_OPTIONS ||
        params.options.length > MAX_OPTIONS
      ) {
        throw new Error(
          `ask_user requires between ${MIN_OPTIONS} and ${MAX_OPTIONS} options (got ${params.options.length}). Retry with a valid number of options.`,
        );
      }

      if (ctx.mode !== "tui") {
        return reply(params, { kind: "no-ui" });
      }
      if (signal?.aborted) {
        return reply(params, { kind: "cancelled" });
      }

      const result = await ctx.ui.custom<AskUserResult>(
        (_tui, theme, _kb, done) =>
          createQuestionComponent(
            params.question,
            params.options,
            theme,
            signal,
            done,
          ),
      );

      if (!result) {
        return reply(params, { kind: "dismissed" });
      }
      if (result.wasCustom) {
        return reply(params, { kind: "custom", answer: result.answer });
      }
      return reply(params, {
        kind: "selected",
        answer: result.answer,
        index: result.index,
      });
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("ask_user "));
      text += theme.fg(
        "muted",
        typeof args.question === "string" ? args.question : "",
      );
      const opts = Array.isArray(args.options)
        ? (args.options as AskUserOption[])
        : [];
      if (opts.length > 0) {
        const numbered = opts.map((o, i) => `${i + 1}. ${o.label}`);
        text += `\n${theme.fg("dim", `  ${numbered.join("  ")}`)}`;
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as AskUserDetails | undefined;
      if (!details) {
        const first = result.content[0];
        return new Text(first?.type === "text" ? first.text : "", 0, 0);
      }
      if (details.cancelled || details.answer === null) {
        return new Text(theme.fg("warning", "✗ dismissed"), 0, 0);
      }
      if (details.wasCustom) {
        return new Text(
          theme.fg("success", "✓ ") +
            theme.fg("muted", "(wrote) ") +
            theme.fg("accent", details.answer),
          0,
          0,
        );
      }
      const idx = details.options.indexOf(details.answer) + 1;
      const display = idx > 0 ? `${idx}. ${details.answer}` : details.answer;
      return new Text(
        theme.fg("success", "✓ ") + theme.fg("accent", display),
        0,
        0,
      );
    },
  });
}
