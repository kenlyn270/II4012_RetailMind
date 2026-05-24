#!/usr/bin/env bash
# Start ngrok tunnel for Fonnte webhook.
# Default mode uses docker-compose.dev.yml service `ngrok`.
# Optional local binary mode: NGROK_MODE=local ./backend/start-ngrok.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.dev.yml"
MODE="${NGROK_MODE:-docker}"
PORT="${PORT:-3001}"

# Load root .env first because Docker Compose also reads it from project root.
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

# Then load backend/.env for compatibility with existing local server setup.
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
  set +a
fi

PORT="${PORT:-3001}"

print_webhook_help() {
  cat <<EOF

⚠️  Setelah ngrok berjalan, copy HTTPS forwarding URL, contoh:
   https://xxxx.ngrok-free.app

Daftarkan di Fonnte dashboard:
   Webhook:        https://xxxx.ngrok-free.app/webhook/fonnte
   Connect:        https://xxxx.ngrok-free.app/webhook/fonnte/connect
   Message Status: https://xxxx.ngrok-free.app/webhook/fonnte/message-status

Ngrok inspection UI:
   http://localhost:4040

EOF
}

print_tunnels() {
  if command -v curl >/dev/null 2>&1; then
    echo "🔎 Current ngrok tunnels:"
    curl -fsS http://localhost:4040/api/tunnels 2>/dev/null \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const j=JSON.parse(s); const urls=(j.tunnels||[]).map(t=>t.public_url).filter(Boolean); console.log(urls.length ? urls.join("\n") : "No public URL yet. Open http://localhost:4040");}catch{console.log("Open http://localhost:4040 to view tunnel URL");}})' \
      || true
    echo ""
  fi
}

start_docker_ngrok() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "❌ Compose file not found: $COMPOSE_FILE" >&2
    exit 1
  fi

  if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Docker is not installed or not in PATH." >&2
    echo "   Use NGROK_MODE=local if you have ngrok binary installed locally." >&2
    exit 1
  fi

  if [[ -z "${NGROK_AUTHTOKEN:-}" ]]; then
    echo "❌ NGROK_AUTHTOKEN is not set." >&2
    echo "   Add it to either:" >&2
    echo "   - $REPO_ROOT/.env    (recommended for Docker Compose)" >&2
    echo "   - $SCRIPT_DIR/.env" >&2
    echo "" >&2
    echo "   Get token at: https://dashboard.ngrok.com/get-started/your-authtoken" >&2
    exit 1
  fi

  echo "🚀 Starting ngrok tunnel via Docker Compose..."
  echo "   Local server target: http://host.docker.internal:$PORT"
  echo "   Compose file: $COMPOSE_FILE"
  print_webhook_help

  cd "$REPO_ROOT"
  PORT="$PORT" NGROK_AUTHTOKEN="$NGROK_AUTHTOKEN" docker compose -f "$COMPOSE_FILE" --profile webhook up -d ngrok

  echo "⏳ Waiting for ngrok tunnel..."
  sleep 3
  print_tunnels

  echo "📜 Following ngrok logs. Press Ctrl+C to stop following logs; container will keep running."
  echo "   Stop tunnel with: docker compose -f docker-compose.dev.yml --profile webhook stop ngrok"
  docker compose -f "$COMPOSE_FILE" logs -f ngrok
}

start_local_ngrok() {
  if ! command -v ngrok >/dev/null 2>&1; then
    echo "❌ ngrok binary not found." >&2
    echo "   Install ngrok or run default Docker mode:" >&2
    echo "   ./backend/start-ngrok.sh" >&2
    exit 1
  fi

  echo "🚀 Starting ngrok tunnel using local ngrok binary..."
  echo "   Local port: $PORT"
  print_webhook_help
  echo "Press Ctrl+C to stop the tunnel"
  echo "---"

  ngrok http "$PORT"
}

case "$MODE" in
  docker)
    start_docker_ngrok
    ;;
  local)
    start_local_ngrok
    ;;
  *)
    echo "❌ Unknown NGROK_MODE: $MODE" >&2
    echo "   Supported modes: docker, local" >&2
    exit 1
    ;;
esac
