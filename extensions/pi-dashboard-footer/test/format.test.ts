import { describe, expect, test } from "vitest";
import {
  columns,
  formatContext,
  formatCost,
  formatDirectory,
  formatGit,
  formatTokens,
  formatTokensPerSecond,
  stripAnsi,
  truncate,
  type DashboardState,
} from "../src/format.ts";

const base: DashboardState = {
  directory: "/x",
  model: "openai-codex/gpt-5.5",
  thinking: "high",
  contextPercent: 42,
  contextWindow: 272_000,
  cost: 0.13,
  tokensPerSecond: 87,
  gitBranch: "main",
  changedFiles: 3,
};

describe("formatTokens", () => {
  test.each([
    [0, "0"],
    [999, "999"],
    [1_000, "1k"],
    [272_000, "272k"],
    [1_000_000, "1.0m"],
    [2_500_000, "2.5m"],
  ])("%s -> %s", (input, expected) => {
    expect(formatTokens(input)).toBe(expected);
  });
});

describe("formatDirectory", () => {
  const home = "/home/tama";
  test("collapses the home prefix to ~", () => {
    expect(formatDirectory("/home/tama/projects/x", home)).toBe("~/projects/x");
  });

  test("home itself becomes ~", () => {
    expect(formatDirectory(home, home)).toBe("~");
  });

  test("leaves unrelated paths untouched", () => {
    expect(formatDirectory("/etc", home)).toBe("/etc");
  });
});

describe("context/cost/tokps/git formatting", () => {
  test("formatContext with known percent and window", () => {
    expect(formatContext(base)).toBe("42%/272k");
  });

  test("formatContext with null percent shows ?", () => {
    expect(formatContext({ ...base, contextPercent: null })).toBe("?%/272k");
  });

  test("formatContext with unknown window shows ?", () => {
    expect(formatContext({ ...base, contextWindow: 0 })).toBe("42%/?");
  });

  test("formatCost", () => {
    expect(formatCost(0)).toBe("$0.00");
    expect(formatCost(0.1)).toBe("$0.10");
    expect(formatCost(12.345)).toBe("$12.35");
  });

  test("formatTokensPerSecond", () => {
    expect(formatTokensPerSecond(null)).toBe("— tok/s");
    expect(formatTokensPerSecond(87)).toBe("87 tok/s");
  });

  test("formatGit omits everything without a branch", () => {
    expect(formatGit({ ...base, gitBranch: null })).toBe("");
  });

  test("formatGit pluralizes files", () => {
    expect(formatGit({ ...base, changedFiles: 1 })).toBe(
      "main · 1 file changed",
    );
    expect(formatGit(base)).toBe("main · 3 files changed");
  });
});

describe("columns", () => {
  test("pads the gap when there is room", () => {
    expect(columns("a", "b", 5)).toBe("a   b");
  });

  test("returns left as-is when right is empty", () => {
    expect(columns("hello", "", 3)).toBe("he…");
  });

  test("truncates both sides when they do not fit", () => {
    const line = columns("a very long left side", "right", 10);
    expect(line.length).toBeLessThanOrEqual(10);
    expect(stripAnsi(line)).toHaveLength(10);
  });
});

describe("truncate", () => {
  test("keeps short strings unchanged", () => {
    expect(truncate("hi", 10)).toBe("hi");
  });

  test("truncates with an ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello w…");
  });

  test("handles width <= ellipsis length", () => {
    expect(truncate("hello", 1)).toBe("…");
    expect(truncate("hello", 0)).toBe("");
  });
});
