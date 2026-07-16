/**
 * Cross-platform clipboard copy.
 *
 * Tries the known clipboard helpers (`pbcopy`, `wl-copy`, `xclip`, `xsel`) in
 * preference order and pipes text into the first one that exists. A backend
 * that is missing shows up as a spawn `ENOENT` error, which simply advances to
 * the next candidate — no separate PATH lookup is needed.
 */

export interface ClipboardCopyResult {
  readonly ok: boolean;
  readonly backend?: string;
  readonly error?: string;
}

/** Clipboard helpers, tried in order of preference. */
export const CLIPBOARD_BACKENDS = [
  "pbcopy",
  "wl-copy",
  "xclip",
  "xsel",
] as const;

export type ClipboardBackend = (typeof CLIPBOARD_BACKENDS)[number];

/** Injectable spawner used by `copyToClipboard`. */
export type SpawnClipboardBackend = (
  command: string,
  text: string,
  signal?: AbortSignal,
) => Promise<ClipboardCopyResult>;

/**
 * Pipe text into one backend. Resolves with an `ok` result on exit code 0.
 * A missing binary resolves as `ok: false` with an `enoent` marker so the
 * caller can try the next backend. Aborts resolve as cancelled (`ok: false`).
 */
export const spawnClipboardBackend: SpawnClipboardBackend = (
  command,
  text,
  signal,
) =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ ok: false, error: "cancelled" });
      return;
    }

    import("node:child_process")
      .then(({ spawn }) => {
        let stderr = "";
        const child = spawn(command, [], { stdio: ["pipe", "ignore", "pipe"] });

        const onAbort = () => {
          child.kill();
          resolve({ ok: false, error: "cancelled" });
        };
        signal?.addEventListener("abort", onAbort, { once: true });

        child.stderr?.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.on("error", (error: NodeJS.ErrnoException) => {
          signal?.removeEventListener("abort", onAbort);
          resolve({
            ok: false,
            error: error.code === "ENOENT" ? "enoent" : error.message,
          });
        });
        child.on("close", (code) => {
          signal?.removeEventListener("abort", onAbort);
          if (code === 0) {
            resolve({ ok: true, backend: command });
          } else {
            const message =
              stderr.trim() || `${command} exited with code ${code}`;
            resolve({ ok: false, backend: command, error: message });
          }
        });

        child.stdin?.end(text);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        resolve({ ok: false, error: message });
      });
  });

/**
 * Copy text to the clipboard by trying each backend in order. Returns the first
 * success, the first hard failure (a backend that exists but errors), or a
 * not-found result when no backend is installed.
 *
 * `spawn` is injectable for testing; production uses `spawnClipboardBackend`.
 */
export async function copyToClipboard(
  text: string,
  optionsOrSignal?: AbortSignal | { spawn?: SpawnClipboardBackend },
): Promise<ClipboardCopyResult> {
  const signal =
    optionsOrSignal instanceof AbortSignal ? optionsOrSignal : undefined;
  const spawn =
    (!(optionsOrSignal instanceof AbortSignal) && optionsOrSignal?.spawn) ||
    spawnClipboardBackend;

  for (const candidate of CLIPBOARD_BACKENDS) {
    const result = await spawn(candidate, text, signal);
    if (result.ok) return result;
    if (result.error !== "enoent") {
      // A real backend exists but failed; surface that rather than continuing.
      return result;
    }
    // ENOENT: candidate not installed, keep trying.
  }

  return { ok: false, error: "no clipboard helper found" };
}
