import { describe, expect, test, vi } from "vitest";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import piCopyAll, { runCopyAll, type CopyFn } from "../src/index.ts";
import { collectCopySections } from "../src/messages.ts";

type CommandHandler = (args: string, ctx: any) => void | Promise<void>;

function setup() {
  const handlers = new Map<string, CommandHandler>();
  const commands = new Map<
    string,
    { description: string; handler: CommandHandler }
  >();
  const pi = {
    on: vi.fn((event: string, handler: CommandHandler) =>
      handlers.set(event, handler),
    ),
    registerCommand: vi.fn(
      (
        name: string,
        options: { description: string; handler: CommandHandler },
      ) => commands.set(name, options),
    ),
  };
  piCopyAll(pi as any);
  return { handlers, commands, pi };
}

describe("pi-copy-all", () => {
  test("registers the /copy-all command", () => {
    const { commands } = setup();
    expect(commands.has("copy-all")).toBe(true);
    expect(commands.get("copy-all")?.description).toMatch(/clipboard/);
  });

  test("notifies when there is nothing to copy", async () => {
    const { commands } = setup();
    const notify = vi.fn();
    const waitForIdle = vi.fn(async () => {});
    const getBranch = vi.fn(() => []);

    await commands.get("copy-all")?.handler("", {
      ui: { notify },
      waitForIdle,
      sessionManager: { getBranch },
      signal: undefined,
    });

    expect(waitForIdle).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      "No user or assistant messages to copy",
      "info",
    );
  });

  test("maps the active branch into copy sections (pure path)", () => {
    const branch: SessionEntry[] = [
      {
        type: "message",
        id: "id",
        parentId: null,
        timestamp: "",
        message: { role: "user", content: "hi" },
      } as unknown as SessionEntry,
      {
        type: "message",
        id: "id2",
        parentId: "id",
        timestamp: "",
        message: { role: "assistant", content: "hello back" },
      } as unknown as SessionEntry,
    ];

    // The handler reads exactly this shape via ctx.sessionManager.getBranch();
    // collectCopySections is the pure mapping it relies on.
    const sections = collectCopySections(branch);
    expect(sections).toEqual([
      { role: "USER", text: "hi" },
      { role: "ASSISTANT", text: "hello back" },
    ]);
  });

  test("notifies with a backend on a successful copy", async () => {
    const branch: SessionEntry[] = [
      {
        type: "message",
        id: "id",
        parentId: null,
        timestamp: "",
        message: { role: "user", content: "hi" },
      } as unknown as SessionEntry,
    ];
    const notify = vi.fn();
    const copy: CopyFn = vi.fn(async () => ({
      ok: true,
      backend: "xclip",
    }));

    await runCopyAll(
      {
        ui: { notify },
        waitForIdle: vi.fn(async () => {}),
        sessionManager: { getBranch: vi.fn(() => branch) },
        signal: undefined,
      } as never,
      copy,
    );

    expect(copy).toHaveBeenCalledWith(
      expect.stringContaining("USER:"),
      undefined,
    );
    expect(notify).toHaveBeenCalledWith("Copied 1 messages via xclip", "info");
  });

  test("surfaces a clipboard failure as an error notification", async () => {
    const branch: SessionEntry[] = [
      {
        type: "message",
        id: "id",
        parentId: null,
        timestamp: "",
        message: { role: "user", content: "hi" },
      } as unknown as SessionEntry,
    ];
    const notify = vi.fn();
    const copy: CopyFn = vi.fn(async () => ({
      ok: false,
      error: "no clipboard helper found",
    }));

    await runCopyAll(
      {
        ui: { notify },
        waitForIdle: vi.fn(async () => {}),
        sessionManager: { getBranch: vi.fn(() => branch) },
        signal: undefined,
      } as never,
      copy,
    );

    expect(notify).toHaveBeenCalledWith(
      "Copy failed: no clipboard helper found",
      "error",
    );
  });
});
