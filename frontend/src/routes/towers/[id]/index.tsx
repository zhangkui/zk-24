import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { DocumentHead, routeLoader$ } from "@builder.io/qwik-city";
import { api } from "~/utils/api";
import type { TowerPoint, IcingRiskAssessment, RealTimeMetrics, RiskLevel } from "~/types";
import { riskColors, riskLabels, formatNumber, formatDateTime, windDirectionLabel } from "~/utils/format";
import { Tower3DModel } from "~/components/Tower3DModel";
import { HistoryCharts } from "~/components/HistoryCharts";
import { SpectrumAnalyzer } from "~/components/SpectrumAnalyzer";

export const useTowerLoader = routeLoader$(async (e) => {
  const id = e.params.id;
  try {
    const tower = await api.get<TowerPoint>(`/api/towers/${id}`);
    const metrics = await api.get<RealTimeMetrics>(`/api/towers/${id}/metrics`);
    const risk = await api.get<IcingRiskAssessment>(`/api/towers/${id}/risk`);
    return { tower, metrics, risk, id };
  } catch (e: any) {
    return { tower: null, metrics: null, risk: null, id, error: e?.message };
  }
});

function trendLabel(t?: string): string | undefined {
  if (!t) return undefined;
  if (t === "RapidlyIncreasing") return "↗↗ 急升";
  if (t === "Increasing") return "↗ 上升";
  if (t === "Decreasing") return "↘ 下降";
  return "→ 稳定";
}

export default component$(() => {
  const loader = useTowerLoader();
  const tower = useSignal<TowerPoint | null>(loader.value.tower as any);
  const metrics = useSignal<RealTimeMetrics | null>(loader.value.metrics as any);
  const risk = useSignal<IcingRiskAssessment | null>(loader.value.risk as any);
  const tab = useSignal<"overview" | "vibration" | "ice" | "model" | "history">("overview");

  useVisibleTask$(() => {
    const listeners = (globalThis as any).__ws_listeners || [];
    listeners.push((msg: any) => {
      if (msg.tower_id !== loader.value.id) return;
      if (msg.type === "vibration" && metrics.value) {
        metrics.value.vibration_acceleration = msg.acceleration;
        metrics.value.vibration_frequency = msg.frequency;
      }
      if (msg.type === "wind" && metrics.value) {
        metrics.value.wind_speed = msg.speed;
        metrics.value.wind_direction = msg.direction;
      }
      if (msg.type === "ice" && metrics.value) {
        metrics.value.ice_thickness = msg.ice_thickness;
        metrics.value.temperature = msg.temperature;
        metrics.value.humidity = msg.humidity;
      }
      if (msg.type === "risk_assessment") risk.value = msg;
    });
    (globalThis as any).__ws_listeners = listeners;
  });

  if (!tower.value) {
    return <div class="glass-panel p-16 text-center">
      <div class="text-5xl mb-4">❓</div>
      <div class="text-slate-400">塔架不存在或加载失败</div>
    </div>;
  }

  const t = tower.value;
  const level = risk.value?.risk_level ?? "Safe";
  const r = risk.value;
  const m = metrics.value;

  return <div>
    <div class="mb-6">
      <div class="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div class="text-sm text-slate-400 mb-1">/ <a href="/towers" class="hover:text-primary-400">塔架管理</a> / {t.code}</div>
          <h1 class="text-3xl font-bold text-slate-50 flex items-center gap-3">
            🗼 {t.name}
            <span class={["badge !px-3 !py-1 !text-sm", riskColors[level].bg, riskColors[level].text, riskColors[level].border]}>
              {riskLabels[level]}
            </span>
          </h1>
          <p class="text-slate-400 text-sm mt-1">{t.line_name} · {t.material} · 海拔 {t.geo.altitude.toFixed(0)}m</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-ghost">📥 导出</button>
          <button class="btn btn-ghost">📹 视频复核</button>
          <button class="btn btn-primary">⚡ 紧急处置</button>
        </div>
      </div>
    </div>

    <div class="glass-panel p-5 mb-6">
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <MetricGauge label="风速" value={m?.wind_speed} unit="m/s" max={t.max_wind_speed} color="blue" trend={trendLabel(r?.wind_speed_trend)} />
        <MetricGauge label="风向" value={m?.wind_direction} unit="°" formatter={(v) => windDirectionLabel(v)} color="cyan" />
        <MetricGauge label="覆冰厚度" value={m?.ice_thickness} unit="mm" max={t.max_ice_thickness} color={(m?.ice_thickness ?? 0) > t.max_ice_thickness * 0.55 ? "rose" : (m?.ice_thickness ?? 0) > t.max_ice_thickness * 0.25 ? "amber" : "sky"} trend={trendLabel(r?.ice_thickness_trend)} />
        <MetricGauge label="振动加速度" value={m?.vibration_acceleration} unit="mm/s²" max={40} color={(m?.vibration_acceleration ?? 0) > 25 ? "rose" : (m?.vibration_acceleration ?? 0) > 12 ? "amber" : "emerald"} trend={trendLabel(r?.vibration_trend)} />
        <MetricGauge label="振动频率" value={m?.vibration_frequency} unit="Hz" color="violet" />
        <MetricGauge label="环境温度" value={m?.temperature} unit="℃" color="indigo" />
        <MetricGauge label="相对湿度" value={m?.humidity} unit="%" max={100} color="teal" />
      </div>
    </div>

    <div class="flex gap-2 mb-6 border-b border-slate-800 overflow-x-auto pb-px">
      {[
        { k: "overview", label: "📈 实时总览" }, { k: "vibration", label: "📳 振动频谱" },
        { k: "ice", label: "❄️ 覆冰识别" }, { k: "model", label: "🧊 三维模型" }, { k: "history", label: "📚 历史分析" },
      ].map((tb) => (
        <button key={tb.k} onClick$={() => (tab.value = tb.k as any)}
          class={["px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg border-b-2 -mb-px transition-all",
            tab.value === tb.k ? "border-primary-500 text-primary-300 bg-primary-500/10" : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"]}>
          {tb.label}
        </button>
      ))}
    </div>

    <div class="grid grid-cols-12 gap-6">
      {tab.value === "overview" && <>
        <div class="col-span-12 xl:col-span-8 space-y-6">
          <ChartCard title="📈 过去24小时多参数趋势" height={340}><HistoryCharts mode="multi" /></ChartCard>
          <ChartCard title="📉 实时振动时域波形" height={260}><LiveWaveform /></ChartCard>
        </div>
        <div class="col-span-12 xl:col-span-4 space-y-6">
          <RiskPanel risk={r} />
          <RecPanel recs={r?.recommendations ?? []} />
          <LoadPanel load={r?.load_percentage ?? 0} />
        </div>
      </>}
      {tab.value === "vibration" && <>
        <div class="col-span-12 xl:col-span-8 space-y-6">
          <ChartCard title="🎼 振动 FFT 频谱分析" height={380}><SpectrumAnalyzer /></ChartCard>
          <ChartCard title="📊 三维加速度轨迹" height={300}><Vib3DPlot /></ChartCard>
        </div>
        <div class="col-span-12 xl:col-span-4 space-y-6">
          <div class="glass-panel p-5">
            <h2 class="section-title">🎛️ 频域诊断</h2>
            <div class="space-y-3 text-sm">
              <DiagRow label="主频" value="1.23 Hz" ok />
              <DiagRow label="2倍频" value="2.46 Hz" ok />
              <DiagRow label="异常谐振" value="12.30 Hz" warn note="缆绳涡激振动特征频率" />
              <DiagRow label="RMS" value={`${formatNumber(m?.vibration_acceleration)} mm/s²`} warn note="接近预警阈值" />
            </div>
          </div>
          <div class="glass-panel p-5">
            <h2 class="section-title">🧭 判定标准 (mm/s²)</h2>
            <div class="space-y-2 text-xs">
              {[["0-12", "优（正常运行）", "emerald"], ["12-25", "良（注意观察）", "amber"], ["25-40", "差（考虑停运）", "orange"], [">40", "不允许（停运）", "rose"]].map(([r, l, c]) => (
                <div key={r} class="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span class={`text-${c}-300 font-mono`}>{r}</span>
                  <span class="text-slate-300">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>}
      {tab.value === "ice" && <>
        <div class="col-span-12 xl:col-span-8 space-y-6">
          <ChartCard title="❄️ 覆冰厚度与载荷分析" height={360}><HistoryCharts mode="ice" /></ChartCard>
          <div class="grid grid-cols-2 gap-6">
            <ChartCard title="🌡️ 温湿度" height={280}><HistoryCharts mode="weather" /></ChartCard>
            <ChartCard title="🧮 覆冰类型" height={280}><IceType risk={r} /></ChartCard>
          </div>
        </div>
        <div class="col-span-12 xl:col-span-4 space-y-6">
          <div class="glass-panel p-5">
            <h2 class="section-title">🎯 风险因素</h2>
            <div class="space-y-2">
              {(r?.contributing_factors ?? []).length === 0
                ? <div class="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-200">✅ 当前无显著风险因素</div>
                : (r?.contributing_factors ?? []).map((f, i) => (
                  <div key={i} class="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-200">⚠️ {f}</div>
                ))}
            </div>
          </div>
          <div class="glass-panel p-5">
            <h2 class="section-title">📹 视频复核</h2>
            <div class="aspect-video rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 text-xs relative">
              RTSP 流 · H.264/4K · 点击开启
              <div class="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600/80 text-[10px] font-bold">
                <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </div>
              <div class="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-900/80 text-[10px]">CAM-{t.code.slice(4)}</div>
            </div>
            <button class="btn btn-primary w-full mt-3">📹 发起人工复核</button>
          </div>
        </div>
      </>}
      {tab.value === "model" && <div class="col-span-12">
        <ChartCard title="🧊 塔架三维数字孪生模型（载荷热力叠加）" height={640}>
          <Tower3DModel tower={t} />
        </ChartCard>
      </div>}
      {tab.value === "history" && <div class="col-span-12 space-y-6">
        <ChartCard title="📚 风险评估历史（过去30天）" height={320}><HistoryCharts mode="risk" /></ChartCard>
        <div class="grid grid-cols-3 gap-6">
          {[["⏸️", "累计停运", "32.5", "小时"], ["❄️", "最大覆冰", "41.2", "mm"], ["💨", "最大阵风", "28.6", "m/s"],
            ["📋", "巡检次数", "48", "次"], ["🧊", "除冰作业", "11", "次"], ["📊", "平均评分", "23.8", "分"]].map(([i, l, v, u]) => (
            <div key={l} class="stat-card text-center">
              <div class="text-3xl mb-1">{i}</div>
              <div class="text-[11px] text-slate-500 tracking-wide uppercase mb-1">{l}</div>
              <div class="text-3xl font-bold text-slate-100">{v}<span class="text-xs ml-1 text-slate-400 font-normal">{u}</span></div>
            </div>
          ))}
        </div>
      </div>}
    </div>
  </div>;
});

const MetricGauge = component$<{
  label: string; value: number | null | undefined; unit: string;
  max?: number; color: string; trend?: string; formatter?: (v: number) => string;
}>(({ label, value, unit, max, color, trend, formatter }) => {
  const display = value === null || value === undefined ? "-" : formatter ? formatter(value) : formatNumber(value);
  const pct = max && value !== null && value !== undefined ? Math.min(100, (value / max) * 100) : null;
  const map: Record<string, string> = {
    blue: "text-primary-400 from-primary-500/40 to-primary-500",
    cyan: "text-cyan-400 from-cyan-500/40 to-cyan-500",
    emerald: "text-emerald-400 from-emerald-500/40 to-emerald-500",
    amber: "text-amber-400 from-amber-500/40 to-amber-500",
    rose: "text-rose-400 from-rose-500/40 to-rose-500",
    sky: "text-sky-400 from-sky-500/40 to-sky-500",
    violet: "text-violet-400 from-violet-500/40 to-violet-500",
    indigo: "text-indigo-400 from-indigo-500/40 to-indigo-500",
    teal: "text-teal-400 from-teal-500/40 to-teal-500",
    orange: "text-orange-400 from-orange-500/40 to-orange-500",
  };
  const c = map[color]?.split(" ") || ["text-slate-100", "bg-slate-500"];
  return <div class="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
    <div class="flex items-center justify-between mb-2">
      <span class="text-[11px] text-slate-500 uppercase tracking-wider">{label}</span>
      {trend && <span class="text-[10px] text-slate-400">{trend}</span>}
    </div>
    <div class="flex items-baseline gap-1 mb-2">
      <span class={`text-2xl font-bold ${c[0]}`}>{display}</span>
      <span class="text-[11px] text-slate-500">{unit}</span>
    </div>
    {pct !== null && <div class="h-1.5 rounded-full bg-slate-800 overflow-hidden">
      <div class={`h-full rounded-full bg-gradient-to-r ${c.slice(1).join(" ")} transition-all`} style={{ width: `${pct}%` }} />
    </div>}
  </div>;
});

const ChartCard = component$<{ title: string; height?: number }>(({ title, height, children }) => (
  <div class="glass-panel p-5">
    <h2 class="section-title !mb-3">{title}</h2>
    <div style={height ? { height: `${height}px` } : undefined}>{children}</div>
  </div>
));

const RiskPanel = component$<{ risk: IcingRiskAssessment | null }>(({ risk }) => {
  if (!risk) return <div class="glass-panel p-8 text-center text-slate-500 text-sm">暂无风险评估</div>;
  const lvl = risk.risk_level as RiskLevel;
  const c = riskColors[lvl];
  return <div class="glass-panel p-5">
    <h2 class="section-title">🎯 综合风险评估</h2>
    <div class="relative mb-4 h-28 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-end p-4">
      <div class={`absolute left-0 right-0 bottom-0 bg-gradient-to-t ${c.bg} transition-all duration-700`} style={{ height: `${risk.composite_score}%` }} />
      <div class="relative w-full flex items-end justify-between">
        <div>
          <div class="text-xs text-slate-500 mb-1">综合评分</div>
          <div class={`text-5xl font-black ${c.text}`}>
            {risk.composite_score.toFixed(0)}<span class="text-2xl font-medium opacity-60">分</span>
          </div>
        </div>
        <div class="text-right">
          <div class={`badge !text-lg !px-4 !py-1.5 font-bold ${c.bg} ${c.text} ${c.border}`}>{riskLabels[lvl]}</div>
          <div class="text-[11px] text-slate-500 mt-2">{formatDateTime(risk.assessment_time)}</div>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2 text-xs">
      {[["冰类型", risk.ice_type_estimate], ["载荷率", `${risk.load_percentage.toFixed(1)}%`],
        ["估算载荷", `${(risk.estimated_load / 1000).toFixed(1)} kN`], ["复核", risk.reviewed ? "已复核" : "待复核"]].map(([k, v]) => (
        <div key={k} class="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex justify-between">
          <span class="text-slate-500">{k}</span>
          <span class={`font-bold ${risk.load_percentage > 80 && k === "载荷率" ? "text-rose-400" : "text-slate-200"}`}>{v}</span>
        </div>
      ))}
    </div>
  </div>;
});

const RecPanel = component$<{ recs: string[] }>(({ recs }) => (
  <div class="glass-panel p-5">
    <h2 class="section-title">💡 处置建议</h2>
    <div class="space-y-2">
      {recs.length === 0 && <div class="text-sm text-slate-500">暂无</div>}
      {recs.map((r, i) => (
        <div key={i} class="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20 text-sm text-primary-100 flex gap-2">
          <span>{i + 1}.</span><span>{r}</span>
        </div>
      ))}
    </div>
  </div>
));

const LoadPanel = component$<{ load: number }>(({ load }) => (
  <div class="glass-panel p-5">
    <h2 class="section-title">🏋️ 结构承载率</h2>
    <div class="relative py-4">
      <div class="flex justify-between text-xs text-slate-500 mb-1"><span>安全区</span><span>60%</span><span>80%</span><span>极限95%</span></div>
      <div class="relative h-5 rounded-full overflow-hidden bg-slate-900 border border-slate-800">
        <div class="absolute left-0 top-0 h-full w-[60%] bg-gradient-to-r from-emerald-900/40 to-emerald-700/30" />
        <div class="absolute left-[60%] top-0 h-full w-[20%] bg-gradient-to-r from-amber-900/40 to-amber-700/30" />
        <div class="absolute left-[80%] top-0 h-full w-[15%] bg-gradient-to-r from-orange-900/40 to-orange-700/30" />
        <div class="absolute left-[95%] top-0 h-full w-[5%] bg-gradient-to-r from-rose-900/40 to-rose-700/30" />
        <div class={`absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] rounded-full ${load > 95 ? "animate-pulse" : ""}`} style={{ left: `${Math.min(98, load)}%` }} />
      </div>
      <div class="mt-3 flex items-center justify-between">
        <span class="text-sm text-slate-300">当前承载率</span>
        <span class={`text-3xl font-bold ${load > 80 ? "text-rose-400 text-glow-red" : load > 60 ? "text-amber-400 text-glow-amber" : "text-emerald-400"}`}>{load.toFixed(1)}%</span>
      </div>
    </div>
  </div>
));

const LiveWaveform = component$(() => {
  const phase = useSignal(0);
  useVisibleTask$(() => {
    const id = setInterval(() => phase.value++, 80);
    return () => clearInterval(id);
  });
  return <div class="w-full h-full flex items-end justify-center relative">
    <svg class="w-full h-full" viewBox="0 0 800 260" preserveAspectRatio="none">
      {[52, 104, 156, 208].map(y => <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="rgba(148,163,184,0.1)" />)}
      <line x1="0" y1="130" x2="800" y2="130" stroke="rgba(148,163,184,0.2)" stroke-dasharray="4 4" />
      <path d={(() => {
        let s = ""; const p = phase.value;
        for (let i = 0; i <= 400; i++) {
          const x = (i / 400) * 800; const t = i / 400 + p * 0.04;
          const y = 130 - (18 * Math.sin(t * 40) * 0.5 + 9 * Math.sin(t * 80 + 1.3) * 0.3 + 4 * Math.sin(t * 15 + 0.7));
          s += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
        } return s;
      })()} fill="none" stroke="#22d3ee" stroke-width="1.5" filter="drop-shadow(0 0 4px rgba(34,211,238,0.6))" />
    </svg>
  </div>;
});

const Vib3DPlot = component$(() => (
  <div class="w-full h-full flex items-center justify-center">
    <div class="relative w-full h-full max-w-md mx-auto">
      <svg class="w-full h-full" viewBox="0 0 400 300">
        <defs><radialGradient id="gl" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#22d3ee" stop-opacity="0.6" /><stop offset="100%" stop-color="#22d3ee" stop-opacity="0" /></radialGradient></defs>
        <circle cx="200" cy="150" r="120" fill="url(#gl)" />
        {[40, 80, 120].map((r, i) => <ellipse key={r} cx="200" cy="150" rx={r} ry={r * 0.5} fill="none" stroke="rgba(148,163,184,0.15)" transform={`rotate(${-20 + i * 30} 200 150)`} />)}
        <polyline points={(() => {
          let s = "";
          for (let i = 0; i <= 200; i++) { const t = i / 200 * Math.PI * 8; const r = 50 + t * 2.5; s += (i === 0 ? `${200 + r * Math.cos(t)},${150 + r * Math.sin(t) * 0.5 + t * 0.4}` : ` ${200 + r * Math.cos(t)},${150 + r * Math.sin(t) * 0.5 + t * 0.4}`); }
          return s;
        })()} fill="none" stroke="#f472b6" stroke-width="1.6" />
      </svg>
    </div>
  </div>
));

const IceType = component$<{ risk: any }>(({ risk }) => {
  const t = risk?.ice_type_estimate ?? "晶凇";
  return <div class="p-4 text-sm space-y-3">
    <div class="text-center py-3 rounded-xl bg-gradient-to-br from-sky-500/20 to-cyan-900/30 border border-sky-500/30">
      <div class="text-[11px] text-slate-400">当前判别类型</div>
      <div class="text-3xl font-bold text-sky-200 mt-1">{t}</div>
    </div>
    {[
      ["晶凇 (Rime)", "低温水汽凝华 · 密度低 0.2~0.4 g/cm³", "bg-sky-500/10 border-sky-500/30"],
      ["雨凇 (Glaze)", "过冷水滴冻结 · 透明坚硬 0.8~0.9 g/cm³", "bg-cyan-500/10 border-cyan-500/30"],
      ["混合凇 (Mixed)", "晶凇+雨凇交替 · 危害最大", "bg-indigo-500/10 border-indigo-500/30"],
      ["软凇 (Soft)", "松散易脱落 · 通常无需处置", "bg-emerald-500/10 border-emerald-500/30"],
    ].map(([k, d, c]) => (
      <div key={k} class={`p-2.5 rounded-lg border text-xs ${k.startsWith(t) ? c + " ring-1 ring-sky-400/50" : "bg-slate-950/50 border-slate-800"}`}>
        <div class="font-semibold text-slate-200">{k}</div><div class="text-slate-400 mt-0.5">{d}</div>
      </div>
    ))}
  </div>;
});

const DiagRow = component$<{ label: string; value: string; ok?: boolean; warn?: boolean; note?: string }>(({ label, value, ok, warn, note }) => (
  <div class={`p-2.5 rounded-lg border flex items-center justify-between ${ok ? "bg-emerald-500/10 border-emerald-500/20" : warn ? "bg-amber-500/10 border-amber-500/20" : "bg-slate-950/50 border-slate-800"}`}>
    <div><div class="text-slate-400 text-xs">{label}</div>{note && <div class="text-[10px] text-slate-500 mt-0.5">⚠️ {note}</div>}</div>
    <div class={`font-mono font-bold ${ok ? "text-emerald-300" : warn ? "text-amber-300" : "text-slate-200"}`}>{value}</div>
  </div>
));

export const head: DocumentHead = { title: "塔架详情 · 索道塔架监测平台" };
