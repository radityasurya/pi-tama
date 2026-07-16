import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { copyToClipboard, type ClipboardCopyResult } from "./clipboard.ts";
import { collectCopySections, formatCopyPayload } from "./messages.ts";

export type CopyFn = (
  text: string,
  signal?: AbortSignal,
) => Promise<ClipboardCopyResult>;

async function runCopyAll(
  ctx: ExtensionCommandContext,
  copy: CopyFn = copyToClipboard,
): Promise<void> {
  await ctx.waitForIdle();

  const sections = collectCopySections(ctx.sessionManager.getBranch());
  if (sections.length === 0) {
    ctx.ui.notify("No user or assistant messages to copy", "info");
    return;
  }

  const payload = formatCopyPayload(sections);
  const result = await copy(payload, ctx.signal);
  if (!result.ok) {
    ctx.ui.notify(`Copy failed: ${result.error ?? "unknown"}`, "error");
    return;
  }

  ctx.ui.notify(
    `Copied ${sections.length} messages via ${result.backend ?? "clipboard"}`,
    "info",
  );
}

export default function piCopyAll(pi: ExtensionAPI): void {
  pi.registerCommand("copy-all", {
    description:
      "Copy all previous user and assistant messages to the clipboard",
    handler: async (_args, ctx) => {
      await runCopyAll(ctx);
    },
  });
}

export { runCopyAll };

export {
  CLIPBOARD_BACKENDS,
  copyToClipboard,
  spawnClipboardBackend,
  type ClipboardBackend,
  type ClipboardCopyResult,
} from "./clipboard.ts";
export {
  collectCopySections,
  formatCopyPayload,
  SECTION_SEPARATOR,
  type CopySection,
  type SessionBranch,
} from "./messages.ts";
