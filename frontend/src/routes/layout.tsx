import { component$, Slot, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import type { RequestHandler } from "@builder.io/qwik-city";

export const onRequest: RequestHandler = async ({ next }) => {
  await next();
};

const navItems = [
  { path: "/", label: "总览大屏", icon: "📊" },
  { path: "/towers", label: "塔架管理", icon: "🗼" },
  { path: "/monitor", label: "实时监测", icon: "📈" },
  { path: "/risk", label: "风险识别", icon: "⚠️" },
  { path: "/decisions", label: "停运决策", icon: "🚦" },
  { path: "/video", label: "视频复核", icon: "📹" },
  { path: "/inspections", label: "巡检归档", icon: "📋" },
  { path: "/weather", label: "气象分析", icon: "🌨️" },
];

export default component$(() => {
  const loc = useLocation();
  const wsStatus = useSignal<"connecting" | "open" | "closed">("connecting");

  useVisibleTask$(async ({ cleanup }) => {
    const path = (globalThis as any).__ws_url || "/api/ws";
    let url = path;
    if (typeof window !== "undefined") {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      url = `${proto}//${window.location.host}/api/ws`;
    }
    try {
      const ws = new WebSocket(url);
      (globalThis as any).__app_ws = ws;
      ws.onopen = () => (wsStatus.value = "open");
      ws.onclose = () => (wsStatus.value = "closed");
      ws.onerror = () => (wsStatus.value = "closed");
      ws.onmessage = (ev: any) => {
        try {
          const msg = JSON.parse(ev.data);
          const listeners = (globalThis as any).__ws_listeners || [];
          listeners.forEach((l: any) => {
            try { l(msg); } catch {}
          });
        } catch {}
      };
      cleanup(() => ws.close());
    } catch (e) {
      wsStatus.value = "closed";
    }
  });

  return (
    <div class="min-h-screen grid-bg">
      <header class="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div class="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-xl shadow-lg shadow-primary-900/40">
              🗼
            </div>
            <div>
              <div class="text-lg font-bold text-slate-50 tracking-wide">
                山地索道塔架 <span class="text-primary-400 text-glow-blue">联动监测平台</span>
              </div>
              <div class="text-[11px] text-slate-500 tracking-wider">
                CABLEWAY TOWER VIBRATION & ICING MONITORING · EDGE v1.0
              </div>
            </div>
          </div>

          <nav class="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const active = loc.url.pathname === item.path || (item.path !== "/" && loc.url.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  class={[
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5",
                    active
                      ? "bg-primary-600/20 text-primary-300 border border-primary-500/30 shadow shadow-primary-900/20"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60",
                  ]}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div class="flex items-center gap-3">
            <div class="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/50">
              <span
                class={[
                  "w-2 h-2 rounded-full",
                  wsStatus.value === "open"
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"
                    : wsStatus.value === "connecting"
                      ? "bg-amber-400 animate-blink"
                      : "bg-red-500",
                ]}
              />
              <span class="text-xs text-slate-400">
                {wsStatus.value === "open" ? "实时流连接" : wsStatus.value === "connecting" ? "连接中…" : "连接中断"}
              </span>
            </div>
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/50">
              <div class="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center text-xs font-bold">
                调
              </div>
              <div class="hidden md:block leading-tight">
                <div class="text-xs font-medium text-slate-200">调度中心</div>
                <div class="text-[10px] text-slate-500">运维管理员</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="max-w-[1920px] mx-auto px-6 py-6">
        <Slot />
      </main>

      <footer class="mt-16 border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        © 2026 山地索道安全监测系统 · 景区边缘服务器部署 · 数据驻留本地，不上传云端
      </footer>
    </div>
  );
});
