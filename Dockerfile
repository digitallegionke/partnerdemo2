# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./

RUN npm ci 2>/dev/null || npm install

COPY . .
RUN npm run build

# Production stage
# Env vars (NODE_ENV, NEXT_TELEMETRY_DISABLED, PORT, HOSTNAME) are defined in .env.
# At runtime use: docker run --env-file .env ... to load them.
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Defaults; override at runtime with: docker run --env-file .env ...
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
