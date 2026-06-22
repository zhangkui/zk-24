import { component$ } from "@builder.io/qwik";
import type { TowerPoint } from "~/types";

export const Tower3DModel = component$<{ tower: TowerPoint }>(({ tower }) => {
  const H = tower.height;
  const scale = 460 / H;
  const topW = 34;
  const baseW = 86;
  const h = H * scale;
  return (
    <div class="w-full h-full flex items-center justify-center relative">
      <div class="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_25%_85%,rgba(251,113,133,0.15),transparent_55%)]" />
      <svg width="560" height="560" viewBox="-280 -20 560 580">
        <defs>
          <linearGradient id="tg" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#334155" stop-opacity="0.85" />
            <stop offset="70%" stop-color="#64748b" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#94a3b8" stop-opacity="1" />
          </linearGradient>
          <linearGradient id="ic" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.6" />
            <stop offset="100%" stop-color="#7dd3fc" stop-opacity="0.95" />
          </linearGradient>
          <radialGradient id="ih" cx="50%" cy="0%" r="100%">
            <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.75" />
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.35" />
          </radialGradient>
        </defs>
        <ellipse cx="0" cy={h - 2} rx="130" ry="9" fill="#020617" opacity="0.6" />
        <rect x="-78" y={h - 4} width="156" height="8" fill="#334155" rx="1" />
        <rect x="-68" y={h - 12} width="136" height="14" fill="#475569" rx="2" />
        <g transform="skewX(-12)">
          {[-1, 1].map((s) => (
            <g key={s}>
              <line x1={s * (baseW / 2)} y1={h - 10} x2={s * (topW / 2) + 4.8} y2={18} stroke="url(#tg)" stroke-width="5" />
            </g>
          ))}
          {Array.from({ length: 10 }).map((_, i) => {
            const y0 = h - 30 - i * (h - 50) / 10;
            const y1 = y0 - (h - 50) / 10;
            const w0 = baseW / 2 - (i / 10) * (baseW / 2 - topW / 2);
            const w1 = baseW / 2 - ((i + 1) / 10) * (baseW / 2 - topW / 2);
            return (
              <g key={i} opacity="0.85">
                <line x1={-w0} y1={y0} x2={w0} y2={y0} stroke="url(#tg)" stroke-width="2" />
                <line x1={-w1} y1={y1} x2={w1} y2={y1} stroke="url(#tg)" stroke-width="2" />
                <line x1={-w0} y1={y0} x2={w1} y2={y1} stroke="rgba(148,163,184,0.5)" stroke-width="1" />
                <line x1={w0} y1={y0} x2={-w1} y2={y1} stroke="rgba(148,163,184,0.5)" stroke-width="1" />
              </g>
            );
          })}
          <rect x={-topW - 18} y={12} width={topW * 2 + 36} height="10" fill="url(#tg)" rx="1.5" />
          <rect x={-topW - 22} y={-3} width={topW * 2 + 44} height="10" fill="url(#ih)" opacity="0.85" rx="4" />
          <rect x={-topW - 18} y={6} width={topW * 2 + 36} height="6" fill="url(#ic)" opacity="0.9" />
        </g>
        <path d={`M -232 22 Q 0 48 232 22`} fill="none" stroke="#475569" stroke-width="4" />
        <path d={`M -232 22 Q 0 48 232 22`} fill="none" stroke="url(#ic)" stroke-width="7" opacity="0.85" />
        <g transform="skewX(-12)">
          <circle cx={-topW - 12} cy={16} r="5" fill="#f59e0b" stroke="white" stroke-width="1" />
          <circle cx={topW + 12} cy={16} r="5" fill="#f59e0b" stroke="white" stroke-width="1" />
          <circle cx="0" cy={h * 0.3} r="4.5" fill="#22d3ee" stroke="white" stroke-width="1" />
          <circle cx="0" cy={h * 0.55} r="4.5" fill="#a78bfa" stroke="white" stroke-width="1" />
          <circle cx={topW / 2 + 14} cy={-4} r="6" fill="#60a5fa" stroke="white" stroke-width="1.5" />
        </g>
      </svg>
      <div class="absolute top-3 left-3 flex flex-col gap-1.5 text-[10px]">
        {[
          ["bg-rose-500", "高温区·重点监测"], ["bg-sky-400", "覆冰分布"],
          ["bg-amber-500", "冰厚传感器"], ["bg-cyan-400", "加速度计"], ["bg-violet-400", "应变计"],
        ].map(([c, t]) => (
          <div key={t} class="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/70 border border-slate-800">
            <span class={`w-2 h-2 rounded-full ${c}`} /><span class="text-slate-300">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
