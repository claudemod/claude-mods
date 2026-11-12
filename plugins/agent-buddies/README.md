# Agent Buddies

Every agent Claude sends out gets its own little blocky buddy in its own colour, in a panel beside the chat.

- Each buddy walks and blinks while its agent works and holds what fits the current tool: a pencil for edits, a book for reading, a terminal for commands, a magnifier for searches, a globe for the web.
- Each buddy shows how far it is in per cent: exact when the agent keeps a to-do list, otherwise estimated from how many steps earlier agents of its type took (marked with ~). The coloured strip of everything it has done fills up to that point.
- Under each buddy, the last three tool calls run live. The list shows whatever that agent really calls, MCP tools included.
- Click a buddy to open its whole run: the task it was given, model, steps and tokens, its steps grouped into phases (exploring, editing, running …) with when each started and how long it took, and the answer it handed back. Tabs at the top jump between agents.
- Click any step to open it, like in the chat: the diff of an edit, the output of a command. Click a phase to fold it. Very long runs fold their older phases by themselves, so the view always fits.
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
