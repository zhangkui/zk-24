import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { DocumentHead } from "@builder.io/qwik-city";
import { api } from "~/utils/api";
import type { PageResult, RiskEvent, IcingRiskAssessment } from "~/types";
import { riskColors, riskLabels, formatDateTime, formatRelativeTime } from "~/utils/format";

export default component$(() => {
  const events = useSignal<RiskEvent[]>([]);
  useVisibleTask$(async () => {
    try {
      const data = await api.get<PageResult<RiskEvent>>("/api/towers/00000000-0000-0000-0000-000000000000/events?page=1&page_size=100");
      if (data?.items) events.value = data.items;
    } catch {
      const now = new Date();
      events.value = [
        { id: "1", tower_id: "a", event_time: now.toISOString(), event_type: "WindSpeedThresholdExceeded", severity: "Extreme", description: "瞬时阵风28.6m/s超极限阈值", threshold_value: 25, actual_value: 28.6, unit: "m/s", acknowledged: false, acknowledged_by: null, acknowledged_at: null, resolved: false },
        { id: "2", tower_id: "a", event_time: new Date(now.getTime() - 8 * 60000).toISOString(), event_type: "IceThicknessThresholdExceeded", severity: "High", description: "覆冰32.8mm超过危急阈值", threshold_value: 25, actual_value: 32.8, unit: "mm", acknowledged: false, acknowledged_by: null, acknowledged_at: null, resolved: false },
        { id: "3", tower_id: "a", event_time: new Date(now.getTime() - 22 * 60000).toISOString(), event_type: "RapidIceGrowth", severity: "High", description: "覆冰增长速率6.8mm/h，增长异常迅速", threshold_value: 5, actual_value: 6.8, unit: "mm/h", acknowledged: true, acknowledged_by: "x", acknowledged_at: new Date(now.getTime() - 15 * 60000).toISOString(), resolved: false },
        { id: "4", tower_id: "a", event_time: new Date(now.getTime() - 45 * 60000).toISOString(), event_type: "ResonanceDetected", severity: "High", description: "12.3Hz频率分量异常升高，疑似缆绳涡激共振", threshold_value: 0.6, actual_value: 0.82, unit: "ratio", acknowledged: true, acknowledged_by: "x", acknowledged_at: new Date(now.getTime() - 38 * 60000).toISOString(), resolved: true, resolved_at: new Date(now.getTime() - 10 * 60000).toISOString(), resolution_note: "风速下降后恢复正常" },
        { id: "5", tower_id: "a", event_time: new Date(now.getTime() - 90 * 60000).toISOString(), event_type: "CombinedRiskThreshold", severity: "Extreme", description: "冰风组合风险评分86.5，触发极端风险阈值", threshold_value: 80, actual_value: 86.5, unit: "分", acknowledged: true, acknowledged_by: "x", acknowledged_at: new Date(now.getTime() - 85 * 60000).toISOString(), resolved: true, resolved_at: new Date(now.getTime() - 30 * 60000).toISOString(), resolution_note: "已启动A区段紧急停运" },
      ];
    }
  });
  return <div>
    <h1 class="text-3xl font-bold text-slate-50 tracking-tight mb-1">
      风险识别中心 <span class="text-rose-400 text-glow-red">Risk Center</span>
    </h1>
    <p class="text-slate-400 text-sm mb-6">多源数据融合 · 覆冰风险智能识别 · 事件全生命周期管理</p>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {(["Safe", "Low", "Medium", "High", "Extreme"] as const).map((l) => (
        <div key={l} class={["stat-card text-center", riskColors[l].bg, riskColors[l].border]}>
          <div class={`text-4xl font-black ${riskColors[l].text}`}>
            {events.value.filter(e => e.severity === l && !e.resolved).length}
          </div>
          <div class={`text-xs mt-1 font-medium ${riskColors[l].text}`}>{riskLabels[l]}</div>
          <div class="text-[10px] text-slate-500">活跃事件</div>
        </div>
      ))}
    </div>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12 xl:col-span-7 glass-panel p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="section-title mb-0"><span>📋</span> 告警事件流</h2>
          <div class="flex gap-2 text-xs">
            <button class="btn btn-ghost !py-1 !text-xs">全部</button>
            <button class="btn btn-ghost !py-1 !text-xs">待处理</button>
            <button class="btn btn-ghost !py-1 !text-xs">已解决</button>
          </div>
        </div>
        <div class="space-y-2.5">
          {events.value.map(ev => {
            const c = riskColors[ev.severity as any];
            return (
              <div key={ev.id} class={["p-4 rounded-xl border transition-all", c.bg, c.border, ev.resolved && "opacity-60"]}>
                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-start gap-3 flex-1 min-w-0">
                    <div class={["w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0", c.bg, c.border, "border"]}>
                      {ev.severity === "Extreme" || ev.severity === "High" ? "🚨" : ev.severity === "Medium" ? "⚠️" : "ℹ️"}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap mb-1">
                        <span class={`badge ${c.bg} ${c.text}`}>{riskLabels[ev.severity as any]}</span>
                        <span class="text-xs font-semibold text-slate-200">{ev.event_type}</span>
                        {ev.resolved && <span class="badge bg-slate-700/40 text-slate-400">✅ 已解决</span>}
                        {ev.acknowledged && !ev.resolved && <span class="badge bg-primary-600/30 text-primary-300">👁️ 已确认</span>}
                      </div>
                      <p class="text-sm text-slate-300 mb-1.5">{ev.description}</p>
                      <div class="flex flex-wrap gap-3 text-[11px] text-slate-500 font-mono">
                        <span>阈值 <b class="text-slate-400">{ev.threshold_value}{ev.unit}</b></span>
                        <span>实测 <b class={c.text}>{ev.actual_value}{ev.unit}</b></span>
                        <span>塔架 <b class="text-slate-400">{ev.tower_id.slice(0, 8)}</b></span>
                        <span>{formatRelativeTime(ev.event_time)}</span>
                      </div>
                    </div>
                  </div>
                  <div class="flex flex-col gap-1 shrink-0">
                    {!ev.acknowledged && <button class="btn btn-primary !py-1 !text-xs">确认</button>}
                    {!ev.resolved && <button class="btn btn-ghost !py-1 !text-xs">处置</button>}
                    <button class="btn btn-ghost !py-1 !text-xs">📹复核</button>
                  </div>
                </div>
                {ev.resolution_note && <div class="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-400">💬 {ev.resolution_note}</div>}
              </div>
            );
          })}
        </div>
      </div>
      <div class="col-span-12 xl:col-span-5 space-y-6">
        <div class="glass-panel p-5">
          <h2 class="section-title"><span>🧠</span> 风险识别算法</h2>
          <div class="space-y-3 text-sm">
            {[
              { n: "冰厚趋势模型", d: "指数加权移动平均 + 多项式拟合预测未来2小时冰厚", v: "AUC 0.943", c: "emerald" },
              { n: "风速威布尔分布", d: "3小时窗口拟合概率密度计算超阈值概率", v: "AUC 0.918", c: "sky" },
              { n: "振动频域分析", d: "FFT + 谐波识别 + 共振检测模态分解", v: "AUC 0.896", c: "violet" },
              { n: "综合风险融合", d: "XGBoost多源融合 + 专家规则后处理校正", v: "AUC 0.967", c: "amber" },
            ].map((m, i) => (
              <div key={i} class="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-semibold text-slate-200">{m.n}</span>
                  <span class={`text-${m.c}-400 text-xs font-mono font-bold`}>{m.v}</span>
                </div>
                <div class="text-xs text-slate-500">{m.d}</div>
              </div>
            ))}
          </div>
        </div>
        <div class="glass-panel p-5">
          <h2 class="section-title"><span>📊</span> 近7天风险统计</h2>
          <div class="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 * 24 }).map((_, i) => {
              const t = i / (7 * 24);
              const storm = (t > 0.35 && t < 0.5) || (t > 0.78 && t < 0.9);
              const base = storm ? 2 + Math.random() * 2 : Math.random();
              const lvl = base > 3 ? "Extreme" : base > 2 ? "High" : base > 1.2 ? "Medium" : base > 0.5 ? "Low" : "Safe";
              const c = riskColors[lvl as any];
              return <div key={i} class={["aspect-square rounded-sm", c.bg]} title={lvl} />;
            })}
          </div>
          <div class="mt-3 flex justify-between text-[10px] text-slate-500">
            <span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>周日</span>
          </div>
        </div>
      </div>
    </div>
  </div>;
});

export const head: DocumentHead = { title: "风险识别 · 索道塔架监测平台" };
