# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock* .yarnrc.yml* ./
RUN yarn install --frozen-lockfile 2>/dev/null || yarn install

COPY . .
RUN yarn build

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

EXPOSE 4001

# Defaults; override at runtime with: docker run --env-file .env ...
ENV PORT=4001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
