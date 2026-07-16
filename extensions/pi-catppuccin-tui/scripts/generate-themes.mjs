import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "themes");

const schema =
  "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json";

const palette = {
  latte: {
    rosewater: "#dc8a78",
    flamingo: "#dd7878",
    pink: "#ea76cb",
    mauve: "#8839ef",
    red: "#d20f39",
    maroon: "#e64553",
    peach: "#fe640b",
    yellow: "#df8e1d",
    green: "#40a02b",
    teal: "#179299",
    sky: "#04a5e5",
    sapphire: "#209fb5",
    blue: "#1e66f5",
    lavender: "#7287fd",
    text: "#4c4f69",
    subtext1: "#5c5f77",
    subtext0: "#6c6f85",
    overlay2: "#7c7f93",
    overlay1: "#8c8fa1",
    overlay0: "#9ca0b0",
    surface2: "#acb0be",
    surface1: "#bcc0cc",
    surface0: "#ccd0da",
    base: "#eff1f5",
    mantle: "#e6e9ef",
    crust: "#dce0e8",
  },
  frappe: {
    rosewater: "#f2d5cf",
    flamingo: "#eebebe",
    pink: "#f4b8e4",
    mauve: "#ca9ee6",
    red: "#e78284",
    maroon: "#ea999c",
    peach: "#ef9f76",
    yellow: "#e5c890",
    green: "#a6d189",
    teal: "#81c8be",
    sky: "#99d1db",
    sapphire: "#85c1dc",
    blue: "#8caaee",
    lavender: "#babbf1",
    text: "#c6d0f5",
    subtext1: "#b5bfe2",
    subtext0: "#a5adce",
    overlay2: "#949cbb",
    overlay1: "#838ba7",
    overlay0: "#737994",
    surface2: "#626880",
    surface1: "#51576d",
    surface0: "#414559",
    base: "#303446",
    mantle: "#292c3c",
    crust: "#232634",
  },
  macchiato: {
    rosewater: "#f4dbd6",
    flamingo: "#f0c6c6",
    pink: "#f5bde6",
    mauve: "#c6a0f6",
    red: "#ed8796",
    maroon: "#ee99a0",
    peach: "#f5a97f",
    yellow: "#eed49f",
    green: "#a6da95",
    teal: "#8bd5ca",
    sky: "#91d7e3",
    sapphire: "#7dc4e4",
    blue: "#8aadf4",
    lavender: "#b7bdf8",
    text: "#cad3f5",
    subtext1: "#b8c0e0",
    subtext0: "#a5adcb",
    overlay2: "#939ab7",
    overlay1: "#8087a2",
    overlay0: "#6e738d",
    surface2: "#5b6078",
    surface1: "#494d64",
    surface0: "#363a4f",
    base: "#24273a",
    mantle: "#1e2030",
    crust: "#181926",
  },
  mocha: {
    rosewater: "#f5e0dc",
    flamingo: "#f2cdcd",
    pink: "#f5c2e7",
    mauve: "#cba6f7",
    red: "#f38ba8",
    maroon: "#eba0ac",
    peach: "#fab387",
    yellow: "#f9e2af",
    green: "#a6e3a1",
    teal: "#94e2d5",
    sky: "#89dceb",
    sapphire: "#74c7ec",
    blue: "#89b4fa",
    lavender: "#b4befe",
    text: "#cdd6f4",
    subtext1: "#bac2de",
    subtext0: "#a6adc8",
    overlay2: "#9399b2",
    overlay1: "#7f849c",
    overlay0: "#6c7086",
    surface2: "#585b70",
    surface1: "#45475a",
    surface0: "#313244",
    base: "#1e1e2e",
    mantle: "#181825",
    crust: "#11111b",
  },
};

const colorTokens = {
  accent: "mauve",
  border: "surface2",
  borderAccent: "lavender",
  borderMuted: "surface1",
  success: "green",
  error: "red",
  warning: "yellow",
  muted: "subtext0",
  dim: "overlay1",
  text: "text",
  thinkingText: "subtext1",
  selectedBg: "surface0",
  userMessageBg: "surface0",
  userMessageText: "text",
  customMessageBg: "mantle",
  customMessageText: "text",
  customMessageLabel: "mauve",
  toolPendingBg: "mantle",
  toolSuccessBg: "surface0",
  toolErrorBg: "surface0",
  toolTitle: "blue",
  toolOutput: "overlay2",
  mdHeading: "mauve",
  mdLink: "blue",
  mdLinkUrl: "sapphire",
  mdCode: "peach",
  mdCodeBlock: "subtext1",
  mdCodeBlockBorder: "surface2",
  mdQuote: "subtext0",
  mdQuoteBorder: "surface2",
  mdHr: "surface2",
  mdListBullet: "mauve",
  toolDiffAdded: "green",
  toolDiffRemoved: "red",
  toolDiffContext: "subtext0",
  syntaxComment: "overlay2",
  syntaxKeyword: "mauve",
  syntaxFunction: "blue",
  syntaxVariable: "maroon",
  syntaxString: "green",
  syntaxNumber: "peach",
  syntaxType: "yellow",
  syntaxOperator: "sky",
  syntaxPunctuation: "overlay2",
  thinkingOff: "surface1",
  thinkingMinimal: "surface2",
  thinkingLow: "blue",
  thinkingMedium: "sapphire",
  thinkingHigh: "mauve",
  thinkingXhigh: "red",
  bashMode: "peach",
};

const names = {
  latte: "catppuccin-tui-latte",
  frappe: "catppuccin-tui-frappe",
  macchiato: "catppuccin-tui-macchiato",
  mocha: "catppuccin-tui-mocha",
};

function exportColors(flavor, vars) {
  if (flavor === "latte") {
    return {
      pageBg: vars.base,
      cardBg: vars.mantle,
      infoBg: vars.surface0,
    };
  }

  return {
    pageBg: vars.crust,
    cardBg: vars.base,
    infoBg: vars.surface0,
  };
}

await mkdir(outDir, { recursive: true });

for (const [flavor, vars] of Object.entries(palette)) {
  const theme = {
    $schema: schema,
    name: names[flavor],
    vars,
    colors: colorTokens,
    export: exportColors(flavor, vars),
  };

  await writeFile(
    join(outDir, `${names[flavor]}.json`),
    `${JSON.stringify(theme, null, 2)}\n`,
  );
}

console.log(`Generated ${Object.keys(palette).length} Catppuccin Pi themes.`);
