# ============================================================
# 山地索道塔架监测平台 - Qwik 前端构建
# pnpm 构建 + Node Express SSR + 静态资源托管
# ============================================================

# -------- Stage 1: 构建 --------
FROM node:20-alpine3.20 AS builder
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prefer-offline

COPY . .
RUN pnpm build.server && pnpm build.client

# -------- Stage 2: 生产 --------
FROM node:20-alpine3.20 AS runtime
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
  && apk add --no-cache tzdata nginx \
  && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
  && mkdir -p /app /var/log/nginx /var/run

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN pnpm install --prod --ignore-scripts --no-optional --prefer-offline

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./
COPY --from=builder /app/adapters static ./adapters 2>/dev/null || true

COPY deploy/scripts/frontend-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 80 443
ENTRYPOINT ["/app/entrypoint.sh"]
