import { describe, expect, test } from "vitest";
import {
  createAskUserState,
  handleKey,
  isDigitKey,
  LineEdit,
  optionCount,
} from "../src/question.ts";

const options = [{ label: "Red" }, { label: "Green" }, { label: "Blue" }];

describe("createAskUserState", () => {
  test("appends the write-my-own option", () => {
    const state = createAskUserState("Pick a color", options);
    expect(optionCount(state)).toBe(4);
    expect(state.options[3]!.label).toBe("Write my own answer…");
    expect(state.selectedIndex).toBe(0);
    expect(state.editMode).toBe(false);
  });
});

describe("handleKey navigation", () => {
  test("down wraps around", () => {
    let state = createAskUserState("q", options);
    state = handleKey(state, { type: "down" }).state;
    expect(state.selectedIndex).toBe(1);
    state = handleKey(state, { type: "down" }).state;
    state = handleKey(state, { type: "down" }).state;
    state = handleKey(state, { type: "down" }).state;
    expect(state.selectedIndex).toBe(0);
  });

  test("up wraps around", () => {
    let state = createAskUserState("q", options);
    state = handleKey(state, { type: "up" }).state;
    expect(state.selectedIndex).toBe(optionCount(state) - 1);
  });

  test("digit keys jump straight to an option", () => {
    const state = createAskUserState("q", options);
    const out = handleKey(state, { type: "digit", value: 2 });
    expect(out.result).toEqual({
      answer: "Green",
      wasCustom: false,
      index: 2,
    });
  });

  test("enter on a normal option selects it", () => {
    let state = createAskUserState("q", options);
    state = handleKey(state, { type: "down" }).state;
    const out = handleKey(state, { type: "enter" });
    expect(out.result).toEqual({
      answer: "Green",
      wasCustom: false,
      index: 2,
    });
  });

  test("escape dismisses (returns null result)", () => {
    const state = createAskUserState("q", options);
    const out = handleKey(state, { type: "escape" });
    expect(out.result).toBeNull();
  });
});

describe("handleKey write-my-own", () => {
  test("enter on the last option enters edit mode", () => {
    let state = createAskUserState("q", options);
    const last = optionCount(state) - 1;
    state = { ...state, selectedIndex: last };
    const out = handleKey(state, { type: "enter" });
    expect(out.state.editMode).toBe(true);
    expect(out.result).toBeUndefined();
  });

  test("escape in edit mode returns to options", () => {
    let state = createAskUserState("q", options);
    state = { ...state, editMode: true, draft: "partial" };
    const out = handleKey(state, { type: "escape" });
    expect(out.state.editMode).toBe(false);
    expect(out.state.draft).toBe("");
    expect(out.result).toBeUndefined();
  });

  test("text keys in edit mode feed the editor without resolving", () => {
    let state = createAskUserState("q", options);
    state = { ...state, editMode: true };
    const out = handleKey(state, { type: "text", data: "h" });
    expect(out.feedEditor).toBe(true);
    expect(out.result).toBeUndefined();
  });
});

describe("isDigitKey", () => {
  test("returns the digit for 1-9 and undefined otherwise", () => {
    expect(isDigitKey("1")).toBe(1);
    expect(isDigitKey("9")).toBe(9);
    expect(isDigitKey("0")).toBeUndefined();
    expect(isDigitKey("a")).toBeUndefined();
    expect(isDigitKey("\u001b[A")).toBeUndefined();
  });
});

describe("LineEdit", () => {
  test("inserts characters and tracks the cursor", () => {
    const edit = new LineEdit();
    edit.handle("h");
    edit.handle("i");
    expect(edit.text).toBe("hi");
    expect(edit.cursor).toBe(2);
  });

  test("backspace deletes the previous char", () => {
    const edit = new LineEdit();
    edit.handle("hi");
    edit.handle("\u007f");
    expect(edit.text).toBe("h");
    expect(edit.cursor).toBe(1);
  });

  test("left/right/home/end move the cursor", () => {
    const edit = new LineEdit();
    edit.handle("abc");
    edit.handle("\u001b[D"); // left
    expect(edit.cursor).toBe(2);
    edit.handle("\u0001"); // home
    expect(edit.cursor).toBe(0);
    edit.handle("\u001b[C"); // right
    expect(edit.cursor).toBe(1);
    edit.handle("\u0005"); // end
    expect(edit.cursor).toBe(3);
  });

  test("ctrl+w deletes a word left", () => {
    const edit = new LineEdit();
    edit.handle("hello world");
    edit.handle("\u0017");
    expect(edit.text).toBe("hello");
    expect(edit.cursor).toBe(5);
  });

  test("ignores escape sequences and newlines", () => {
    const edit = new LineEdit();
    edit.handle("a");
    edit.handle("\u001b[3;~");
    edit.handle("\n");
    expect(edit.text).toBe("a");
  });

  test("reset clears text and cursor", () => {
    const edit = new LineEdit();
    edit.handle("abc");
    edit.reset();
    expect(edit.text).toBe("");
    expect(edit.cursor).toBe(0);
  });
});
