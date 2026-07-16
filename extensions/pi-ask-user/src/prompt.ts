/** Model-facing strings and the result-message builder for the ask_user tool. */

export const ASK_USER_PARAMETER_DESCRIPTIONS = {
  optionLabel: "Short display label for this option",
  optionDescription: "Optional one-line description shown below the label",
  question: "The question to ask the user",
  options:
    "Between 2 and 5 answer options. A free-form 'write my own answer' option is always appended automatically - never include one yourself.",
};

export const ASK_USER_TOOL_DESCRIPTION =
  "Ask the user a single multiple-choice question (2-5 options). A free-form 'write my own answer' option is always added automatically, and the user may dismiss the question without answering. Ask exactly one question per call.";

export const ASK_USER_PROMPT_SNIPPET =
  "Ask the user a multiple-choice question (2-5 options plus a free-form answer)";

export const ASK_USER_PROMPT_GUIDELINES = [
  "When asking the user a question whose likely answers can be enumerated, use the ask_user tool instead of asking in plain text.",
  "Ask one question per ask_user call; ask follow-up questions in subsequent calls.",
];

export type AskUserOutcome =
  | { kind: "no-ui" }
  | { kind: "cancelled" }
  | { kind: "dismissed" }
  | { kind: "custom"; answer: string }
  | { kind: "selected"; answer: string; index: number | undefined };

/** Builds the behavioral tool-result message returned to the parent model. */
export function buildAskUserResultMessage(outcome: AskUserOutcome): string {
  switch (outcome.kind) {
    case "no-ui":
      return "No interactive UI is available, so the question could not be shown. Ask the user in plain text instead.";
    case "cancelled":
      return "Cancelled";
    case "dismissed":
      return "User dismissed the question without answering. Do not assume an answer; proceed accordingly or ask differently.";
    case "custom":
      return `User wrote their own answer: ${outcome.answer}`;
    case "selected":
      return `User selected option ${outcome.index}: ${outcome.answer}`;
  }
}
