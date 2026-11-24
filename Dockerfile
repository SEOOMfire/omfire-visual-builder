FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fontconfig \
    fonts-liberation \
    fonts-noto-core \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CHROMIUM_PATH=/usr/bin/chromium \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts/db-migrate.mjs ./scripts/db-migrate.mjs
COPY --from=build /app/docker/entrypoint.sh ./docker/entrypoint.sh
COPY --from=build /app/node_modules/postgres ./node_modules/postgres
COPY --from=build /app/node_modules/playwright-core ./node_modules/playwright-core
RUN chmod +x docker/entrypoint.sh
EXPOSE 3000
CMD ["docker/entrypoint.sh"]
