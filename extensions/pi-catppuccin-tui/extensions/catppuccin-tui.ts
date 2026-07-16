import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  getAgentDir,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const STATUS_ID = "catppuccin-tui";
const STATE_CUSTOM_TYPE = "catppuccin-tui-state";
const STATE_FILE_NAME = "catppuccin-tui-state.json";

const macchiato = {
  mauve: "#c6a0f6",
  blue: "#8aadf4",
  lavender: "#b7bdf8",
  green: "#a6da95",
  peach: "#f5a97f",
  overlay0: "#6e738d",
  overlay1: "#8087a2",
};

type Feature = "indicator" | "status" | "footer";
type Toggle = "on" | "off";
type StatusPhase = "ready" | "working";
type PersistedState = Record<Feature, boolean>;

const state: PersistedState = {
  indicator: false,
  status: false,
  footer: false,
};

let indicatorInstalled = false;
let footerInstalled = false;

function normalizeState(data: unknown): PersistedState | undefined {
  if (!data || typeof data !== "object") return undefined;

  const value = data as Partial<Record<Feature, unknown>>;
  const hasState =
    value.indicator !== undefined ||
    value.status !== undefined ||
    value.footer !== undefined;
  if (!hasState) return undefined;

  return {
    indicator: value.indicator === true,
    status: value.status === true,
    footer: value.footer === true,
  };
}

function getGlobalStatePath(): string {
  return join(getAgentDir(), STATE_FILE_NAME);
}

function readGlobalState(): PersistedState | undefined {
  try {
    return normalizeState(
      JSON.parse(readFileSync(getGlobalStatePath(), "utf8")),
    );
  } catch {
    return undefined;
  }
}

function writeGlobalState(): void {
  try {
    const statePath = getGlobalStatePath();
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  } catch {
    // Session-local persistence still works if global state cannot be written.
  }
}

function fg(hex: string, text: string): string {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

function formatCount(value: number): string {
  if (value < 1000) return `${value}`;
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(1)}m`;
}

function formatModelName(model: string): string {
  return (model.split("/").pop() ?? model).replace(/-\d{8}$/, "");
}

function footerFits(width: number, left: string, right: string): boolean {
  return visibleWidth(left) + 1 + visibleWidth(right) <= width;
}

function formatFooterLine(width: number, left: string, right: string): string {
  const padWidth = Math.max(
    1,
    width - visibleWidth(left) - visibleWidth(right),
  );
  return truncateToWidth(`${left}${" ".repeat(padWidth)}${right}`, width, "");
}

function getUsage(ctx: ExtensionContext): {
  input: number;
  output: number;
  cost: number;
} {
  let input = 0;
  let output = 0;
  let cost = 0;

  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "message") continue;
    const message = entry.message as {
      role?: string;
      usage?: { input?: number; output?: number; cost?: { total?: number } };
    };
    if (message.role !== "assistant" || !message.usage) continue;

    input += message.usage.input ?? 0;
    output += message.usage.output ?? 0;
    cost += message.usage.cost?.total ?? 0;
  }

  return { input, output, cost };
}

function applyIndicator(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;

  if (!state.indicator) {
    if (indicatorInstalled) {
      ctx.ui.setWorkingIndicator();
      indicatorInstalled = false;
    }
    return;
  }

  ctx.ui.setWorkingIndicator({
    frames: [
      fg(macchiato.overlay1, "·"),
      fg(macchiato.overlay0, "•"),
      fg(macchiato.blue, "●"),
      fg(macchiato.mauve, "●"),
      fg(macchiato.lavender, "•"),
      fg(macchiato.overlay0, "·"),
    ],
    intervalMs: 120,
  });
  indicatorInstalled = true;
}

function applyStatus(
  ctx: ExtensionContext,
  phase: StatusPhase = "ready",
): void {
  if (!ctx.hasUI) return;

  if (!state.status) {
    ctx.ui.setStatus(STATUS_ID, undefined);
    return;
  }

  const icon =
    phase === "working" ? fg(macchiato.mauve, "⋯") : fg(macchiato.green, "✓");
  const label =
    phase === "working"
      ? fg(macchiato.mauve, "working")
      : fg(macchiato.green, "ready");
  const model = ctx.model?.id ?? "no model";
  ctx.ui.setStatus(
    STATUS_ID,
    `${icon} ${label} ${fg(macchiato.overlay0, "·")} ${fg(macchiato.blue, model)}`,
  );
}

function applyFooter(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;

  if (!state.footer) {
    if (footerInstalled) {
      ctx.ui.setFooter(undefined);
      footerInstalled = false;
    }
    return;
  }

  ctx.ui.setFooter((tui, _theme, footerData) => {
    const unsubscribe = footerData.onBranchChange(() => tui.requestRender());

    return {
      dispose: unsubscribe,
      invalidate() {},
      render(width: number): string[] {
        if (width <= 0) return [""];

        const usage = getUsage(ctx);
        const branch = footerData.getGitBranch();
        const model = formatModelName(ctx.model?.id ?? "no model");
        const branchName = branch ?? "no git";
        const compactStats = [
          fg(macchiato.blue, `↑${formatCount(usage.input)}`),
          fg(macchiato.lavender, `↓${formatCount(usage.output)}`),
          fg(macchiato.peach, `$${usage.cost.toFixed(3)}`),
        ].join(" ");

        const fullLeft = [
          fg(macchiato.mauve, "◆"),
          fg(macchiato.blue, model),
          fg(macchiato.overlay0, "•"),
          fg(macchiato.green, branch ? `git ${branchName}` : branchName),
        ].join(" ");
        const fullRight = [
          fg(macchiato.blue, `in ${formatCount(usage.input)}`),
          fg(macchiato.lavender, `out ${formatCount(usage.output)}`),
          fg(macchiato.peach, `cost $${usage.cost.toFixed(3)}`),
        ].join("  ");

        if (footerFits(width, fullLeft, fullRight)) {
          return [formatFooterLine(width, fullLeft, fullRight)];
        }

        const compactLeft = [
          fg(macchiato.mauve, "◆"),
          fg(macchiato.blue, model),
          fg(macchiato.overlay0, "•"),
          fg(macchiato.green, branchName),
        ].join(" ");
        if (footerFits(width, compactLeft, compactStats)) {
          return [formatFooterLine(width, compactLeft, compactStats)];
        }

        return [
          truncateToWidth(
            [
              fg(macchiato.mauve, "◆"),
              fg(macchiato.blue, model),
              compactStats,
            ].join(" "),
            width,
            "",
          ),
        ];
      },
    };
  });
  footerInstalled = true;
}

function applyAll(ctx: ExtensionContext): void {
  applyIndicator(ctx);
  applyStatus(ctx);
  applyFooter(ctx);
}

function readPersistedState(ctx: ExtensionContext): PersistedState | undefined {
  let savedState: PersistedState | undefined;

  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "custom" || entry.customType !== STATE_CUSTOM_TYPE)
      continue;
    const data = normalizeState(entry.data);
    if (!data) continue;

    savedState = data;
  }

  return savedState;
}

function persistState(pi: ExtensionAPI): void {
  writeGlobalState();
  pi.appendEntry<PersistedState>(STATE_CUSTOM_TYPE, { ...state });
}

function restoreState(ctx: ExtensionContext): void {
  const savedState = readPersistedState(ctx) ?? readGlobalState();
  state.indicator = savedState?.indicator ?? false;
  state.status = savedState?.status ?? false;
  state.footer = savedState?.footer ?? false;
  applyAll(ctx);
}

function setFeature(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  feature: Feature,
  toggle: Toggle,
  shouldPersist = true,
): void {
  state[feature] = toggle === "on";

  if (feature === "indicator") applyIndicator(ctx);
  if (feature === "status") applyStatus(ctx);
  if (feature === "footer") applyFooter(ctx);
  if (shouldPersist) persistState(pi);
}

function statusLine(): string {
  return `indicator=${state.indicator ? "on" : "off"}, status=${state.status ? "on" : "off"}, footer=${state.footer ? "on" : "off"}`;
}

function reset(pi: ExtensionAPI, ctx: ExtensionContext): void {
  state.indicator = false;
  state.status = false;
  state.footer = false;
  applyAll(ctx);
  persistState(pi);
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("catppuccin-tui", {
    description:
      "Toggle optional Catppuccin TUI polish: indicator, status, and compact footer.",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;

      const parts = args.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const [feature, toggle] = parts;

      if (!feature) {
        ctx.ui.notify(
          `Catppuccin TUI: ${statusLine()}. Usage: /catppuccin-tui [indicator|status|footer|all] [on|off], or /catppuccin-tui reset`,
          "info",
        );
        return;
      }

      if (feature === "reset") {
        reset(pi, ctx);
        ctx.ui.notify("Catppuccin TUI enhancements reset", "info");
        return;
      }

      if (toggle !== "on" && toggle !== "off") {
        ctx.ui.notify(
          "Usage: /catppuccin-tui [indicator|status|footer|all] [on|off]",
          "error",
        );
        return;
      }

      if (feature === "all") {
        setFeature(pi, ctx, "indicator", toggle, false);
        setFeature(pi, ctx, "status", toggle, false);
        setFeature(pi, ctx, "footer", toggle, false);
        persistState(pi);
        ctx.ui.notify(`Catppuccin TUI enhancements ${toggle}`, "info");
        return;
      }

      if (
        feature !== "indicator" &&
        feature !== "status" &&
        feature !== "footer"
      ) {
        ctx.ui.notify(
          "Unknown Catppuccin TUI feature. Use indicator, status, footer, all, or reset.",
          "error",
        );
        return;
      }

      setFeature(pi, ctx, feature, toggle);
      ctx.ui.notify(`Catppuccin TUI ${feature} ${toggle}`, "info");
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    restoreState(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    restoreState(ctx);
  });

  pi.on("turn_start", async (_event, ctx) => {
    applyStatus(ctx, "working");
  });

  pi.on("turn_end", async (_event, ctx) => {
    applyStatus(ctx, "ready");
  });

  pi.on("model_select", async (_event, ctx) => {
    applyStatus(ctx);
  });

  pi.on("thinking_level_select", async (_event, ctx) => {
    applyStatus(ctx);
  });
}
