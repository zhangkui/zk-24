import { component$, useSignal } from "@builder.io/qwik";
import { DocumentHead } from "@builder.io/qwik-city";
import type { VerificationPriority, VerificationStatus } from "~/types";
import { formatRelativeTime } from "~/utils/format";

const priorityMap: Record<VerificationPriority, { c: string; l: string }> = {
  Routine: { c: "bg-slate-500/15 text-slate-300 border-slate-500/30", l: "常规" },
  Normal: { c: "bg-sky-500/15 text-sky-300 border-sky-500/30", l: "普通" },
  High: { c: "bg-amber-500/15 text-amber-300 border-amber-500/30", l: "高优" },
  Urgent: { c: "bg-orange-500/15 text-orange-300 border-orange-500/30", l: "紧急" },
  Emergency: { c: "bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse", l: "应急" },
};

const statusMap: Record<VerificationStatus, { c: string; l: string }> = {
  Pending: { c: "bg-amber-500/15 text-amber-300 border-amber-500/30", l: "待处理" },
  InProgress: { c: "bg-sky-500/15 text-sky-300 border-sky-500/30", l: "进行中" },
  Completed: { c: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", l: "已完成" },
  Cancelled: { c: "bg-slate-500/15 text-slate-300 border-slate-500/30", l: "已取消" },
  TimedOut: { c: "bg-rose-500/15 text-rose-300 border-rose-500/30", l: "超时" },
};

export default component$(() => {
  const view = useSignal<"grid" | "list">("grid");
  const cams = sampleCameras();
  const tasks = sampleTasks();
  return <div>
    <h1 class="text-3xl font-bold text-slate-50 tracking-tight mb-1">
      视频联动复核 <span class="text-sky-400">Video Center</span>
    </h1>
    <p class="text-slate-400 text-sm mb-6">多路视频实时浏览 · 风险告警触发抓拍 · 人工复核流程 · PTZ 相机控制</p>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {[
        ["📹", "监控摄像头", 12, "在线"],
        ["🎬", "实时观看中", 6, "画面"],
        ["📋", "待复核", tasks.filter(t => t.status === "Pending" || t.status === "InProgress").length, "任务"],
        ["⚠️", "高优任务", tasks.filter(t => t.priority === "High" || t.priority === "Urgent" || t.priority === "Emergency").length, "个"],
        ["📸", "24h 抓拍", 186, "张"],
      ].map(([i, l, v, u]) => (
        <div key={l as string} class="stat-card">
          <div class="flex items-center gap-2 text-slate-400 text-xs mb-1"><span class="text-lg">{i}</span>{l}</div>
          <div class="flex items-baseline gap-1"><span class="text-3xl font-bold text-slate-100">{v}</span><span class="text-xs text-slate-500">{u}</span></div>
        </div>
      ))}
    </div>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12 xl:col-span-8 space-y-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-title mb-0"><span>🎥</span> 监控墙</h2>
          <div class="flex gap-2">
            <button onClick$={() => (view.value = "grid")}
              class={["btn !py-1 !text-xs", view.value === "grid" ? "btn-primary" : "btn-ghost"]}>网格视图</button>
            <button onClick$={() => (view.value = "list")}
              class={["btn !py-1 !text-xs", view.value === "list" ? "btn-primary" : "btn-ghost"]}>列表视图</button>
          </div>
        </div>
        <div class={["grid gap-3", view.value === "grid" ? "grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4" : "grid-cols-1"]}>
          {cams.map(cam => <div key={cam.id} class="glass-panel p-3">
            <div class="aspect-video rounded-lg bg-black border border-slate-800 overflow-hidden relative">
              <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.1),transparent_70%)] flex items-center justify-center">
                <div class="text-slate-700 text-xs">
                  <div class="text-4xl text-center mb-1 opacity-40">🎥</div>
                  <div>RTSP: {cam.rtsp_url.slice(0, 28)}…</div>
                </div>
              </div>
              <div class="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-red-600/90">
                <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </div>
              <div class="absolute top-2 right-2 flex gap-1">
                {cam.location === "Top" && <span class="badge !py-0 bg-slate-900/80 !text-[10px]">📍塔顶</span>}
                {cam.location === "CableSaddle" && <span class="badge !py-0 bg-slate-900/80 !text-[10px]">📍鞍座</span>}
                {cam.location === "Middle" && <span class="badge !py-0 bg-slate-900/80 !text-[10px]">📍中部</span>}
              </div>
              <div class="absolute bottom-2 left-2 right-2 flex justify-between items-end text-[10px]">
                <div class="px-2 py-0.5 rounded bg-slate-900/80 text-slate-300">{cam.name}</div>
                <div class="px-2 py-0.5 rounded bg-slate-900/80 text-emerald-300 flex items-center gap-1">
                  <span class="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> 4K · 25fps
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between mt-2.5">
              <div class="text-xs">
                <div class="font-semibold text-slate-200">{cam.name}</div>
                <div class="text-slate-500">{cam.model} · {cam.resolution}</div>
              </div>
              <div class="flex gap-1">
                <button class="btn btn-ghost !px-2 !py-1 !text-xs" title="全屏">⛶</button>
                {cam.ptz_capable && <button class="btn btn-ghost !px-2 !py-1 !text-xs" title="云台">🎮</button>}
                <button class="btn btn-ghost !px-2 !py-1 !text-xs" title="抓拍">📸</button>
              </div>
            </div>
          </div>)}
        </div>
      </div>
      <div class="col-span-12 xl:col-span-4 space-y-5">
        <div class="glass-panel p-5">
          <h2 class="section-title flex justify-between">
            <span><span>📋</span> 复核任务队列</span>
            <button class="btn btn-primary !py-1 !text-xs">+ 新建任务</button>
          </h2>
          <div class="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {tasks.map(t => (
              <div key={t.id} class="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class={["badge", priorityMap[t.priority].c]}>{priorityMap[t.priority].l}</span>
                    <span class={["badge", statusMap[t.status].c]}>{statusMap[t.status].l}</span>
                  </div>
                  <span class="text-[10px] text-slate-500">{formatRelativeTime(t.created_at)}</span>
                </div>
                <p class="text-sm text-slate-300 mb-2">{t.reason}</p>
                <div class="flex items-center justify-between">
                  <div class="flex gap-1.5 text-[10px]">
                    {t.cam_names.slice(0, 3).map(n => <span key={n} class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">📹 {n}</span>)}
                    {t.cam_names.length > 3 && <span class="text-slate-500">+{t.cam_names.length - 3}</span>}
                  </div>
                  <button class="btn btn-primary !py-1 !text-xs">处理 →</button>
                </div>
                {t.verdict && (
                  <div class={`mt-2 text-xs p-1.5 rounded ${t.verdict === "Confirmed" ? "bg-rose-500/15 text-rose-300" :
                    t.verdict === "FalseAlarm" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/30 text-slate-300"}`}>
                    复核结论: {t.verdict === "Confirmed" ? "⚠️ 确认真实告警" : t.verdict === "FalseAlarm" ? "✅ 虚警排除" : "❓ 无法判定"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div class="glass-panel p-5">
          <h2 class="section-title"><span>🤖</span> AI 视觉识别</h2>
          <div class="grid grid-cols-2 gap-3 text-sm">
            {[
              ["🧊", "覆冰检测", 96.2, "Ice-YOLOv8x", "emerald"],
              ["❄️", "积雪检测", 94.8, "Custom-DETR", "sky"],
              ["📐", "结构位移", 92.4, "ViT-Large", "violet"],
              ["⚠️", "异物识别", 90.1, "YOLOv8s", "amber"],
            ].map(([i, n, v, m, c]) => (
              <div key={n as string} class="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <div class="flex items-center gap-1.5 text-slate-200 text-xs mb-1"><span>{i}</span>{n}</div>
                <div class={`text-2xl font-black text-${c}-400`}>{v}<span class="text-xs font-normal opacity-70">%</span></div>
                <div class="text-[10px] text-slate-500 mt-1 font-mono">{m}</div>
              </div>
            ))}
          </div>
          <div class="mt-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-200">
            💡 共分析 <b>3,428 张</b> 抓拍图像，自动识别覆冰事件 <b>17 次</b>，经人工复核准确率 <b>94.1%</b>
          </div>
        </div>
      </div>
    </div>
  </div>;
});

function sampleCameras() {
  const U = () => (crypto as any)?.randomUUID?.() || String(Math.random());
  const def: any[] = [];
  const names = ["A1塔顶全景", "A1鞍座特写", "A2塔顶全景", "A2跨中", "A3塔顶全景", "A3鞍座特写", "A4塔顶全景", "B1塔顶全景", "B2塔顶全景", "B2鞍座特写", "B3塔顶全景", "B3入口"];
  const locs: any[] = ["Top", "CableSaddle", "Top", "Middle", "Top", "CableSaddle", "Top", "Top", "Top", "CableSaddle", "Top", "Base"];
  names.forEach((n, i) => def.push({
    id: U(), tower_id: U(), name: n, model: i % 2 ? "Hikvision DS-2DF8C8" : "Dahua IPC-HFW5849",
    rtsp_url: `rtsp://192.168.1.${100 + i}:554/stream`, location: locs[i],
    fov_degrees: i % 2 ? 95 : 45, resolution: i % 2 ? "3840x2160" : "2560x1440",
    night_vision: true, ptz_capable: i % 2 === 0, online: true, stream_active: true,
  }));
  return def;
}
function sampleTasks() {
  const U = () => (crypto as any)?.randomUUID?.() || String(Math.random());
  const now = Date.now();
  return [
    { id: U(), priority: "Emergency", status: "InProgress", reason: "A3塔极端风险：覆冰32.8mm+阵风28.6m/s，需要紧急人工确认", created_at: new Date(now - 4 * 60000).toISOString(), cam_names: ["A3塔顶全景", "A3鞍座特写"], verdict: null as any },
    { id: U(), priority: "High", status: "Pending", reason: "A2塔覆冰快速增长，6.8mm/h，疑似冻雨过程", created_at: new Date(now - 15 * 60000).toISOString(), cam_names: ["A2塔顶全景", "A2跨中"], verdict: null as any },
    { id: U(), priority: "High", status: "Completed", reason: "B1塔组合风险评分86.5触发极端阈值", created_at: new Date(now - 95 * 60000).toISOString(), cam_names: ["B1塔顶全景"], verdict: "Confirmed" as any },
    { id: U(), priority: "Normal", status: "Completed", reason: "12.3Hz振动异常频率检测，疑似共振", created_at: new Date(now - 180 * 60000).toISOString(), cam_names: ["A2塔顶全景"], verdict: "FalseAlarm" as any },
    { id: U(), priority: "Routine", status: "Completed", reason: "巡检排班定时复核", created_at: new Date(now - 360 * 60000).toISOString(), cam_names: ["A1塔顶全景", "B3入口"], verdict: "PartiallyConfirmed" as any },
  ];
}

export const head: DocumentHead = { title: "视频复核 · 索道塔架监测平台" };
