import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { DocumentHead } from "@builder.io/qwik-city";
import { Link } from "@builder.io/qwik-city";
import { api } from "~/utils/api";
import type { TowerPoint, IcingRiskAssessment } from "~/types";
import { riskColors, riskLabels, formatNumber } from "~/utils/format";
import { HistoryCharts } from "~/components/HistoryCharts";
import { SpectrumAnalyzer } from "~/components/SpectrumAnalyzer";

export default component$(() => {
  const towers = useSignal<TowerPoint[]>([]);
  const selected = useSignal<string>("");
  useVisibleTask$(async () => {
    try {
      const data = await api.get<TowerPoint[]>("/api/towers") || [];
      towers.value = data;
      if (data.length) selected.value = data[0].id;
    } catch {}
  });
  return <div>
    <h1 class="text-3xl font-bold text-slate-50 tracking-tight mb-1">
      实时监测中心 <span class="text-primary-400 text-glow-blue">Live Monitor</span>
    </h1>
    <p class="text-slate-400 text-sm mb-6">多维度振动、风速、覆冰同步实时监测 · 采样率 100Hz · 告警延迟 < 1s</p>
    <div class="grid grid-cols-12 gap-5">
      <div class="col-span-12 lg:col-span-3 glass-panel p-4">
        <div class="text-sm font-semibold text-slate-300 mb-3">塔架列表</div>
        <div class="space-y-1.5">
          {towers.value.map(t => (
            <Link key={t.id} href={`/towers/${t.id}`} onClick$={() => (selected.value = t.id)}
              class={["block p-2.5 rounded-lg border text-sm transition-all",
                selected.value === t.id ? "bg-primary-600/20 border-primary-500/40 text-primary-200" : "bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300"]}>
              <div class="flex items-center justify-between">
                <span class="font-semibold">{t.code}</span>
                <span class={["text-[10px] badge", t.status === "Normal" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"]}>
                  {t.status === "Normal" ? "正常" : "告警"}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 mt-0.5">{t.name}</div>
            </Link>
          ))}
        </div>
      </div>
      <div class="col-span-12 lg:col-span-9 space-y-5">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { l: "振动加速度", v: "8.6", u: "mm/s²", c: "text-cyan-400", t: "12.5 阈值" },
            { l: "风速", v: "14.2", u: "m/s", c: "text-blue-400", t: "18.0 阈值" },
            { l: "覆冰厚度", v: "18.4", u: "mm", c: "text-sky-400", t: "25.0 阈值" },
            { l: "结构应变", v: "143", u: "µε", c: "text-violet-400", t: "200 阈值" },
          ].map((m, i) => (
            <div key={i} class="stat-card">
              <div class="text-[11px] text-slate-500 uppercase">{m.l}</div>
              <div class="flex items-baseline gap-1 mt-1">
                <span class={`text-3xl font-bold ${m.c}`}>{m.v}</span>
                <span class="text-xs text-slate-400">{m.u}</span>
              </div>
              <div class="text-[10px] text-slate-500 mt-1">阈值: {m.t}</div>
            </div>
          ))}
        </div>
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div class="glass-panel p-5">
            <h2 class="section-title">📈 振动时域波形（实时）</h2>
            <div class="h-60"><HistoryCharts mode="multi" /></div>
          </div>
          <div class="glass-panel p-5">
            <h2 class="section-title">🎼 FFT 频谱分析</h2>
            <div class="h-60"><SpectrumAnalyzer /></div>
          </div>
          <div class="glass-panel p-5">
            <h2 class="section-title">🌬️ 风速风向玫瑰</h2>
            <WindRose />
          </div>
          <div class="glass-panel p-5">
            <h2 class="section-title">❄️ 覆冰厚度变化</h2>
            <div class="h-60"><HistoryCharts mode="ice" /></div>
          </div>
        </div>
      </div>
    </div>
  </div>;
});

const WindRose = component$(() => {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const vals = [38, 52, 74, 46, 30, 22, 58, 68];
  return <div class="h-60 flex items-center justify-center">
    <svg viewBox="-110 -110 220 220" class="w-full h-full max-w-xs">
      {[0.25, 0.5, 0.75, 1].map(f => <circle key={f} cx="0" cy="0" r={80 * f} fill="none" stroke="rgba(148,163,184,0.15)" />)}
      {dirs.map((_, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        return <line key={i} x1="0" y1="0" x2={Math.cos(a) * 80} y2={Math.sin(a) * 80} stroke="rgba(148,163,184,0.15)" />;
      })}
      {dirs.map((d, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        return <text key={d} x={Math.cos(a) * 95} y={Math.sin(a) * 95} fill="#94a3b8" font-size="10" text-anchor="middle" dominant-baseline="middle">{d}</text>;
      })}
      <polygon
        points={vals.map((v, i) => {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          const r = (v / 100) * 80;
          return `${Math.cos(a) * r},${Math.sin(a) * r}`;
        }).join(" ")}
        fill="rgba(59,130,246,0.3)" stroke="#60a5fa" stroke-width="2"
      />
    </svg>
  </div>;
});

export const head: DocumentHead = { title: "实时监测 · 索道塔架监测平台" };
