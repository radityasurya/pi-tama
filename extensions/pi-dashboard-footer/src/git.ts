/**
 * Lightweight git status poller.
 *
 * Runs `git` commands through an injected runner so the logic is testable
 * without spawning processes. Designed to be called on a debounce: callers
 * keep a generation counter and ignore results from stale generations.
 */

export interface GitStatus {
  readonly branch: string | null;
  readonly changedFiles: number;
  readonly isRepository: boolean;
}

export interface GitCommandResult {
  readonly code: number;
  readonly stdout: string;
}

export type GitRunner = (
  args: ReadonlyArray<string>,
) => Promise<GitCommandResult>;

const EMPTY: GitStatus = {
  branch: null,
  changedFiles: 0,
  isRepository: false,
};

function countChangedFiles(status: string): number {
  const trimmed = status.trim();
  if (!trimmed) return 0;
  return trimmed.split("\n").filter(Boolean).length;
}

/**
 * Read branch and changed-file count for `cwd`. Returns the empty status when
 * the directory is not inside a git work tree or git is unavailable.
 */
export async function readGitStatus(runner: GitRunner): Promise<GitStatus> {
  const inside = await runner(["rev-parse", "--is-inside-work-tree"]);
  if (inside.code !== 0 || inside.stdout.trim() !== "true") return EMPTY;

  const [branchResult, statusResult] = await Promise.all([
    runner(["branch", "--show-current"]),
    runner(["status", "--porcelain=v1", "--untracked-files=all"]),
  ]);

  const branch = branchResult.stdout.trim();
  const changedFiles =
    statusResult.code === 0 ? countChangedFiles(statusResult.stdout) : 0;

  return { branch: branch || null, changedFiles, isRepository: true };
}
