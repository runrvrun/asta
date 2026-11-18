const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function formatNumber(n: number, digits = 0) {
  return n.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** "Rp 1.234.567" */
export function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

/** Compact: "Rp 1,24 T", "Rp 420 M", "Rp 18,5 Jt" */
export function formatRupiahShort(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `Rp ${formatNumber(n / 1e12, 2)} T`;
  if (abs >= 1e9) return `Rp ${formatNumber(n / 1e9, abs >= 1e11 ? 0 : 1)} M`;
  if (abs >= 1e6) return `Rp ${formatNumber(n / 1e6, 1)} Jt`;
  return formatRupiah(n);
}

function toDate(v: string | Date) {
  return typeof v === "string" ? new Date(v.length === 10 ? v + "T00:00:00" : v) : v;
}

/** "18 Nov 2026" */
export function formatDate(v?: string | Date) {
  if (!v) return "-";
  const d = toDate(v);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "18 November 2026" */
export function formatDateLong(v?: string | Date) {
  if (!v) return "-";
  const d = toDate(v);
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "18 Nov 2026, 09:30" */
export function formatDateTime(v?: string | Date) {
  if (!v) return "-";
  const d = toDate(v);
  return `${formatDate(d)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function monthLabel(year: number, month: number) {
  return `${MONTHS[month]} ${String(year).slice(2)}`;
}

/** "5 menit lalu", "2 hari lalu" */
export function timeAgo(v: string) {
  const diff = Date.now() - toDate(v).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} hari lalu`;
  return formatDate(v);
}

/** Days from today to date (negative = past). */
export function daysUntil(date: string) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((toDate(date).getTime() - t.getTime()) / 86400000);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatBytes(n: number) {
  if (n >= 1e6) return `${formatNumber(n / 1e6, 1)} MB`;
  if (n >= 1e3) return `${formatNumber(n / 1e3, 0)} KB`;
  return `${n} B`;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
