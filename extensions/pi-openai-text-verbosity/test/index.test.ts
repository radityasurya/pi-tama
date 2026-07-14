import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  patchTextVerbosity,
  registerOpenAITextVerbosity,
  resolveTextVerbosity,
} from "../src/index.ts";

function modelConfig(textVerbosity: unknown = "low") {
  return {
    providers: {
      "internal-openai": {
        models: [
          { id: "gpt-5.6-sol", textVerbosity },
          { id: "gpt-5.6-luna", textVerbosity: "medium" },
        ],
      },
    },
  };
}

function createHarness(modelsPath: string) {
  let handler: ((event: any, ctx: any) => unknown) | undefined;
  const pi = {
    on(name: string, candidate: (event: any, ctx: any) => unknown) {
      if (name === "before_provider_request") handler = candidate;
    },
  };
  registerOpenAITextVerbosity(pi as any, { modelsPath });
  if (!handler) {
    throw new Error("before_provider_request handler was not registered");
  }
  return (
    payload: unknown,
    model: { provider: string; id: string; api: string },
  ) => handler!({ payload }, { model });
}

describe("OpenAI text verbosity", () => {
  test("resolves provider, override, and model-level settings", () => {
    const config = {
      providers: {
        openai: {
          textVerbosity: "high",
          modelOverrides: {
            "gpt-5.6-terra": { textVerbosity: "medium" },
          },
          models: [{ id: "gpt-5.6-sol", textVerbosity: "low" }],
        },
      },
    };

    expect(resolveTextVerbosity(config, "openai", "gpt-5.6-sol")).toBe("low");
    expect(resolveTextVerbosity(config, "openai", "gpt-5.6-terra")).toBe(
      "medium",
    );
    expect(resolveTextVerbosity(config, "openai", "gpt-5.6-luna")).toBe("high");
    expect(
      resolveTextVerbosity(config, "anthropic", "gpt-5.6-sol"),
    ).toBeUndefined();
  });

  test("ignores unsupported values", () => {
    expect(
      resolveTextVerbosity(
        modelConfig("brief"),
        "internal-openai",
        "gpt-5.6-sol",
      ),
    ).toBeUndefined();
  });

  test("preserves existing text options while setting verbosity", () => {
    expect(
      patchTextVerbosity(
        { model: "gpt-5.6-sol", text: { format: { type: "text" } } },
        "low",
      ),
    ).toEqual({
      model: "gpt-5.6-sol",
      text: { format: { type: "text" }, verbosity: "low" },
    });
  });

  test("patches matching OpenAI Responses requests from models.json", () => {
    const root = mkdtempSync(join(tmpdir(), "pi-text-verbosity-"));
    try {
      const modelsPath = join(root, "models.json");
      writeFileSync(modelsPath, JSON.stringify(modelConfig()), "utf8");
      const request = createHarness(modelsPath);
      const model = {
        provider: "internal-openai",
        id: "gpt-5.6-sol",
        api: "openai-responses",
      };

      expect(request({ model: "gpt-5.6-sol", input: [] }, model)).toEqual({
        model: "gpt-5.6-sol",
        input: [],
        text: { verbosity: "low" },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not patch unsupported APIs or mismatched in-flight models", () => {
    const root = mkdtempSync(join(tmpdir(), "pi-text-verbosity-"));
    try {
      const modelsPath = join(root, "models.json");
      writeFileSync(modelsPath, JSON.stringify(modelConfig()), "utf8");
      const request = createHarness(modelsPath);
      const selected = {
        provider: "internal-openai",
        id: "gpt-5.6-sol",
        api: "openai-responses",
      };

      expect(request({ model: "gpt-5.6-luna" }, selected)).toBeUndefined();
      expect(
        request(
          { model: "gpt-5.6-sol" },
          { ...selected, api: "anthropic-messages" },
        ),
      ).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
