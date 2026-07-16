# Inspirations & attributions

pi-tama is a personal Pi setup. This page records **where each piece comes
from** so credit goes upstream and updates can be traced back to their source.
It does not affect how anything runs.

> Big thanks to the authors below. If something here is misattributed or you'd
> like a fork adjusted/removed, please open an issue.

## Extensions

Most extensions in `extensions/` are original to this repo. A few are
inspired by — or adapted from — other open-source Pi setups:

| Extension                                   | Origin                                                 | Notes                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `pi-ask-user`                               | adapted from [davis7dotsh/my-pi-setup][mps] `ask-user` | Rewritten for the `@radityasurya` workspace; arrow-key handling uses Pi's keybinding matcher (Kitty-safe). |
| `pi-copy-all`                               | adapted from [davis7dotsh/my-pi-setup][mps] `copy-all` | Workspace package copy.                                                                                    |
| `pi-double-paste`                           | original                                               | Expand Pi's paste markers into editable text on second paste.                                              |
| `pi-inline-skill-identifier`                | original                                               | Highlight/route Codex-style `$skill-name` references through native skills.                                |
| `pi-openai-text-verbosity`                  | original                                               | Wire OpenAI Responses text verbosity to Pi model config.                                                   |
| `pi-split-session`                          | original                                               | Fork a side session with a clean side-agent handoff.                                                       |
| `pi-welcome-screen`                         | original                                               | Responsive startup header showing Pi's loaded resources.                                                   |
| `pi-catppuccin-tui` / `pi-dashboard-footer` | original (in progress)                                 | Not yet published.                                                                                         |

### `personal/` (not published)

| Extension            | Origin                                                  | Notes                                                                                                   |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `personal/subagents` | adapted from [davis7dotsh/my-pi-setup][mps] `subagents` | **pi-only fork.** Strips the upstream Claude Code / Codex backends; wires up the in-process Pi backend. |
| `personal/workflows` | adapted from [davis7dotsh/my-pi-setup][mps] `workflows` | Model-authored multi-agent orchestration via an inline JS script.                                       |

[mps]: https://github.com/davis7dotsh/my-pi-setup

## Skills

The agent skills loaded into Pi come from several upstream skill collections
plus a couple authored in this repo. They are installed **by reference, not
vendored** — see the bootstrap script in the dotfiles (`run_onchange_install-skills.sh`)
for the exact install mechanism (the `skills` CLI + git clones, symlinked into
`~/.pi/agent/skills`).

### External skill collections

| Collection                  | Skills                                                                                                                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [vercel-labs/skills][vls]   | `find-skills`                                                                                                                                                                                                                                  |
| [ogulcancelik/herdr][herdr] | `herdr`                                                                                                                                                                                                                                        |
| [mattpocock/skills][mp]     | `tdd`, `diagnosing-bugs`, `domain-modeling`, `grilling`, `grill-me`, `grill-with-docs`, `handoff`, `code-review`, `codebase-design`, `improve-codebase-architecture`, `prototype`, `research`, `to-spec`, `to-tickets`, `writing-great-skills` |
| [emilkowalski/skills][emil] | `emil-design-eng`, `animation-vocabulary`, `apple-design`, `review-animations`, `find-animation-opportunities`, `improve-animations`                                                                                                           |

[vls]: https://github.com/vercel-labs/skills
[herdr]: https://github.com/ogulcancelik/herdr
[mp]: https://github.com/mattpocock/skills
[emil]: https://github.com/emilkowalski/skills

### Authored in this repo (`skills/`)

| Skill       | Pairs with           | Notes                                                                       |
| ----------- | -------------------- | --------------------------------------------------------------------------- |
| `subagents` | `personal/subagents` | How to spawn/manage background Pi subagents (pi-only fork).                 |
| `workflows` | `personal/workflows` | How to author inline JS orchestration scripts (`agent`/`parallel`/`phase`). |

## Updating the sources

- **External skills:** kept up to date upstream; refresh with the bootstrap
  script (re-runs on change). Don't copy them into this repo — copies go stale.
- **Authored skills (`skills/`):** edit here; they belong to this repo.
- **Attributions:** when you adapt a new extension or skill from elsewhere, add
  a row above so the lineage stays discoverable.
