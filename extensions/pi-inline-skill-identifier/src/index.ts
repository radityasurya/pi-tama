// Codex-style inline skill aliases for Pi.
//
// Minimal by design: no editor replacement, dependencies, or background work.
// This only:
// - completes loaded skill names after `$` using Pi's native autocomplete
// - colors known `$skill-name` tokens in the existing Pi editor render output
// - rewrites exactly one known `$skill-name` reference to Pi's native
//   `/skill:name ...` command, so Pi still owns skill loading and slash commands.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  type AutocompleteItem,
  type AutocompleteProvider,
  Editor,
  visibleWidth,
} from "@earendil-works/pi-tui";

const SKILL_ALIAS_RE = /\$([a-z0-9][a-z0-9-]{0,63})\b/g;
const SKILL_AUTOCOMPLETE_RE = /(?:^|[ \t])(\$[a-z0-9-]*)$/;
const SKILL_AUTOCOMPLETE_STOP_RE = /(?:^|[ \t])\$[a-z0-9-]*[ \t]$/;
const MAX_AUTOCOMPLETE_ITEMS = 20;
// Keep the original keys so reloading from the former local extension to this
// package reuses the same process-wide patch and active-skill state.
const EDITOR_PATCH_FLAG = Symbol.for(
  "kg.pi.inlineSkillAliases.editorRenderPatch",
);
const ACTIVE_SKILLS_KEY = Symbol.for(
  "kg.pi.inlineSkillAliases.activeSkillNames",
);
const PURPLE = "\x1b[38;2;251;148;255m";
const FG_RESET = "\x1b[39m";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type PiCommand = ReturnType<ExtensionAPI["getCommands"]>[number];

function skillName(command: PiCommand): string | undefined {
  if (command.source !== "skill") return undefined;
  const name = command.name.startsWith("skill:")
    ? command.name.slice("skill:".length)
    : command.name;
  return name || undefined;
}

// Skill commands are registered as `skill:<name>`; strip the prefix so callers
// get bare skill names. Discovery order, de-duplicated.
export function getSkillNames(pi: ExtensionAPI): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const command of pi.getCommands()) {
    const name = skillName(command);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }

  return names;
}

function skillAutocompleteItems(
  pi: ExtensionAPI,
  query: string,
): AutocompleteItem[] {
  const seen = new Set<string>();
  const items: AutocompleteItem[] = [];

  for (const command of pi.getCommands()) {
    const name = skillName(command);
    if (!name || seen.has(name) || !name.startsWith(query)) continue;

    seen.add(name);
    items.push({
      value: `$${name}`,
      label: `$${name}`,
      ...(command.description ? { description: command.description } : {}),
    });
    if (items.length === MAX_AUTOCOMPLETE_ITEMS) break;
  }

  return items;
}

export function createSkillAutocompleteProvider(
  pi: ExtensionAPI,
  current: AutocompleteProvider,
): AutocompleteProvider {
  return {
    triggerCharacters: ["$"],

    async getSuggestions(lines, cursorLine, cursorCol, options) {
      const beforeCursor = (lines[cursorLine] ?? "").slice(0, cursorCol);
      if ((lines[0] ?? "").trimStart().startsWith("/")) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      // Typing a space finishes the alias and closes our suggestions. Forced
      // completion later still delegates to Pi's native provider.
      if (!options.force && SKILL_AUTOCOMPLETE_STOP_RE.test(beforeCursor)) {
        return null;
      }

      const prefix = beforeCursor.match(SKILL_AUTOCOMPLETE_RE)?.[1];
      if (!prefix) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      const items = skillAutocompleteItems(pi, prefix.slice(1));
      if (items.length === 0) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      return { prefix, items };
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return current.applyCompletion(
        lines,
        cursorLine,
        cursorCol,
        item,
        prefix,
      );
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      return (
        current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ??
        true
      );
    },
  };
}

export function referencedSkills(
  text: string,
  knownSkillNames: ReadonlySet<string>,
): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(SKILL_ALIAS_RE)) {
    const name = match[1];
    if (name && knownSkillNames.has(name) && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

export function colorizeSkillAliases(
  line: string,
  skillNames: string[],
): string {
  if (skillNames.length === 0 || !line.includes("$")) return line;

  // Longest-first so a shorter skill that prefixes a longer one (for example,
  // `review` vs `review-my`) cannot leave the suffix uncolored.
  const alternatives = [...skillNames]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join("|");
  const pattern = new RegExp(`\\$(${alternatives})\\b`, "g");
  const colored = line.replace(
    pattern,
    (match) => `${PURPLE}${match}${FG_RESET}`,
  );
  return visibleWidth(colored) === visibleWidth(line) ? colored : line;
}

function activeSkills(): Set<string> {
  return (
    ((globalThis as Record<symbol, unknown>)[ACTIVE_SKILLS_KEY] as
      | Set<string>
      | undefined) ?? new Set()
  );
}

function installEditorRenderPatch(): void {
  const prototype = Editor.prototype as Editor & Record<symbol, unknown>;
  if (prototype[EDITOR_PATCH_FLAG]) return;

  const originalRender = prototype.render;
  prototype.render = function renderWithInlineSkillIdentifiers(
    width: number,
  ): string[] {
    const lines = originalRender.call(this, width);
    return lines.map((line) =>
      colorizeSkillAliases(line, Array.from(activeSkills())),
    );
  };

  Object.defineProperty(prototype, EDITOR_PATCH_FLAG, { value: true });
}

export default function inlineSkillIdentifier(pi: ExtensionAPI): void {
  installEditorRenderPatch();

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    (globalThis as Record<symbol, unknown>)[ACTIVE_SKILLS_KEY] = new Set(
      getSkillNames(pi),
    );
    ctx.ui.addAutocompleteProvider((current) =>
      createSkillAutocompleteProvider(pi, current),
    );
  });

  pi.on("input", (event) => {
    if (event.source === "extension") return { action: "continue" };
    if (!event.text.includes("$")) return { action: "continue" };

    // Never touch slash commands. This keeps /model, /settings, /skill:*, etc.
    // entirely native.
    if (event.text.trimStart().startsWith("/")) {
      return { action: "continue" };
    }

    const names = referencedSkills(event.text, new Set(getSkillNames(pi)));

    // Keep the layer intentionally narrow. Multiple skills can be handled later,
    // but only if Pi exposes a native composition path.
    if (names.length !== 1) return { action: "continue" };

    return { action: "transform", text: `/skill:${names[0]} ${event.text}` };
  });
}
