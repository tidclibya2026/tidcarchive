FROM node:22-bookworm-slim

WORKDIR /app
COPY . .

RUN corepack enable \
  && corepack pnpm install --frozen-lockfile \
  && corepack pnpm run build

ENV NODE_ENV=production
CMD ["node", "ops/local-windows/start-local.mjs"]
