import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const themesDir = join(root, "themes");

const requiredTokens = [
  "accent",
  "border",
  "borderAccent",
  "borderMuted",
  "success",
  "error",
  "warning",
  "muted",
  "dim",
  "text",
  "thinkingText",
  "selectedBg",
  "userMessageBg",
  "userMessageText",
  "customMessageBg",
  "customMessageText",
  "customMessageLabel",
  "toolPendingBg",
  "toolSuccessBg",
  "toolErrorBg",
  "toolTitle",
  "toolOutput",
  "mdHeading",
  "mdLink",
  "mdLinkUrl",
  "mdCode",
  "mdCodeBlock",
  "mdCodeBlockBorder",
  "mdQuote",
  "mdQuoteBorder",
  "mdHr",
  "mdListBullet",
  "toolDiffAdded",
  "toolDiffRemoved",
  "toolDiffContext",
  "syntaxComment",
  "syntaxKeyword",
  "syntaxFunction",
  "syntaxVariable",
  "syntaxString",
  "syntaxNumber",
  "syntaxType",
  "syntaxOperator",
  "syntaxPunctuation",
  "thinkingOff",
  "thinkingMinimal",
  "thinkingLow",
  "thinkingMedium",
  "thinkingHigh",
  "thinkingXhigh",
  "bashMode",
];

const requiredThemeNames = new Set([
  "catppuccin-tui-latte",
  "catppuccin-tui-frappe",
  "catppuccin-tui-macchiato",
  "catppuccin-tui-mocha",
]);

const hexPattern = /^#[0-9a-fA-F]{6}$/;
const requiredTokenSet = new Set(requiredTokens);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateColorValue(value, vars, location) {
  if (value === "") return;
  if (typeof value === "number") {
    assert(
      Number.isInteger(value) && value >= 0 && value <= 255,
      `${location} must be a 256-color integer`,
    );
    return;
  }
  if (typeof value === "string") {
    if (hexPattern.test(value)) return;
    assert(
      Object.hasOwn(vars, value),
      `${location} references unknown variable "${value}"`,
    );
    return;
  }
  throw new Error(`${location} has unsupported value ${JSON.stringify(value)}`);
}

const files = (await readdir(themesDir))
  .filter((file) => file.endsWith(".json"))
  .sort();
assert(files.length === 4, `Expected 4 theme files, found ${files.length}`);

const seenNames = new Set();

for (const file of files) {
  const filePath = join(themesDir, file);
  const raw = await readFile(filePath, "utf8");
  const theme = JSON.parse(raw);

  assert(theme.$schema, `${file} is missing $schema`);
  assert(
    typeof theme.name === "string" && theme.name.length > 0,
    `${file} is missing name`,
  );
  assert(
    requiredThemeNames.has(theme.name),
    `${file} has unexpected theme name ${theme.name}`,
  );
  assert(
    !seenNames.has(theme.name),
    `${file} duplicates theme name ${theme.name}`,
  );
  seenNames.add(theme.name);

  assert(
    theme.vars && typeof theme.vars === "object",
    `${file} is missing vars`,
  );
  for (const [name, value] of Object.entries(theme.vars)) {
    assert(
      hexPattern.test(value),
      `${file} var ${name} must be a 6-digit hex color`,
    );
  }

  assert(
    theme.colors && typeof theme.colors === "object",
    `${file} is missing colors`,
  );
  const colorKeys = Object.keys(theme.colors);
  const missing = requiredTokens.filter(
    (token) => !Object.hasOwn(theme.colors, token),
  );
  const extra = colorKeys.filter((token) => !requiredTokenSet.has(token));

  assert(missing.length === 0, `${file} missing tokens: ${missing.join(", ")}`);
  assert(extra.length === 0, `${file} has unknown tokens: ${extra.join(", ")}`);
  assert(
    colorKeys.length === requiredTokens.length,
    `${file} must define exactly ${requiredTokens.length} tokens`,
  );

  for (const token of requiredTokens) {
    validateColorValue(
      theme.colors[token],
      theme.vars,
      `${file} colors.${token}`,
    );
  }

  if (theme.export !== undefined) {
    assert(
      theme.export && typeof theme.export === "object",
      `${file} export must be an object`,
    );
    for (const key of ["pageBg", "cardBg", "infoBg"]) {
      if (theme.export[key] !== undefined) {
        validateColorValue(
          theme.export[key],
          theme.vars,
          `${file} export.${key}`,
        );
      }
    }
  }
}

for (const name of requiredThemeNames) {
  assert(seenNames.has(name), `Missing theme ${name}`);
}

console.log(
  `Validated ${files.length} themes with ${requiredTokens.length} Pi color tokens each.`,
);
