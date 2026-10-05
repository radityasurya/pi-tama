import type { Theme } from "@earendil-works/pi-coding-agent";
import type { DashboardState } from "./format.ts";
import {
  columns,
  formatContext,
  formatCost,
  formatDirectory,
  formatGit,
  formatTokensPerSecond,
} from "./format.ts";

export type ExtensionStatuses = ReadonlyMap<string, string>;

export interface FooterSnapshot {
  readonly state: DashboardState;
  readonly cwd: string;
  readonly home: string;
  readonly theme: Theme;
  readonly statuses: ExtensionStatuses;
}

/**
 * Footer component for the dashboard. Renders two data lines plus a third
 * status line: all extension badges joined and right-aligned.
 */
export class DashboardFooter {
  constructor(private readonly snapshot: () => FooterSnapshot) {}

  render(width: number): string[] {
    const { state, cwd, home, theme, statuses } = this.snapshot();

    const directory = theme.fg("text", formatDirectory(cwd, home));
    const model = state.model
      ? theme.fg("muted", `${state.model} · ${state.thinking}`)
      : theme.fg("muted", "no-model");
    const usage = theme.fg(
      "muted",
      `${formatContext(state)} · ${formatCost(state.cost)} · ${formatTokensPerSecond(state.tokensPerSecond)}`,
    );

    // Third line: activity badges (agents, ADHD, …) on the left, mode badges
    // (ponytail) on the right.
    const RIGHT_SIDE_STATUSES = new Set(["ponytail"]);
    const entries = [...statuses.entries()].sort(([a], [b]) => a.localeCompare(b));
    const badgeLine = (keys: "left" | "right") =>
      entries
        .filter(([key]) => (keys === "right") === RIGHT_SIDE_STATUSES.has(key))
        .flatMap(([, text]) => text.split("\n"))
        .filter((line) => line.trim().length > 0)
        .join("  ");

    const lines = [
      columns(directory, model, width),
      columns(usage, theme.fg("muted", formatGit(state)), width),
    ];
    const leftBadges = badgeLine("left");
    const rightBadges = badgeLine("right");
    if (leftBadges || rightBadges) lines.push(columns(leftBadges, rightBadges, width));
    return lines;
  }

  invalidate(): void {
    // Stateless render: nothing to invalidate.
  }
}

/**
 * Hold the mutable dashboard state for the active session.
 */
export class DashboardStateStore {
  state: DashboardState;

  constructor(initial: DashboardState) {
    this.state = initial;
  }

  update(patch: Partial<DashboardState>): DashboardState {
    this.state = { ...this.state, ...patch };
    return this.state;
  }
}
