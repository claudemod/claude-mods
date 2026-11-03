# Mode Bar

Ten one-click modes above the chat in Claude Code, plus a traffic light that shows how heavy the current task is.

- **Traffic light:** green, yellow or red by the tokens the running task has used so far (all model steps, subagents included, weighted by price). Hover it for the numbers.
- **Buttons:** on the desktop each mode is an app-icon-like tile in a calm colour that matches Claude's orange, with a line symbol and the mode's name under it; hover one to see what it does, click to pick it.
- **Modes:** Eco, Quick, Brief, Normal, Plan, Review, Explain, Debug, Test, Deep. Eco and Quick send requests to a smaller model with low effort, Deep to Opus with high effort; Plan and Review block file edits. Every chat starts in Normal, which changes nothing.
- **Your own modes:** each mode is a file in `modes/` (header with label, color, model, effort, blocked tools, hint; below it the note the model gets with each message).
- With the XP Bar mod installed, the XP bar sits above the buttons.
- **Before the first message** a chat has no bar yet (the app starts Claude Code with the first message). Pick the mode with that message instead: `/mode brief` (German: `/modus knapp`), by name or number, optionally followed by your prompt. Each chat keeps its mode, also after the app pauses it.

Language: `auto`, `de` or `en` in the plugin settings.
