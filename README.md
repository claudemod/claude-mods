# claude-mods

Mods for the Claude Code desktop app, made by [@claudemod](https://www.tiktok.com/@claudemod) on TikTok.

| Mod | What it does |
| --- | --- |
| [xp-bar](plugins/xp-bar) | A Minecraft-style XP bar above the prompt: your usage limit, roughly how many tokens that is, and when it refills |

## Install

In Claude Code in your terminal, run these two commands:

```
/plugin marketplace add claudemod/claude-mods
/plugin install xp-bar@claude-mods
```

From your shell, without starting a session, it's the same without the slash:

```bash
claude plugin marketplace add claudemod/claude-mods
claude plugin install xp-bar@claude-mods
```

**In the desktop app:** click **+** next to the prompt, open **Add plugins** (or **Plugins → Browse plugins**), choose **Add marketplace**, enter `claudemod/claude-mods`, then install **XP Bar**.

Start a new session afterwards and the mod shows up.

The XP bar speaks English or German and follows your system language. To pick one yourself, run `/plugin configure xp-bar@claude-mods` in Claude Code in your terminal.

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

Mods für die Claude-Code-Desktop-App. Installieren in Claude Code im Terminal:

```
/plugin marketplace add claudemod/claude-mods
/plugin install xp-bar@claude-mods
```

In der Desktop-App: **+** neben dem Eingabefeld → **Add plugins** (oder **Plugins → Browse plugins**) → **Add marketplace** → `claudemod/claude-mods` eingeben → **XP Bar** installieren. Danach eine neue Sitzung starten.

Die XP-Leiste spricht Deutsch oder Englisch, je nach Systemsprache. Festlegen lässt sich das mit `/plugin configure xp-bar@claude-mods` in Claude Code im Terminal.
