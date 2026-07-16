# @pi-tama/pi-dashboard-footer

A two-line status footer for [Pi](https://pi.dev) that shows model, context usage, session cost, streaming tokens/s, and git status.

It replaces Pi's built-in footer with a denser dashboard and restores the built-in footer on shutdown. It does not touch the header or the theme, so it composes with `pi-welcome-screen` and any Catppuccin/GitHub theme.

## What it shows

```
~/projects/myapp                    openai-codex/gpt-5.5 · high
42%/272k · $0.13 · 87 tok/s        main · 3 files changed
```

- Line 1: current directory on the left, `provider/model · thinking` on the right.
- Line 2: `ctx%/window · $cost · tok/s` on the left, `branch · N files changed` on the right.
- Additional lines: any statuses other extensions register via `ctx.ui.setStatus`.

## Install

```sh
pi install npm:@pi-tama/pi-dashboard-footer
```

Then restart Pi or run `/reload`.

## Notes

- `tok/s` is an estimate from streamed text/thinking deltas, smoothed across the whole agent run. It ignores the first delta and requires at least two deltas over ≥50ms.
- Git status is polled on each user input, after tool execution, and every 3 seconds. Commands time out after 3 seconds so a slow repo never blocks the TUI.
- Outside a git repository the git segment is omitted.
