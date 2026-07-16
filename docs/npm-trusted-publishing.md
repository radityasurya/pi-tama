# npm Trusted Publishing for `@radityasurya/*`

Releases of every `@radityasurya/*` package are published **tokenlessly** from the
`radityasurya/pi-tama` GitHub repo by [`.github/workflows/publish.yml`](../.github/workflows/publish.yml).
It uses npm **Trusted Publishing** — GitHub OIDC identity is the _only_
credential. There is **no `NODE_AUTH_TOKEN` secret** to create or rotate.

This works only after each package is registered as a Trusted Publisher on
npmjs.com. **Without that one-time setup, the very first release of a package
will fail.** This doc covers the prerequisites, the per-package steps, and the
bootstrap nuance for brand-new packages.

---

## TL;DR — the release flow (once set up)

1. Bump the version in the package's `package.json`.
2. Commit and push to `main`.
3. Create and push a tag matching the convention: `pi-<name>-v<version>`
   (e.g. `pi-catppuccin-tui-v0.1.4`).
4. Create a **GitHub Release** from that tag.
5. `on: release: published` fires → the workflow publishes
   `--access public --provenance`, no token needed.

The workflow verifies the tag version matches `package.json` version, then
publishes only the matching workspace. See the [package table](#package-table).

---

## How it authenticates (why setup is required)

The workflow has:

```yaml
permissions:
  contents: read
  id-token: write # lets the job mint a GitHub OIDC token
jobs:
  publish:
    environment: npm # must match the environment named on npm
    steps:
      - run: npm publish --workspace "${{ ... }}" --access public --provenance
```

`npm publish` detects the GitHub Actions OIDC context and, for a package that
has a **Trusted Publisher** configured, exchanges the OIDC token for publishing
rights — **tokenless**, and the publish is automatically **signed with
provenance** (a verifiable link back to this exact workflow run + commit).

If no Trusted Publisher is configured for that package, `npm publish` has no
credential and the step fails with an auth error.

---

## Prerequisites (one-time)

1. **Have an npm account.** The `@radityasurya` scope is your **personal** scope —
   it's created automatically with your account, so **no org setup is needed.**
2. **Enable 2FA** on that account (required for provenance / trusted
   publishing). Account → Account Settings → Two-Factor Authentication.

> Keep your npm login handy — you'll need it (with OTP) for the manual first
> publish of each brand-new package (see Path B below).

---

## Package table

| Package                                    | Version | Directory                               | Release tag                       |
| ------------------------------------------ | ------- | --------------------------------------- | --------------------------------- |
| `@radityasurya/pi-ask-user`                | 0.1.0   | `extensions/pi-ask-user`                | `pi-ask-user-v<x>`                |
| `@radityasurya/pi-catppuccin-tui`          | 0.1.3   | `extensions/pi-catppuccin-tui`          | `pi-catppuccin-tui-v<x>`          |
| `@radityasurya/pi-copy-all`                | 0.1.0   | `extensions/pi-copy-all`                | `pi-copy-all-v<x>`                |
| `@radityasurya/pi-dashboard-footer`        | 0.1.0   | `extensions/pi-dashboard-footer`        | `pi-dashboard-footer-v<x>`        |
| `@radityasurya/pi-double-paste`            | 0.1.0   | `extensions/pi-double-paste`            | `pi-double-paste-v<x>`            |
| `@radityasurya/pi-inline-skill-identifier` | 0.1.1   | `extensions/pi-inline-skill-identifier` | `pi-inline-skill-identifier-v<x>` |
| `@radityasurya/pi-openai-text-verbosity`   | 0.1.0   | `extensions/pi-openai-text-verbosity`   | `pi-openai-text-verbosity-v<x>`   |
| `@radityasurya/pi-split-session`           | 0.1.0   | `extensions/pi-split-session`           | `pi-split-session-v<x>`           |
| `@radityasurya/pi-welcome-screen`          | 0.1.2   | `extensions/pi-welcome-screen`          | `pi-welcome-screen-v<x>`          |

> Versions are read from each `package.json` at the time of writing. The tag's
> `<x>` must **exactly equal** the `version` field — the workflow enforces this.

---

## Per-package setup

For **each** package in the table, do one of the two paths below. Path A is for
a package that has **already been published at least once** (it exists on npm);
Path B is for a **brand-new** package that has never been published.

### Path A — package already exists on npm

1. Sign in to <https://www.npmjs.com>.
2. Open the package page, e.g.
   `https://www.npmjs.com/package/@radityasurya/pi-catppuccin-tui`.
3. Go to **Settings** → **Publishing access**.
4. Under **Trusted Publishers**, click **Add trusted publisher** and choose
   **GitHub**. Fill in exactly:

   | Field                 | Value                           |
   | --------------------- | ------------------------------- |
   | Repository owner/name | `radityasurya/pi-tama`          |
   | Workflow filename     | `.github/workflows/publish.yml` |
   | Environment           | `npm`                           |

   Leave branch/ref unrestricted (or pin to `refs/heads/main` if you want to
   require releases from `main`).

5. Save. Done — the next GitHub Release for that package publishes tokenlessly.

### Path B — brand-new package (never published)

npm Trusted Publishers can only be attached to a package you **own**. Since
`@radityasurya` is your personal scope, you own any `@radityasurya/*` package
the moment it's published — but for a not-yet-published package you must do
that first publish to create it:

1. **Bootstrap the first publish manually** (creates the package under
   `@radityasurya`):

   ```bash
   cd extensions/<pkg-dir>          # e.g. extensions/pi-catppuccin-tui
   npm publish --access public      # uses your npm login + 2FA OTP
   ```

   This first version is published **without provenance** (your laptop isn't a
   GitHub Actions OIDC environment, so `--provenance` can't be used locally).
   That's fine — provenance applies from the next release onward.

2. Now follow **Path A** (the package exists, so you can add the Trusted
   Publisher).
3. For the **next** release, use the GitHub Release flow (TL;DR above) — it will
   publish tokenlessly **with provenance**.

> You only do the manual bootstrap **once per package**, ever.

---

## Verifying it works

- **Before a real release** (cheap sanity check): the workflow runs `npm run
check` (format + typecheck + tests + `package:check`). A failing check blocks
  the publish, so a green `npm run check` locally is a good pre-flight.
- **After a release**: open the package on npmjs.com. A successfully
  provenance-published package shows a **"Provenance"** badge / link under the
  version, pointing to a SIGSTORE/SLSA attestation. Clicking it leads back to the
  exact GitHub Actions run.
- **If the publish step fails with a 403/401 or "provenance" error**: the
  Trusted Publisher isn't configured for that package (or the environment name
  doesn't match `npm`, or the workflow path differs). Re-check Path A, steps
  3–5.

---

## Troubleshooting

- **`code E403 ... forbidden`** on publish → Trusted Publisher not added, or
  repo/workflow/environment fields don't match exactly (`radityasurya/pi-tama`,
  `.github/workflows/publish.yml`, environment `npm`).
- **`Release X does not match @radityasurya/foo@Y`** → the git tag version differs
  from `package.json` `version`. Bump both to the same value, re-tag.
- **`Unsupported release tag`** → the tag prefix isn't in the workflow's
  `if:`-filter or `case` branches. When adding a new package, you must add it to
  **both** (see how the existing entries are structured).
- **Workflow didn't run at all** → confirm the GitHub **Release** was created
  (not just a tag) and is set to `published` (not draft). The trigger is
  `on: release: [published]`.

---

## Adding a new package later

When you add another `@radityasurya/*` extension:

1. Put it under `extensions/` with an `@radityasurya/*`-scoped `name` and a `version`.
   Give it a `package:check` script like the others.
2. Add **two** entries to `.github/workflows/publish.yml`:
   - the tag prefix to the top-level `if:` `startsWith(...)` chain, and
   - a `pi-<name>-v*) ... ;;` arm in the `case` statement (workspace, directory,
     prefix).
3. Bootstrap its first publish (Path B above) and add its Trusted Publisher.
4. Add a row to the [package table](#package-table) in this doc.
