// Helpers for the maintenance, airworthiness and spare-parts modules.
import type { Asset, DB, FlightLog, SparePart, StockMovement, WorkOrder } from "./types";
import type { Tone } from "./domain";
import { daysUntil } from "./format";
import { AVIATION_CATEGORIES } from "./seed";

export const WO_TYPES: WorkOrder["type"][] = ["Preventif", "Korektif", "Inspeksi Berkala", "Modifikasi"];
export const PRIORITIES: WorkOrder["priority"][] = ["Rendah", "Sedang", "Tinggi", "Kritis"];
export const OPEN_WO: WorkOrder["status"][] = ["baru", "dikerjakan", "menunggu_part"];

export const CHECKLIST_TEMPLATES: Record<WorkOrder["type"], string[]> = {
  Preventif: ["Pemeriksaan visual menyeluruh", "Penggantian oli & filter", "Pelumasan titik-titik kontrol", "Pemeriksaan ban & rem", "Uji fungsi akhir"],
  Korektif: ["Diagnosa kerusakan", "Lepas komponen yang rusak", "Pasang komponen pengganti", "Uji fungsi", "Verifikasi hasil perbaikan"],
  "Inspeksi Berkala": ["Pemeriksaan struktur & badan", "Borescope / pemeriksaan mesin", "Pemeriksaan sistem hidrolik", "Pemeriksaan avionik & kelistrikan", "Ground run", "Uji terbang / uji operasi"],
  Modifikasi: ["Persiapan dokumen modifikasi", "Pemasangan perangkat", "Integrasi kabel & sistem", "Uji darat", "Uji terbang / uji operasi"],
};

export const MISSIONS: FlightLog["mission"][] = ["Latihan", "Patroli", "Angkut", "SAR", "VIP", "Uji Terbang"];

export function isOverdue(wo: WorkOrder) {
  return OPEN_WO.includes(wo.status) && daysUntil(wo.dueDate) < 0;
}

export function aviationAssets(db: DB) {
  return db.assets.filter((a) => AVIATION_CATEGORIES.includes(a.categoryId) && a.aviation && a.status !== "Dihapus");
}

export function lastFlight(db: DB, assetId: string) {
  let last: FlightLog | undefined;
  for (const f of db.flightLogs) if (f.assetId === assetId && (!last || f.date > last.date)) last = f;
  return last;
}

export function movementDelta(m: StockMovement) {
  return m.type === "masuk" ? m.qty : m.type === "keluar" ? -m.qty : m.qty;
}

/** Asset goes back to "Aktif" when it no longer has an open WO (and was in maintenance). */
export function releaseAssetIfIdle(db: DB, asset: Asset | undefined, exceptWoId: string) {
  if (!asset || asset.status !== "Dalam Pemeliharaan") return;
  const open = db.workOrders.some((w) => w.id !== exceptWoId && w.assetId === asset.id && OPEN_WO.includes(w.status));
  if (!open) {
    asset.status = "Aktif";
    asset.updatedAt = new Date().toISOString();
  }
}

export function stockTone(p: SparePart): Tone {
  return p.stock === 0 ? "critical" : p.stock < p.minStock ? "warning" : "normal";
}
export function stockLabel(p: SparePart) {
  return p.stock === 0 ? "Habis" : p.stock < p.minStock ? "Di bawah minimum" : "Aman";
}
