import { component$ } from "@builder.io/qwik";
import { DocumentHead } from "@builder.io/qwik-city";
import { HistoryCharts } from "~/components/HistoryCharts";
import type { AlertSeverity, WeatherAlertType, PrecipitationType } from "~/types";

const severityColor: Record<AlertSeverity, string> = {
  Minor: "bg-sky-500/20 border-sky-500/40 text-sky-300",
  Moderate: "bg-amber-500/20 border-amber-500/40 text-amber-300",
  Severe: "bg-orange-500/20 border-orange-500/40 text-orange-300",
  Extreme: "bg-rose-500/20 border-rose-500/40 text-rose-300",
};

const typeIcon: Record<WeatherAlertType | string, string> = {
  Blizzard: "🌨️",
  IceStorm: "🧊",
  HighWind: "💨",
  ExtremeCold: "🥶",
  HeavySnow: "❄️",
  FreezingRain: "🌧️➡️🧊",
  Thunderstorm: "⛈️",
  Tornado: "🌪️",
  DenseFog: "🌫️",
  Avalanche: "🏔️",
  GeneralWarning: "⚠️",
};

export default component$(() => {
  return <div>
    <h1 class="text-3xl font-bold text-slate-50 tracking-tight mb-1">
      气象影响分析 <span class="text-indigo-400">Weather Impact</span>
    </h1>
    <p class="text-slate-400 text-sm mb-6">
      精细化山地气象预报 · 气象事件与索道运行关联分析 · 影响范围与经济损失评估
    </p>
    <div class="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
      {[
        ["🌡️", "最低气温", "-11.3", "℃"],
        ["💨", "最大阵风", "28.6", "m/s"],
        ["❄️", "累计降雪", "26.5", "cm"],
        ["🧊", "最大覆冰", "41.2", "mm"],
        ["⏸️", "累计停运", "32.5", "小时"],
        ["💰", "经济影响", "¥38.6", "万"],
      ].map(([i, l, v, u]) => (
        <div key={l as string} class="stat-card bg-gradient-to-br from-indigo-500/10 to-slate-900/50 border-indigo-500/20">
          <div class="flex items-center gap-2 text-slate-400 text-xs mb-1"><span class="text-lg">{i}</span>{l}</div>
          <div class="flex items-baseline gap-1">
            <span class="text-3xl font-bold text-slate-100">{v}</span>
            <span class="text-xs text-slate-500">{u}</span>
          </div>
        </div>
      ))}
    </div>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12 xl:col-span-7 space-y-5">
        <div class="glass-panel p-5">
          <h2 class="section-title flex justify-between"><span><span>🔮</span> 未来48小时精细化预报</span>
            <span class="text-xs text-slate-400">中国气象局 · 山地气象中心</span>
          </h2>
          <div class="overflow-x-auto">
            <div class="grid grid-cols-[40px_repeat(48,minmax(56px,1fr))] min-w-[2800px] border border-slate-800 rounded-lg">
              {Array.from({ length: 49 }).map((_, col) => {
                const t = col; const h = (6 + t) % 24;
                return <>
                  {col === 0 && <>
                    <div class="p-2 border-r border-b border-slate-800 text-xs text-slate-500 flex items-end">时间</div>
                    <div class="p-2 border-r border-b border-slate-800 text-xs text-slate-500 flex items-center">气温</div>
                    <div class="p-2 border-r border-b border-slate-800 text-xs text-slate-500 flex items-center">风速</div>
                    <div class="p-2 border-r border-b border-slate-800 text-xs text-slate-500 flex items-center">天气</div>
                    <div class="p-2 border-r border-b border-slate-800 text-xs text-slate-500 flex items-center">降水</div>
                    <div class="p-2 border-b border-slate-800 text-xs text-slate-500 flex items-center">结冰概率</div>
                  </>}
                  {col > 0 && (() => {
                    const storm = col > 12 && col < 36 ? ((col > 24 ? 1 - (col - 24) / 12 : (col - 12) / 14) * 0.9) : 0;
                    const temp = -3 + Math.sin(col / 8) * 4 - storm * 6;
                    const wind = 4 + storm * 22 + Math.sin(col / 5) * 2;
                    const precip = storm > 0.2 ? "FreezingRain" : storm > 0.1 ? "Snow" : "None";
                    const precipMm = storm * 4.5;
                    const iceProb = Math.min(98, 10 + storm * 85);
                    return <>
                      <div class={`p-2 border-b text-center text-xs ${h === 12 ? "bg-slate-800/30 font-semibold text-slate-200" : "text-slate-400"}`}>
                        {h.toString().padStart(2, "0")}
                      </div>
                      <div class="p-2 border-b border-l border-slate-800/40 text-center">
                        <div class={`text-sm font-bold ${temp < -8 ? "text-rose-400" : temp < -3 ? "text-sky-400" : temp < 5 ? "text-blue-300" : "text-emerald-300"}`}>
                          {temp.toFixed(0)}°
                        </div>
                      </div>
                      <div class="p-2 border-b border-l border-slate-800/40 text-center">
                        <div class={`text-sm font-bold ${wind > 20 ? "text-rose-400" : wind > 12 ? "text-amber-400" : "text-sky-300"}`}>
                          {wind.toFixed(0)}
                        </div>
                        <div class="text-[9px] text-slate-500">m/s</div>
                      </div>
                      <div class="p-2 border-b border-l border-slate-800/40 text-center text-lg">
                        {precip === "FreezingRain" ? "🧊" : precip === "Snow" ? "❄️" : "☀️"}
                      </div>
                      <div class="p-2 border-b border-l border-slate-800/40 text-center">
                        <div class="flex flex-col items-center gap-0.5">
                          <div class="w-1.5 h-4 rounded-sm bg-slate-800 overflow-hidden">
                            <div class={`w-full bg-${precipMm > 3 ? "rose" : precipMm > 1 ? "amber" : "sky"}-400`}
                              style={{ height: `${Math.min(100, precipMm * 20)}%` }} />
                          </div>
                          <div class="text-[9px] text-slate-500">{precipMm.toFixed(1)}mm</div>
                        </div>
                      </div>
                      <div class="p-2 border-b border-l border-slate-800/40 text-center">
                        <div class={`text-sm font-bold ${iceProb > 80 ? "text-rose-400" : iceProb > 50 ? "text-amber-400" : iceProb > 25 ? "text-sky-400" : "text-emerald-400"}`}>
                          {iceProb.toFixed(0)}%
                        </div>
                      </div>
                    </>;
                  })()}
                </>;
              })}
            </div>
          </div>
        </div>
        <div class="glass-panel p-5">
          <h2 class="section-title"><span>📈</span> 关键气象参数与停运时长趋势（过去30天）</h2>
          <div class="h-72"><HistoryCharts mode="risk" /></div>
        </div>
        <div class="glass-panel p-5">
          <h2 class="section-title"><span>🗂️</span> 本次天气过程影响报告</h2>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div class="text-slate-500 text-xs mb-1">事件摘要</div>
              <div class="text-slate-200 leading-relaxed">
                2026年12月19日20时至21日06时，索道沿线出现<span class="text-rose-300">冻雨转暴雪</span>天气过程，
                过程降温12~15℃，过程降雪量25~30cm，塔架最大覆冰厚度41.2mm，实测最大阵风28.6m/s（11级）。
              </div>
            </div>
            <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div class="text-slate-500 text-xs mb-1">运行处置</div>
              <ul class="space-y-1 text-slate-200 list-disc pl-5 leading-relaxed">
                <li>20日03时07分自动触发A区段紧急停运</li>
                <li>20日11时32分 全线段临时紧急停运</li>
                <li>组织应急疏散旅客286人次</li>
                <li>协调地面转运车辆11台次</li>
                <li>21日15时 分段恢复运营</li>
              </ul>
            </div>
            <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div class="text-slate-500 text-xs mb-1">主要影响</div>
              <div class="space-y-1.5">
                {[
                  ["累计停运时长", "32小时30分", "text-amber-300"],
                  ["影响旅客人数", "约1,850人次", "text-amber-300"],
                  ["门票退改签", "¥18.6万元", "text-rose-300"],
                  ["运营收入减少", "约¥20万元", "text-rose-300"],
                ].map(([k, v, c]) => (
                  <div key={k as string} class="flex justify-between items-center border-b border-slate-800/50 pb-1">
                    <span class="text-slate-400 text-xs">{k as string}</span>
                    <span class={`font-semibold ${c as string}`}>{v as string}</span>
                  </div>
                ))}
              </div>
            </div>
            <div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div class="text-emerald-300 text-xs font-semibold mb-1">复盘改进建议</div>
              <ul class="list-disc pl-5 text-emerald-100/90 space-y-1 text-xs leading-relaxed">
                <li>完善冻雨-暴雪极端天气下的<u>预停运机制</u>，提前疏散而非紧急疏散</li>
                <li>在A3-A4区段增加1台风廓线雷达，加强风场监测精度</li>
                <li>除冰物资储备增加30%，并预先部署在A2、B2站</li>
                <li>建立与气象部门<u>逐小时滚动会商</u>机制</li>
                <li>更新地面接驳车辆协议，将响应时间缩短至30分钟内</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div class="col-span-12 xl:col-span-5 space-y-5">
        <div class="glass-panel p-5">
          <h2 class="section-title"><span>🚨</span> 气象预警信号</h2>
          <div class="space-y-3">
            {[
              ["IceStorm", "Severe", "冻雨及道路结冰橙色预警", "预计未来18小时内，索道沿线冻雨转暴雪，塔架覆冰可能达35~50mm", "主索道A1-A5/B1-B3段，海拔2300m以上", 36],
              ["HighWind", "Moderate", "大风黄色预警", "沿索道线偏北风6-8级，阵风可达9级以上", "索道全线，垭口高海拔区段", 12],
              ["ExtremeCold", "Severe", "寒潮蓝色预警", "48小时降温幅度12~15℃，最低气温降至-15℃左右", "全线山地高海拔地区", 48],
            ].map(([t, s, h, d, a, hours], i) => (
              <div key={i} class={`p-4 rounded-xl border ${severityColor[s as AlertSeverity]} relative overflow-hidden`}>
                <div class="absolute -right-4 -top-4 text-8xl opacity-10">{typeIcon[t as WeatherAlertType]}</div>
                <div class="relative">
                  <div class="flex items-center gap-2 mb-2 flex-wrap">
                    <span class="text-2xl">{typeIcon[t as WeatherAlertType]}</span>
                    <span class={`badge ${severityColor[s as AlertSeverity]}`}>
                      {s === "Extreme" ? "红色" : s === "Severe" ? "橙色" : s === "Moderate" ? "黄色" : "蓝色"}预警
                    </span>
                    <span class="badge bg-slate-900/60 text-slate-300 text-[10px]">有效期 {hours as number}h</span>
                  </div>
                  <div class="font-bold text-slate-100 mb-1.5">{h as string}</div>
                  <p class="text-xs text-slate-200/80 leading-relaxed mb-2">{d as string}</p>
                  <p class="text-[11px] text-slate-400">📍 {a as string}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div class="glass-panel p-5">
          <h2 class="section-title"><span>🌦️</span> 降水类型判别</h2>
          <div class="grid grid-cols-4 gap-2 mb-4 text-center text-xs">
            {[
              ["☔", "降雨", 0],
              ["🌨️", "降雪", 36],
              ["🧊", "冻雨", 94],
              ["❄️", "混合", 48],
            ].map(([i, l, pct], j) => (
              <div key={j} class="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                <div class="text-2xl mb-0.5">{i}</div>
                <div class="text-slate-400 mb-1">{l as string}</div>
                <div class={`text-lg font-bold ${(pct as number) > 70 ? "text-rose-400" : (pct as number) > 40 ? "text-amber-400" : "text-slate-500"}`}>
                  {pct as number}%
                </div>
              </div>
            ))}
          </div>
          <div class="text-xs text-slate-400 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 leading-relaxed">
            💡 基于当前温度 -7.2℃、湿度 93%、气压 758hPa 的温湿廓线推算：
            <u className="text-indigo-200">未来12小时冻雨概率维持高位</u>，
            覆冰将持续增长约 4~6mm/h，至 21日08时 前后达到峰值约 43~47mm。
          </div>
        </div>
        <div class="glass-panel p-5">
          <h2 class="section-title"><span>🏔️</span> 垂直气候带分析</h2>
          <div class="h-56 relative">
            <svg class="w-full h-full" viewBox="0 0 400 220">
              {[1800, 2000, 2200, 2400, 2600, 2800, 3000].map((alt, i) => (
                <g key={alt}>
                  <line x1="40" y1={200 - i * 30} x2="390" y2={200 - i * 30} stroke="rgba(148,163,184,0.12)" />
                  <text x="30" y={204 - i * 30} fill="rgba(148,163,184,0.7)" fontSize="10" text-anchor="end">{alt}m</text>
                </g>
              ))}
              <path d="M 40 200 L 100 175 L 150 155 L 210 95 L 270 65 L 330 80 L 390 110"
                fill="none" stroke="#64748b" stroke-width="3" />
              <path d="M 40 200 L 100 175 L 150 155 L 210 95 L 270 65 L 330 80 L 390 110 L 390 200 Z"
                fill="url(#mtn)" opacity="0.6" />
              <defs>
                <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#475569" />
                  <stop offset="100%" stop-color="#0f172a" />
                </linearGradient>
              </defs>
              {[
                [80, 182, "🌡️-2℃", 0],
                [160, 148, "🌡️-5℃", 0],
                [240, 88, "🧊冰厚 28mm", 1],
                [310, 73, "🧊冰厚 41mm", 2],
              ].map(([x, y, l, idx], i) => (
                <g key={i} transform={`translate(${x as number}, ${y as number})`}>
                  <rect x="-2" y="-10" width="2" height="10" fill={(idx as number) > 0 ? "#fb7185" : "#64748b"} />
                  <circle cx="-2" cy="-10" r="3" fill={(idx as number) > 0 ? "#fb7185" : "#22d3ee"} />
                  <text x="6" y="-8" fill={(idx as number) > 0 ? "#fecdd3" : "#a5f3fc"} fontSize="10">{l as string}</text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>;
});

export const head: DocumentHead = { title: "气象分析 · 索道塔架监测平台" };
