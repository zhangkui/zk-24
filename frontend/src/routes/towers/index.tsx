import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link, DocumentHead } from "@builder.io/qwik-city";
import { api } from "~/utils/api";
import type { TowerPoint } from "~/types";
import {
  riskColors,
  riskLabels,
  formatNumber,
  formatDateTime,
} from "~/utils/format";

export default component$(() => {
  const towers = useSignal<TowerPoint[]>([]);
  const filter = useSignal<string>("all");
  const search = useSignal("");

  useVisibleTask$(async () => {
    try {
      towers.value = await api.get<TowerPoint[]>("/api/towers") || [];
    } catch {}
  });

  const filtered = towers.value.filter((t) => {
    if (filter.value !== "all" && t.status !== filter.value) return false;
    if (search.value) {
      const q = search.value.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.line_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div>
      <div class="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-3xl font-bold text-slate-50 tracking-tight mb-1">
            塔架点位 <span class="text-primary-400 text-glow-blue">建模管理</span>
          </h1>
          <p class="text-slate-400 text-sm">
            共 {towers.value.length} 座塔架 · {filtered.length} 座符合筛选条件
          </p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <input
            class="input w-64"
            placeholder="🔍 搜索塔架名称/编号…"
            bind:value={search}
          />
          <select
            class="input w-auto"
            bind:value={filter}
          >
            <option value="all">全部状态</option>
            <option value="Normal">正常运行</option>
            <option value="Warning">预警状态</option>
            <option value="Critical">严重告警</option>
            <option value="Maintenance">维护中</option>
          </select>
          <button class="btn btn-primary">
            <span>➕</span>新建塔架
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((t) => (
          <div key={t.id} class="glass-panel p-5 group hover:border-primary-500/50 transition-all">
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/30 to-primary-900/30 border border-primary-500/30 flex items-center justify-center text-2xl">
                  🗼
                </div>
                <div>
                  <div class="text-lg font-bold text-slate-100">{t.name}</div>
                  <div class="text-xs text-slate-500 tracking-wider">
                    {t.code} · {t.line_name} #{t.index}
                  </div>
                </div>
              </div>
              <span
                class={[
                  "badge",
                  t.status === "Normal" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" :
                    t.status === "Warning" ? "bg-amber-500/15 text-amber-300 border border-amber-500/30" :
                      t.status === "Critical" ? "bg-rose-500/15 text-rose-300 border border-rose-500/30 animate-pulse" :
                        "bg-slate-500/15 text-slate-300 border border-slate-500/30",
                ]}
              >
                {t.status === "Normal" ? "正常" : t.status === "Warning" ? "预警" : t.status === "Critical" ? "严重" : "维护"}
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2 mb-4 text-center">
              <MiniStat label="塔高" value={`${t.height.toFixed(0)}m`} />
              <MiniStat label="海拔" value={`${t.geo.altitude.toFixed(0)}m`} />
              <MiniStat label="投运" value={`${t.build_year}`} />
            </div>

            <div class="grid grid-cols-2 gap-2 mb-4 text-xs">
              <div class="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                <div class="text-slate-500 mb-0.5">📍 地理坐标</div>
                <div class="text-slate-200 font-mono text-[11px]">
                  {t.geo.latitude.toFixed(5)}, {t.geo.longitude.toFixed(5)}
                </div>
              </div>
              <div class="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                <div class="text-slate-500 mb-0.5">🏗️ 结构材质</div>
                <div class="text-slate-200">{t.material}</div>
              </div>
              <div class="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                <div class="text-slate-500 mb-0.5">💨 设计抗风</div>
                <div class="text-slate-200">{t.max_wind_speed} m/s</div>
              </div>
              <div class="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                <div class="text-slate-500 mb-0.5">❄️ 设计覆冰</div>
                <div class="text-slate-200">{t.max_ice_thickness} mm</div>
              </div>
            </div>

            <div class="mb-4">
              <div class="text-xs text-slate-500 mb-2">
                传感器 ({t.sensors.length})
              </div>
              <div class="flex flex-wrap gap-1">
                {t.sensors.map((s, i) => (
                  <span
                    key={i}
                    title={`${s.sensor_type} @ ${s.location}`}
                    class={[
                      "text-[10px] px-1.5 py-0.5 rounded",
                      s.online
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        : "bg-slate-700/30 text-slate-400 border border-slate-600/30",
                    ]}
                  >
                    {s.online ? "●" : "○"}{" "}
                    {s.sensor_type.replace("Sensor", "").replace("Meter", "")}
                  </span>
                ))}
              </div>
            </div>

            <div class="text-[11px] text-slate-500 mb-3">
              最近更新：{formatDateTime(t.updated_at)}
            </div>

            <div class="flex gap-2 pt-3 border-t border-slate-800">
              <Link
                href={`/towers/${t.id}`}
                class="btn btn-primary !py-1.5 flex-1 !text-xs"
              >
                📊 实时监测
              </Link>
              <Link
                href={`/towers/${t.id}`}
                class="btn btn-ghost !py-1.5 !text-xs"
              >
                ✏️
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div class="glass-panel p-16 text-center">
          <div class="text-6xl mb-4 opacity-50">🗼</div>
          <div class="text-slate-400 mb-2">没有匹配的塔架</div>
          <div class="text-xs text-slate-500">调整筛选条件或新建塔架</div>
        </div>
      )}
    </div>
  );
});

const MiniStat = component$<{ label: string; value: string }>(({ label, value }) => (
  <div class="rounded-lg bg-slate-950/60 border border-slate-800 py-2">
    <div class="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    <div class="text-sm font-bold text-slate-100 mt-0.5">{value}</div>
  </div>
));

export const head: DocumentHead = {
  title: "塔架管理 · 索道塔架监测平台",
};
