# CSMJU2030 1.8.4 · DEP-01..04
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_ENV=production
RUN corepack enable pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --filter backend...
COPY backend/ backend/
RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=4000 TZ=Asia/Bangkok
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/backend/node_modules ./backend/node_modules
COPY --from=builder --chown=node:node /app/backend/dist ./backend/dist
COPY --from=builder --chown=node:node /app/backend/prisma ./backend/prisma
COPY --from=builder --chown=node:node /app/backend/prisma.config.ts ./backend/prisma.config.ts
COPY --from=builder --chown=node:node /app/backend/package.json ./backend/package.json
COPY --from=builder --chown=node:node /app/backend/docker ./backend/docker
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD node -e "require('net').connect(4000,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"
ENTRYPOINT ["/app/backend/docker/entrypoint.sh"]
