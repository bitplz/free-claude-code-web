#!/usr/bin/env bash
# ─── Free Claude Web Launcher ─────────────────────────────
# Starts the free-claude-code proxy, then opens the web UI.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY_DIR="$SCRIPT_DIR/free-claude-code"
HTML_FILE="$SCRIPT_DIR/index.html"
PROXY_PORT=8082

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║       Free Claude Web Launcher        ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""

# ── Check if proxy repo exists ────────────────────────────
if [ ! -d "$PROXY_DIR" ]; then
  echo "  [!] Proxy repo not found at: $PROXY_DIR"
  echo ""
  echo "  Run these commands first:"
  echo "    git clone https://github.com/Alishahryar1/free-claude-code.git"
  echo "    cd free-claude-code && cp .env.example .env"
  echo "    # Edit .env with your API key"
  echo ""
  read -p "  Press Enter to exit..."
  exit 1
fi

# ── Check uv ──────────────────────────────────────────────
if ! command -v uv &>/dev/null; then
  echo "  [!] 'uv' not found. Install it:"
  echo "    curl -LsSf https://astral.sh/uv/install.sh | sh"
  read -p "  Press Enter to exit..."
  exit 1
fi

# ── Check if proxy already running ────────────────────────
if lsof -i :$PROXY_PORT &>/dev/null 2>&1; then
  echo "  [✓] Proxy already running on port $PROXY_PORT"
else
  echo "  [→] Starting proxy on port $PROXY_PORT..."
  cd "$PROXY_DIR"
  uv run uvicorn server:app --host 0.0.0.0 --port $PROXY_PORT &
  PROXY_PID=$!
  echo "  [✓] Proxy started (PID: $PROXY_PID)"
  echo "  [i] Waiting for proxy to be ready..."
  sleep 2
fi

# ── Open browser ──────────────────────────────────────────
echo "  [→] Opening web interface..."
if command -v xdg-open &>/dev/null; then
  xdg-open "$HTML_FILE"
elif command -v open &>/dev/null; then
  open "$HTML_FILE"
else
  echo "  [i] Open this file in your browser:"
  echo "      $HTML_FILE"
fi

echo ""
echo "  [✓] Free Claude Web is running!"
echo "  [i] Proxy: http://localhost:$PROXY_PORT"
echo "  [i] Press Ctrl+C to stop the proxy."
echo ""

# Keep script alive to allow Ctrl+C to kill proxy
if [ -n "$PROXY_PID" ]; then
  wait $PROXY_PID
fi
