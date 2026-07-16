# @radityasurya/pi-split-session

Fork the current Pi conversation into a right-hand side session, continue working there, and import a clean handoff into the main session.

The extension is intentionally narrow: it supports Herdr and Ghostty, shares the current working directory, and adds no background service or model call of its own.

## Why another side-session workflow?

Pi already has useful primitives for branching and side questions. This extension combines their useful parts for longer parallel work without trying to replace them:

- `/fork` and `/clone` create another conversation path, but you continue by moving the active Pi session to that path.
- BTW-style extensions are excellent for quick questions while the main agent runs, usually through a custom panel or an in-memory side thread.
- `pi-split-session` creates a normal persisted Pi session in another terminal pane. The main session stays visible and keeps running, while the side gets Pi's normal editor, tools, commands, model, and session history.

That makes it a good fit when the side task is more than a quick question: investigating code, trying an approach, reviewing a change, or iterating through several follow-ups. When the side work is ready, its own agent writes a clean handoff and the main session imports only that summary. The main context stays small unless you explicitly request the full transcript.

The trade-off is deliberate: a real side terminal is heavier than a one-off BTW request, but it avoids building another conversation UI, hidden agent runtime, transcript model, or summarizer inside the extension. For a quick disposable question, `/btw` may be the better tool. For sustained parallel work that should remain a first-class Pi session, use `/split`.

## Install

After the first npm release:

```bash
pi install npm:@radityasurya/pi-split-session@0.1.0
```

For local development:

```bash
pi -e ./extensions/pi-split-session/src/index.ts
```

## Workflow

Start side work with a prompt:

```text
/split investigate the failing integration test
```

Or run `/split` without arguments to choose a previous user message. The selected prompt is submitted automatically in the side session.

When the side work is ready, run this inside the side session:

```text
/split-handoff
```

The side agent writes a concise final handoff using its own context. Back in the main session, import only that handoff:

```text
/split-import
```

An optional argument starts a main-agent follow-up after queuing the handoff:

```text
/split-import compare this with the current approach
```

For diagnostics, explicitly import the complete text transcript:

```text
/split-import-full
```

Summary and full-transcript imports are tracked separately, while repeated imports of the same format are ignored.

## Requirements and constraints

- **Herdr is the preferred host.** When Pi is running inside the cross-platform [Herdr](https://herdr.dev) multiplexer, `/split` opens a right-hand Herdr agent split.
- **Ghostty is the fallback.** Outside Herdr, macOS users can open a right-hand [Ghostty](https://ghostty.org) split through its AppleScript API.
- **Other terminals are not supported automatically.** Without an active Herdr session or Ghostty on macOS, `/split` fails before copying a session. Supporting another terminal requires adapting the small launch boundary in the extension.
- **Conversation isolation is not filesystem isolation.** Main and side sessions share the same working directory and files, so simultaneous edits can affect each other.
- **The side remains a normal Pi session.** Close it manually when finished, or resume it later through Pi's session workflow.
- **Ambiguous launches remain recoverable.** If a host may have opened despite a timeout, the retained child appears as `[unconfirmed]` in the import chooser.

Requires Pi 0.80.6 or newer. Ghostty fallback requires macOS, Ghostty AppleScript support, and macOS Automation permission.

## Commands

| Command                          | Behavior                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/split [prompt]`                | Fork the conversation and launch a side session. Without a prompt, choose a previous user message. |
| `/split-handoff`                 | Ask the live side agent to prepare its clean final handoff.                                        |
| `/split-import [follow-up]`      | Import the completed handoff and optionally ask the main agent a follow-up.                        |
| `/split-import-full [follow-up]` | Import the full text transcript and optionally ask a follow-up.                                    |

## Design

- No runtime dependencies.
- No startup I/O, subprocesses, model requests, timers, or event listeners; startup only registers commands.
- Uses Pi's session files and custom entries for branch boundaries and import tracking.
- The side agent creates the summary; the main session never receives the side transcript unless `/split-import-full` is invoked.
- Multiple side sessions remain selectable with a small TUI chooser.
- Removing the package removes the commands; existing custom entries become inert and imported handoffs remain ordinary session context.

## Development

From the repository root:

```bash
npm ci --ignore-scripts
npm run check
```

Inspect the publish payload:

```bash
npm pack --workspace @radityasurya/pi-split-session --dry-run
```

## License

MIT
