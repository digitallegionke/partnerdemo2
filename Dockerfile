# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./

RUN npm ci 2>/dev/null || npm install

# 1. Define the arguments passed from GitHub Actions
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_EMBED_MAP
ARG RESEND_API_KEY
ARG MAPS_PLATFORM_API_KEY
ARG FROM_EMAIL

# 2. Assign them to environment variables so they persist at runtime
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_EMBED_MAP=${NEXT_PUBLIC_EMBED_MAP}
ENV RESEND_API_KEY=${RESEND_API_KEY}
ENV MAPS_PLATFORM_API_KEY=${MAPS_PLATFORM_API_KEY}
ENV FROM_EMAIL=${FROM_EMAIL}

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
