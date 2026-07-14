import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getAgentDir,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

type TextVerbosity = "low" | "medium" | "high";
type JsonObject = Record<string, unknown>;

const SUPPORTED_API = "openai-responses";

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTextVerbosity(value: unknown): TextVerbosity | undefined {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : undefined;
}

export function resolveTextVerbosity(
  config: unknown,
  provider: string,
  modelId: string,
): TextVerbosity | undefined {
  if (!isObject(config) || !isObject(config.providers)) return undefined;

  const providerConfig = config.providers[provider];
  if (!isObject(providerConfig)) return undefined;

  let verbosity = normalizeTextVerbosity(providerConfig.textVerbosity);

  const modelOverride = isObject(providerConfig.modelOverrides)
    ? providerConfig.modelOverrides[modelId]
    : undefined;
  if (isObject(modelOverride)) {
    verbosity =
      normalizeTextVerbosity(modelOverride.textVerbosity) ?? verbosity;
  }

  if (Array.isArray(providerConfig.models)) {
    const model = providerConfig.models.find(
      (candidate) => isObject(candidate) && candidate.id === modelId,
    );
    if (isObject(model))
      verbosity = normalizeTextVerbosity(model.textVerbosity) ?? verbosity;
  }

  return verbosity;
}

export function patchTextVerbosity(
  payload: unknown,
  verbosity: TextVerbosity,
): unknown {
  if (!isObject(payload)) return payload;
  const text = isObject(payload.text) ? payload.text : {};
  return { ...payload, text: { ...text, verbosity } };
}

export function registerOpenAITextVerbosity(
  pi: ExtensionAPI,
  options: { modelsPath?: string } = {},
): void {
  const modelsPath = options.modelsPath ?? join(getAgentDir(), "models.json");

  pi.on("before_provider_request", (event, ctx) => {
    if (!ctx.model || ctx.model.api !== SUPPORTED_API) return;
    if (!isObject(event.payload)) return;

    // Avoid patching an in-flight request if the selected model changed mid-run.
    if (
      typeof event.payload.model === "string" &&
      event.payload.model !== ctx.model.id
    )
      return;

    let config: unknown;
    try {
      config = JSON.parse(readFileSync(modelsPath, "utf8"));
    } catch {
      return;
    }

    const verbosity = resolveTextVerbosity(
      config,
      ctx.model.provider,
      ctx.model.id,
    );
    if (!verbosity) return;
    return patchTextVerbosity(event.payload, verbosity);
  });
}

export default function openAITextVerbosity(pi: ExtensionAPI): void {
  registerOpenAITextVerbosity(pi);
}
