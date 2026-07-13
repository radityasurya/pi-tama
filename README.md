# pi-kaush

Small, composable extensions for the [Pi coding agent](https://pi.dev).

## Packages

| Package                                                     | Description                                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`@pi-kaush/pi-double-paste`](./extensions/pi-double-paste) | Paste the same large block twice to expand Pi's paste markers into editable text. |

Every package is independently versioned and published to npm. Runtime source is readable TypeScript, and packages avoid runtime dependencies where practical.

## Use an extension

### Install from npm (recommended)

Install the extension globally through Pi's package manager:

```sh
pi install npm:@pi-kaush/pi-double-paste
```

Restart Pi or run `/reload`. To pin a specific release, include its version:

```sh
pi install npm:@pi-kaush/pi-double-paste@0.1.0
```

### Run from a local clone

Clone the repository:

```sh
git clone https://github.com/kaushikgopal/pi-kaush.git
cd pi-kaush
npm ci --ignore-scripts
npm run check
```

Then launch Pi from any project and point `-e` at the extension's entry file, replacing the example path with the location of your clone:

```sh
pi -e ~/path/to/pi-kaush/extensions/pi-double-paste/src/index.ts
```

This loads the live TypeScript source without installing or copying it. It also keeps your normally configured Pi extensions enabled. Use `--no-extensions` before `-e` if you want to test it in isolation.
