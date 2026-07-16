/**
 * Streaming tokens-per-second estimator.
 *
 * Tracks assistant text/thinking deltas within a single assistant message and
 * estimates a smoothed tok/s across the whole agent run. The estimator ignores
 * the first delta (which may arrive as a large initial chunk) and requires at
 * least two deltas over >=50ms before reporting a rate.
 */

const CHARS_PER_TOKEN = 4;
const MIN_DELTAS = 2;
const MIN_STREAM_MS = 50;
const LIVE_THROTTLE_MS = 200;

interface RunAccumulator {
  chars: number;
  firstDeltaChars: number;
  deltaCount: number;
  startMs: number | null;
  lastMs: number;
  messageChars: number;
  messageStartMs: number | null;
  messageLastMs: number | null;
  messageActive: boolean;
}

function emptyRun(): RunAccumulator {
  return {
    chars: 0,
    firstDeltaChars: 0,
    deltaCount: 0,
    startMs: null,
    lastMs: 0,
    messageChars: 0,
    messageStartMs: null,
    messageLastMs: null,
    messageActive: false,
  };
}

export class TokensPerSecondEstimator {
  private run = emptyRun();
  private lastLivePublish = 0;
  private reportedTokensPerSecond: number | null = null;

  /** Begin a new agent run; previous run totals are discarded. */
  resetRun(): void {
    this.run = emptyRun();
    this.reportedTokensPerSecond = null;
  }

  /** Begin a new assistant message within the current run. */
  resetMessage(): void {
    this.run.messageChars = 0;
    this.run.messageStartMs = null;
    this.run.messageLastMs = null;
    this.run.firstDeltaChars = 0;
    this.run.deltaCount = 0;
    this.run.messageActive = false;
  }

  /** Record a content delta. Returns a live tok/s when it is worth publishing. */
  recordDelta(delta: string, now = Date.now()): number | null {
    if (!delta) return null;

    if (!this.run.messageActive) {
      this.run.messageActive = true;
      this.run.messageStartMs = now;
      this.run.firstDeltaChars = delta.length;
    }
    this.run.messageLastMs = now;
    this.run.messageChars += delta.length;
    this.run.deltaCount += 1;

    if (this.run.deltaCount < MIN_DELTAS) return null;
    if (now - this.lastLivePublish < LIVE_THROTTLE_MS) return null;

    const start = this.run.messageStartMs ?? now;
    const elapsed = now - start;
    const streamed = this.run.messageChars - this.run.firstDeltaChars;
    if (elapsed <= 0 || streamed <= 0) return null;

    this.lastLivePublish = now;
    return Math.round(streamed / CHARS_PER_TOKEN / (elapsed / 1000));
  }

  /**
   * Finalize the current message. Merges its measured tokens/duration into the
   * run accumulator and returns the updated run-wide tok/s.
   */
  finalizeMessage(outputTokens: number, now = Date.now()): number | null {
    const {
      messageActive,
      messageChars,
      messageStartMs,
      messageLastMs,
      deltaCount,
    } = this.run;
    if (
      !messageActive ||
      messageStartMs === null ||
      messageChars <= 0 ||
      deltaCount < MIN_DELTAS
    ) {
      return this.reportedTokensPerSecond;
    }

    const last = messageLastMs ?? now;
    const streamMs = last - messageStartMs;
    if (streamMs < MIN_STREAM_MS) return this.reportedTokensPerSecond;

    const firstDeltaTokens = Math.ceil(
      this.run.firstDeltaChars / CHARS_PER_TOKEN,
    );
    const streamedTokens =
      outputTokens > 0
        ? Math.max(0, outputTokens - firstDeltaTokens)
        : Math.max(
            0,
            Math.ceil(messageChars / CHARS_PER_TOKEN) - firstDeltaTokens,
          );
    if (streamedTokens <= 0) return this.reportedTokensPerSecond;

    this.run.chars += streamedTokens;
    if (this.run.startMs === null) this.run.startMs = messageStartMs;
    this.run.lastMs = last;

    const runStart = this.run.startMs ?? last;
    const runMs = this.run.lastMs - runStart;
    if (runMs <= 0) return this.reportedTokensPerSecond;

    this.reportedTokensPerSecond = this.run.chars / (runMs / 1000);
    return this.reportedTokensPerSecond;
  }

  get tokensPerSecond(): number | null {
    return this.reportedTokensPerSecond;
  }
}

export const ESTIMATOR_CONSTANTS = {
  CHARS_PER_TOKEN,
  MIN_DELTAS,
  MIN_STREAM_MS,
  LIVE_THROTTLE_MS,
};
