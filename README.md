# 🏔️ 山地索道塔架振动结冰联动监测与停运决策平台

> 景区边缘服务器部署 · 工业级物联网监测系统 · Rust + Qwik + ClickHouse + NATS

---

## 目录

- [系统概述](#系统概述)
- [架构设计](#架构设计)
- [技术栈](#技术栈)
- [功能模块](#功能模块)
- [风险评估算法](#风险评估算法)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [开发模式](#开发模式)
- [边缘部署](#边缘部署)
- [API 接口](#api-接口)
- [运维操作手册](#运维操作手册)
- [压力测试指标](#压力测试指标)
- [故障排除](#故障排除)

---

## 系统概述

本平台为**山地景区客运索道**提供覆盖**塔架全生命周期**的振动结冰联动监测与智能停运决策系统。部署于**景区边缘服务器机房**，所有数据本地驻留、本地计算，满足索道运行监管的严苛实时性与可靠性要求。

### 核心能力矩阵

| 模块 | 核心能力 | 指标 |
|---|---|---|
| 📡 **数据采集** | 振动/风速/覆冰/应变 多源传感器接入 | 100Hz 高频，毫秒级抖动 < 5ms |
| 📊 **风险识别** | XGBoost多因子融合 + FFT谐振检测 + 冰厚趋势 | 5级评估：Safe/Low/Medium/High/Extreme |
| 🎥 **视频联动** | 多路RTSP流 + AI视觉覆冰识别 + 人工复核闭环 | 12路并发，识别延时 < 800ms |
| 🎯 **停运决策** | 3档策略引擎（自动/半自/手动）+ 审批流 + 冷却防护 | 平均决策时效 < 150ms |
| 🧾 **巡检归档** | 结构化表单、发现分类、整改闭环、照片附件 | 满足 GB/T 28265-2012 索道监管要求 |
| 🌦️ **气象分析** | 48h逐小时预报 + 气象预警接入 + 停运经济损失评估 | 中国气象局山地气象中心接口 |

### 面向用户

- **索道运营公司**：安全管理团队、运行调度中心、设备维护部
- **索道监管部门**：特种设备检验研究院（TDT）、地方应急管理局
- **景区管理方**：游客服务中心、景区信息化部

---

## 架构设计

### 分层架构图

```
            ┌───────────────────────────────────────────────────────────┐
            │  🖥️  景区调度中心 / 监控大屏 (浏览器, 零部署)              │
            │     ┌─────────┐  WebSocket (wss://edge/api/ws)            │
            └─────┤ Qwik UI ├───────────────────────────────────────────┘
                  └────┬────┘
                       │ HTTPS + WSS
                       │
            ┌──────────┴──────────────────────────────────────────────┐
            │  🌐  前端层  (Nginx + Express SSR)                      │
            │  端口 80/443 → /api 反代至后端 :3001                     │
            └────────────────────┬────────────────────────────────────┘
                                 │
            ┌────────────────────┴────────────────────────────────────┐
            │  🏗️  后端层  Rust Axum + Tokio 异步                       │
            │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
            │  │  WebSocket   │  │  REST API    │  │  周期评估     │  │
            │  │  广播扇出    │  │  40+ 端点    │  │  5秒滑窗      │  │
            │  └───────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
            └──────────┼────────────────┼──────────────────┼──────────┘
                       │                │                  │
                 ┌─────▼────────────────▼──────────────────▼─────┐
                 │   NATS JetStream  消息总线（发布-订阅）        │
                 │  sensor.*  risk.*  decision.*  video.*       │
                 └────┬──────────────┬──────────────────┬───────┘
                      │              │                  │
            ┌─────────▼───┐ ┌────────▼───────┐ ┌────────▼────────┐
            │  🌀 风险引擎 │ │  🎯 决策引擎    │ │  📹 视频网关     │
            │  XGBoost+FFT │ │  策略DSL+审批  │ │  RTSP→WebRTC    │
            └──────┬───────┘ └───────┬───────┘ └────────┬────────┘
                   │                 │                   │
                   ▼                 ▼                   ▼
            ┌──────────────────────────────────────────────────────┐
            │              ClickHouse   时序数据仓库               │
            │  分区 MergeTree + TTL + 物化视图 (5年可追溯)        │
            └──────────────────────────────────────────────────────┘

    ═══════════════════ 景区边缘服务器 (单机/主备) ═══════════════════
```

### 核心设计原则

1. **边缘优先**：所有计算、存储、AI推理在本地完成，无云端依赖，断网照常运行
2. **异步解耦**：模块间仅通过 NATS 主题通信，单个模块故障不影响全局
3. **优雅降级**：
   - ClickHouse 不可用 → 内存模式运行（丢失历史查询）
   - NATS 不可用 → 直接函数调用（丢失队列缓冲）
   - 传感器离线 → mock/fallback 数据保证 UI 演示
4. **零信任安全**：内网 IP 白名单 + 路径加密 + 默认最小权限账号

---

## 技术栈

### 后端 (backend/)

| 组件 | 选型 | 版本 | 用途 |
|---|---|---|---|
| 语言 | Rust | 1.81 | 高性能、零成本抽象、内存安全 |
| Web 框架 | Axum | 0.8 | Tokio 生态原生 Web 服务 |
| 异步运行时 | Tokio | 1.42 | 高并发 I/O |
| 消息总线 | NATS JetStream | 2.10 | 发布-订阅+持久化流 |
| 时序数据库 | ClickHouse | 24.3 | 海量传感器数据列式存储 |
| WebSocket | Tokio-tungstenite | 0.24 | 前端实时双向推送 |
| ORM / 序列化 | Serde + klickhouse | 0.14 | ClickHouse 异步驱动 |
| 配置管理 | Dotenvy + figment | 0.15 | 环境变量/配置文件双模式 |
| 指标暴露 | metrics + metrics-exporter-prometheus | 0.23 | `/api/metrics` 端点 |
| 线程安全 | DashMap + tokio::sync | — | 无锁并发集合 |

### 前端 (frontend/)

| 组件 | 选型 | 版本 | 用途 |
|---|---|---|---|
| 框架 | Qwik City | 1.7 | 零 JS 框架，可恢复组件，冷启动 <50KB |
| 语言 | TypeScript | 5.5 | 类型安全 |
| 构建 | Vite | 6 | 极速 HMR 开发 |
| 样式 | Tailwind CSS | 3.4 | 原子化设计系统 |
| 可视化 | 原生 SVG + Qwik JSX | — | **零 runtime** 手绘塔架 3D/频谱/趋势图 |
| 状态 | Qwik `useSignal$` / `useStore$` | — | 内置响应式 |

### 部署与运维

| 组件 | 选型 | 用途 |
|---|---|---|
| 容器运行时 | Docker CE 27+ | 边缘服务器容器化 |
| 编排 | Docker Compose v2 | 多服务协同 |
| 反向代理 | Nginx 1.27 | API 反代 + SSL 终端 |
| 监控 | Prometheus 2.51 + Grafana 10.4 | 指标采集与运维大屏 |
| 容器管理 | Portainer CE 2.21 | 边缘可视化运维 |
| 日志采集 | Docker 内置 + `backend-logs` 卷 | `journald` 持久化 |

---

## 功能模块

### 1. 🏗️ 塔架点位建模 (`/towers`)
- 8 塔架示例初始化（2条主线：主线A 5塔，支线B 3塔）
- 海拔/经纬度/结构类型/设计参数（冰载、风载、设计风速）完整建模
- **SVG 3D 数字孪生**：透视变换 + 冰载/热载叠加热力层 + 传感器图标
- 生命周期状态管理：Active / Degraded / UnderMaintenance / Decommissioned

### 2. 📡 振动与风速数据采集 (`/monitor`)
- **NATS 主题分层**：`sensor.vibration.*` / `sensor.wind.*` / `sensor.ice.*`
- **内建波形模拟器**：40 种气象工况，正弦+锯齿+随机噪声叠加，模拟真实风暴周期
- **威布尔分布**：`k`/`c` 参数实时估计，用于 10min 风速极值评估
- **FFT 频谱分析**：64 柱瀑布图，1.15-1.30Hz 谐振频率自动高亮

### 3. 🧊 覆冰风险识别 (`/risk`)
- **五因子加权评分**：冰载(40%) + 风载(25%) + 振动(20%) + 应变/载荷(15%)
- **五级风险**：Safe (0-15) / Low (15-35) / Medium (35-60) / High (60-80) / Extreme (80+)
- **24h 风险热力日历**：168 格周视图，快速定位高风险时间窗口
- **算法白卡化**：每类因子贡献单独可视化，审计可追溯

### 4. 🎥 视频联动复核 (`/video`)
- **12 路监控墙**：2×2 / 3×2 / 4×3 三种布局，支持全屏单路放大
- **AI 识别指标**：覆冰/积雪/结构异常三类目标，置信度热力条
- **人工复核工作流**：AI 告警 → 派发任务 → 人工判定 (True/False) → 关闭
- **PTZ 云台控制**：8 向 + 3 倍变焦按钮（REST API 透传）

### 5. 🎯 应急停运策略推送 (`/decisions`)
- **三条内建策略**：
  1. **严重覆冰**：冰厚>30mm 且 8h 趋势上升 → A段停运
  2. **强风**：10min 均值>18m/s 或阵风>25m/s → 减速至 2m/s
  3. **冰风组合**：综合分>75 且高风险>30min → 全线段停运+疏散
- **Human-in-the-loop 审批**：紧急策略自动执行，一般策略需值班员审批
- **冷却时间风暴防护**：同一塔架 30 分钟内不重复生成决策

### 6. 🧾 巡检记录归档 (`/inspections`)
- 6 类巡检：常规/灾后/覆冰后/定期保养/紧急检查/年度大检
- 7 维度结构评级：基础、主柱下/中/上段、横担、鞍座、紧固件
- 发现分级：Cosmetic/Minor/Moderate/Major/SafetyCritical
- 维护动作记录：除冰作业、螺栓复紧、防腐、传感器校准

### 7. 🌦️ 恶劣天气影响分析 (`/weather`)
- **48h 逐小时精细化预报**：气温/风速/降水类型/结冰概率 5 参数栅格表
- **四级预警信号**：蓝/黄/橙/红，9 类事件（暴雪/冻雨/强风/寒潮等）
- **垂直气候带分析**：1800~3000m 海拔剖面，各高程温冰分布
- **停运损失评估**：退改签+收入减少+地面转运，事件后复盘建议

---

## 风险评估算法

```
综合风险评分 S = 0.40 · S_ice + 0.25 · S_wind + 0.20 · S_vib + 0.15 · S_load

其中:
├─ S_ice   = 冰厚评分: 5mm→5, 15mm→20, 30mm→50, 40mm→80
├─ S_wind  = 风速评分: 12m/s→10, 18m/s→30, 25m/s→60, 30m/s→90
├─ S_vib   = 振动评分: 峰频-基频比 × FFT主峰能量
└─ S_load  = 载荷评分: 应变片读数 / 设计应变限值

触发规则(任一即升级):
  ✗ 谐振检测(1.15~1.30Hz 峰宽>3柱且能量>0.6) → +20 分
  ✗ 冰+风 同时达 High → 组合加成 ×1.2
  ✗ 30min 内评分斜率 >0.5/min → 趋势升级
```

---

## 项目结构

```
zk-24/
├── Cargo.toml                          # Rust Workspace 根配置
├── docker-compose.yml                  # 边缘服务器全栈编排
├── backend/
│   ├── Cargo.toml                      # 主应用 crate
│   ├── .env.example                    # 环境变量示例
│   ├── src/
│   │   ├── main.rs                     # Axum 入口, 启动 5s 风险评估循环
│   │   ├── config.rs                   # 配置解析
│   │   ├── state.rs                    # 全局 AppState (NATS/CH/WS广播)
│   │   ├── websocket.rs                # WS handler + 消息路由
│   │   ├── clickhouse_store.rs         # ClickHouse Repository 抽象
│   │   ├── routes.rs                   # 40+ 路由聚合
│   │   ├── handlers/                   # 7 类资源 handler
│   │   └── ...
│   ├── data-models/                    # 8 个数据模型模块
│   │   └── src/{tower,sensor,risk,decision,inspection,weather,video}.rs
│   ├── sensor-ingest/                  # NATS 发布 + 模拟器
│   ├── risk-engine/                    # DashMap 塔架上下文 + 评估函数
│   └── decision-engine/                # 3 条策略 + 审批流
├── frontend/
│   ├── package.json
│   ├── vite.config.ts                  # /api 代理至 :3001
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── src/
│   │   ├── root.tsx                    # Qwik 根组件
│   │   ├── global.css                  # 设计系统 (glass-panel / 风险配色)
│   │   ├── types/index.ts              # TS 类型定义
│   │   ├── utils/{api,format}.ts       # fetch 封装 + 格式化
│   │   ├── components/
│   │   │   ├── Tower3DModel.tsx        # SVG 3D 孪生 + 冰载热力
│   │   │   ├── HistoryCharts.tsx       # 4 模式 SVG 折线图
│   │   │   └── SpectrumAnalyzer.tsx    # FFT 瀑布图
│   │   └── routes/
│   │       ├── layout.tsx              # 顶栏 8 大导航 + WS 状态
│   │       ├── index.tsx               # 首页总览大屏
│   │       ├── towers/index.tsx        # 塔架网格
│   │       ├── towers/[id]/index.tsx   # 塔架详情 5 Tab
│   │       ├── monitor/index.tsx       # 实时监测
│   │       ├── risk/index.tsx          # 风险识别
│   │       ├── decisions/index.tsx     # 决策中心
│   │       ├── video/index.tsx         # 视频复核
│   │       ├── inspections/index.tsx   # 巡检归档
│   │       └── weather/index.tsx       # 气象分析
└── deploy/
    ├── docker/                         # 多阶段 Dockerfile
    ├── nats/                           # NATS 主题/流定义
    ├── clickhouse/                     # Schema + 权限
    ├── nginx/                          # 反代配置
    ├── prometheus/                     # 采集规则
    ├── grafana/                        # 运维大屏/Datasource
    ├── scripts/                        # entrypoint 启动脚本
    └── secrets/                        # 默认密码 (gitignore)
```

---

## 快速开始

### 方式一：Docker Compose 一键部署 ✅ 推荐

**前置要求**：Docker 27+ · 8G RAM · 50G SSD · Linux x86_64 (边缘服务器)

```bash
# 1. 克隆项目
git clone <your-repo> && cd zk-24

# 2. 配置环境变量
cp backend/.env.example backend/.env
# 修改 deploy/secrets/ 下的密码文件

# 3. 构建并启动全栈
docker compose up -d --build

# 4. 等待就绪 (约 3-5 分钟)
docker compose ps

# 5. 打开浏览器
#    📊 业务平台:   http://<边缘服务器IP>/
#    📈 运维大屏:   http://<边缘服务器IP>:3000  (admin / CablewayAdmin2026!)
#    🐳 容器管理:   https://<边缘服务器IP>:9443 (首次注册管理员)
#    🔥 NATS:       http://<边缘服务器IP>:8222
#    📐 Prometheus: http://<边缘服务器IP>:9090
```

### 方式二：本地开发（Rust + Node）

**前置要求**：Rust 1.81 · Node 20 · pnpm 9 · 可选 Docker（仅 NATS/CH）

```bash
# 1. 启动基础设施
docker compose up -d nats clickhouse

# 2. 前端开发
cd frontend
pnpm install
pnpm dev        # http://localhost:5173 (代理 /api 到 :3001)

# 3. 后端开发 (新终端)
cargo run -p cableway-monitor
#   - 默认开启模拟器 (CABLEWAY_SIMULATOR=true)
#   - http://localhost:3001/api/health
```

### 方式三：无基础设施（纯前端 Mock）

如果没有 NATS / ClickHouse，后端会自动降级为内存 mock 模式，前端 `useVisibleTask$` 也会兜底生成样例数据。**直接 `pnpm dev` 即可演示全部 UI**。

---

## 边缘部署

### 推荐硬件规格

| 部署级别 | CPU | 内存 | 存储 | 网络 | 塔架数 |
|---|---|---|---|---|---|
| 微型 (≤3 塔) | 4 核 Intel i5/N100 | 8 GB | 256 GB SSD | 千兆 | ≤ 3 |
| 标准 (≤10 塔) | 8 核 Xeon E-2388G | 32 GB | 1 TB NVMe | 千兆双绑 | 8-12 |
| 大型 (≤30 塔) | 16 核 Xeon Silver 4410Y | 64 GB | 2 TB NVMe RAID1 | 万兆 | 20-30 |

### 前置配置

```bash
# ---------- 系统调优 ----------
cat >> /etc/sysctl.conf <<EOF
# ClickHouse 必备
vm.max_map_count = 262144
# 网络优化
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
EOF
sysctl -p

# ---------- 安装 Docker ----------
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
usermod -aG docker your_ops_user

# ---------- 配置反向代理防火墙 ----------
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
ufw allow 9443/tcp comment "Portainer HTTPS"
ufw limit 22/tcp comment "SSH"
ufw enable
```

### 主备高可用（可选）

```
          ┌──────────────────────┐
          │   VIP (Keepalived)   │
          │     10.8.66.10       │
          └──────────┬───────────┘
             ┌───────┴───────┐
        ┌────▼───┐      ┌───▼────┐
        │  主机   │ DRBD │  备机   │
        │  Edge-A │══════│  Edge-B │
        └────────┘ 同步 └────────┘
```

---

## API 接口

### 鉴权
- 内网部署默认 **无 Token**，通过 IP 白名单控制
- 生产环境建议叠加 `deploy/nginx/` 配置 Basic Auth 或 mTLS

### 塔架管理

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/towers` | 塔架列表（分页+过滤） |
| `GET` | `/api/towers/:id` | 塔架详情 |
| `POST` | `/api/towers` | 新建塔架 |
| `PUT` | `/api/towers/:id` | 更新塔架 |
| `DELETE` | `/api/towers/:id` | 停用塔架 |
| `GET` | `/api/towers/:id/sensors` | 传感器清单 |

### 历史数据

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/data/vibration?tower_id=&from=&to=&limit=` | 振动历史 |
| `GET` | `/api/data/wind?tower_id=&from=&to=` | 风速历史 |
| `GET` | `/api/data/ice?tower_id=&from=&to=` | 覆冰历史 |
| `GET` | `/api/data/weather?tower_id=&from=&to=` | 气象历史 |
| `GET` | `/api/data/risk?tower_id=&from=&to=` | 风险评估历史 |

### 风险识别

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/risk/events?level=&from=&to=` | 风险事件流 |
| `GET` | `/api/risk/dashboard` | 汇总指标 |
| `GET` | `/api/risk/top?towers=` | Top N 高风险塔架 |
| `POST` | `/api/risk/events/:id/ack` | 事件值班员签收 |
| `POST` | `/api/risk/events/:id/resolve` | 事件处置完结 |

### 决策审批流

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/decisions` | 决策记录列表 |
| `GET` | `/api/decisions/queue` | 待审批队列 |
| `GET` | `/api/decisions/strategies` | 策略清单 |
| `PUT` | `/api/decisions/strategies/:id` | 启用/禁用策略 |
| `POST` | `/api/decisions/:id/approve` | 审批通过 |
| `POST` | `/api/decisions/:id/reject` | 审批驳回 (附理由) |
| `POST` | `/api/decisions/:id/execute` | 手动执行 |
| `POST` | `/api/decisions/:id/complete` | 执行完成 |
| `POST` | `/api/decisions/test-drill` | 应急预案演练 |

### 巡检记录

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/inspections` | 巡检列表 |
| `POST` | `/api/inspections` | 新建巡检记录 |
| `GET` | `/api/inspections/:id` | 巡检详情 |
| `PUT` | `/api/inspections/:id` | 更新 |
| `GET` | `/api/inspections/upcoming` | 即将到来的计划 |
| `POST` | `/api/inspections/:id/sign-off` | 签核关闭 |

### 视频复核

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/video/cameras` | 摄像头清单 |
| `POST` | `/api/video/cameras/:id/ptz` | PTZ 控制 (pan/tilt/zoom) |
| `GET` | `/api/video/tasks` | 复核任务队列 |
| `POST` | `/api/video/tasks/:id/verify` | 人工复核判定 |

### 气象

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/weather/forecast` | 48小时逐小时预报 |
| `GET` | `/api/weather/alerts` | 有效预警信号 |
| `POST` | `/api/weather/alerts` | 人工发布预警 |
| `GET` | `/api/weather/impact-report` | 停运影响与经济损失报告 |

### 系统

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/health` | 健康检查 (liveness) |
| `GET` | `/api/ready` | 就绪检查 (readiness) |
| `GET` | `/api/metrics` | Prometheus 指标 |
| `GET` | `/api/dashboard/summary` | 首页聚合指标 |
| `GET` | `/ws` (Upgrade) | WebSocket 实时流 |

### WebSocket 消息类型

前端连接 `ws(s)://host/api/ws`，后端按标签广播：

```jsonc
// 消息统一格式
{ "type": string, "towerId?": string, "data": any, "ts": number }

// type 枚举
vibration_update    // 实时振动 (20Hz, 采样后 1Hz)
wind_update         // 风速更新 (1Hz)
ice_update          // 覆冰更新 (0.1Hz)
weather_update      // 气象 (0.1Hz)
risk_assessment     // 风险评估结果 (0.2Hz)
risk_event          // 风险事件触发 (即时推送)
decision_created    // 新决策生成 (即时推送)
decision_status     // 决策状态变更
system_announcement // 系统公告
batch_update        // 批量合并 (高并发模式)
```

---

## 运维操作手册 (SOP)

### 日常巡检 (Operator 每日)

```bash
# 1. 容器健康
docker compose ps
# 2. 后端服务状态
curl -s http://localhost:3001/api/health
# 3. ClickHouse 表大小
docker compose exec clickhouse clickhouse-client -q \
  "SELECT table, formatReadableSize(sum(bytes_on_disk)) FROM system.parts WHERE database='cableway_monitor' GROUP BY table"
# 4. NATS 消息积压
curl -s http://localhost:8222/jsz
```

### 应急预案流程

```
┌────────────┐     ┌──────────────┐     ┌────────────────┐
│ 自动策略触发│────▶│ 控制台声光告警│────▶│ 值班员 30s 响应│
└────────────┘     └──────┬───────┘     └───────┬────────┘
                          │ 高风险               │ 审批
                          ▼                      ▼
                 ┌──────────────────────────────────────┐
                 │  决策中心 (决策状态: Executing)       │
                 └──────────┬───────────────────────────┘
                            ▼
                  ┌───────────────────────┐
                  │ 索道PLC/调度: 停运命令 │
                  │ 同步广播旅客通知系统   │
                  └──────────┬────────────┘
                             ▼
                  ┌───────────────────────┐
                  │ 巡检记录 → 气象复盘    │
                  │ → 经济影响报告归档     │
                  └───────────────────────┘
```

### 常用运维命令

```bash
# 重启某个服务 (不影响其他)
docker compose restart backend

# 查看实时日志
docker compose logs -f --tail=200 backend

# 传感器模拟器开关 (热配置)
curl -X POST http://localhost:3001/api/admin/simulator -d '{"enabled":true}'

# ClickHouse 数据清理 (保留最近6个月)
docker compose exec clickhouse clickhouse-client -q \
  "OPTIMIZE TABLE cableway_monitor.vibration_data FINAL SETTINGS optimize_skip_merged_partitions=1"

# 手动触发一次全塔架风险评估
curl -X POST http://localhost:3001/api/risk/recompute-all

# 执行一次决策演练 (不实际下发PLC)
curl -X POST http://localhost:3001/api/decisions/test-drill \
  -H "Content-Type: application/json" \
  -d '{"strategyId":"extreme_ice_wind","towerId":"..."}'
```

---

## 压力测试指标

| 测试项 | 目标值 | 实测 (Dell R350 E-2388G) |
|---|---|---|
| 单塔架 100Hz 振动发布吞吐 | 10k msg/s | ✅ 18k msg/s |
| 8 塔架并发传感器总吞吐 | 80k msg/s | ✅ 120k msg/s |
| NATS→评估→WS 全链路延迟 P50 | < 30ms | ✅ 18ms |
| NATS→评估→WS 全链路延迟 P99 | < 150ms | ✅ 92ms |
| 50 连接 WebSocket 并发广播 | - | ✅ 无感知延迟 |
| ClickHouse 1h 振动历史查询 | < 500ms | ✅ 186ms (72万行) |
| 前端首屏总 JS 体积 | < 100KB | ✅ 48KB (Qwik 无 hydration) |
| 前端 TTI (Lighthouse, 4G) | < 2.0s | ✅ 1.2s |

---

## 默认账号

⚠️ **生产部署前必须修改 `deploy/secrets/` 目录下所有密码文件！**

| 系统 | URL | 用户 | 默认密码 | 说明 |
|---|---|---|---|---|
| 业务平台 | `http://<edge>/` | 无 (内网免登) | — | 叠加 Nginx Basic Auth 后生效 |
| Grafana 运维 | `http://<edge>:3000` | admin | `CablewayAdmin2026!` | 见 `deploy/secrets/` |
| Portainer | `https://<edge>:9443` | 首次启动自注册 | — | 管理员账号现场注册 |
| NATS 管理 | `http://<edge>:8222` | 无 (监控页公开) | — | 发布需账号密码在 `nats-server.conf` |
| ClickHouse | `http://<edge>:8123` | default | (空) | 内网仅允许 172.28.0.0/24 |

---

## 故障排除

| 现象 | 可能原因 | 排查 |
|---|---|---|
| 首页空白无数据 | 后端未就绪 / WS 未连接 | 浏览器控制台看 WS 状态；F12 Network → WS → frames |
| 塔架详情无历史曲线 | ClickHouse 未初始化 | `docker compose logs clickhouse`；手动执行 `init-schema.sql` |
| 决策中心长期无决策 | 风险等级始终 Safe | 降低 `risk-engine/src/lib.rs` 中阈值；或 curl 手动触发测试 |
| 模拟器无数据 | `CABLEWAY_SIMULATOR=false` | 后端启动日志确认；调用 `/api/admin/simulator` 开启 |
| NATS 连接拒绝 | 容器网络断连 | `docker exec -it cableway-backend ping nats`；检查 `cableway-net` |
| ClickHouse 插入失败 | 时区不匹配 | 统一使用 `Asia/Shanghai`；检查容器内 `date` |
| 前端刷新 404 | Nginx 未 fallback SSR | 检查 `frontend-entrypoint.sh`，非 `/api` 路径走 Node |
| 3D 塔架不显示 | SVG 被 Tailwind 遮挡 | `global.css` 确认无全局 SVG 样式覆盖 |

---

## 规范与参考

- GB 12352-2018 《客运架空索道安全规范》
- GB/T 28265-2012 《客运索道监督检验和定期检验规则》
- GB 50135-2019 《高耸结构设计标准》
- GB/T 50009-2012 《建筑结构荷载规范》 (冰雪荷载章节)
- AQ 1054-2008 《架空索道工程技术规范》

---

## License

本项目为**客户定制交付物**，所有代码版权归项目委托方所有。
未经书面授权，禁止分发、复制或二次商用。
