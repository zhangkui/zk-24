import { component$ } from "@builder.io/qwik";

export const SpectrumAnalyzer = component$(() => (
  <div class="w-full h-full flex items-end justify-between gap-0.5 px-8 pb-8 relative">
    <div class="absolute bottom-0 left-8 right-8 h-px bg-slate-700" />
    {Array.from({ length: 64 }).map((_, i) => {
      const freqs = [1.23, 2.46, 3.69, 4.92, 6.15, 12.3, 24.6];
      const mags = [0.88, 0.42, 0.21, 0.11, 0.06, 0.35, 0.15];
      let h = Math.sin(i * 0.23) * 0.08 + 0.06;
      for (let j = 0; j < freqs.length; j++) {
        const dist = Math.abs(i - freqs[j] * 4);
        if (dist < 3) h = Math.max(h, mags[j] * (1 - dist / 3));
      }
      h = Math.max(0.015, h);
      const c = h > 0.35 ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]" :
        h > 0.18 ? "bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.5)]" :
          h > 0.08 ? "bg-primary-500" : "bg-slate-700";
      return <div key={i} class={`flex-1 rounded-t ${c} transition-all duration-300`} style={{ height: `${h * 100}%` }} />;
    })}
    <div class="absolute bottom-2 left-0 right-0 flex justify-between px-8 text-[10px] text-slate-500 font-mono">
      {[0, 5, 10, 15, 20, 25, 30].map((f) => <span key={f}>{f} Hz</span>)}
    </div>
  </div>
));
