# ============================================================
# 山地索道塔架监测平台 - Rust Axum 后端多阶段构建
# 多阶段构建 + cargo-chef 缓存加速
# ============================================================

# -------- Stage 1: Rust 构建环境 --------
FROM rust:1.81-alpine3.20 AS chef
RUN apk add --no-cache musl-dev perl make
RUN cargo install cargo-chef --version 0.1.67
WORKDIR /app

# -------- Stage 2: 生成依赖清单 --------
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# -------- Stage 3: 缓存依赖构建 --------
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# -------- Stage 4: 最终应用构建 --------
COPY . .
RUN cargo build --release --bin cableway-monitor

# -------- Stage 5: 生产镜像 (Alpine最小化) --------
FROM alpine:3.20 AS runtime
RUN apk add --no-cache \
    ca-certificates \
    curl \
    tzdata \
    busybox \
  && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
  && mkdir -p /var/log/cableway

RUN addgroup -S appuser && adduser -S appuser -G appuser

WORKDIR /app

COPY --from=builder /app/target/release/cableway-monitor /app/cableway-monitor
COPY backend/.env.example /app/.env
COPY deploy/scripts/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh \
 && chown -R appuser:appuser /app /var/log/cableway

USER appuser

EXPOSE 3001
ENV RUST_LOG=info
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["/app/cableway-monitor"]
