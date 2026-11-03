# claude-mods

Mods for the Claude Code desktop app, made by [@claudemod](https://www.tiktok.com/@claudemod) on TikTok.

Unofficial community mods, not made by or affiliated with Anthropic.

| Mod | What it does |
| --- | --- |
| [xp-bar](plugins/xp-bar) | A Minecraft-style XP bar above the prompt: your usage limit, roughly how many tokens that is, and when it refills |
| [craft-rush](plugins/craft-rush) | A crafting mini-game for the wait: random inventory, craft as much as you can before time runs out. Start it with `/craft` |
| [mode-bar](plugins/mode-bar) | Ten one-click modes above the chat that make Claude cheaper, faster or more careful, plus a traffic light for how heavy the current task is |

## Install

In Claude Code in your terminal, add the marketplace once, then install the mods you want:

```
/plugin marketplace add claudemod/claude-mods
/plugin install xp-bar@claude-mods
/plugin install craft-rush@claude-mods
/plugin install mode-bar@claude-mods
```

From your shell, without starting a session, it's the same without the slash:

```bash
claude plugin marketplace add claudemod/claude-mods
claude plugin install xp-bar@claude-mods
claude plugin install craft-rush@claude-mods
claude plugin install mode-bar@claude-mods
```

**In the desktop app:** click **+** next to the prompt, open **Add plugins** (or **Plugins → Browse plugins**), choose **Add marketplace**, enter `claudemod/claude-mods`, then install **XP Bar**, **Craft Rush** or **Mode Bar**.

Already added the marketplace for another mod? Run `claude plugin marketplace update claude-mods` (or `/plugin marketplace update claude-mods`) first, otherwise the new mod isn't found.

Start a new session afterwards and the mods show up. Play Craft Rush with `/craft`, or jump straight in with `/craft 2x2` or `/craft 3x3`.

The Mode Bar appears after your first message in a chat. To start a chat in a mode right away, send `/mode brief` (by name or number, optionally followed by your prompt). Using it together with the XP Bar? You need XP Bar 0.11.0 or newer: `claude plugin update xp-bar@claude-mods`.

All mods speak English or German and follow your system language. To pick one yourself, run `/plugin configure xp-bar@claude-mods` (or `craft-rush@claude-mods`) in Claude Code in your terminal.

## Update

Refresh the marketplace, then update each mod you have installed:

```bash
claude plugin marketplace update claude-mods
claude plugin update xp-bar@claude-mods
```

Then start a new session. Updating the marketplace alone doesn't update installed mods. Or turn on auto-update for `claude-mods` under **Marketplaces** in `/plugin`.

## Remove

```
/plugin uninstall xp-bar@claude-mods
```

---

## Deutsch

Mods für die Claude-Code-Desktop-App. Inoffizielle Community-Mods, nicht von Anthropic.

Installieren in Claude Code im Terminal:

```
/plugin marketplace add claudemod/claude-mods
/plugin install xp-bar@claude-mods
/plugin install craft-rush@claude-mods
/plugin install mode-bar@claude-mods
```

In der Desktop-App: **+** neben dem Eingabefeld → **Add plugins** (oder **Plugins → Browse plugins**) → **Add marketplace** → `claudemod/claude-mods` eingeben → **XP Bar**, **Craft Rush** oder **Mode Bar** installieren. Danach eine neue Sitzung starten. Craft Rush startet mit `/craft`. Die Mode Bar erscheint nach der ersten Nachricht, mit `/modus knapp` startet ein Chat direkt in einem Modus. Zusammen mit der XP-Leiste braucht sie XP-Leiste 0.11.0 oder neuer (`claude plugin update xp-bar@claude-mods`).

Marktplatz schon für einen anderen Mod hinzugefügt? Dann vorher `claude plugin marketplace update claude-mods` ausführen, sonst wird der neue Mod nicht gefunden.

Beide Mods sprechen Deutsch oder Englisch, je nach Systemsprache. Festlegen lässt sich das mit `/plugin configure <mod>@claude-mods` in Claude Code im Terminal.
