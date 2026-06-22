import { component$ } from "@builder.io/qwik";

export const HistoryCharts = component$<{ mode?: "multi" | "ice" | "weather" | "risk" }>(({ mode = "multi" }) => {
  const color = (c: string) => c;
  return (
    <div class="w-full h-full relative">
      <svg class="w-full h-full" viewBox="0 0 800 340" preserveAspectRatio="none">
        {[42, 84, 126, 168, 210, 252, 294].map((y) => (
          <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="rgba(148,163,184,0.1)" />
        ))}
        {(mode === "multi" || mode === "ice") && Array.from({ length: 200 }).map((_, i) => {
          const x = (i / 199) * 800; const t = i / 199;
          const storm = t > 0.55 ? ((t - 0.55) / 0.45) : 0;
          const y1 = 300 - (t * 38 * (0.6 + storm * 0.6)) * 6;
          const y0 = 300 - ((((i - 1) / 199)) * 38 * (0.6 + ((((i - 1) / 199)) > 0.55 ? ((((i - 1) / 199) - 0.55) / 0.45) : 0) * 0.6)) * 6;
          return i === 0 ? null : (
            <line key={`i${i}`} x1={((i - 1) / 199) * 800} y1={Math.max(50, y0)} x2={x} y2={Math.max(50, y1)} stroke="#38bdf8" stroke-width="2" />
          );
        })}
        {(mode === "multi") && Array.from({ length: 200 }).map((_, i) => {
          const x = (i / 199) * 800; const t = i / 199;
          const storm = t > 0.6 ? ((t - 0.6) / 0.4) : 0;
          const y1 = 260 - (5 + storm * 22 + Math.sin(t * 25) * 3) * 7;
          return i === 0 ? null : (
            <line key={`w${i}`} x1={((i - 1) / 199) * 800} y1={260 - (5 + ((((i - 1) / 199) > 0.6 ? ((((i - 1) / 199) - 0.6) / 0.4) : 0)) * 22 + Math.sin(((i - 1) / 199) * 25) * 3) * 7} x2={x} y2={y1} stroke="#60a5fa" stroke-width="2" />
          );
        })}
        {(mode === "multi") && Array.from({ length: 200 }).map((_, i) => {
          const x = (i / 199) * 800; const t = i / 199;
          const storm = t > 0.62 ? ((t - 0.62) / 0.38) : 0;
          const y1 = 180 - (2.5 + storm * 28 + Math.sin(t * 40) * 1.5) * 3;
          return i === 0 ? null : (
            <line key={`v${i}`} x1={((i - 1) / 199) * 800} y1={180 - (2.5 + ((((i - 1) / 199) > 0.62 ? ((((i - 1) / 199) - 0.62) / 0.38) : 0)) * 28 + Math.sin(((i - 1) / 199) * 40) * 1.5) * 3} x2={x} y2={y1} stroke="#f59e0b" stroke-width="2" />
          );
        })}
        {(mode === "weather") && Array.from({ length: 200 }).map((_, i) => {
          const x = (i / 199) * 800; const t = i / 199;
          const y1 = 140 + Math.sin(t * 6.28 - 1.5) * 70 - t * 25;
          return i === 0 ? null : (
            <line key={`tw${i}`} x1={((i - 1) / 199) * 800} y1={140 + Math.sin((((i - 1) / 199) * 6.28) - 1.5) * 70 - ((i - 1) / 199) * 25} x2={x} y2={y1} stroke="#f87171" stroke-width="2" />
          );
        })}
        {(mode === "weather") && Array.from({ length: 200 }).map((_, i) => {
          const x = (i / 199) * 800; const t = i / 199;
          const y1 = 70 + Math.sin(t * 6.28 + 0.5) * 40 + t * 70;
          return i === 0 ? null : (
            <line key={`th${i}`} x1={((i - 1) / 199) * 800} y1={70 + Math.sin((((i - 1) / 199)) * 6.28 + 0.5) * 40 + ((i - 1) / 199) * 70} x2={x} y2={y1} stroke="#a3e635" stroke-width="2" />
          );
        })}
        {(mode === "risk") && Array.from({ length: 300 }).map((_, i) => {
          const x = (i / 299) * 800; const t = i / 299;
          const storm = (t > 0.35 && t < 0.5) ? (t > 0.425 ? 1 - (t - 0.425) / 0.075 : (t - 0.35) / 0.075) * 0.85 : 0;
          const storm2 = (t > 0.78 && t < 0.9) ? (t > 0.84 ? 1 - (t - 0.84) / 0.06 : (t - 0.78) / 0.06) * 0.7 : 0;
          const y = 250 - (8 + storm * 82 + storm2 * 68 + Math.sin(t * 30) * 8) * 2.2;
          return i === 0 ? null : (
            <line key={`rk${i}`} x1={((i - 1) / 299) * 800} y1={250 - (8 + ((((i - 1) / 299) > 0.35 && ((i - 1) / 299) < 0.5) ? (((i - 1) / 299) > 0.425 ? 1 - (((i - 1) / 299) - 0.425) / 0.075 : (((i - 1) / 299) - 0.35) / 0.075) * 0.85 : 0) * 82 + ((((i - 1) / 299) > 0.78 && ((i - 1) / 299) < 0.9) ? (((i - 1) / 299) > 0.84 ? 1 - (((i - 1) / 299) - 0.84) / 0.06 : (((i - 1) / 299) - 0.78) / 0.06) * 0.7 : 0) * 68 + Math.sin(((i - 1) / 299) * 30) * 8) * 2.2} x2={x} y2={Math.max(30, y)} stroke="#ef4444" stroke-width="2" />
          );
        })}
        {mode === "ice" && Array.from({ length: 48 }).map((_, i) => {
          const x = 50 + i * 15; const t = i / 48;
          const storm = t > 0.5 ? (t - 0.5) * 2 : 0;
          const h = Math.min(1, t * (0.6 + storm * 0.8)) * 220;
          return <rect key={`b${i}`} x={x} y={290 - h} width="10" height={h} fill={h > 180 ? "#fb7185" : h > 120 ? "#38bdf8" : "#7dd3fc"} rx="1.5" opacity="0.8" />;
        })}
      </svg>
      <div class="absolute bottom-1 left-0 right-0 flex justify-center gap-6 text-xs pt-1">
        {(mode === "multi") && <>
          <span><span class="text-blue-400 font-bold">●</span> 风速 m/s</span>
          <span><span class="text-sky-400 font-bold">●</span> 覆冰 mm</span>
          <span><span class="text-amber-400 font-bold">●</span> 振动 mm/s²</span>
        </>}
        {(mode === "ice") && <span><span class="text-sky-400 font-bold">■</span> 覆冰厚度分布</span>}
        {(mode === "weather") && <>
          <span><span class="text-red-400 font-bold">●</span> 温度 ℃</span>
          <span><span class="text-lime-400 font-bold">●</span> 湿度 %</span>
        </>}
        {(mode === "risk") && <span><span class="text-red-400 font-bold">●</span> 综合风险评分</span>}
      </div>
    </div>
  );
});
