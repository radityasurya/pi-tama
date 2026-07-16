---
name: workflows
description: Use when the user wants a model-authored, multi-phase plan that fans work out to isolated agents — ordered phases, parallel fan-out, structured outputs, or a long-running background orchestration. Covers the `workflow` tool, its inline JS script API (agent/parallel/phase/meta/args), and the /workflows dashboard.
---

# Workflows

A `workflow` tool that runs a **JavaScript orchestration script you write
inline**. The script executes ordered phases, fanning work out to isolated
subagents, and returns a structured result. It is the structured-planning
counterpart to ad-hoc [`subagents`](./subagents/SKILL.md).

This extension lives at `personal/workflows`. Runs are blocking by default
(live progress in the tool block); pass `background: true` to return
immediately and get a follow-up message when the run finishes.

## When to use

- A multi-step plan with explicit phases and dependencies.
- Fan-out to many agents with a concurrency limit.
- You want structured (`schema`) outputs aggregated into one result.
- Long orchestration that should keep running while the parent does other work
  (`background: true`).

Prefer raw `subagents` for a small number of independent, loosely-coupled runs.

## The script API

The `workflow` tool takes a `script` (JS source), optional `args` (a JSON
string), and optional `background`. Inside the script:

```js
// 1. Declare metadata (phases show up in the tool block + dashboard).
export const meta = {
  name: "migration-audit",
  description: "Audit the migration plan across modules",
  phases: [
    { title: "discover", detail: "enumerate affected files" },
    { title: "audit", detail: "per-module impact" },
    { title: "summarize" },
  ],
};

// 2. Mark runtime phase progression.
phase("discover");

// 3. Spawn an isolated agent. Always resolves — never throws into the script.
const files = await agent("List files in src/ that import X", {
  label: "discovery",
  phase: "discover",
});

// 4. Fan out in parallel with a concurrency cap.
phase("audit");
const reports = await parallel(
  files.structured.files.map(
    (f) => () => agent(`Assess migration impact for ${f}`, { label: f }),
  ),
  { concurrency: 4 },
);

// 5. Branch explicitly on ok — agent() never throws.
phase("summarize");
const good = reports.filter((r) => r.ok);
return good.map((r) => r.output);
```

### `agent(prompt, opts?)` → `{ ok, output, structured?, error? }`

- `prompt` — non-empty string (required).
- `opts.label` — short label for the dashboard (defaults to `agent-N`).
- `opts.phase` — assign the call to a phase.
- `opts.schema` — a JSON schema; when set, `agent()` returns `structured`.
- `opts.model` / `opts.provider` — override the model (`provider` requires
  `model`); omit both to inherit the parent model.
- `opts.effort` — thinking level: `off|minimal|low|medium|high|xhigh|max`;
  omit to inherit the parent level.

`agent()` **resolves rather than throws**. Always branch on `ok`; on failure
`output` is `""` and `error` holds the message.

### `parallel(fns[], { concurrency? })`

Runs the agent-returning functions, capped at `concurrency` in flight.

### `phase(title)`

Advances the run's current phase (also auto-creates it if new).

### `args`

The parsed value of the tool call's `args` JSON string (the raw string if it
isn't valid JSON).

### `meta`

`{ name, description, phases: [{ title, detail? }] }`. Phases render in the
tool call block and the `/workflows` dashboard.

## Results and artifacts

- The script's return value becomes the workflow `result` (rendered as JSON).
- If the script throws or agents fail to settle, the run status is
  `failed`/`aborted` and the tool throws so Pi marks it failed.
- Artifacts (script, args, per-agent statuses, result) are saved under
  `~/.pi/agent/workflows/<runId>/`. There is **no resume**.
- `/workflows` lists runs; `/workflows <runId>` shows one run's detail.

## Background runs

`background: true` (TUI only) returns immediately with the `runId` and run
directory. The result is delivered as a follow-up message when the run
finishes. Background runs survive `Esc` on the parent turn but are aborted and
settled during session shutdown.

Requires Pi 0.80.6 or newer.
