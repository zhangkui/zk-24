import { component$, useSignal } from "@builder.io/qwik";
import { DocumentHead } from "@builder.io/qwik-city";
import type { InspectionStatus, InspectionType, ConditionRating } from "~/types";
import { formatDateTime, formatRelativeTime } from "~/utils/format";

const typeMap: Record<InspectionType, { c: string; l: string; i: string }> = {
  Routine: { c: "bg-sky-500/15 text-sky-300 border-sky-500/30", l: "常规巡检", i: "📋" },
  PostStorm: { c: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30", l: "灾后巡检", i: "⛈️" },
  PostIcing: { c: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30", l: "覆冰后巡检", i: "❄️" },
  ScheduledMaintenance: { c: "bg-amber-500/15 text-amber-300 border-amber-500/30", l: "定期保养", i: "🔧" },
  EmergencyInspection: { c: "bg-rose-500/15 text-rose-300 border-rose-500/30", l: "紧急检查", i: "🚨" },
  Annual: { c: "bg-violet-500/15 text-violet-300 border-violet-500/30", l: "年度大检", i: "🏆" },
};

const statusMap: Record<InspectionStatus, { c: string; l: string }> = {
  Scheduled: { c: "bg-slate-500/30 text-slate-300 border-slate-500/40", l: "已排期" },
  InProgress: { c: "bg-primary-500/15 text-primary-300 border-primary-500/30", l: "进行中" },
  Completed: { c: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", l: "已完成" },
  Cancelled: { c: "bg-slate-700/30 text-slate-400 border-slate-600/40", l: "已取消" },
  RequiresFollowUp: { c: "bg-amber-500/15 text-amber-300 border-amber-500/30", l: "需复查" },
};

const condMap: Record<ConditionRating, string> = {
  Excellent: "text-emerald-400",
  Good: "text-lime-400",
  Fair: "text-amber-400",
  Poor: "text-orange-400",
  Critical: "text-rose-400",
};

export default component$(() => {
  const tab = useSignal<"list" | "calendar" | "reports">("list");
  const inspections = sampleData();
  const upcoming = sampleUpcoming();
  return <div>
    <h1 class="text-3xl font-bold text-slate-50 tracking-tight mb-1">
      巡检记录归档 <span class="text-emerald-400">Inspections</span>
    </h1>
    <p class="text-slate-400 text-sm mb-6">结构化巡检表单 · 现场发现记录 · 维护作业追踪 · 整改闭环管理</p>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {[
        ["📋", "本月巡检", 24, "次"],
        ["✅", "已完成", 19, "次"],
        ["🚧", "进行中", 3, "次"],
        ["⚠️", "待复查", 4, "项"],
        ["🧊", "除冰作业", 11, "次"],
      ].map(([i, l, v, u]) => (
        <div key={l as string} class="stat-card">
          <div class="flex items-center gap-2 text-slate-400 text-xs mb-1"><span class="text-lg">{i}</span>{l}</div>
          <div class="flex items-baseline gap-1"><span class="text-3xl font-bold text-slate-100">{v}</span><span class="text-xs text-slate-500">{u}</span></div>
        </div>
      ))}
    </div>
    <div class="flex gap-2 mb-5 border-b border-slate-800">
      {[["list", "📜 历史记录"], ["calendar", "📅 排期日历"], ["reports", "📊 统计报表"]].map(([k, l]) => (
        <button key={k} onClick$={() => (tab.value = k as any)}
          class={["px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px",
            tab.value === k ? "border-primary-500 text-primary-300 bg-primary-500/10" : "border-transparent text-slate-400 hover:text-slate-200"]}>{l as string}</button>
      ))}
      <div class="ml-auto flex gap-2 pb-2">
        <button class="btn btn-ghost">📥 导入</button>
        <button class="btn btn-ghost">📤 导出</button>
        <button class="btn btn-primary">➕ 新建巡检记录</button>
      </div>
    </div>
    {tab.value === "list" && <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12 xl:col-span-8 space-y-4">
        {inspections.map(rec => <div key={rec.id} class="glass-panel p-5">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2 flex-wrap">
                <span class={["badge", typeMap[rec.inspection_type].c]}>{typeMap[rec.inspection_type].i} {typeMap[rec.inspection_type].l}</span>
                <span class={["badge", statusMap[rec.status].c]}>{statusMap[rec.status].l}</span>
                {rec.follow_up_required && <span class="badge bg-amber-500/15 text-amber-300 border-amber-500/30">🔔 需复查</span>}
                {rec.signed_off && <span class="badge bg-emerald-500/15 text-emerald-300 border-emerald-500/30">✍️ 已签核</span>}
              </div>
              <h3 class="text-base font-semibold text-slate-100 mb-1">
                {rec.inspector_name} · {rec.tower_code || "塔架 " + rec.tower_id.slice(0, 6)}
              </h3>
              <div class="flex flex-wrap gap-4 text-xs text-slate-500">
                <span>📅 计划: {formatDateTime(rec.planned_date)}</span>
                {rec.started_at && <span>▶️ 开始: {formatRelativeTime(rec.started_at)}</span>}
                {rec.completed_at && <span>✅ 完成: {formatDateTime(rec.completed_at)}</span>}
                <span>🌤️ {rec.weather_conditions}</span>
              </div>
              <div class="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  ["基础", rec.structural_checks?.foundation],
                  ["主柱", rec.structural_checks?.middle_section],
                  ["顶部", rec.structural_checks?.top_section],
                  ["鞍座", rec.structural_checks?.cable_attachments],
                  ["紧固件", rec.structural_checks?.bolts_and_fasteners],
                ].map(([k, v]) => v && (
                  <div key={k as string} class="p-2 rounded-lg bg-slate-950/50 border border-slate-800 text-xs">
                    <div class="text-slate-500">{k as string}</div>
                    <div class={`font-semibold ${condMap[v as ConditionRating]}`}>{v as string}</div>
                  </div>
                ))}
              </div>
              {rec.findings?.length > 0 && (
                <div class="mt-3 space-y-1.5">
                  <div class="text-xs text-slate-400">现场发现 ({rec.findings.length}项):</div>
                  {rec.findings.slice(0, 3).map((f, i) => (
                    <div key={i} class={`p-2 rounded border text-xs ${f.severity === "SafetyCritical" || f.severity === "Major" ? "bg-rose-500/10 border-rose-500/20 text-rose-200" :
                      f.severity === "Moderate" ? "bg-amber-500/10 border-amber-500/20 text-amber-200" : "bg-slate-800/40 border-slate-700/40 text-slate-300"}`}>
                      <span class="font-bold">[{f.severity}]</span> {f.category} - {f.description} {f.resolved && <span class="text-emerald-400">✓ 已修复</span>}
                    </div>
                  ))}
                  {rec.findings.length > 3 && <div class="text-xs text-slate-500 pl-2">…还有 {rec.findings.length - 3} 项</div>}
                </div>
              )}
              {rec.notes && <div class="mt-3 text-xs p-2.5 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-200">💬 {rec.notes}</div>}
            </div>
            <div class="flex flex-col gap-1.5 w-full md:w-auto">
              <button class="btn btn-ghost w-full md:min-w-[120px] !text-xs">查看详情</button>
              <button class="btn btn-ghost w-full md:min-w-[120px] !text-xs">编辑</button>
              {rec.status === "Completed" && rec.follow_up_required && <button class="btn btn-primary w-full md:min-w-[120px] !text-xs">创建复查</button>}
            </div>
          </div>
        </div>)}
      </div>
      <div class="col-span-12 xl:col-span-4 space-y-5">
        <div class="glass-panel p-5">
          <h2 class="section-title"><span>📅</span> 即将到来</h2>
          <div class="space-y-2.5">
            {upcoming.map((u, i) => (
              <div key={i} class="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-3">
                <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-500/40 to-primary-900/40 border border-primary-500/30 flex flex-col items-center justify-center text-xs shrink-0">
                  <div class="text-primary-200">{u.month}</div>
                  <div class="text-xl font-bold text-white">{u.day}</div>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-slate-200 truncate">{u.title}</div>
                  <div class="text-xs text-slate-500 mt-0.5">{u.tower} · {u.inspector}</div>
                </div>
                <span class={["badge", typeMap[u.type as InspectionType].c]}>{typeMap[u.type as InspectionType].l}</span>
              </div>
            ))}
          </div>
        </div>
        <div class="glass-panel p-5">
          <h2 class="section-title"><span>👥</span> 巡检团队</h2>
          <div class="space-y-2.5">
            {[
              ["张建国", "高级工程师", 16, "emerald"],
              ["李明辉", "维修主管", 12, "sky"],
              ["王晓峰", "技术员", 9, "violet"],
              ["赵红梅", "安全员", 7, "amber"],
              ["陈志刚", "外聘专家", 3, "rose"],
            ].map(([n, t, c, col]) => (
              <div key={n as string} class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/40">
                <div class={`w-10 h-10 rounded-full bg-gradient-to-br from-${col}-500 to-${col}-800 flex items-center justify-center text-sm font-bold`}>
                  {(n as string)[0]}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-slate-200">{n}</div>
                  <div class="text-[11px] text-slate-500">{t} · 本月巡检 {c} 次</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div class="glass-panel p-5">
          <h2 class="section-title"><span>📊</span> 本月分布</h2>
          <div class="space-y-2.5 text-sm">
            {[
              ["常规巡检", 12, 15, "sky"],
              ["覆冰后巡检", 5, 6, "cyan"],
              ["灾后检查", 2, 3, "indigo"],
              ["定期保养", 3, 4, "amber"],
              ["紧急检查", 2, 2, "rose"],
            ].map(([n, v, m, c]) => (
              <div key={n as string}>
                <div class="flex justify-between text-xs mb-1">
                  <span class="text-slate-300">{n}</span>
                  <span class="text-slate-400">{v}/{m}</span>
                </div>
                <div class="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div class={`h-full rounded-full bg-${c}-500`} style={{ width: `${((v as number) / (m as number)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>}
    {tab.value === "calendar" && <div class="glass-panel p-8 text-center text-slate-400">
      <div class="text-6xl mb-4 opacity-50">📅</div>
      <div class="mb-2">日历排期视图</div>
      <div class="text-xs">以日历形式展示过去/未来巡检计划，支持拖拽调整排期</div>
    </div>}
    {tab.value === "reports" && <div class="glass-panel p-8 text-center text-slate-400">
      <div class="text-6xl mb-4 opacity-50">📊</div>
      <div class="mb-2">统计报表中心</div>
      <div class="text-xs">巡检完成率、发现问题分布、整改闭环效率等多维报表</div>
    </div>}
  </div>;
});

function sampleData(): any[] {
  const U = () => (crypto as any)?.randomUUID?.() || String(Math.random());
  const now = Date.now();
  return [
    {
      id: U(), tower_id: U(), tower_code: "TWR-0003 · A3号塔", inspection_type: "PostIcing",
      inspector_name: "张建国", inspector_id: U(),
      planned_date: new Date(now - 2 * 86400000 - 3 * 3600000).toISOString(),
      started_at: new Date(now - 2 * 86400000).toISOString(),
      completed_at: new Date(now - 2 * 86400000 + 4 * 3600000).toISOString(),
      status: "Completed",
      overall_condition: "Good",
      findings: [
        { category: "覆冰残留", severity: "Minor", description: "鞍座处残留约5mm薄冰，无脱落风险", resolved: true },
        { category: "螺栓松动", severity: "Moderate", description: "顶部交叉臂3颗螺栓扭矩不足", resolved: true },
      ],
      ice_observation: { ice_present: true, thickness_mm: 6, ice_type: "晶凇" },
      structural_checks: { foundation: "Excellent", base_section: "Good", middle_section: "Good", top_section: "Good", cross_arms: "Good", cable_attachments: "Excellent", bolts_and_fasteners: "Good" },
      maintenance_actions: [{ action_type: "除冰作业", duration_minutes: 95, completed: true }],
      photos: [], weather_conditions: "晴转多云，-3~-1℃，微风",
      notes: "整体状况良好，覆冰已自然脱落大部分，建议关注后续天气",
      follow_up_required: false, signed_off: true,
      signed_off_by: U(), signed_off_at: new Date(now - 1 * 86400000).toISOString(),
    },
    {
      id: U(), tower_id: U(), tower_code: "TWR-0006 · B1号塔", inspection_type: "EmergencyInspection",
      inspector_name: "李明辉", inspector_id: U(),
      planned_date: new Date(now - 6 * 3600000).toISOString(),
      started_at: new Date(now - 5 * 3600000).toISOString(),
      completed_at: null, status: "InProgress",
      overall_condition: "Poor",
      findings: [
        { category: "覆冰超标", severity: "SafetyCritical", description: "鞍座覆冰38mm，远超设计值25mm", resolved: false },
        { category: "结构异响", severity: "Major", description: "强风下主柱中上部出现异常金属声", resolved: false },
        { category: "传感器故障", severity: "Moderate", description: "1#应变片读数异常，疑似接线冻松", resolved: false },
      ],
      structural_checks: { foundation: "Good", base_section: "Fair", middle_section: "Poor", top_section: "Poor", cross_arms: "Poor", cable_attachments: "Fair", bolts_and_fasteners: "Fair" },
      weather_conditions: "暴风雪，-9℃，阵风9~11级",
      notes: "紧急检查中，建议B区段维持停运状态等待进一步检查",
      follow_up_required: true, signed_off: false,
    },
    {
      id: U(), tower_id: U(), tower_code: "TWR-0001 · A1号塔", inspection_type: "Routine",
      inspector_name: "王晓峰", inspector_id: U(),
      planned_date: new Date(now - 7 * 86400000).toISOString(),
      started_at: new Date(now - 7 * 86400000 + 2 * 3600000).toISOString(),
      completed_at: new Date(now - 7 * 86400000 + 5 * 3600000).toISOString(),
      status: "Completed",
      overall_condition: "Excellent",
      findings: [{ category: "防腐涂层", severity: "Cosmetic", description: "基础段小面积涂层划伤约30cm长", resolved: true }],
      structural_checks: { foundation: "Excellent", base_section: "Excellent", middle_section: "Excellent", top_section: "Good", cross_arms: "Excellent", cable_attachments: "Excellent", bolts_and_fasteners: "Excellent" },
      weather_conditions: "晴朗，气温5℃，轻风",
      notes: "整塔状态优秀，为线路标杆塔",
      follow_up_required: false, signed_off: true,
    },
    {
      id: U(), tower_id: U(), tower_code: "TWR-0007 · B2号塔", inspection_type: "ScheduledMaintenance",
      inspector_name: "赵红梅", inspector_id: U(),
      planned_date: new Date(now - 15 * 86400000).toISOString(),
      started_at: new Date(now - 15 * 86400000 + 1.5 * 3600000).toISOString(),
      completed_at: new Date(now - 15 * 86400000 + 6 * 3600000).toISOString(),
      status: "Completed",
      overall_condition: "Good",
      findings: [],
      structural_checks: { foundation: "Good", base_section: "Good", middle_section: "Good", top_section: "Good", cross_arms: "Good", cable_attachments: "Good", bolts_and_fasteners: "Excellent" },
      weather_conditions: "多云，3~8℃，微风",
      notes: "季度保养完成，8颗传感器重新标定，线缆润滑完成",
      follow_up_required: false, signed_off: true,
    },
  ];
}

function sampleUpcoming() {
  return [
    { month: "DEC", day: "24", title: "A4号塔 季度常规巡检", tower: "TWR-0004", inspector: "王晓峰", type: "Routine" },
    { month: "DEC", day: "26", title: "A1-A5 全线覆冰后检查", tower: "全线5塔", inspector: "张建国带队", type: "PostIcing" },
    { month: "DEC", day: "28", title: "B3号塔 传感器标定", tower: "TWR-0008", inspector: "外聘陈工", type: "ScheduledMaintenance" },
    { month: "JAN", day: "03", title: "元旦前 全线安全大检查", tower: "全线8塔", inspector: "全团队", type: "Annual" },
    { month: "JAN", day: "10", title: "B2号塔 结构超声探伤", tower: "TWR-0007", inspector: "第三方机构", type: "ScheduledMaintenance" },
  ];
}

export const head: DocumentHead = { title: "巡检归档 · 索道塔架监测平台" };
