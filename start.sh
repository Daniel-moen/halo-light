#!/bin/sh
# Build (if needed) and serve Halo Light on 0.0.0.0:8050, detached.
# Writes the server PID to server.pid and output to server.log.
set -e
cd "$(dirname "$0")"
PORT="${PORT:-8050}"

if [ -f server.pid ] && kill -0 "$(cat server.pid)" 2>/dev/null; then
  echo "Already running (pid $(cat server.pid)) on port $PORT"
  exit 0
fi
if [ ! -f dist/index.html ] || [ "$1" = "--build" ]; then
  npm run build
fi

NODE="$(command -v node)"
# setsid detaches from this terminal's session so the server outlives it.
nohup perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' "$NODE" server.mjs "$PORT" 0.0.0.0 \
  >> server.log 2>&1 < /dev/null &
echo $! > server.pid
sleep 0.5
if kill -0 "$(cat server.pid)" 2>/dev/null; then
  echo "Halo Light running (pid $(cat server.pid)): http://localhost:$PORT"
  IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
  [ -n "$IP" ] && echo "On your network: http://$IP:$PORT"
else
  echo "Server failed to start; see server.log" >&2
  exit 1
fi
