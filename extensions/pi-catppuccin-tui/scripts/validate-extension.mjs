#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(
  join(root, "extensions", "catppuccin-tui.ts"),
  "utf8",
);

const checks = [
  {
    label: "global opt-in state file is defined",
    pattern: /STATE_FILE_NAME\s*=\s*"catppuccin-tui-state\.json"/,
  },
  {
    label: "restore falls back from session branch state to global state",
    pattern:
      /const savedState = readPersistedState\(ctx\) \?\? readGlobalState\(\);/,
  },
  {
    label: "toggles write global state before appending session state",
    pattern:
      /function persistState[\s\S]*writeGlobalState\(\);[\s\S]*pi\.appendEntry<PersistedState>\(STATE_CUSTOM_TYPE, \{ \.\.\.state \}\);/,
  },
];

const failures = checks.filter((check) => !check.pattern.test(source));
if (failures.length > 0) {
  console.error("Extension validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure.label}`);
  }
  process.exit(1);
}

console.log("Validated Catppuccin TUI extension persistence.");
