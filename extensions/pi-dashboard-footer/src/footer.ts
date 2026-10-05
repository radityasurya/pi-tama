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

    // Third line: every badge on one line, flush right.
    const badges = [...statuses.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([, text]) => text.split("\n"))
      .filter((line) => line.trim().length > 0)
      .join("  ");

    const lines = [
      columns(directory, model, width),
      columns(usage, theme.fg("muted", formatGit(state)), width),
    ];
    if (badges) lines.push(columns("", badges, width));
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
