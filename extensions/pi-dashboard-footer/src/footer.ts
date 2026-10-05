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
 * Footer component for the dashboard. Renders two data lines; extension
 * status badges registered via `ctx.ui.setStatus` are joined onto the second
 * line's right side so the footer stays two rows total.
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

    // All badges on one line, right of the git info. `columns` truncates both
    // sides if the terminal is too narrow, so no third footer row appears.
    const badges = [...statuses.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([, text]) => text.split("\n"))
      .filter((line) => line.trim().length > 0)
      .join("  ");
    const right = [theme.fg("muted", formatGit(state)), badges].filter(Boolean).join("  ");

    return [
      columns(directory, model, width),
      columns(usage, right, width),
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
