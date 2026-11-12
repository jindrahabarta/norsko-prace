#!/usr/bin/env bash
# Přenese proměnné prostředí ze staženého souboru do nalinkovaného Vercel projektu.
#
# Použití:  ./scripts/vercel-env-push.sh .env.vercel-stary production
#
# Hodnoty se nikam nevypisují — do terminálu jde jen název proměnné a výsledek.
set -uo pipefail

FILE="${1:?Zadej soubor, např. .env.vercel-stary}"
ENVIRONMENT="${2:-production}"

[ -f "$FILE" ] || { echo "Soubor $FILE neexistuje"; exit 1; }

ok=0; skipped=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|'#'*) continue ;; esac
  name="${line%%=*}"
  value="${line#*=}"
  case "$name" in *[!A-Za-z0-9_]*|'') continue ;; esac
  # uvozovky, které přidává `vercel env pull`
  value="${value%\"}"; value="${value#\"}"

  if printf '%s' "$value" | npx vercel env add "$name" "$ENVIRONMENT" --force >/dev/null 2>&1; then
    echo "  ✓ $name"
    ok=$((ok + 1))
  else
    echo "  ✗ $name (nepřidáno — přidej ručně v dashboardu)"
    skipped=$((skipped + 1))
  fi
done < "$FILE"

echo "Hotovo: $ok přeneseno, $skipped selhalo (prostředí: $ENVIRONMENT)."
