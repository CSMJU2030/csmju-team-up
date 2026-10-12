#!/bin/sh
set -eu
cd /app/backend && ./node_modules/.bin/prisma migrate deploy
exec node /app/backend/dist/main.js
