import type { Role } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  pimpinan: "Pejabat Penyetuju",
  petugas: "Petugas Aset",
  teknisi: "Teknisi",
  auditor: "Auditor",
};

export const ROLE_DESC: Record<Role, string> = {
  admin: "Akses penuh, termasuk pengguna dan master data",
  pimpinan: "Menyetujui mutasi, peminjaman, dan penghapusan; melihat semua laporan",
  petugas: "Mendaftarkan dan mengelola aset, mutasi, inventarisasi, dan stok",
  teknisi: "Mengerjakan work order, mencatat jam terbang, dan memakai suku cadang",
  auditor: "Akses baca seluruh data, jejak audit, dan reviu penghapusan",
};

/** Every gated action in the app. Pages check these with `can()`. */
export type Permission =
  | "asset.create"
  | "asset.edit"
  | "asset.delete"
  | "wo.create"
  | "wo.work" // update checklist, status, hours
  | "wo.assign"
  | "flight.log"
  | "airworthiness.edit"
  | "part.manage" // add/edit parts, receive stock
  | "part.use"
  | "transfer.create"
  | "transfer.handover" // BAST & return
  | "stocktake.manage"
  | "stocktake.count"
  | "disposal.create"
  | "report.view"
  | "audit.view"
  | "user.manage"
  | "master.manage"
  | "demo.reset";

const MATRIX: Record<Permission, Role[]> = {
  "asset.create": ["admin", "petugas"],
  "asset.edit": ["admin", "petugas"],
  "asset.delete": ["admin"],
  "wo.create": ["admin", "petugas", "teknisi", "pimpinan"],
  "wo.work": ["admin", "teknisi"],
  "wo.assign": ["admin", "petugas", "pimpinan"],
  "flight.log": ["admin", "teknisi", "petugas"],
  "airworthiness.edit": ["admin", "teknisi"],
  "part.manage": ["admin", "petugas"],
  "part.use": ["admin", "teknisi"],
  "transfer.create": ["admin", "petugas"],
  "transfer.handover": ["admin", "petugas"],
  "stocktake.manage": ["admin", "petugas"],
  "stocktake.count": ["admin", "petugas", "auditor"],
  "disposal.create": ["admin", "petugas"],
  "report.view": ["admin", "pimpinan", "petugas", "auditor", "teknisi"],
  "audit.view": ["admin", "auditor", "pimpinan"],
  "user.manage": ["admin"],
  "master.manage": ["admin"],
  "demo.reset": ["admin", "pimpinan", "petugas", "teknisi", "auditor"],
};

export function can(role: Role | undefined | null, perm: Permission) {
  return !!role && MATRIX[perm].includes(role);
}

/** Approval steps are acted on by the role named in the step (admin may act on any step). */
export function canApproveStep(role: Role | undefined | null, stepRole: Role) {
  return !!role && (role === stepRole || role === "admin");
}
