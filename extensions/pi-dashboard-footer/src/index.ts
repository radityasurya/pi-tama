import { homedir } from "node:os";
import type {
  ExtensionAPI,
  ExtensionContext,
  ReadonlyFooterDataProvider,
} from "@earendil-works/pi-coding-agent";
import { DashboardFooter, DashboardStateStore } from "./footer.ts";
import type { DashboardState } from "./format.ts";
import { readGitStatus, type GitRunner } from "./git.ts";
import { TokensPerSecondEstimator } from "./tokens-per-second.ts";

const HOME = homedir();
const GIT_POLL_INTERVAL_MS = 3_000;
const GIT_TIMEOUT_MS = 3_000;

function emptyState(cwd: string): DashboardState {
  return {
    directory: cwd,
    model: "",
    thinking: "off",
    contextPercent: null,
    contextWindow: 0,
    cost: 0,
    tokensPerSecond: null,
    gitBranch: null,
    changedFiles: 0,
  };
}

function modelLabel(model: ExtensionContext["model"]): string {
  if (!model) return "";
  return model.name ? `${model.provider}/${model.id}` : model.id;
}

function sessionCost(ctx: ExtensionContext): number {
  let cost = 0;
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "message") continue;
    const message = entry.message;
    if (message && message.role === "assistant") {
      cost += message.usage?.cost?.total ?? 0;
    }
  }
  return cost;
}

export default function piDashboardFooter(pi: ExtensionAPI): void {
  let store = new DashboardStateStore(emptyState(""));
  let requestRender: (() => void) | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let generation = 0;
  const estimator = new TokensPerSecondEstimator();
  let runner: GitRunner | undefined;

  function refresh(ctx: ExtensionContext) {
    const usage = ctx.getContextUsage();
    const model = ctx.model;
    store.update({
      directory: ctx.cwd,
      model: modelLabel(model),
      thinking: model?.reasoning ? pi.getThinkingLevel() : "off",
      contextWindow: usage?.contextWindow ?? model?.contextWindow ?? 0,
      contextPercent: usage?.percent ?? null,
      cost: sessionCost(ctx),
    });
    requestRender?.();
  }

  async function pollGit(ctx: ExtensionContext, myGeneration: number) {
    if (!runner) return;
    const status = await readGitStatus(runner);
    if (myGeneration !== generation) return;
    store.update({
      gitBranch: status.branch,
      changedFiles: status.changedFiles,
    });
    requestRender?.();
  }

  function makeRunner(ctx: ExtensionContext): GitRunner {
    return async (args) => {
      try {
        const result = await pi.exec("git", [...args], {
          timeout: GIT_TIMEOUT_MS,
        });
        return { code: result.code, stdout: result.stdout };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { code: 1, stdout: message };
      }
    };
  }

  pi.on("session_start", (_event, ctx) => {
    generation += 1;
    const myGeneration = generation;
    store = new DashboardStateStore(emptyState(ctx.cwd));
    estimator.resetRun();

    if (ctx.mode !== "tui") return;
    runner = makeRunner(ctx);

    ctx.ui.setFooter((tui, theme, footerData: ReadonlyFooterDataProvider) => {
      requestRender = () => tui.requestRender();
      const footer = new DashboardFooter(() => ({
        state: store.state,
        cwd: ctx.cwd,
        home: HOME,
        theme,
        statuses: footerData.getExtensionStatuses(),
      }));
      return footer;
    });

    refresh(ctx);
    void pollGit(ctx, myGeneration);
    pollTimer = setInterval(() => {
      if (myGeneration === generation) void pollGit(ctx, myGeneration);
    }, GIT_POLL_INTERVAL_MS);
  });

  pi.on("input", (_event, ctx) => {
    void pollGit(ctx, generation);
    return { action: "continue" };
  });

  pi.on("tool_execution_end", (_event, ctx) => {
    void pollGit(ctx, generation);
  });

  pi.on("model_select", (event) => {
    store.update({
      model: modelLabel(event.model),
      thinking: event.model.reasoning ? pi.getThinkingLevel() : "off",
      contextWindow: event.model.contextWindow,
    });
    requestRender?.();
  });

  pi.on("thinking_level_select", (event) => {
    store.update({ thinking: event.level });
    requestRender?.();
  });

  pi.on("agent_start", () => {
    estimator.resetRun();
    store.update({ tokensPerSecond: null });
    requestRender?.();
  });

  pi.on("message_start", (event) => {
    if (event.message.role === "assistant") estimator.resetMessage();
  });

  pi.on("message_update", (event) => {
    if (event.message.role !== "assistant") return;
    const streamEvent = event.assistantMessageEvent;
    if (
      streamEvent.type !== "text_delta" &&
      streamEvent.type !== "thinking_delta"
    ) {
      return;
    }
    const live = estimator.recordDelta(streamEvent.delta);
    if (live !== null) {
      store.update({ tokensPerSecond: live });
      requestRender?.();
    }
  });

  pi.on("message_end", (event, ctx) => {
    if (event.message.role !== "assistant") return;
    const outputTokens = event.message.usage?.output ?? 0;
    const finalized = estimator.finalizeMessage(outputTokens);
    store.update({ tokensPerSecond: finalized });
    refresh(ctx);
  });

  pi.on("turn_end", (_event, ctx) => refresh(ctx));

  pi.on("session_shutdown", (_event, ctx) => {
    generation += 1;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = undefined;
    requestRender = undefined;
    runner = undefined;
    if (ctx.mode === "tui") ctx.ui.setFooter(undefined);
  });
}
