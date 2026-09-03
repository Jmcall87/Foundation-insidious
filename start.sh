#!/bin/sh
if [ -z "$ADMIN_PASS" ]; then
  ADMIN_PASS=$(head -c 24 /dev/urandom | base64 | tr -dc "A-Za-z0-9" | head -c 16)
  export ADMIN_PASS
  echo "=== ADMIN PASSWORD (change after first login): $ADMIN_PASS ==="
fi
exec node server.js
