# pi-tama

Small, composable extensions for the [Pi coding agent](https://pi.dev).

## Skills

Agent skills live in [`skills/`](./skills) — `subagents` and `workflows`, pairing with the `personal/` extensions. External skills used by this setup are installed by reference (not vendored); see [`docs/inspirations.md`](./docs/inspirations.md) for where every skill and extension comes from.

## Packages

| Package                                                                               | Description                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`@radityasurya/pi-ask-user`](./extensions/pi-ask-user)                               | Multiple-choice tool that lets the model ask you one question at a time.             |
| [`@radityasurya/pi-double-paste`](./extensions/pi-double-paste)                       | Paste the same large block twice to expand Pi's paste markers into editable text.    |
| [`@radityasurya/pi-inline-skill-identifier`](./extensions/pi-inline-skill-identifier) | Highlight and route Codex-style `$skill-name` references through Pi's native skills. |
| [`@radityasurya/pi-openai-text-verbosity`](./extensions/pi-openai-text-verbosity)     | Configure OpenAI Responses text verbosity from Pi's model configuration.             |
| [`@radityasurya/pi-split-session`](./extensions/pi-split-session)                     | Fork a side session and import a clean side-agent handoff.                           |
| [`@radityasurya/pi-welcome-screen`](./extensions/pi-welcome-screen)                   | Show a responsive startup header with Pi's loaded resources.                         |

Every package is independently versioned and published to npm. Runtime source is readable TypeScript, and packages avoid runtime dependencies where practical. Releases publish **tokenlessly with provenance** via GitHub OIDC — see [**npm Trusted Publishing setup**](./docs/npm-trusted-publishing.md) for the one-time, per-package configuration.

## Use an extension

### Install from npm (recommended)

Install an extension globally through Pi's package manager:

```sh
pi install npm:@radityasurya/pi-ask-user
pi install npm:@radityasurya/pi-double-paste
pi install npm:@radityasurya/pi-inline-skill-identifier
pi install npm:@radityasurya/pi-openai-text-verbosity
pi install npm:@radityasurya/pi-split-session
pi install npm:@radityasurya/pi-welcome-screen
```

Restart Pi or run `/reload`. To pin a specific release, append its version, such as `@0.1.0`.

### Run from a local clone

Clone the repository:

```sh
git clone https://github.com/radityasurya/pi-tama.git
cd pi-tama
npm ci --ignore-scripts
npm run check
```

Then launch Pi from any project and point `-e` at the extension's entry file, replacing the example path with the location of your clone:

```sh
pi -e ~/path/to/pi-tama/extensions/pi-ask-user/src/index.ts
pi -e ~/path/to/pi-tama/extensions/pi-double-paste/src/index.ts
pi -e ~/path/to/pi-tama/extensions/pi-inline-skill-identifier/src/index.ts
pi -e ~/path/to/pi-tama/extensions/pi-openai-text-verbosity/src/index.ts
pi -e ~/path/to/pi-tama/extensions/pi-split-session/src/index.ts
pi -e ~/path/to/pi-tama/extensions/pi-welcome-screen/src/index.ts
```

Run one command for the extension you want. This loads the live TypeScript source without installing or copying it. It also keeps your normally configured Pi extensions enabled. Use `--no-extensions` before `-e` if you want to test it in isolation.

## Publishing

Packages publish from `.github/workflows/publish.yml` with npm Trusted Publishing. GitHub Actions exchanges its OIDC identity for a short-lived npm credential, so the repository stores no npm write token.

Each npm package must trust the following publisher:

- Provider: GitHub Actions
- Organization or user: `radityasurya`
- Repository: `pi-tama`
- Workflow filename: `publish.yml`
- Environment: `npm`
- Allowed action: `npm publish`

Create a GitHub release whose tag identifies the workspace and exactly matches its package version:

```text
pi-ask-user-v0.1.0
pi-double-paste-v0.1.0
pi-inline-skill-identifier-v0.1.0
pi-openai-text-verbosity-v0.1.0
pi-split-session-v0.1.0
pi-welcome-screen-v0.1.2
```

The workflow verifies the tag against `package.json`, runs the full repository check, and publishes only that workspace. A package's first release must be bootstrapped interactively on npm before its Trusted Publisher can be configured; subsequent releases use GitHub OIDC without local login or write-action 2FA prompts.
