/**
 * Pure formatting helpers for the dashboard footer.
 *
 * Kept dependency-free and side-effect-free so they can be unit tested in
 * isolation from the TUI and git plumbing.
 */

export interface DashboardState {
  readonly directory: string;
  readonly model: string;
  readonly thinking: string;
  readonly contextPercent: number | null;
  readonly contextWindow: number;
  readonly cost: number;
  readonly tokensPerSecond: number | null;
  readonly gitBranch: string | null;
  readonly changedFiles: number;
}

export function formatTokens(tokens: number): string {
  if (tokens < 1_000) return `${tokens}`;
  if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}k`;
  return `${(tokens / 1_000_000).toFixed(1)}m`;
}

export function formatDirectory(cwd: string, home: string): string {
  if (cwd === home) return "~";
  if (cwd.startsWith(`${home}/`)) return `~/${cwd.slice(home.length + 1)}`;
  return cwd;
}

export function formatContext(state: DashboardState): string {
  const percent =
    state.contextPercent === null ? "?" : `${Math.round(state.contextPercent)}`;
  const window =
    state.contextWindow > 0 ? formatTokens(state.contextWindow) : "?";
  return `${percent}%/${window}`;
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export function formatTokensPerSecond(value: number | null): string {
  return value === null ? "— tok/s" : `${Math.round(value)} tok/s`;
}

export function formatGit(state: DashboardState): string {
  if (!state.gitBranch) return "";
  const fileLabel = state.changedFiles === 1 ? "file" : "files";
  return `${state.gitBranch} · ${state.changedFiles} ${fileLabel} changed`;
}

/** Join a left and right string into one terminal line of `width` columns. */
export function columns(left: string, right: string, width: number): string {
  if (!right) return truncate(left, width);

  const leftVisible = visibleWidth(left);
  const rightVisible = visibleWidth(right);
  const gap = width - leftVisible - rightVisible;
  if (gap >= 1) return `${left}${" ".repeat(gap)}${right}`;

  // Not enough room: split the width ~45/55 and truncate both sides.
  const leftWidth = Math.max(1, Math.floor(width * 0.45));
  const rightWidth = Math.max(1, width - leftWidth - 1);
  const fittedLeft = truncate(left, leftWidth);
  const fittedRight = truncate(right, rightWidth);
  const fittedGap = Math.max(
    1,
    width - visibleWidth(fittedLeft) - visibleWidth(fittedRight),
  );
  return `${fittedLeft}${" ".repeat(fittedGap)}${fittedRight}`;
}

/** Visible (printable) width of a string that may contain ANSI escapes. */
const ANSI_PATTERN =
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})?)?[\dA-PR-TZcf-nq-uy=><~]))/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

export function visibleWidth(text: string): number {
  return stripAnsi(text).length;
}

export function truncate(text: string, width: number, ellipsis = "…"): string {
  const stripped = stripAnsi(text);
  if (stripped.length <= width) return text;
  if (width <= 0) return "";
  if (width <= ellipsis.length) return ellipsis.slice(0, width);
  return `${stripped.slice(0, width - ellipsis.length)}${ellipsis}`;
}
