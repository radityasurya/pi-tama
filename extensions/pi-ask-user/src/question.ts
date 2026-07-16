/**
 * Pure state machine for the ask-user popup.
 *
 * Keeps the keyboard/input logic testable without the TUI: `handleKey` returns
 * the next state plus an optional outcome. The TUI component in `index.ts`
 * drives this and renders from `state`.
 */

export interface AskUserOption {
  readonly label: string;
  readonly description?: string;
}

export type AskUserResult = {
  answer: string;
  wasCustom: boolean;
  index?: number;
} | null;

export interface AskUserState {
  readonly question: string;
  readonly options: ReadonlyArray<AskUserOption>;
  /** Index of the highlighted option. The last entry is always "write my own". */
  readonly selectedIndex: number;
  readonly editMode: boolean;
  /** Current free-form answer text (only meaningful in edit mode). */
  readonly draft: string;
}

export const OTHER_LABEL = "Write my own answer…";

export function createAskUserState(
  question: string,
  options: ReadonlyArray<AskUserOption>,
): AskUserState {
  const all = [...options, { label: OTHER_LABEL }];
  return {
    question,
    options: all,
    selectedIndex: 0,
    editMode: false,
    draft: "",
  };
}

/** Total option count including the appended "write my own" entry. */
export function optionCount(state: AskUserState): number {
  return state.options.length;
}

export interface KeyOutcome {
  readonly state: AskUserState;
  readonly result?: AskUserResult;
  /** A textual key the editor should consume (free-form typing in edit mode). */
  readonly feedEditor?: boolean;
}

const DIGITS = "123456789";

/**
 * Advance the state for a logical key event. Returns the new state and an
 * optional terminal result. `feedEditor` signals that the raw key data should
 * be forwarded to the text editor (used only in edit mode for ordinary input,
 * backspace, etc.).
 */
export function handleKey(
  state: AskUserState,
  key:
    | { type: "up" }
    | { type: "down" }
    | { type: "enter" }
    | { type: "escape" }
    | { type: "digit"; value: number }
    | { type: "text"; data: string },
): KeyOutcome {
  if (state.editMode) {
    if (key.type === "escape") {
      return { state: { ...state, editMode: false, draft: "" } };
    }
    if (key.type === "enter") {
      const trimmed = state.draft.trim();
      if (trimmed) {
        return {
          state,
          result: { answer: trimmed, wasCustom: true },
        };
      }
      return { state: { ...state, editMode: false, draft: "" } };
    }
    // Any other key in edit mode is forwarded to the editor.
    return { state, feedEditor: true };
  }

  const count = optionCount(state);
  if (key.type === "up") {
    const index = (state.selectedIndex - 1 + count) % count;
    return { state: { ...state, selectedIndex: index } };
  }
  if (key.type === "down") {
    const index = (state.selectedIndex + 1) % count;
    return { state: { ...state, selectedIndex: index } };
  }
  if (key.type === "escape") {
    return { state, result: null };
  }
  if (key.type === "enter") {
    return selectIndex(state, state.selectedIndex);
  }
  if (key.type === "digit" && key.value >= 1 && key.value <= count) {
    return selectIndex(state, key.value - 1);
  }
  return { state };
}

function selectIndex(state: AskUserState, index: number): KeyOutcome {
  const selected = state.options[index];
  if (!selected) return { state };

  if (selected.label === OTHER_LABEL) {
    return {
      state: { ...state, selectedIndex: index, editMode: true, draft: "" },
    };
  }

  return {
    state,
    result: { answer: selected.label, wasCustom: false, index: index + 1 },
  };
}

export function isDigitKey(data: string): number | undefined {
  if (data.length === 1 && DIGITS.includes(data)) {
    return Number(data);
  }
  return undefined;
}

/**
 * Minimal pure single-line text editor for the free-form answer.
 *
 * Handles printable characters, backspace, left/right movement, home/end, and
 * word-left (ctrl+w / alt+backspace). No TUI dependency, so it is unit tested
 * directly. The component renders it by inserting a cursor marker.
 */
export class LineEdit {
  text = "";
  cursor = 0;

  reset(): void {
    this.text = "";
    this.cursor = 0;
  }

  handle(data: string): void {
    // Bracketed paste: ESC[200~<content>ESC[201~. Pi re-wraps pastes with
    // these markers before reaching us, so without stripping them a paste
    // starts with ESC and is silently dropped by the control-sequence guard
    // below. Collapse newlines (this is a single-line field) and insert.
    if (data.includes("\u001b[200~")) {
      const content = data
        .replace(/\u001b\[200~/g, "")
        .replace(/\u001b\[201~/g, "");
      const cleaned = content.replace(/[\r\n]+/g, " ").trim();
      if (cleaned) this.insert(cleaned);
      return;
    }
    // Escape sequences we recognize.
    if (data === "\u007f" || data === "\b") {
      this.backspace();
      return;
    }
    if (data === "\u001b[D" || data === "\u001bOD") {
      this.cursor = Math.max(0, this.cursor - 1);
      return;
    }
    if (data === "\u001b[C" || data === "\u001bOC") {
      this.cursor = Math.min(this.text.length, this.cursor + 1);
      return;
    }
    if (data === "\u001b[H" || data === "\u001bOH" || data === "\u0001") {
      this.cursor = 0;
      return;
    }
    if (data === "\u001b[F" || data === "\u001bOF" || data === "\u0005") {
      this.cursor = this.text.length;
      return;
    }
    if (data === "\u0017" || data === "\u001b\u007f") {
      this.deleteWordLeft();
      return;
    }
    // CRLF / LF / tab: ignore (Enter is handled by the state machine).
    if (data === "\r" || data === "\n" || data === "\t") return;
    // Any other control sequence: ignore.
    if (data.startsWith("\u001b") || data.startsWith("\u0000")) return;

    this.insert(data);
  }

  private insert(data: string) {
    this.text =
      this.text.slice(0, this.cursor) + data + this.text.slice(this.cursor);
    this.cursor += data.length;
  }

  private backspace() {
    if (this.cursor <= 0) return;
    this.text =
      this.text.slice(0, this.cursor - 1) + this.text.slice(this.cursor);
    this.cursor -= 1;
  }

  private deleteWordLeft() {
    if (this.cursor <= 0) return;
    const left = this.text.slice(0, this.cursor);
    const match = left.match(/(\s*\S+\s*)$/);
    const removed = match ? match[1]!.length : 0;
    this.text =
      this.text.slice(0, this.cursor - removed) + this.text.slice(this.cursor);
    this.cursor = Math.max(0, this.cursor - removed);
  }
}

/** Render a line editor value with a visible cursor at `cursor`. */
export function renderLineEdit(edit: LineEdit): {
  before: string;
  after: string;
} {
  return {
    before: edit.text.slice(0, edit.cursor),
    after: edit.text.slice(edit.cursor),
  };
}
