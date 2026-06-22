import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { DocumentHead } from "@builder.io/qwik-city";
import { api } from "~/utils/api";
import type { ShutdownDecision } from "~/types";
import {
  priorityColors, priorityLabels, statusColors, statusLabels,
  decisionTypeLabels, formatDateTime, formatRelativeTime,
} from "~/utils/format";

export default component$(() => {
  const decisions = useSignal<ShutdownDecision[]>([]);
  const filter = useSignal<string>("all");
  useVisibleTask$(async () => {
    try {
      const data = await api.get<ShutdownDecision[]>("/api/decisions") || [];
      decisions.value = data;
    } catch {
      decisions.value = sampleDecisions();
    }
  });
  const filtered = filter.value === "all" ? decisions.value
    : decisions.value.filter(d => d.status === filter.value);
  return <div>
    <h1 class="text-3xl font-bold text-slate-50 tracking-tight mb-1">
      停运决策中心 <span class="text-amber-400 text-glow-amber">Decision Engine</span>
    </h1>
    <p class="text-slate-400 text-sm mb-6">
      风险驱动决策生成 · 人工审批流程 · 策略执行追踪 · 停运影响评估
    </p>
    <div class="grid grid-cols-4 gap-4 mb-6">
      {[
        ["PendingApproval", "待审批", "bg-amber-500/15 border-amber-500/30", "text-amber-300"],
        ["Approved", "已批准", "bg-primary-500/15 border-primary-500/30", "text-primary-300"],
        ["Executed", "已执行", "bg-emerald-500/15 border-emerald-500/30", "text-emerald-300"],
        ["Rejected", "已拒绝", "bg-slate-700/30 border-slate-600/50", "text-slate-400"],
      ].map(([k, l, b, c]) => (
        <div key={k} class={["stat-card border", b]}>
          <div class={`text-4xl font-black ${c}`}>
            {decisions.value.filter(d => d.status === k).length}
          </div>
          <div class="text-sm text-slate-400 mt-1">{l}</div>
        </div>
      ))}
    </div>
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div class="flex gap-2">
        {[
          ["all", "全部"], ["PendingApproval", "待审批"], ["Approved", "已批准"],
          ["Executed", "已执行"], ["Rejected", "已拒绝"],
        ].map(([k, l]) => (
          <button key={k} onClick$={() => (filter.value = k)}
            class={["btn !py-1.5 text-xs", filter.value === k ? "btn-primary" : "btn-ghost"]}>{l}
            <span class="opacity-60 ml-1">({k === "all" ? decisions.value.length : decisions.value.filter(d => d.status === k).length})</span>
          </button>
        ))}
      </div>
      <div class="flex gap-2">
        <button class="btn btn-ghost">📊 决策统计</button>
        <button class="btn btn-ghost">⚙️ 策略配置</button>
      </div>
    </div>
    <div class="space-y-4">
      {filtered.length === 0 && <div class="glass-panel p-12 text-center text-slate-500">暂无决策记录</div>}
      {filtered.map(d => (
        <div key={d.id} class="glass-panel p-5 border-l-4"
          style={{ borderLeftColor: d.priority === "Critical" ? "#f43f5e" : d.priority === "High" ? "#f97316" : d.priority === "Medium" ? "#f59e0b" : "#64748b" }}>
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2 flex-wrap">
                <span class={priorityColors[d.priority]}>⚡ {priorityLabels[d.priority]}</span>
                <span class={statusColors[d.status]}>{statusLabels[d.status]}</span>
                <span class="badge bg-slate-800/80 text-slate-300 border border-slate-700">{decisionTypeLabels[d.decision_type]}</span>
                {d.auto_generated && <span class="badge bg-violet-500/15 text-violet-300 border border-violet-500/30">🤖 AI生成</span>}
                {d.executed && <span class="badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">✅ 已执行</span>}
              </div>
              <h3 class="text-lg font-semibold text-slate-100 mb-2">
                {typeof d.recommended_action === "string"
                  ? d.recommended_action
                  : d.recommended_action?.type || "停运决策"
                  || (() => {
                    const keys = Object.keys(d.recommended_action || {});
                    if (keys.includes("FullSuspend")) return "全线停运";
                    if (keys.includes("EmergencyStop")) return "紧急停车";
                    if (keys.includes("SuspendSection")) return "区段停运";
                    if (keys.includes("ReduceSpeed")) return "降速运行";
                    if (keys.includes("ReduceCapacity")) return "减载运行";
                    return "正常运行";
                  })()}
              </h3>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-xs">
                <div class="p-2 rounded bg-slate-950/60 border border-slate-800">
                  <div class="text-slate-500 mb-0.5">塔架</div>
                  <div class="text-slate-200 font-mono">{d.tower_id.slice(0, 8)}…</div>
                </div>
                <div class="p-2 rounded bg-slate-950/60 border border-slate-800">
                  <div class="text-slate-500 mb-0.5">预计时长</div>
                  <div class="text-slate-200">{d.estimated_duration_minutes} 分钟</div>
                </div>
                <div class="p-2 rounded bg-slate-950/60 border border-slate-800">
                  <div class="text-slate-500 mb-0.5">旅客等待</div>
                  <div class="text-slate-200">{d.passenger_handling?.estimated_wait_minutes ?? 0} 分钟</div>
                </div>
                <div class="p-2 rounded bg-slate-950/60 border border-slate-800">
                  <div class="text-slate-500 mb-0.5">触发于</div>
                  <div class="text-slate-200">{formatRelativeTime(d.decision_time)}</div>
                </div>
              </div>
              <div class="space-y-1.5 mb-3">
                {d.trigger_reasons.map((r, i) => (
                  <div key={i} class="text-xs flex items-start gap-2 p-2 rounded bg-slate-950/50 border border-slate-800">
                    <span class={[
                      "badge !py-0 shrink-0 mt-0.5",
                      r.severity === "Extreme" || r.severity === "High" ? "bg-rose-500/15 text-rose-300"
                        : r.severity === "Medium" ? "bg-amber-500/15 text-amber-300" : "bg-lime-500/15 text-lime-300",
                    ]}>{r.code}</span>
                    <div class="flex-1 min-w-0">
                      <div class="text-slate-200">{r.description}</div>
                      <div class="text-slate-500 font-mono mt-0.5">
                        {r.metric}: {r.actual.toFixed(2)} (阈值 {r.threshold.toFixed(1)})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {(d.comments || d.approved_at || d.executed_at) && (
                <div class="text-xs space-y-1 p-2 rounded bg-slate-950/40 border border-slate-800">
                  {d.approved_at && <div class="text-slate-400">✅ {d.approver_id?.slice(0, 8) || "AI"} 审批于 {formatDateTime(d.approved_at)}</div>}
                  {d.executed_at && <div class="text-slate-400">⚡ {d.executor_id?.slice(0, 8) || "系统"} 执行于 {formatDateTime(d.executed_at)}</div>}
                  {d.comments && <div class="text-slate-300">💬 {d.comments}</div>}
                </div>
              )}
            </div>
            <div class="flex flex-col gap-2 w-full md:w-auto md:min-w-[140px]">
              {d.status === "PendingApproval" && <>
                <button class="btn btn-primary w-full">✅ 批准执行</button>
                <button class="btn btn-ghost w-full">❌ 驳回</button>
              </>}
              {d.status === "Approved" && !d.executed && <button class="btn btn-danger w-full">⚡ 立即执行</button>}
              <button class="btn btn-ghost w-full">📹 关联视频</button>
              <button class="btn btn-ghost w-full">📄 详情 →</button>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div class="glass-panel p-5 mt-8">
      <h2 class="section-title"><span>⚙️</span> 应急策略配置</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { n: "严重覆冰自动停运", d: "覆冰厚度≥40mm持续3分钟→全线停运+视频复核", t: "rose", s: true },
          { n: "强风减载策略", d: "风速≥18m/s持续5分钟→降速至50%", t: "amber", s: true },
          { n: "冰风组合极端风险", d: "综合评分≥80持续1分钟→紧急停车+疏散", t: "rose", s: true },
        ].map((s, i) => (
          <div key={i} class={`p-4 rounded-xl border bg-${s.t}-500/5 border-${s.t}-500/20`}>
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold text-slate-100">{s.n}</h3>
              <div class={`w-9 h-5 rounded-full bg-${s.t}-600 relative ${!s.s ? "opacity-40" : ""}`}>
                <div class={`absolute top-0.5 w-4 h-4 rounded-full bg-white ${s.s ? "right-0.5" : "left-0.5"} transition-all`} />
              </div>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed">{s.d}</p>
            <div class="mt-3 flex justify-between text-[10px] text-slate-500">
              <span>v1.0</span><span>已触发 3 次</span><span>100% 正确率</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>;
});

function sampleDecisions(): ShutdownDecision[] {
  const now = new Date();
  const U = () => (crypto as any)?.randomUUID?.() || String(Math.random());
  return [
    {
      id: U(), tower_id: U(), decision_time: new Date(now.getTime() - 6 * 60000).toISOString(),
      decision_type: "Emergency", priority: "Critical",
      trigger_reasons: [{ code: "COMBO_EXTREME", metric: "composite_score", threshold: 80, actual: 86.5, severity: "Extreme", description: "冰风组合极端风险触发" }],
      risk_evidence: [U()], recommended_action: "EmergencyStop",
      estimated_duration_minutes: 240, affected_sections: ["全线路"],
      passenger_handling: { unload_passengers: true, hold_in_stations: true, ground_transport_arranged: true, estimated_wait_minutes: 180 },
      estimated_impact: "Indefinite", auto_generated: true, status: "PendingApproval",
      approver_id: null, approved_at: null, comments: null, executed: false, executed_at: null, executor_id: null,
    },
    {
      id: U(), tower_id: U(), decision_time: new Date(now.getTime() - 38 * 60000).toISOString(),
      decision_type: "Mandatory", priority: "High",
      trigger_reasons: [
        { code: "ICE_CRITICAL", metric: "ice_thickness", threshold: 25, actual: 32.8, severity: "High", description: "覆冰厚度危急" },
        { code: "WIND_CRITICAL", metric: "wind_speed", threshold: 18, actual: 21.3, severity: "High", description: "风速危急" },
      ],
      risk_evidence: [U(), U()], recommended_action: "SuspendSection",
      estimated_duration_minutes: 120, affected_sections: ["A1-A5区段"],
      passenger_handling: { unload_passengers: true, hold_in_stations: true, ground_transport_arranged: true, estimated_wait_minutes: 90 },
      estimated_impact: "Delay2Hours", auto_generated: true, status: "Approved",
      approver_id: U(), approved_at: new Date(now.getTime() - 35 * 60000).toISOString(),
      comments: "已通知站务人员，协调转运车辆", executed: true,
      executed_at: new Date(now.getTime() - 32 * 60000).toISOString(), executor_id: U(),
    },
    {
      id: U(), tower_id: U(), decision_time: new Date(now.getTime() - 120 * 60000).toISOString(),
      decision_type: "Recommended", priority: "Medium",
      trigger_reasons: [{ code: "ICE_WARNING", metric: "ice_thickness", threshold: 10, actual: 16.2, severity: "Medium", description: "覆冰厚度告警" }],
      risk_evidence: [U()], recommended_action: "ReduceSpeed",
      estimated_duration_minutes: 60, affected_sections: [],
      passenger_handling: { unload_passengers: false, hold_in_stations: false, ground_transport_arranged: false, estimated_wait_minutes: 30 },
      estimated_impact: "Delay30Min", auto_generated: true, status: "Executed",
      approver_id: U(), approved_at: new Date(now.getTime() - 118 * 60000).toISOString(),
      comments: null, executed: true,
      executed_at: new Date(now.getTime() - 110 * 60000).toISOString(), executor_id: U(),
    },
  ];
}

export const head: DocumentHead = { title: "停运决策 · 索道塔架监测平台" };
