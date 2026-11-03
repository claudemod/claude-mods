# claude-mods

Mods for the Claude Code desktop app, made by [@claudemod](https://www.tiktok.com/@claudemod) on TikTok.

Unofficial community mods, not made by or affiliated with Anthropic.

| Mod | What it does |
| --- | --- |
| [xp-bar](plugins/xp-bar) | A Minecraft-style XP bar above the prompt: your usage limit, roughly how many tokens that is, and when it refills |
| [craft-rush](plugins/craft-rush) | A crafting mini-game for the wait: random inventory, craft as much as you can before time runs out. Start it with `/craft` |

## Install

In Claude Code in your terminal, add the marketplace once, then install the mods you want:

```
/plugin marketplace add claudemod/claude-mods
/plugin install xp-bar@claude-mods
/plugin install craft-rush@claude-mods
```

From your shell, without starting a session, it's the same without the slash:

```bash
claude plugin marketplace add claudemod/claude-mods
claude plugin install xp-bar@claude-mods
claude plugin install craft-rush@claude-mods
```

**In the desktop app:** click **+** next to the prompt, open **Add plugins** (or **Plugins → Browse plugins**), choose **Add marketplace**, enter `claudemod/claude-mods`, then install **XP Bar** or **Craft Rush**.

Already added the marketplace for another mod? Run `claude plugin marketplace update claude-mods` (or `/plugin marketplace update claude-mods`) first, otherwise the new mod isn't found.

Start a new session afterwards and the mods show up. Play Craft Rush with `/craft`, or jump straight in with `/craft 2x2` or `/craft 3x3`.

Both mods speak English or German and follow your system language. To pick one yourself, run `/plugin configure xp-bar@claude-mods` (or `craft-rush@claude-mods`) in Claude Code in your terminal.

## Update

```
/plugin marketplace update claude-mods
```

Then start a new session. Or turn on auto-update for `claude-mods` under **Marketplaces** in `/plugin`.

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
```

In der Desktop-App: **+** neben dem Eingabefeld → **Add plugins** (oder **Plugins → Browse plugins**) → **Add marketplace** → `claudemod/claude-mods` eingeben → **XP Bar** oder **Craft Rush** installieren. Danach eine neue Sitzung starten. Craft Rush startet mit `/craft`.

Marktplatz schon für einen anderen Mod hinzugefügt? Dann vorher `claude plugin marketplace update claude-mods` ausführen, sonst wird der neue Mod nicht gefunden.

Beide Mods sprechen Deutsch oder Englisch, je nach Systemsprache. Festlegen lässt sich das mit `/plugin configure <mod>@claude-mods` in Claude Code im Terminal.
