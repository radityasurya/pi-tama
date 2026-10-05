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

    // Line 2: every badge (agents, ADHD, ponytail, …) leads the left side,
    // usage follows, git stays right. Two footer lines total.
    const badges = [...statuses.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([, text]) => text.split("\n"))
      .filter((line) => line.trim().length > 0)
      .join("  ");
    const left2 = [badges, usage].filter(Boolean).join("  ");
    return [
      columns(directory, model, width),
      columns(left2, theme.fg("muted", formatGit(state)), width),
    ];
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
