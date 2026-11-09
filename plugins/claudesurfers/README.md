# ClaudeSurfers

A three-lane surf runner for the wait, right beside the chat. Your buddy rides a stream of code: dodge rate limits, permission dialogs and merge conflicts, collect tokens, and spend them on new buddies.

- `/surf` opens the game, `/surf buddies` goes straight to the buddies.
- Click the game once, then steer: `←` `→` change lane, `↑` jumps, `↓` ducks, `p` pauses. Swiping or clicking the sides works too.
- Pick-ups: magnet (pulls tokens in), ×2 (double points), dash (smashes everything for 4 seconds), checkpoint (survives one hit).
- Twelve buddies: eight to buy with tokens, three to earn (5,000 points, 30 runs, all the others), and Claude from the start. Score, tokens and buddies are kept across sessions.
- The world changes from day to dusk to terminal night as you get further.

Language: `auto`, `de` or `en` in the plugin settings.

Works in the desktop app with pixel art and in the terminal in letters.

## Install

```
claude plugin marketplace add claudemod/claude-mods
claude plugin marketplace update claude-mods
claude plugin install claudesurfers@claude-mods
```

Then start a new session and type `/surf`. Desktop app: + next to the prompt → Add plugins → Add marketplace → `claudemod/claude-mods` → install ClaudeSurfers.

Unofficial community mod, not made by Anthropic.
