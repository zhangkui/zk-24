import { component$, useSignal, useVisibleTask$, useTask$ } from "@builder.io/qwik";
import { DocumentHead } from "@builder.io/qwik-city";
import { Link } from "@builder.io/qwik-city";
import { api } from "~/utils/api";
import type { DashboardSummary, RiskLevel, TowerSummary } from "~/types";
import {
  riskColors,
  riskLabels,
  formatNumber,
  formatRelativeTime,
} from "~/utils/format";

export default component$(() => {
  const summary = useSignal<DashboardSummary | null>(null);
  const loading = useSignal(true);
  const tickCount = useSignal(0);

  useVisibleTask$(async ({ track }) => {
    track(() => tickCount.value);
    try {
      summary.value = await api.get<DashboardSummary>("/api/dashboard/summary");
      loading.value = false;
    } catch (e) {
      console.error(e);
      loading.value = false;
    }
  });

  useVisibleTask$(() => {
    const id = setInterval(() => {
      tickCount.value++;
    }, 5000);
    return () => clearInterval(id);
  });

  return (
    <div>
      <div class="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-3xl font-bold text-slate-50 tracking-tight mb-1">
            监测总览 <span class="text-primary-400 text-glow-blue">Dashboard</span>
          </h1>
          <p class="text-slate-400 text-sm">
            全线路塔架振动、风速、覆冰实时联动监测 · 风险自动识别 · 智能停运决策推送
            {summary.value && (
              <span class="ml-3 text-slate-500">
                · 数据时间 {formatRelativeTime(summary.value.generated_at)}
              </span>
            )}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-ghost">
            <span>📥</span>导出报告
          </button>
          <button class="btn btn-primary">
            <span>🔔</span>预警订阅
          </button>
        </div>
      </div>

      {/* Top stat cards */}
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          label="塔架总数"
          value={summary.value?.total_towers ?? 0}
          unit="座"
          icon="🗼"
          tint="blue"
        />
        <StatCard
          label="在线监测"
          value={summary.value?.towers_online ?? 0}
          unit="座"
          icon="✅"
          tint="emerald"
          hint={`${(((summary.value?.towers_online ?? 0) / Math.max(1, summary.value?.total_towers ?? 1)) * 100).toFixed(0)}% 在线`}
        />
        <StatCard
          label="安全状态"
          value={summary.value?.risk_breakdown[0] ?? 0}
          unit="座"
          icon="🟢"
          tint="emerald"
        />
        <StatCard
          label="风险告警"
          value={(summary.value?.risk_breakdown[2] ?? 0) + (summary.value?.risk_breakdown[3] ?? 0) + (summary.value?.risk_breakdown[4] ?? 0)}
          unit="座"
          icon="🚨"
          tint="rose"
          pulse={(summary.value?.risk_breakdown[4] ?? 0) > 0}
        />
        <StatCard
          label="待审批决策"
          value={summary.value?.pending_decisions ?? 0}
          unit="条"
          icon="📝"
          tint="amber"
        />
        <StatCard
          label="气象预警"
          value={summary.value?.weather_alerts ?? 0}
          unit="条"
          icon="🌨️"
          tint="indigo"
        />
      </div>

      <div class="grid grid-cols-12 gap-6">
        {/* Left: Map + Risk list */}
        <div class="col-span-12 xl:col-span-8 space-y-6">
          {/* Map / 3D overview */}
          <div class="glass-panel p-5">
            <div class="flex items-center justify-between mb-4">
              <h2 class="section-title mb-0">
                <span class="text-2xl">🗺️</span>
                线路塔架分布 · 实时风险热力
              </h2>
              <div class="flex gap-2 text-xs">
                <span class="badge bg-slate-800 text-slate-400">上行线 A1-A4</span>
                <span class="badge bg-slate-800 text-slate-400">下行线 B1-B4</span>
              </div>
            </div>
            <TowerMapView towers={summary.value?.summaries ?? []} />
          </div>

          {/* Risk breakdown bar */}
          <div class="glass-panel p-5">
            <h2 class="section-title">
              <span>📊</span> 塔架风险分布
            </h2>
            <RiskBreakdownBar breakdown={summary.value?.risk_breakdown ?? [0, 0, 0, 0, 0]} />
          </div>
        </div>

        {/* Right: Events + Decisions + Alerts */}
        <div class="col-span-12 xl:col-span-4 space-y-6">
          <div class="glass-panel p-5">
            <h2 class="section-title flex items-center justify-between">
              <span><span>🚨</span> 高风险塔架 TOP</span>
              <Link href="/risk" class="text-xs text-primary-400 hover:text-primary-300">查看全部 →</Link>
            </h2>
            <div class="space-y-2">
              {(summary.value?.top_high_risk ?? []).length === 0 ? (
                <div class="py-8 text-center text-slate-500 text-sm">
                  ✨ 所有塔架运行状态良好
                </div>
              ) : (
                (summary.value?.top_high_risk ?? []).map((t) => (
                  <TowerRiskRow key={t.id} tower={t} />
                ))
              )}
            </div>
          </div>

          <div class="glass-panel p-5">
            <h2 class="section-title flex items-center justify-between">
              <span><span>📢</span> 实时事件流</span>
              <span class="text-xs text-emerald-400 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
              </span>
            </h2>
            <LiveEventFeed />
          </div>

          <div class="glass-panel p-5">
            <h2 class="section-title flex items-center justify-between">
              <span><span>⚡</span> 停运决策中心</span>
              <Link href="/decisions" class="text-xs text-primary-400 hover:text-primary-300">全部决策 →</Link>
            </h2>
            <DecisionQueueCompact />
          </div>
        </div>
      </div>
    </div>
  );
});

const StatCard = component$<{
  label: string;
  value: number;
  unit: string;
  icon: string;
  tint: "blue" | "emerald" | "rose" | "amber" | "indigo" | "slate";
  hint?: string;
  pulse?: boolean;
}>(({ label, value, unit, icon, tint, hint, pulse }) => {
  const tints: Record<string, string> = {
    blue: "from-primary-500/20 to-primary-900/10 border-primary-500/30",
    emerald: "from-emerald-500/20 to-emerald-900/10 border-emerald-500/30",
    rose: "from-rose-500/20 to-rose-900/10 border-rose-500/30",
    amber: "from-amber-500/20 to-amber-900/10 border-amber-500/30",
    indigo: "from-indigo-500/20 to-indigo-900/10 border-indigo-500/30",
    slate: "from-slate-500/20 to-slate-900/10 border-slate-500/30",
  };
  return (
    <div
      class={[
        "stat-card relative overflow-hidden bg-gradient-to-br",
        tints[tint],
        pulse && "ring-2 ring-rose-500/40 animate-pulse",
      ]}
    >
      <div class="flex items-start justify-between mb-3">
        <span class="text-xs text-slate-400 font-medium tracking-wide">{label}</span>
        <span class="text-xl opacity-80">{icon}</span>
      </div>
      <div class="flex items-baseline gap-1">
        <span class={["text-3xl font-bold tracking-tight", pulse ? "text-rose-300 text-glow-red" : "text-slate-50"]}>
          {value}
        </span>
        <span class="text-xs text-slate-400">{unit}</span>
      </div>
      {hint && <div class="mt-2 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
});

const TowerMapView = component$<{ towers: TowerSummary[] }>(({ towers }) => {
  // Normalize coordinates for a pseudo-map
  const lats = towers.map((t) => t.geo.latitude);
  const lons = towers.map((t) => t.geo.longitude);
  const minLat = Math.min(...lats, 0);
  const maxLat = Math.max(...lats, 1);
  const minLon = Math.min(...lons, 0);
  const maxLon = Math.max(...lons, 1);

  return (
    <div class="relative h-80 md:h-96 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
      {/* Terrain gradient background */}
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(16,185,129,0.06),transparent_60%)]" />
      {/* Grid */}
      <div class="absolute inset-0 grid-bg opacity-40" />
      {/* Mountain range silhouette */}
      <svg class="absolute inset-x-0 bottom-0 w-full opacity-20" viewBox="0 0 1000 200" preserveAspectRatio="none">
        <path
          d="M0,200 L0,140 L80,80 L160,120 L240,50 L320,100 L400,40 L480,90 L560,60 L640,110 L720,70 L800,130 L880,80 L1000,150 L1000,200 Z"
          fill="currentColor"
          class="text-slate-700"
        />
      </svg>

      {/* Cable lines */}
      <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {towers.length > 1 && (
          <polyline
            points={towers
              .map((t) => {
                const x = ((t.geo.longitude - minLon) / Math.max(0.0001, maxLon - minLon)) * 90 + 5;
                const y = 90 - ((t.geo.latitude - minLat) / Math.max(0.0001, maxLat - minLat)) * 75;
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="rgba(148,163,184,0.45)"
            stroke-width="0.2"
            stroke-dasharray="0.6 0.4"
          />
        )}
      </svg>

      {/* Tower markers */}
      {towers.map((t, i) => {
        const x = ((t.geo.longitude - minLon) / Math.max(0.0001, maxLon - minLon)) * 90 + 5;
        const y = 90 - ((t.geo.latitude - minLat) / Math.max(0.0001, maxLat - minLat)) * 75;
        const level = t.risk_level ?? "Safe";
        const color = riskColors[level];
        return (
          <Link
            key={t.id}
            href={`/towers/${t.id}`}
            class="absolute group"
            style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-100%)" }}
          >
            <div class={["relative flex flex-col items-center cursor-pointer"]}>
              <div class={[
                "px-1.5 py-0.5 text-[10px] rounded-md border backdrop-blur transition-all group-hover:scale-110",
                color.bg,
                color.text,
                color.border,
                level !== "Safe" && level !== "Low" && "animate-pulse",
              ]}>
                <span class="font-bold">{t.code.split("-")[1]}</span>
              </div>
              <div class={[
                "w-1 h-5",
                level === "Extreme" || level === "High" ? "bg-rose-500" :
                  level === "Medium" ? "bg-amber-500" :
                  level === "Low" ? "bg-lime-500" : "bg-emerald-500",
              ]} />
              <div class={[
                "w-3 h-3 rounded-full border-2 -mt-1.5",
                level === "Extreme" || level === "High" ? "bg-rose-500/50 border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)]" :
                  level === "Medium" ? "bg-amber-500/50 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]" :
                  level === "Low" ? "bg-lime-500/50 border-lime-400" : "bg-emerald-500/50 border-emerald-400",
              ]} />
              {/* Hover tooltip */}
              <div class="absolute bottom-full mb-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 w-48">
                <div class="glass-panel p-2.5 text-[11px] space-y-1 shadow-2xl">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-100">{t.name}</span>
                    <span class={["badge px-1.5 py-px", color.bg, color.text]}>{riskLabels[level]}</span>
                  </div>
                  <div class="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-400 pt-1">
                    <span>风速</span><span class="text-slate-200">{formatNumber(t.current_wind_speed)} m/s</span>
                    <span>覆冰</span><span class="text-slate-200">{formatNumber(t.current_ice_thickness)} mm</span>
                    <span>振动</span><span class="text-slate-200">{formatNumber(t.current_vibration)} mm/s²</span>
                    <span>海拔</span><span class="text-slate-200">{t.geo.altitude.toFixed(0)} m</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}

      {/* Legend */}
      <div class="absolute bottom-3 left-3 glass-panel !bg-slate-950/70 px-3 py-2 text-[11px] flex items-center gap-3">
        <span class="text-slate-400">风险等级</span>
        {(["Safe", "Low", "Medium", "High", "Extreme"] as RiskLevel[]).map((l) => (
          <div key={l} class="flex items-center gap-1">
            <span class={["w-2.5 h-2.5 rounded-full",
              riskColors[l].bg.replace("bg-", "bg-").replace("/15", "").replace("/60", "")
            ]} />
            <span class="text-slate-300">{riskLabels[l]}</span>
          </div>
        ))}
      </div>

      {/* Compass */}
      <div class="absolute top-3 right-3 w-12 h-12 rounded-full bg-slate-950/70 border border-slate-700/60 flex items-center justify-center text-xs text-slate-400">
        <div class="relative w-full h-full">
          <span class="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] text-rose-400">N</span>
          <span class="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px]">S</span>
          <span class="absolute left-0 top-1/2 -translate-y-1/2 text-[10px]">W</span>
          <span class="absolute right-0 top-1/2 -translate-y-1/2 text-[10px]">E</span>
        </div>
      </div>
    </div>
  );
});

const RiskBreakdownBar = component$<{ breakdown: [number, number, number, number, number] }>(({ breakdown }) => {
  const total = breakdown.reduce((a, b) => a + b, 0) || 1;
  const pcts = breakdown.map((v) => (v / total) * 100);
  const levels: RiskLevel[] = ["Safe", "Low", "Medium", "High", "Extreme"];
  return (
    <div>
      <div class="h-8 rounded-lg overflow-hidden flex bg-slate-950 border border-slate-800 shadow-inner">
        {levels.map((l, i) => {
          const c = riskColors[l];
          return (
            <div
              key={l}
              class={["relative transition-all flex items-center justify-center group", c.bg]}
              style={{ width: `${pcts[i]}%` }}
            >
              {pcts[i] > 8 && (
                <span class="text-xs font-bold text-slate-50/90">
                  {breakdown[i]} 座
                </span>
              )}
              {pcts[i] > 0 && (
                <div class="absolute inset-x-0 -top-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div class="glass-panel !bg-slate-900 py-1 px-2 text-[11px] whitespace-nowrap">
                    <span class={c.text}>{riskLabels[l]}</span>: {breakdown[i]} ({pcts[i].toFixed(0)}%)
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div class="mt-3 grid grid-cols-5 gap-2 text-[11px] text-slate-400">
        {levels.map((l, i) => (
          <div key={l} class="flex items-center gap-1.5">
            <span class={["w-2 h-2 rounded-full", riskColors[l].bg]} />
            <span>{riskLabels[l]} <b class="text-slate-200 ml-1">{breakdown[i]}</b></span>
          </div>
        ))}
      </div>
    </div>
  );
});

const TowerRiskRow = component$<{ tower: TowerSummary }>(({ tower }) => {
  const level = tower.risk_level ?? "Safe";
  const c = riskColors[level];
  return (
    <Link href={`/towers/${tower.id}`} class="block">
      <div
        class={[
          "flex items-center gap-3 p-3 rounded-lg border transition-all hover:-translate-y-0.5",
          c.bg,
          c.border,
        ]}
      >
        <div class={[
          "w-10 h-10 rounded-lg flex items-center justify-center font-bold border",
          c.bg,
          c.border,
          c.text,
        ]}>
          {tower.code.split("-")[1]}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-slate-100 truncate">{tower.name}</span>
            <span class={["badge", c.bg, c.text]}>{riskLabels[level]}</span>
          </div>
          <div class="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
            <span>风 {formatNumber(tower.current_wind_speed)}m/s</span>
            <span>冰 {formatNumber(tower.current_ice_thickness)}mm</span>
            <span>振 {formatNumber(tower.current_vibration)}mm/s²</span>
          </div>
        </div>
        <span class="text-slate-500 text-xs">→</span>
      </div>
    </Link>
  );
});

const LiveEventFeed = component$(() => {
  const events = useSignal<any[]>([]);

  useVisibleTask$(() => {
    const sample: any[] = [
      { time: new Date(), severity: "High", type: "冰厚阈值超警戒", tower: "A3", detail: "32.5mm > 25mm" },
      { time: new Date(Date.now() - 120000), severity: "Medium", type: "风速持续走高", tower: "B2", detail: "17.8m/s, +3.2m/s" },
      { time: new Date(Date.now() - 340000), severity: "High", type: "冰风组合风险", tower: "A2", detail: "综合评分67.5" },
      { time: new Date(Date.now() - 780000), severity: "Low", type: "温湿度骤降", tower: "A1", detail: "-8.2℃ / 93%" },
      { time: new Date(Date.now() - 1240000), severity: "Extreme", type: "瞬时阵风超极值", tower: "B1", detail: "26.1m/s" },
    ];
    events.value = sample;

    const listeners = (globalThis as any).__ws_listeners || [];
    listeners.push((msg: any) => {
      if (msg.type === "risk_event") {
        events.value = [
          {
            time: new Date(msg.event_time || Date.now()),
            severity: msg.severity,
            type: msg.event_type,
            tower: msg.tower_id?.slice(0, 4) || "??",
            detail: `${msg.actual_value} ${msg.unit || ""}`,
          },
          ...events.value,
        ].slice(0, 20);
      }
    });
    (globalThis as any).__ws_listeners = listeners;
  });

  return (
    <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
      {events.value.map((e, i) => {
        const sev = (e.severity || "Medium") as RiskLevel;
        const c = riskColors[sev];
        return (
          <div key={i} class={["p-2.5 rounded-lg border text-xs", c.bg, c.border]}>
            <div class="flex items-start justify-between mb-1">
              <div class="flex items-center gap-1.5">
                <span class={["w-1.5 h-1.5 rounded-full",
                  sev === "Extreme" || sev === "High" ? "bg-rose-400 animate-pulse" :
                    sev === "Medium" ? "bg-amber-400" : "bg-lime-400",
                ]} />
                <span class={["font-medium", c.text]}>{e.type}</span>
              </div>
              <span class="text-slate-500">{formatRelativeTime(e.time.toISOString?.())}</span>
            </div>
            <div class="flex items-center gap-2 text-slate-400">
              <span class="badge bg-slate-800/50 text-slate-300">塔架 {e.tower}</span>
              <span class="text-slate-300">{e.detail}</span>
            </div>
          </div>
        );
      })}
      {events.value.length === 0 && (
        <div class="py-8 text-center text-sm text-slate-500">暂无告警事件</div>
      )}
    </div>
  );
});

const DecisionQueueCompact = component$(() => {
  const decisions = useSignal<any[]>([]);
  useVisibleTask$(async () => {
    try {
      const data = await api.get<any[]>("/api/decisions");
      decisions.value = data || [];
    } catch {}
    const listeners = (globalThis as any).__ws_listeners || [];
    listeners.push((msg: any) => {
      if (msg.type === "decision") {
        decisions.value = [msg, ...decisions.value].slice(0, 10);
      }
    });
    (globalThis as any).__ws_listeners = listeners;
  });
  return (
    <div class="space-y-2">
      {decisions.value.length === 0 ? (
        <div class="py-6 text-center text-sm text-slate-500">暂无待处理决策</div>
      ) : (
        decisions.value.slice(0, 4).map((d, i) => (
          <div key={i} class="p-3 rounded-lg bg-slate-900/60 border border-slate-700/40">
            <div class="flex items-start justify-between mb-2">
              <div>
                <span class="badge bg-rose-500/15 text-rose-300 border border-rose-500/30 mr-2">
                  {d.decision_type === "Emergency" ? "🚨紧急" : d.decision_type === "Mandatory" ? "⚠️强制" : "💡建议"}
                </span>
                <span class="text-sm text-slate-200 font-medium">{d.affected_sections?.[0] || "全线"}</span>
              </div>
              <span class="text-[10px] text-slate-500">{formatRelativeTime(d.decision_time)}</span>
            </div>
            <p class="text-[11px] text-slate-400 leading-relaxed">
              {(d.trigger_reasons || []).slice(0, 2).map((r: any, j: number) => (
                <span key={j} class="block">• {r.description}</span>
              ))}
            </p>
            <div class="mt-2 flex gap-1.5">
              <button class="btn btn-primary !py-1 !px-2 !text-[11px] flex-1">批准执行</button>
              <button class="btn btn-ghost !py-1 !px-2 !text-[11px]">驳回</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "总览大屏 · 索道塔架监测平台",
  meta: [
    {
      name: "description",
      content: "山地索道塔架振动结冰联动监测与停运决策平台 - 总览大屏",
    },
  ],
};
