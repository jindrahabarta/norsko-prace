#!/usr/bin/env bash
# Ověří, zda daný Stripe signing secret odpovídá tomu, který používá produkce.
#
# Použití:  ./scripts/stripe-webhook-check.sh
# Skript se na secret zeptá (nevypisuje se a nejde do historie shellu).
#
# Pošle na /api/stripe/webhook neškodnou podepsanou událost typu "ping":
#   HTTP 200  → secret SEDÍ s produkcí
#   HTTP 400  → NESEDÍ, do Vercelu patří jiná hodnota
set -uo pipefail

URL="${WEBHOOK_URL:-https://norsko-prace.cz/api/stripe/webhook}"

printf 'Vlož signing secret (whsec_…), Enter: '
read -rs SECRET
echo

[ -n "$SECRET" ] || { echo "Nic jsi nevložil."; exit 1; }

# Kontrola tvaru — nejčastější chybou je zatoulaná mezera nebo uvozovky
case "$SECRET" in
  whsec_*) ;;
  *) echo "⚠ Nezačíná na whsec_ — zkontroluj, co se zkopírovalo." ;;
esac
case "$SECRET" in
  *[[:space:]]*|*\"*|*\'*) echo "⚠ Obsahuje mezeru nebo uvozovku — to samo stačí, aby podpis neplatil." ;;
esac
echo "  délka: ${#SECRET} znaků"

PAYLOAD='{"id":"evt_check","object":"event","type":"ping","data":{"object":{}}}'
TS=$(date +%s)
SIG=$(printf '%s' "$TS.$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/.*= *//')

CODE=$(curl -s -o /tmp/whcheck.$$ -w '%{http_code}' -m 60 -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=$TS,v1=$SIG" \
  --data "$PAYLOAD")

echo "  odpověď produkce: HTTP $CODE $(head -c 120 /tmp/whcheck.$$)"
rm -f /tmp/whcheck.$$
echo
case "$CODE" in
  200) echo "✅ Tento secret SEDÍ s tím, co má produkce. Pokud Stripe i tak hlásí neplatný podpis, nesedí endpoint, ze kterého jsi ho vzal (zkontroluj přepínač test/live)." ;;
  400) echo "❌ NESEDÍ. Tuhle hodnotu vlož do Vercelu jako STRIPE_WEBHOOK_SECRET a nasaď znovu." ;;
  *)   echo "⚠ Neočekávaná odpověď — endpoint možná není dostupný." ;;
esac
