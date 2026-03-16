#!/bin/bash
# Freepik Spaces MCP Server — Setup Script
# Installiert Abhängigkeiten und kompiliert das Projekt.

set -e

echo "=== Freepik Spaces MCP Server Setup ==="
echo ""

# Node.js Version prüfen
NODE_VERSION=$(node -v 2>/dev/null | sed "s/v//" | cut -d. -f1)
if [ -z "$NODE_VERSION" ]; then
  echo "FEHLER: Node.js ist nicht installiert."
  echo "Bitte installiere Node.js >= 18: https://nodejs.org/"
  exit 1
fi

if [ "$NODE_VERSION" -lt 18 ]; then
  echo "FEHLER: Node.js $NODE_VERSION gefunden, aber >= 18 wird benötigt."
  echo "Bitte aktualisiere Node.js: https://nodejs.org/"
  exit 1
fi

echo "Node.js v$(node -v | sed s/v//) gefunden."
echo ""

# Abhängigkeiten installieren
echo "1/2  npm install ..."
npm install
echo ""

# TypeScript kompilieren
echo "2/2  TypeScript kompilieren ..."
npx tsc
echo ""

echo "=== Setup abgeschlossen! ==="
echo ""
echo "Nächste Schritte:"
echo ""
echo "  1. Chrome mit Remote Debugging starten:"
echo "     /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222"
echo ""
echo "  2. Freepik Spaces öffnen:"
echo "     https://www.freepik.com/pikaso/spaces/..."
echo ""
echo "  3. Claude Desktop konfigurieren (claude_desktop_config.json):"
echo "     {"
echo "       \"mcpServers\": {"
echo "         \"freepik-spaces\": {"
echo "           \"command\": \"node\","
echo "           \"args\": [\"$(pwd)/dist/index.js\"]"
echo "         }"
echo "       }"
echo "     }"
echo ""
echo "  4. Claude Desktop neu starten"
echo ""
