import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncate } from "./format.ts";
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
 * Footer component for the dashboard. Renders two data lines plus one line per
 * extension status registered via `ctx.ui.setStatus`. Implements pi's
 * structural `Component` interface (`render` + `invalidate`).
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
    const git = formatGit(state);

    const lines = [
      columns(directory, model, width),
      columns(usage, theme.fg("muted", git), width),
    ];

    const statusLines = [...statuses.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([, text]) => text.split("\n"));
    for (const statusLine of statusLines) {
      lines.push(truncate(statusLine, width, theme.fg("dim", "…")));
    }

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
