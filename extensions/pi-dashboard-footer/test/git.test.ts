import { describe, expect, test, vi } from "vitest";
import { readGitStatus, type GitRunner } from "../src/git.ts";

function runner(
  table: Record<string, { code?: number; stdout: string }>,
): GitRunner {
  return vi.fn(async (args: ReadonlyArray<string>) => {
    const key = args.join(" ");
    const entry = table[key];
    if (!entry) return { code: 1, stdout: "" };
    return { code: entry.code ?? 0, stdout: entry.stdout };
  });
}

describe("readGitStatus", () => {
  test("returns empty status outside a work tree", async () => {
    const run = runner({
      "rev-parse --is-inside-work-tree": { code: 1, stdout: "" },
    });

    const status = await readGitStatus(run);

    expect(status).toEqual({
      branch: null,
      changedFiles: 0,
      isRepository: false,
    });
  });

  test("reads branch and counts changed files", async () => {
    const run = runner({
      "rev-parse --is-inside-work-tree": { stdout: "true" },
      "branch --show-current": { stdout: "main" },
      "status --porcelain=v1 --untracked-files=all": {
        stdout: " M a.ts\n?? b.ts\nA  c.ts\n",
      },
    });

    const status = await readGitStatus(run);

    expect(status).toEqual({
      branch: "main",
      changedFiles: 3,
      isRepository: true,
    });
  });

  test("handles detached head (empty branch)", async () => {
    const run = runner({
      "rev-parse --is-inside-work-tree": { stdout: "true" },
      "branch --show-current": { stdout: "" },
      "status --porcelain=v1 --untracked-files=all": { stdout: " M a\n" },
    });

    const status = await readGitStatus(run);
    expect(status.branch).toBeNull();
    expect(status.changedFiles).toBe(1);
    expect(status.isRepository).toBe(true);
  });

  test("reports zero changed files for a clean tree", async () => {
    const run = runner({
      "rev-parse --is-inside-work-tree": { stdout: "true" },
      "branch --show-current": { stdout: "main" },
      "status --porcelain=v1 --untracked-files=all": { stdout: "" },
    });

    expect(await readGitStatus(run)).toMatchObject({
      branch: "main",
      changedFiles: 0,
    });
  });
});
