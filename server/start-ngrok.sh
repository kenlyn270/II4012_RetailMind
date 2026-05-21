#!/bin/bash
# Start ngrok tunnel for Fonnte webhook (free tier)
# This exposes your local server (port 3001) with a random ngrok URL

PORT=3001

echo "🚀 Starting ngrok tunnel (free tier)..."
echo "   Local port: $PORT"
echo ""
echo "⚠️  Setelah ngrok berjalan, copy URL yang diberikan (contoh: https://xxxx.ngrok-free.app)"
echo "   Lalu daftarkan di Fonnte dashboard:"
echo ""
echo "   Webhook:        https://xxxx.ngrok-free.app/webhook/fonnte"
echo "   Connect:        https://xxxx.ngrok-free.app/webhook/fonnte/connect"
echo "   Message Status: https://xxxx.ngrok-free.app/webhook/fonnte/message-status"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo "---"

ngrok http $PORT
