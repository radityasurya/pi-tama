# @radityasurya/pi-copy-all

Copy all previous user and assistant messages in a [Pi](https://pi.dev) session to the clipboard.

Adds a `/copy-all` slash command that walks the active session branch, collects every user and assistant message, and writes a `ROLE:\n<text>` block per message (joined by `---`) into the system clipboard.

## Install

```sh
pi install npm:@radityasurya/pi-copy-all
```

Then restart Pi or run `/reload`.

## Clipboard backends

The extension tries each helper in order and uses the first one that is installed:

1. `pbcopy` (macOS)
2. `wl-copy` (Wayland)
3. `xclip` (X11)
4. `xsel` (X11)

If none is found, `/copy-all` notifies you instead of failing silently. Images and thinking blocks collapse to `[image]` / `[thinking]` markers so the copied text stays readable.
