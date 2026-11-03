#!/bin/sh
# Copies a mod from its working folder next to this repo into plugins/<name>.
# Usage: scripts/sync-mod.sh xp-bar
# Bump "version" in the mod's .claude-plugin/plugin.json before you push,
# otherwise people who already installed it keep their cached copy.
set -eu

name="${1:?usage: scripts/sync-mod.sh <mod-name>}"
repo="$(cd "$(dirname "$0")/.." && pwd)"
src="$repo/../$name"

[ -f "$src/.claude-plugin/plugin.json" ] || { echo "no mod at $src" >&2; exit 1; }

rsync -a --delete \
  --exclude '.claude-plugin/marketplace.json' \
  --exclude '.DS_Store' \
  "$src/" "$repo/plugins/$name/"

echo "synced $name: $(grep '"version"' "$repo/plugins/$name/.claude-plugin/plugin.json" | tr -d ' ,')"
