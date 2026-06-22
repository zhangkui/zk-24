import type { RiskLevel, DecisionPriority, DecisionStatus, DecisionType } from "~/types";

export const riskColors: Record<RiskLevel, { bg: string; text: string; border: string; ring: string; glow: string }> = {
  Safe: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    border: "border-emerald-500/40",
    ring: "ring-emerald-500/50",
    glow: "text-emerald-400",
  },
  Low: {
    bg: "bg-lime-500/15",
    text: "text-lime-300",
    border: "border-lime-500/40",
    ring: "ring-lime-500/50",
    glow: "text-lime-400",
  },
  Medium: {
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    border: "border-amber-500/40",
    ring: "ring-amber-500/50",
    glow: "text-amber-400",
  },
  High: {
    bg: "bg-red-500/15",
    text: "text-red-300",
    border: "border-red-500/40",
    ring: "ring-red-500/50",
    glow: "text-red-400",
  },
  Extreme: {
    bg: "bg-rose-900/60",
    text: "text-rose-200",
    border: "border-rose-500/50",
    ring: "ring-rose-500/70",
    glow: "text-rose-300",
  },
};

export const riskLabels: Record<RiskLevel, string> = {
  Safe: "安全",
  Low: "低风险",
  Medium: "中风险",
  High: "高风险",
  Extreme: "极端风险",
};

export const riskScores: Record<RiskLevel, number> = {
  Safe: 0,
  Low: 1,
  Medium: 2,
  High: 3,
  Extreme: 4,
};

export function riskFromScore(s: number): RiskLevel {
  if (s >= 80) return "Extreme";
  if (s >= 60) return "High";
  if (s >= 35) return "Medium";
  if (s >= 15) return "Low";
  return "Safe";
}

export const priorityLabels: Record<DecisionPriority, string> = {
  Informational: "提示",
  Low: "低",
  Medium: "中",
  High: "高",
  Critical: "紧急",
};

export const priorityColors: Record<DecisionPriority, string> = {
  Informational: "badge bg-slate-600/30 text-slate-300 border border-slate-500/30",
  Low: "badge bg-lime-500/15 text-lime-300 border border-lime-500/30",
  Medium: "badge bg-amber-500/15 text-amber-300 border border-amber-500/30",
  High: "badge bg-orange-500/15 text-orange-300 border border-orange-500/30",
  Critical: "badge bg-rose-500/15 text-rose-300 border border-rose-500/30 animate-pulse",
};

export const statusLabels: Record<DecisionStatus, string> = {
  Draft: "草稿",
  PendingApproval: "待审批",
  Approved: "已批准",
  Rejected: "已拒绝",
  Executed: "已执行",
  Cancelled: "已取消",
  Expired: "已过期",
};

export const statusColors: Record<DecisionStatus, string> = {
  Draft: "badge bg-slate-600/30 text-slate-300",
  PendingApproval: "badge bg-amber-500/15 text-amber-300 border border-amber-500/30",
  Approved: "badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  Rejected: "badge bg-red-500/15 text-red-300 border border-red-500/30",
  Executed: "badge bg-blue-500/15 text-blue-300 border border-blue-500/30",
  Cancelled: "badge bg-slate-600/30 text-slate-400",
  Expired: "badge bg-slate-600/30 text-slate-400",
};

export const decisionTypeLabels: Record<DecisionType, string> = {
  Advisory: "建议",
  Recommended: "推荐",
  Mandatory: "强制",
  Emergency: "紧急",
};

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    const now = Date.now();
    const t = new Date(iso).getTime();
    const diff = Math.floor((now - t) / 1000);
    if (diff < 60) return `${diff}秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    return `${Math.floor(diff / 86400)}天前`;
  } catch {
    return iso;
  }
}

export function formatNumber(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return "-";
  return Number(n).toFixed(digits);
}

export function windDirectionLabel(deg: number | null | undefined): string {
  if (deg === null || deg === undefined) return "-";
  const dirs = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return `${dirs[idx]} ${deg.toFixed(0)}°`;
}

export function precipitationLabel(t: string): string {
  const map: Record<string, string> = {
    None: "无",
    Rain: "雨",
    Drizzle: "毛毛雨",
    Snow: "雪",
    Sleet: "雨夹雪",
    FreezingRain: "冻雨",
    Hail: "冰雹",
    Mixed: "混合",
  };
  return map[t] || t;
}

export function truncate(text: string, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}
