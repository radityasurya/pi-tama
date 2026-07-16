# @pi-tama/pi-ask-user

A multiple-choice `ask_user` tool for [Pi](https://pi.dev).

Registers an `ask_user` tool the model can call to ask you one multiple-choice question at a time (2-5 options). A free-form "write my own answer" option is always appended, and you can dismiss the question with Esc. The model is told the outcome (selected option, custom answer, or dismissed).

## Install

```sh
pi install npm:@pi-tama/pi-ask-user
```

Then restart Pi or run `/reload`.

## Behavior

- Popup UI: arrow keys or number keys to pick, Enter to confirm.
- Selecting "Write my own answer…" opens an inline single-line editor; Enter submits, Esc returns to the options.
- Esc on the options dismisses the question — the model is told the user declined rather than guessing an answer.
- Outside the TUI (`-p`, `--mode json`), the tool returns a message telling the model to ask in plain text instead.

The keyboard and selection logic is a pure state machine in `src/question.ts`, unit-tested without the TUI.
