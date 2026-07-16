# @pi-tama/pi-openai-text-verbosity

Configure OpenAI Responses `text.verbosity` per provider or model from Pi's `models.json`.

## Usage

Load the extension from a local checkout:

```json
{
  "extensions": [
    "~/dev/oss/pi-tama/extensions/pi-openai-text-verbosity/src/index.ts"
  ]
}
```

Then add `textVerbosity` to a model in `~/.pi/agent/models.json`:

```json
{
  "providers": {
    "openai": {
      "models": [
        {
          "id": "gpt-5.6-sol",
          "textVerbosity": "low"
        }
      ]
    }
  }
}
```

Valid values are `low`, `medium`, and `high`. Remove the field to use the provider default.

The extension also accepts a provider default or a built-in model override:

```json
{
  "providers": {
    "openai": {
      "textVerbosity": "low",
      "modelOverrides": {
        "gpt-5.6-sol": {
          "textVerbosity": "medium"
        }
      }
    }
  }
}
```

Precedence is model entry, model override, then provider default.

## Behavior

- Applies only to Pi's standard `openai-responses` API. Codex Responses already has a native verbosity default.
- Preserves existing `text` request options.
- Reads `models.json` for every provider request, so configuration changes apply without restarting Pi.
- Skips an in-flight request when Pi's selected model no longer matches the payload model.
