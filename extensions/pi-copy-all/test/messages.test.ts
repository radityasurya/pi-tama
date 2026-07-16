import { describe, expect, test } from "vitest";
import {
  collectCopySections,
  formatCopyPayload,
  SECTION_SEPARATOR,
  type SessionBranch,
} from "../src/messages.ts";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

function message(role: string, content: unknown): SessionEntry {
  return {
    type: "message",
    id: "id",
    parentId: null,
    timestamp: "",
    message: { role, content },
  } as unknown as SessionEntry;
}

const nonMessageEntry = {
  type: "compaction",
  id: "id",
  parentId: null,
  timestamp: "",
} as SessionEntry;

describe("collectCopySections", () => {
  test("keeps user and assistant text, preserving order", () => {
    const branch: SessionBranch = [
      message("user", "hello"),
      message("assistant", "hi there"),
      message("user", "again"),
    ];

    expect(collectCopySections(branch)).toEqual([
      { role: "USER", text: "hello" },
      { role: "ASSISTANT", text: "hi there" },
      { role: "USER", text: "again" },
    ]);
  });

  test("flattens content block arrays and marks images and thinking", () => {
    const branch: SessionBranch = [
      message("assistant", [
        { type: "text", text: "part one" },
        {
          type: "image",
          source: { type: "base64", mediaType: "image/png", data: "x" },
        },
        { type: "thinking", text: "secret" },
        { type: "text", text: "part two" },
      ]),
    ];

    expect(collectCopySections(branch)).toEqual([
      {
        role: "ASSISTANT",
        text: "part one\n[image]\n[thinking]\npart two",
      },
    ]);
  });

  test("drops non-message entries, other roles, and empty text", () => {
    const branch: SessionBranch = [
      nonMessageEntry,
      message("toolResult", [{ type: "text", text: "ignored" }]),
      message("user", "   "),
      message("assistant", ""),
      message("user", "kept"),
    ];

    expect(collectCopySections(branch)).toEqual([
      { role: "USER", text: "kept" },
    ]);
  });
});

describe("formatCopyPayload", () => {
  test("joins sections with role headers and the separator", () => {
    const payload = formatCopyPayload([
      { role: "USER", text: "hello" },
      { role: "ASSISTANT", text: "hi" },
    ]);

    expect(payload).toBe(`USER:\nhello${SECTION_SEPARATOR}ASSISTANT:\nhi`);
  });

  test("returns an empty string for no sections", () => {
    expect(formatCopyPayload([])).toBe("");
  });
});
