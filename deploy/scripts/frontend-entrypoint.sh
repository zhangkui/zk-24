#!/bin/sh
set -e

echo "============================================"
echo "🌐  索道监测平台 - 前端服务启动"
echo "============================================"

BACKEND_URL=${BACKEND_URL:-"http://backend:3001"}
FRONTEND_PORT=${FRONTEND_PORT:-80}
FRONTEND_HOST=${FRONTEND_HOST:-"0.0.0.0"}

echo "[1/2] 配置 Nginx (反代 API / 静态资源)..."
cat >/etc/nginx/http.d/default.conf <<EOF
server {
    listen ${FRONTEND_PORT};
    server_name _;

    access_log /var/log/nginx/cableway-access.log;
    error_log  /var/log/nginx/cableway-error.log warn;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript application/xml image/svg+xml;
    gzip_min_length 1024;
    gzip_comp_level 6;

    # 客户端大文件上传 (巡检照片/视频附件)
    client_max_body_size 128m;

    # ---- 静态资源长期缓存 ----
    location ~* \.(?:css|js|woff2?|ttf|eot|ico|png|jpe?g|svg|gif|webp|avif)$ {
        root /app/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # ---- API / WebSocket 反代到后端 ----
    location /api/ {
        proxy_pass ${BACKEND_URL};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket 升级
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;

        # 长连接 / 实时数据
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # ---- Qwik SSR fallback ----
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
    }
}
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    ''      close;
}
EOF

echo "  ✓ Nginx 已配置"

echo "[2/2] 启动 Nginx + Qwik SSR..."
nginx -t && nginx

export FRONTEND_PORT=5173
node /app/server/entry.express.js &
NODE_PID=$!

trap "kill $NODE_PID; nginx -s stop; exit 0" TERM INT
wait $NODE_PID
