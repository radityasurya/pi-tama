# subagents

Spawn background subagents from a parent Pi session. Each subagent is a fully
autonomous, headless agent with its own context window, running on the **pi
backend** — an in-process Pi `AgentSession` that inherits the parent's tools,
model, and configuration.

Subagents are fire-and-forget: `subagent_spawn` returns immediately with an id,
and the subagent's final output is queued back to the parent as a follow-up
message when it settles (or collected explicitly with `subagent_wait`). This is
a pi-only fork — the upstream design also supports Claude Code and Codex
backends; this copy strips those and wires up the in-process pi backend only.

> **Location:** `personal/subagents` — a standalone personal extension, not part
> of the published `extensions/*` workspace. It is loaded as readable TypeScript
> and has no package manifest of its own.

## Install

Load the live TypeScript source with Pi's `-e` flag:

```sh
pi -e ~/projects/pi-tama/personal/subagents/index.ts
```

Or register it once in `~/.pi/agent/settings.json` so it loads in every session:

```json
{
  "packages": ["../../projects/pi-tama/personal/subagents"]
}
```

Then restart Pi (or run `/reload`).

## Tools

The extension adds five tools to the parent model:

| Tool              | Parameters                                                                 | Behavior                                                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subagent_spawn`  | `prompt`, `name`, `harness`, `working_dir?`, `model?`, `reasoning_effort?` | Fire-and-forget spawn. Returns immediately with an id (`sa-N`). Enforces a max of **4** running subagents with a synchronous reservation so parallel tool calls can't race past the cap. Validates `working_dir`. |
| `subagent_wait`   | `ids[]` (max 64)                                                           | Blocks until all listed subagents settle; respects the tool `AbortSignal`; streams `Waiting for ...` updates. Marks awaited results "consumed" so they are not also auto-delivered. Errors on unknown ids.        |
| `subagent_cancel` | `ids[]`                                                                    | Aborts running subagents (marks them consumed first), waits for settlement, reports per-id results. Partial transcripts remain on disk.                                                                           |
| `subagent_check`  | `id`                                                                       | Non-blocking peek: status line, turn count, error text, and a preview of the latest output (including the live streaming message). Does not consume the result.                                                   |
| `subagent_list`   | —                                                                          | One line per subagent: `id [status] "title" (model, ctx%, elapsed, cwd)`.                                                                                                                                         |

Spawn defaults:

- **`harness`** is `"pi"` (the only backend wired up in this fork).
- **`model`** is omitted by default, so the child **inherits the parent model**
  (`"provider/model-id"` or a bare model id overrides it).
- **`reasoning_effort`** is omitted by default, so the child inherits the
  parent's thinking level.

## Result delivery

When a subagent settles **unconsumed**, its result is buffered and flushed back
to the parent as a follow-up message (`customType: "subagent-result"`) the next
time the parent goes idle (immediately if idle, otherwise on the parent's next
`agent_settled`). A later `subagent_wait` can still consume a buffered result
before it flushes. Delivered output is truncated (24 KB / 600 lines) with a
pointer to the child's session file for the full transcript.

## `/subagents` — dashboard and takeover

The `/subagents` command (TUI only) opens an interactive picker when subagents
exist:

- **Dashboard** — a fullscreen overlay listing every subagent (running and
  settled) with status glyph, title, model, context utilization, and elapsed
  time. Move with the configured up/down keys (or `j`/`k`), `Enter` to take over
  a subagent, `x` to abort the selected running one, and `Esc`/cancel to close.
- **Takeover view** — a fullscreen view of one subagent: a transcript viewport,
  an input line to steer the live run (or start a fresh run when idle), and
  scroll/page keys. Renders live streaming assistant messages, in-flight tool
  executions, and queued steering messages.

The footer also shows a live `subagents: ■ N running · ■ N done · ■ N failed`
status while any are tracked.

## How the pi backend works

Each subagent is a real in-process Pi `AgentSession` (`createAgentSession` +
`SessionManager.create(cwd)`), so:

- Children get real session files visible in `/resume`.
- Child resources are loaded per-cwd with **trust gating** — an alternate
  `working_dir` is trusted only when Pi's persisted trust store explicitly trusts
  it (a same-directory child inherits the parent's live trust decision).
- Children run under a **tool denylist**: the five `subagent_*` tools, `workflow`,
  and `ask_user` are removed so a child cannot orchestrate further agents, run
  workflows, or prompt the user. Every other tool stays enabled.
- `send()` steers a streaming run via `session.steer()`, or starts a fresh
  `prompt()` run when the child is idle. Interrupt clears the queue and aborts;
  closing the session scope emits the child `session_shutdown` hook and disposes
  the session.

Children cannot see the parent conversation, so a spawn `prompt` must be fully
self-contained.

## Caps and limits

- **4** subagents running concurrently (`MAX_RUNNING`); spawning past that throws.
- **64** subagents tracked (`MAX_TRACKED`), with LRU pruning of settled agents.
- Spawn reservations are synchronous to keep parallel tool calls under the cap.
- Output budgets: `subagent_wait` returns at most 48 KB total / 16 KB per agent;
  `subagent_check` previews up to 2 KB / 20 lines.

## Design

- Effect v4 throughout: backends → manager → runtime, with `index.ts` as the
  async boundary where plain-async tool handlers run effects against one shared
  `ManagedRuntime`.
- Backends translate their native streams (pi session events) into a single
  normalized `SubagentEvent` union; the manager folds those into one
  `SubagentSnapshot` that the tools, footer, and both TUI views read. Nothing
  downstream of a backend knows about the underlying session shape.
- `stub.ts` provides scripted sessions for tests (`src/backends/stub.ts`).

## Development

Type-check from the repository root (this copy is not part of the workspace's
`tsconfig.json` `include`, so check it explicitly):

```sh
cd ~/projects/pi-tama
npx tsc --noEmit --strict --exactOptionalPropertyTypes \
  --module NodeNext --moduleResolution NodeNext --target ES2022 \
  --skipLibCheck --allowImportingTsExtensions --resolveJsonModule \
  --types node $(find personal/subagents -name '*.ts')
```

Requires Pi 0.80.6 or newer.

## License

MIT
