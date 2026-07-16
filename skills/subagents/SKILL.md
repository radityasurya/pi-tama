---
name: subagents
description: Use when the user asks to delegate work to background subagents, run tasks in parallel, or fan work out across autonomous agents. Covers the subagent_spawn / subagent_wait / subagent_check / subagent_list / subagent_cancel tools and the /subagents dashboard.
---

# Subagents

Spawn background subagents from the parent Pi session. Each subagent is a fully
autonomous, headless agent with its **own context window** running as an
in-process Pi `AgentSession`. It inherits the parent's tools, model, and config
but **cannot** see the parent conversation, ask the user, spawn further
subagents, run workflows, or call `ask_user`.

This extension lives at `personal/subagents`. It is a **pi-only fork** of a
multi-harness design; only the in-process `pi` backend is wired up here.

## When to use

- Parallelizable, independent tasks (e.g. "audit these 3 modules", "research X
  while I implement Y").
- Work that benefits from a fresh context window isolated from the parent.
- Anything fire-and-forget where the result can arrive as a follow-up message.

Prefer the [`workflows`](./workflows/SKILL.md) skill when you need an explicit,
ordered multi-phase plan with structured outputs. Prefer subagents for a small
number of loosely-related independent runs.

## The `pi` harness

`harness` is always `"pi"` in this fork. Two spawn defaults make children
inherit the parent:

- Omit `model` → child inherits the **parent model**.
- Omit `reasoning_effort` → child inherits the **parent thinking level**.

Override with `"provider/model-id"` (preferred) or a bare model id (only when
unambiguous). Valid `reasoning_effort` values are the Pi thinking levels:
`off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`.

## Tools

| Tool              | Key parameters                                                             | Behavior                                                                                                           |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `subagent_spawn`  | `prompt`, `name`, `harness`, `working_dir?`, `model?`, `reasoning_effort?` | Fire-and-forget. Returns immediately with an id (`sa-N`). Max **4** running concurrently. Validates `working_dir`. |
| `subagent_wait`   | `ids[]` (max 64)                                                           | Blocks until the listed subagents settle. Marks results "consumed" so they aren't also auto-delivered.             |
| `subagent_check`  | `id`                                                                       | Non-blocking peek: status, turn count, error, and a preview of the latest output. Does not consume the result.     |
| `subagent_list`   | —                                                                          | One line per subagent: `id [status] "title" (model, ctx%, elapsed, cwd)`.                                          |
| `subagent_cancel` | `ids[]`                                                                    | Aborts running subagents; partial transcripts remain on disk.                                                      |

Children cannot see the parent conversation, so every spawn `prompt` must be
**fully self-contained** — include paths, constraints, and the expected report
format. Vague prompts produce vague results.

## Result delivery

Unconsumed results are buffered and flushed back to the parent as a follow-up
message the next time the parent goes idle. Delivered output is truncated
(24 KB / 600 lines) with a pointer to the child's session file for the full
transcript.

## Workflow

1. `subagent_spawn` each task with a complete, self-contained prompt.
2. **Continue useful parent work** — do not immediately block on `subagent_wait`
   unless the result is required to proceed.
3. Results arrive as follow-ups automatically. Use `subagent_check` to peek or
   `subagent_wait` only when you specifically need them before continuing.
4. `/subagents` (TUI) opens a dashboard to inspect runs or take one over live.

## Caps and limits

- **4** subagents running concurrently; spawning past the cap throws.
- **64** subagents tracked (LRU pruning of settled ones).
- `subagent_wait` returns at most 48 KB total / 16 KB per agent.
- `subagent_check` previews up to 2 KB / 20 lines.

Requires Pi 0.80.6 or newer.
