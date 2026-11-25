#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "============================================================================"
echo "  METATRON CaricoStudio — Creazione Software Desktop (macOS / Linux)"
echo "============================================================================"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERRORE] Node.js 20+ richiesto. Installalo da https://nodejs.org/"
  exit 1
fi

echo "[1/4] Installazione dipendenze progetto..."
npm install

echo "[2/4] Installazione Electron e electron-builder..."
npm install --no-save electron electron-builder

echo "[3/4] Compilazione frontend e motore server interno..."
npm run build
node scripts/build-desktop-server.mjs

OS_NAME="$(uname -s)"
echo "[4/4] Generazione pacchetto eseguibile per ${OS_NAME}..."
if [[ "${OS_NAME}" == "Darwin" ]]; then
  npx electron-builder --mac --config desktop-app/electron-builder.json
else
  npx electron-builder --linux --config desktop-app/electron-builder.json
fi

echo ""
echo "============================================================================"
echo "  COMPLETATO! Trovi il software compilato nella cartella: ./release/"
echo "============================================================================"
