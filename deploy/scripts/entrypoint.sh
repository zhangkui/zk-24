#!/bin/sh
set -e

echo "============================================"
echo "⛰️  山地索道塔架监测平台 - 后端服务启动"
echo "============================================"
echo "[1/3] 等待 NATS 服务就绪..."
until curl -sf http://nats:8222/healthz >/dev/null 2>&1; do
  echo "  NATS 未就绪，等待 3s..."
  sleep 3
done
echo "  ✓ NATS 就绪"

echo "[2/3] 等待 ClickHouse 服务就绪..."
until curl -sf "http://default:@clickhouse:8123/?query=SELECT%201" >/dev/null 2>&1; do
  echo "  ClickHouse 未就绪，等待 3s..."
  sleep 3
done
echo "  ✓ ClickHouse 就绪"

echo "[3/3] 启动后端服务..."
exec "$@"
