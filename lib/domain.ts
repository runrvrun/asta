// Shared lookups and business rules used across modules.
import type {
  ApprovalStep, Asset, AssetStatus, Airworthiness, Condition, DB, Disposal, Priority, Transfer, User, WOStatus,
} from "./types";
import { daysUntil } from "./format";

export type Tone = "normal" | "warning" | "critical" | "neutral" | "done";

// ---------- lookups ----------
export const byId = <T extends { id: string }>(list: T[], id?: string) => (id ? list.find((x) => x.id === id) : undefined);

export function userName(db: DB, id?: string) {
  const u = byId(db.users, id);
  return u ? `${u.rank} ${u.name}` : id === "system" ? "Sistem" : "-";
}
export function unitName(db: DB, id?: string) {
  return byId(db.units, id)?.name ?? "-";
}
export function locationName(db: DB, id?: string) {
  return byId(db.locations, id)?.name ?? "-";
}
export function categoryName(db: DB, id?: string) {
  return db.categories.find((c) => c.id === id)?.name ?? "-";
}
export function assetLabel(db: DB, id?: string) {
  const a = byId(db.assets, id);
  return a ? `${a.name} (${a.code})` : "-";
}

/** Next running number for a document series, e.g. nextNo(db.workOrders.map(w=>w.no), "WO-2026-11") → "WO-2026-11-0417". */
export function nextNo(existing: string[], prefix: string) {
  let max = 0;
  for (const no of existing) {
    if (!no.startsWith(prefix + "-")) continue;
    const n = parseInt(no.slice(prefix.length + 1), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export function nextAssetCode(db: DB, categoryId: string, year: number) {
  const cat = db.categories.find((c) => c.id === categoryId);
  return nextNo(db.assets.map((a) => a.code), `${cat?.codePrefix ?? "AST"}-${year}`);
}

/** Current month prefix, e.g. "2026-11". */
export function yearMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------- valuation (straight-line depreciation) ----------
export function depreciation(asset: Asset, at = new Date()) {
  const cost = asset.acquisitionValue;
  if (!asset.usefulLife) return { accumulated: 0, bookValue: cost, perYear: 0, ageYears: 0, pct: 0 };
  const start = new Date(asset.acquisitionDate + "T00:00:00");
  const ageYears = Math.max(0, (at.getTime() - start.getTime()) / (365.25 * 86400000));
  const perYear = (cost - asset.residualValue) / asset.usefulLife;
  const accumulated = Math.min(cost - asset.residualValue, perYear * ageYears);
  return { accumulated, bookValue: cost - accumulated, perYear, ageYears, pct: cost ? accumulated / cost : 0 };
}

// ---------- aviation ----------
export function inspectionStatus(asset: Asset) {
  const av = asset.aviation;
  if (!av) return null;
  const next = av.lastInspectionHours + av.inspectionIntervalHours;
  const remaining = next - av.flightHours;
  const certDays = daysUntil(av.certificateExpiry);
  let tone: Tone = "normal";
  if (remaining <= 0 || certDays < 0) tone = "critical";
  else if (remaining <= av.inspectionIntervalHours * 0.1 || certDays <= 30) tone = "warning";
  return { nextDueHours: next, remainingHours: remaining, certDays, tone };
}

// ---------- tones for badges ----------
export const ASSET_STATUS_TONE: Record<AssetStatus, Tone> = {
  Aktif: "normal",
  "Dalam Pemeliharaan": "warning",
  Dipinjam: "neutral",
  "Diusulkan Hapus": "critical",
  Dihapus: "done",
};
export const CONDITION_TONE: Record<Condition, Tone> = { Baik: "normal", "Rusak Ringan": "warning", "Rusak Berat": "critical" };
export const AIRWORTHINESS_TONE: Record<Airworthiness, Tone> = { Laik: "normal", "Laik Terbatas": "warning", "Tidak Laik": "critical" };
export const PRIORITY_TONE: Record<Priority, Tone> = { Rendah: "normal", Sedang: "warning", Tinggi: "critical", Kritis: "critical" };
export const WO_STATUS_LABEL: Record<WOStatus, string> = {
  baru: "Baru",
  dikerjakan: "Dikerjakan",
  menunggu_part: "Menunggu Part",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};
export const WO_STATUS_TONE: Record<WOStatus, Tone> = {
  baru: "neutral",
  dikerjakan: "normal",
  menunggu_part: "warning",
  selesai: "done",
  dibatalkan: "done",
};
export const APPROVAL_TONE: Record<string, Tone> = {
  diajukan: "warning",
  menunggu: "warning",
  disetujui: "normal",
  ditolak: "critical",
  diserahkan: "neutral",
  dikembalikan: "done",
  berjalan: "warning",
  selesai: "done",
};
export const STATUS_LABEL: Record<string, string> = {
  diajukan: "Diajukan",
  menunggu: "Menunggu",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  diserahkan: "Diserahkan",
  dikembalikan: "Dikembalikan",
  berjalan: "Berjalan",
  selesai: "Selesai",
};

// ---------- approvals ----------
/** The first step still waiting, if the request is still in progress. */
export function currentStep(steps: ApprovalStep[]) {
  if (steps.some((s) => s.status === "ditolak")) return undefined;
  return steps.find((s) => s.status === "menunggu");
}

/** Requests waiting on this user's role (used by dashboard, bell and the approval inbox). */
export function pendingApprovalsFor(db: DB, user: User | null) {
  if (!user) return { transfers: [] as Transfer[], disposals: [] as Disposal[] };
  const mine = (steps: ApprovalStep[]) => {
    const s = currentStep(steps);
    return !!s && (s.role === user.role || user.role === "admin");
  };
  return {
    transfers: db.transfers.filter((t) => t.status === "diajukan" && mine(t.approvals)),
    disposals: db.disposals.filter((d) => d.status === "diajukan" && mine(d.approvals)),
  };
}

export function lowStockParts(db: DB) {
  return db.spareParts.filter((p) => p.stock < p.minStock);
}
