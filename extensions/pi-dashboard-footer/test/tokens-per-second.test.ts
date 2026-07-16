import { describe, expect, test } from "vitest";
import { TokensPerSecondEstimator } from "../src/tokens-per-second.ts";

describe("TokensPerSecondEstimator", () => {
  test("returns null before enough deltas", () => {
    const e = new TokensPerSecondEstimator();
    e.resetRun();
    e.resetMessage();
    expect(e.recordDelta("hello", 0)).toBeNull();
  });

  test("publishes a live estimate after two deltas", () => {
    const e = new TokensPerSecondEstimator();
    e.resetRun();
    e.resetMessage();
    e.recordDelta("first chunk".repeat(20), 0);
    const live = e.recordDelta("more text streaming in", 500);
    expect(live).not.toBeNull();
    expect(live!).toBeGreaterThan(0);
  });

  test("finalizeMessage merges into the run total", () => {
    const e = new TokensPerSecondEstimator();
    e.resetRun();
    e.resetMessage();
    e.recordDelta("first chunk".repeat(20), 0);
    e.recordDelta("more text streaming in", 500);
    const finalized = e.finalizeMessage(0, 600);

    expect(finalized).not.toBeNull();
    expect(e.tokensPerSecond).toBe(finalized);
  });

  test("a single delta message does not produce a rate", () => {
    const e = new TokensPerSecondEstimator();
    e.resetRun();
    e.resetMessage();
    e.recordDelta("only one delta here", 0);
    const finalized = e.finalizeMessage(0, 10);
    expect(finalized).toBeNull();
    expect(e.tokensPerSecond).toBeNull();
  });

  test("resetRun clears the accumulated total", () => {
    const e = new TokensPerSecondEstimator();
    e.resetRun();
    e.resetMessage();
    e.recordDelta("first chunk".repeat(20), 0);
    e.recordDelta("more text streaming in", 500);
    e.finalizeMessage(0, 600);
    expect(e.tokensPerSecond).not.toBeNull();

    e.resetRun();
    expect(e.tokensPerSecond).toBeNull();
  });
});
