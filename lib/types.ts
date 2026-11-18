// Domain types for Asta. All data lives in the browser (see lib/store.ts).
// Dates are ISO strings: "YYYY-MM-DD" for dates, full ISO for timestamps.

export type Role = "admin" | "pimpinan" | "petugas" | "teknisi" | "auditor";

export interface User {
  id: string;
  username: string;
  password: string; // demo only, stored in plain text
  name: string;
  rank: string; // pangkat, e.g. "Mayor Tek"
  nrp: string; // nomor registrasi pokok
  position: string; // jabatan
  role: Role;
  unitId: string;
  active: boolean;
  lastLogin?: string;
}

export type UnitType = "Komando" | "Pangkalan" | "Skadron" | "Depo" | "Satuan";

export interface Unit {
  id: string;
  code: string;
  name: string;
  type: UnitType;
  city: string;
  parentId?: string;
}

export interface Location {
  id: string;
  unitId: string;
  name: string; // e.g. "Hangar 2", "Gudang Logistik A"
  kind: "Hangar" | "Gudang" | "Apron" | "Kantor" | "Lahan" | "Garasi" | "Bengkel" | "Lainnya";
}

export type CategoryId =
  | "pesawat"
  | "helikopter"
  | "nirawak"
  | "kendaraan"
  | "gse"
  | "radar"
  | "persenjataan"
  | "elektronik"
  | "tanah"
  | "bangunan"
  | "komponen";

export interface Category {
  id: CategoryId;
  name: string;
  group: "Alutsista Udara" | "Peralatan" | "Kendaraan" | "Properti" | "Komponen";
  usefulLife: number; // years, default for depreciation (0 = not depreciated, e.g. land)
  codePrefix: string;
}

export type AssetStatus =
  | "Aktif"
  | "Dalam Pemeliharaan"
  | "Dipinjam"
  | "Diusulkan Hapus"
  | "Dihapus";

export type Condition = "Baik" | "Rusak Ringan" | "Rusak Berat";

export type Airworthiness = "Laik" | "Laik Terbatas" | "Tidak Laik";

/** Extra data for pesawat / helikopter / nirawak. */
export interface AviationInfo {
  airworthiness: Airworthiness;
  flightHours: number; // total airframe hours
  cycles: number; // landings
  inspectionIntervalHours: number; // e.g. 100h periodic inspection
  lastInspectionHours: number; // airframe hours at last periodic inspection
  lastInspectionDate: string;
  certificateNo: string; // sertifikat kelaikan
  certificateExpiry: string;
  engine: string;
}

export interface AssetDocument {
  id: string;
  name: string;
  size: number; // bytes
  uploadedAt: string;
  uploadedBy: string; // userId
}

export interface Asset {
  id: string;
  code: string; // e.g. "PSW-2019-0003"
  name: string;
  categoryId: CategoryId;
  brand: string;
  model: string;
  serialNumber: string;
  registration?: string; // tail number / nopol / no. sertifikat tanah
  year: number;
  acquisitionDate: string;
  acquisitionValue: number; // Rupiah
  fundingSource: "APBN" | "Hibah" | "PNBP" | "Kredit Ekspor" | "Lainnya";
  usefulLife: number; // years
  residualValue: number; // Rupiah
  unitId: string;
  locationId: string;
  picId: string; // userId penanggung jawab
  condition: Condition;
  status: AssetStatus;
  specs: Record<string, string>; // free-form per-category spec (luas, nopol, odometer, ...)
  aviation?: AviationInfo;
  documents: AssetDocument[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type WOStatus = "baru" | "dikerjakan" | "menunggu_part" | "selesai" | "dibatalkan";
export type Priority = "Rendah" | "Sedang" | "Tinggi" | "Kritis";

export interface WorkOrder {
  id: string;
  no: string; // "WO-2026-11-0012"
  assetId: string;
  type: "Preventif" | "Korektif" | "Inspeksi Berkala" | "Modifikasi";
  title: string;
  description: string;
  priority: Priority;
  status: WOStatus;
  assigneeId?: string; // teknisi
  createdBy: string;
  createdAt: string;
  dueDate: string;
  completedAt?: string;
  estHours: number;
  actualHours: number;
  checklist: { id: string; text: string; done: boolean }[];
  parts: { partId: string; qty: number }[]; // parts consumed (already deducted from stock)
  timeline: { at: string; text: string; by: string }[];
}

export interface SparePart {
  id: string;
  partNumber: string;
  name: string;
  category: "Mesin" | "Avionik" | "Hidrolik" | "Kelistrikan" | "Struktur" | "Roda & Rem" | "Consumable" | "Kendaraan";
  uom: string; // satuan: pcs, set, liter, ...
  stock: number;
  minStock: number;
  price: number;
  locationId: string;
  compatible: string; // free text, e.g. "Heli angkut sedang"
}

export interface StockMovement {
  id: string;
  partId: string;
  type: "masuk" | "keluar" | "penyesuaian";
  qty: number; // always positive; type decides the sign (penyesuaian: signed delta stored in qty)
  date: string;
  ref: string; // WO no / dokumen penerimaan / opname
  note?: string;
  by: string; // userId
}

export interface FlightLog {
  id: string;
  assetId: string;
  date: string;
  mission: "Latihan" | "Patroli" | "Angkut" | "SAR" | "VIP" | "Uji Terbang";
  hours: number;
  cycles: number;
  pilot: string;
  route: string;
  createdBy: string;
}

export type ApprovalStatus = "menunggu" | "disetujui" | "ditolak";

export interface ApprovalStep {
  role: Role;
  title: string; // e.g. "Verifikasi Petugas Aset"
  status: ApprovalStatus;
  by?: string; // userId
  at?: string;
  note?: string;
}

export interface Transfer {
  id: string;
  no: string; // "MUT-2026-0007" / "PJM-2026-0003"
  type: "mutasi" | "pinjam";
  assetIds: string[];
  fromUnitId: string;
  toUnitId: string;
  toLocationId?: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  startDate: string;
  returnDate?: string; // pinjam only
  status: "diajukan" | "disetujui" | "ditolak" | "diserahkan" | "dikembalikan";
  approvals: ApprovalStep[];
  handoverAt?: string; // BAST
  returnedAt?: string;
}

export interface StockTake {
  id: string;
  no: string; // "OPN-2026-0004"
  unitId: string;
  locationIds: string[];
  period: string; // "Semester II 2026"
  startedAt: string;
  completedAt?: string;
  status: "berjalan" | "selesai";
  leaderId: string;
  items: {
    assetId: string;
    result: "belum" | "ditemukan" | "tidak_ditemukan";
    condition?: Condition;
    note?: string;
    checkedAt?: string;
    checkedBy?: string;
  }[];
}

export interface Disposal {
  id: string;
  no: string; // "PHP-2026-0009"
  assetIds: string[];
  reason: string;
  method: "Lelang" | "Hibah" | "Pemusnahan" | "Pemindahtanganan";
  estimatedValue: number;
  createdBy: string;
  createdAt: string;
  status: "diajukan" | "disetujui" | "ditolak";
  approvals: ApprovalStep[];
  attachments: string[]; // file names
}

export interface AuditEntry {
  id: string;
  at: string;
  userId: string;
  action: string; // e.g. "Membuat", "Mengubah", "Menyetujui", "Login"
  module: string; // e.g. "Aset", "Work Order"
  ref?: string; // human readable ref (code / no)
  detail?: string;
}

export interface Notification {
  id: string;
  at: string;
  userId?: string; // undefined = everyone; otherwise target user
  role?: Role; // or target role
  title: string;
  body: string;
  href?: string;
  read: string[]; // userIds that have read it
}

export interface DB {
  version: number;
  users: User[];
  units: Unit[];
  locations: Location[];
  categories: Category[];
  assets: Asset[];
  workOrders: WorkOrder[];
  spareParts: SparePart[];
  stockMovements: StockMovement[];
  flightLogs: FlightLog[];
  transfers: Transfer[];
  stockTakes: StockTake[];
  disposals: Disposal[];
  audit: AuditEntry[];
  notifications: Notification[];
}
