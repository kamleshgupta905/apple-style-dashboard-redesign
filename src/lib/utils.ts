export const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const money = (v: unknown, decimals = 2) =>
  "$" + num(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const compact = (v: unknown) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(num(v));

export function formatDate(s?: string | number | null, withTime = true) {
  if (!s) return "—";
  const str = String(s);
  const d = new Date(str.includes(" ") ? str.replace(" ", "T") : str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function timeAgo(s?: string | number | null) {
  if (!s) return "—";
  const str = String(s);
  const d = new Date(str.includes(" ") ? str.replace(" ", "T") : str).getTime();
  if (isNaN(d)) return str;
  const diff = Math.max(0, Date.now() - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(s, false);
}

export function exportCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const initials = (name?: string) =>
  (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

export const mask = (s?: string) => (s ? "•".repeat(Math.min(14, s.length)) : "—");
