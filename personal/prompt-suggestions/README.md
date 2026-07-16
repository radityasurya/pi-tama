# prompt-suggestions

Model-generated follow-up prompts as **inline autocomplete** in the prompt
input (à la Claude Code), surfaced with **Tab**.

After each agent reply, one headless model call produces 2–3 specific,
context-aware follow-up prompts. They're cached and offered through pi's
autocomplete dropdown — press **Tab** to see them, **↑/↓** to pick, and
**Tab/Enter** to insert one straight into the input.

> **Location:** `personal/prompt-suggestions` — a standalone personal extension,
> not part of the published `extensions/*` workspace. Loaded as readable
> TypeScript, no package manifest of its own.

## How it works

1. On `message_end`, captures the most recent **user** message and **assistant**
   reply (each truncated) as context.
2. On `agent_settled`, spawns a headless in-process `AgentSession` (print mode,
   same pattern as `personal/workflows`) that inherits the active model, asks it
   for follow-up prompts as strict JSON, and caches the parsed suggestions.
3. Registers an **autocomplete provider** via `ctx.ui.addAutocompleteProvider`
   that wraps the built-in file/command completion:
   - **Tab** triggers it (`shouldTriggerFileCompletion` returns true while
     suggestions are cached).
   - `getSuggestions` returns the cached prompts, filtered by what's been typed
     (substring match); if none match, it **defers to the built-in** provider so
     normal `@`/`#`/path/slash completion still works.
   - `applyCompletion` inserts the chosen prompt, replacing the typed prefix.
4. The cache is cleared on the next submit (`turn_start`) and regenerated on the
   next reply, so suggestions always reflect the most recent exchange.

The suggestions are pushed to be **specific**: the system prompt feeds both the
user's question and the assistant's reply, demands that each suggestion
reference a concrete detail (a file name, function/symbol, command, error, or
the exact topic), and bans generic filler like "explain more" / "continue".

Best-effort and non-blocking: generation runs in the background, and errors,
timeouts (30 s cap), and JSON parse failures are swallowed — Tab simply offers
nothing until the next successful generation. Stale runs are discarded via a
run-id guard if a newer turn supersedes them.

## Install

Register it in `~/.pi/agent/settings.json`:

```json
{
  "packages": ["../../projects/pi-tama/personal/prompt-suggestions"]
}
```

Then restart Pi (or run `/reload`).

## Usage

1. After the agent replies, suggestions generate in the background (~1–3 s).
2. **Press Tab** on the (empty or partially typed) input → the dropdown appears.
3. **↑/↓** to highlight, **Tab/Enter** to accept → it fills the input.
4. Type something that doesn't match → the dropdown clears and falls back to
   built-in completion.

## Notes / limitations

- Costs **one extra model call per turn** (using the active model). There is no
  debounce/dedup yet — every settled turn regenerates.
- The suggestion call runs headless with the orchestration tools denied
  (`subagent_*`, `workflow`, `ask_user`), so it can't recurse or prompt.
- Suggestion text isn't length-capped in code (the prompt asks for ≤100 chars);
  a verbose model may occasionally produce longer prompts.
- The headless child session runs in print mode (`ctx.hasUI === false`), so its
  own events are filtered out — it can't re-trigger generation or corrupt state.

Requires Pi 0.80.6 or newer.
