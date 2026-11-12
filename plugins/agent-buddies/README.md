# Agent Buddies

Every agent Claude sends out gets its own little blocky buddy in its own colour, in a panel beside the chat.

- Each buddy walks and blinks while its agent works and holds what fits the current tool: a pencil for edits, a book for reading, a terminal for commands, a magnifier for searches, a globe for the web.
- Under each buddy, the last three tool calls run live, above a coloured strip of everything it has done so far. The list shows whatever that agent really calls, MCP tools included.
- Click a buddy to open its whole run: the task it was given, model, steps and tokens, its steps grouped into phases (reading, searching, editing, running …) with when each started and how long it took, and the answer it handed back. Tabs at the top jump between agents.
- Click any step to open it, like in the chat: the diff of an edit, the output of a command. Click a phase to fold it.
- `/buddies` opens the panel by hand.

Language: `auto`, `de` or `en` in the plugin settings.

## Install

```
claude plugin marketplace add claudemod/claude-mods
claude plugin marketplace update claude-mods
claude plugin install agent-buddies@claude-mods
```

Then start a new session. Desktop app: + next to the prompt → Add plugins → Add marketplace → `claudemod/claude-mods` → install Agent Buddies.

Unofficial community mod, not made by Anthropic.
