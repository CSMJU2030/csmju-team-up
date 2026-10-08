#!/bin/sh
set -eu
/app/node_modules/.bin/prisma migrate deploy --schema /app/backend/prisma/schema.prisma
exec node /app/backend/dist/main.js
