import { describe, expect, test } from "vitest";
import {
  CLIPBOARD_BACKENDS,
  copyToClipboard,
  type ClipboardCopyResult,
  type SpawnClipboardBackend,
} from "../src/clipboard.ts";

function makeSpawn(
  table: Record<string, ClipboardCopyResult>,
): SpawnClipboardBackend {
  return (command) =>
    Promise.resolve(table[command] ?? { ok: false, error: "enoent" });
}

describe("copyToClipboard", () => {
  test("uses the first available backend", async () => {
    const spawn = makeSpawn({
      "wl-copy": { ok: true, backend: "wl-copy" },
    });

    const result = await copyToClipboard("hi", { spawn });

    expect(result.ok).toBe(true);
    expect(result.backend).toBe("wl-copy");
  });

  test("skips missing backends and uses the next one", async () => {
    const spawn = makeSpawn({
      pbcopy: { ok: false, error: "enoent" },
      "wl-copy": { ok: false, error: "enoent" },
      xclip: { ok: true, backend: "xclip" },
    });

    const result = await copyToClipboard("hi", { spawn });

    expect(result.ok).toBe(true);
    expect(result.backend).toBe("xclip");
  });

  test("surfaces a hard failure instead of trying later backends", async () => {
    const calls: string[] = [];
    const spawn: SpawnClipboardBackend = async (command) => {
      calls.push(command);
      if (command === "pbcopy") {
        return { ok: false, backend: "pbcopy", error: "broken pipe" };
      }
      return { ok: true, backend: command };
    };

    const result = await copyToClipboard("hi", { spawn });

    expect(result.ok).toBe(false);
    expect(result.backend).toBe("pbcopy");
    expect(result.error).toBe("broken pipe");
    expect(calls).toEqual(["pbcopy"]);
  });

  test("reports a clear error when no backend is installed", async () => {
    const result = await copyToClipboard("hi", { spawn: makeSpawn({}) });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("no clipboard helper found");
  });

  test("tries backends in declared preference order", async () => {
    const calls: string[] = [];
    const spawn: SpawnClipboardBackend = async (command) => {
      calls.push(command);
      return { ok: true, backend: command };
    };

    await copyToClipboard("hi", { spawn });

    expect(calls).toEqual([...CLIPBOARD_BACKENDS].slice(0, 1));
    expect(CLIPBOARD_BACKENDS[0]).toBe("pbcopy");
  });
});
