"use client";
// Asset form pieces shared by the registration wizard (/aset/baru) and the edit page (/aset/edit).
import { Field } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { AVIATION_CATEGORIES } from "@/lib/seed";
import { formatRupiah, todayISO } from "@/lib/format";
import type { Airworthiness, Asset, AssetStatus, CategoryId, Condition, DB } from "@/lib/types";

export interface AssetDraft {
  name: string;
  categoryId: CategoryId | "";
  brand: string;
  model: string;
  serialNumber: string;
  registration: string;
  year: string;
  acquisitionDate: string;
  acquisitionValue: string;
  fundingSource: Asset["fundingSource"];
  usefulLife: string;
  residualValue: string;
  condition: Condition;
  status: AssetStatus;
  unitId: string;
  locationId: string;
  picId: string;
  notes: string;
  specs: Record<string, string>; // category preset fields
  extraSpecs: { key: string; value: string }[];
  // aviation
  airworthiness: Airworthiness;
  flightHours: string;
  cycles: string;
  inspectionIntervalHours: string;
  lastInspectionHours: string;
  lastInspectionDate: string;
  certificateNo: string;
  certificateExpiry: string;
  engine: string;
}

export type DraftErrors = Partial<Record<string, string>>;

interface SpecField { key: string; label: string; required?: boolean; placeholder?: string }

export const CATEGORY_SPEC_FIELDS: Partial<Record<CategoryId, SpecField[]>> = {
  kendaraan: [
    { key: "No. Polisi", label: "No. Polisi / Registrasi Kendaraan", required: true, placeholder: "mis. 12-XIV" },
    { key: "Odometer", label: "Odometer", placeholder: "mis. 12.500 km" },
  ],
  tanah: [
    { key: "Luas", label: "Luas Tanah", required: true, placeholder: "mis. 38.500 m²" },
    { key: "Status hak", label: "Status Hak", required: true, placeholder: "mis. Hak Pakai" },
    { key: "Alamat", label: "Alamat", required: true, placeholder: "Jalan, kota" },
  ],
  bangunan: [
    { key: "Luas bangunan", label: "Luas Bangunan", required: true, placeholder: "mis. 2.400 m²" },
    { key: "Jumlah lantai", label: "Jumlah Lantai", required: true, placeholder: "mis. 3" },
  ],
  radar: [{ key: "Jangkauan", label: "Jangkauan / Daya", placeholder: "mis. 250 km" }],
  persenjataan: [{ key: "Jumlah", label: "Jumlah / Komposisi", required: true, placeholder: "mis. 120 pucuk" }],
  komponen: [
    { key: "P/N", label: "Part Number", required: true, placeholder: "mis. 23078-016" },
    { key: "TSO", label: "Time Since Overhaul", placeholder: "mis. 1.200 jam" },
  ],
};

export function isAviation(cat: string) {
  return AVIATION_CATEGORIES.includes(cat as CategoryId);
}

export function registrationLabel(cat: string) {
  if (isAviation(cat)) return "Nomor Registrasi (Tail Number)";
  if (cat === "tanah") return "Nomor Sertifikat";
  return "Nomor Registrasi / Inventaris";
}
function registrationRequired(cat: string) {
  return isAviation(cat) || cat === "tanah";
}
const noSerial = (cat: string) => cat === "tanah" || cat === "bangunan";

export function emptyDraft(defaults: Partial<AssetDraft> = {}): AssetDraft {
  return {
    name: "", categoryId: "", brand: "", model: "", serialNumber: "", registration: "",
    year: String(new Date().getFullYear()), acquisitionDate: todayISO(), acquisitionValue: "",
    fundingSource: "APBN", usefulLife: "", residualValue: "", condition: "Baik", status: "Aktif",
    unitId: "", locationId: "", picId: "", notes: "", specs: {}, extraSpecs: [],
    airworthiness: "Laik", flightHours: "0", cycles: "0", inspectionIntervalHours: "100", lastInspectionHours: "0",
    lastInspectionDate: todayISO(), certificateNo: "", certificateExpiry: "", engine: "",
    ...defaults,
  };
}

export function draftFromAsset(a: Asset): AssetDraft {
  const preset = CATEGORY_SPEC_FIELDS[a.categoryId] ?? [];
  const specs: Record<string, string> = {};
  const extraSpecs: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(a.specs)) {
    if (preset.some((p) => p.key === k)) specs[k] = v;
    else extraSpecs.push({ key: k, value: v });
  }
  const av = a.aviation;
  return {
    name: a.name, categoryId: a.categoryId, brand: a.brand, model: a.model, serialNumber: a.serialNumber,
    registration: a.registration ?? "", year: String(a.year), acquisitionDate: a.acquisitionDate,
    acquisitionValue: String(a.acquisitionValue), fundingSource: a.fundingSource, usefulLife: String(a.usefulLife),
    residualValue: String(a.residualValue), condition: a.condition, status: a.status, unitId: a.unitId,
    locationId: a.locationId, picId: a.picId, notes: a.notes ?? "", specs, extraSpecs,
    airworthiness: av?.airworthiness ?? "Laik", flightHours: String(av?.flightHours ?? 0), cycles: String(av?.cycles ?? 0),
    inspectionIntervalHours: String(av?.inspectionIntervalHours ?? 100), lastInspectionHours: String(av?.lastInspectionHours ?? 0),
    lastInspectionDate: av?.lastInspectionDate ?? todayISO(), certificateNo: av?.certificateNo ?? "",
    certificateExpiry: av?.certificateExpiry ?? "", engine: av?.engine ?? "",
  };
}

const num = (s: string) => {
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Fields of Asset derived from the draft (identity fields like id/code/documents are added by the caller). */
export function draftToAssetFields(d: AssetDraft) {
  const specs: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.specs)) if (v.trim()) specs[k] = v.trim();
  for (const s of d.extraSpecs) if (s.key.trim() && s.value.trim()) specs[s.key.trim()] = s.value.trim();
  const cat = d.categoryId as CategoryId;
  return {
    name: d.name.trim(),
    categoryId: cat,
    brand: d.brand.trim() || "-",
    model: d.model.trim() || "-",
    serialNumber: noSerial(cat) ? "-" : d.serialNumber.trim() || "-",
    registration: d.registration.trim() || undefined,
    year: Math.round(num(d.year)),
    acquisitionDate: d.acquisitionDate,
    acquisitionValue: Math.round(num(d.acquisitionValue)),
    fundingSource: d.fundingSource,
    usefulLife: Math.round(num(d.usefulLife)),
    residualValue: Math.round(num(d.residualValue)),
    unitId: d.unitId,
    locationId: d.locationId,
    picId: d.picId,
    condition: d.condition,
    status: d.status,
    specs,
    notes: d.notes.trim() || undefined,
    aviation: isAviation(cat)
      ? {
          airworthiness: d.airworthiness,
          flightHours: num(d.flightHours),
          cycles: Math.round(num(d.cycles)),
          inspectionIntervalHours: num(d.inspectionIntervalHours),
          lastInspectionHours: num(d.lastInspectionHours),
          lastInspectionDate: d.lastInspectionDate,
          certificateNo: d.certificateNo.trim(),
          certificateExpiry: d.certificateExpiry,
          engine: d.engine.trim() || "-",
        }
      : undefined,
  } satisfies Partial<Asset>;
}

export type Section = "identitas" | "spesifikasi" | "lokasi";

export function validate(d: AssetDraft, section: Section, db: DB, selfId?: string): DraftErrors {
  const e: DraftErrors = {};
  const cat = d.categoryId;
  if (section === "identitas") {
    if (d.name.trim().length < 3) e.name = "Nama aset minimal 3 karakter.";
    if (!cat) e.categoryId = "Pilih kategori aset.";
    if (cat && registrationRequired(cat)) {
      if (!d.registration.trim()) e.registration = `${registrationLabel(cat)} wajib diisi.`;
      else if (db.assets.some((a) => a.id !== selfId && a.registration?.toLowerCase() === d.registration.trim().toLowerCase()))
        e.registration = "Nomor ini sudah dipakai aset lain.";
    }
    const y = num(d.year);
    if (!y || y < 1900 || y > new Date().getFullYear() + 1) e.year = "Tahun tidak valid.";
    if (!d.acquisitionDate) e.acquisitionDate = "Tanggal perolehan wajib diisi.";
    if (cat && !noSerial(cat) && !d.serialNumber.trim()) e.serialNumber = "Nomor seri wajib diisi.";
  }
  if (section === "spesifikasi") {
    const v = num(d.acquisitionValue);
    if (v <= 0) e.acquisitionValue = "Nilai perolehan harus lebih dari 0.";
    const life = num(d.usefulLife);
    if (d.usefulLife === "" || life < 0 || life > 80) e.usefulLife = "Umur ekonomis 0–80 tahun.";
    if (num(d.residualValue) < 0 || num(d.residualValue) > v) e.residualValue = "Nilai residu tidak boleh melebihi nilai perolehan.";
    for (const f of CATEGORY_SPEC_FIELDS[cat as CategoryId] ?? []) {
      if (f.required && !d.specs[f.key]?.trim()) e[`spec:${f.key}`] = `${f.label} wajib diisi.`;
    }
    if (isAviation(cat)) {
      if (num(d.flightHours) < 0) e.flightHours = "Tidak valid.";
      if (num(d.inspectionIntervalHours) <= 0) e.inspectionIntervalHours = "Interval harus lebih dari 0.";
      if (num(d.lastInspectionHours) > num(d.flightHours)) e.lastInspectionHours = "Tidak boleh melebihi total jam terbang.";
      if (!d.certificateNo.trim()) e.certificateNo = "Nomor sertifikat kelaikan wajib diisi.";
      if (!d.certificateExpiry) e.certificateExpiry = "Tanggal berlaku wajib diisi.";
    }
  }
  if (section === "lokasi") {
    if (!d.unitId) e.unitId = "Pilih satuan pemilik.";
    if (!d.locationId) e.locationId = "Pilih lokasi.";
    if (!d.picId) e.picId = "Pilih penanggung jawab.";
  }
  return e;
}

type SetDraft = (patch: Partial<AssetDraft>) => void;
interface SectionProps { d: AssetDraft; set: SetDraft; errors: DraftErrors; db: DB }

const cls = (errors: DraftErrors, k: string, base = "input") => `${base} ${errors[k] ? "invalid" : ""}`;

export function IdentitySection({ d, set, errors, db, code }: SectionProps & { code: string }) {
  const groups = Array.from(new Set(db.categories.map((c) => c.group)));
  return (
    <div className="form-grid">
      <Field label="Kode Aset" hint="Dibuat otomatis dari kategori & tahun">
        <input className="input mono" value={code || "—"} disabled />
      </Field>
      <Field label="Kategori" required error={errors.categoryId}>
        <select className={cls(errors, "categoryId", "select")} value={d.categoryId}
          onChange={(e) => {
            const c = db.categories.find((x) => x.id === e.target.value);
            set({ categoryId: e.target.value as CategoryId, usefulLife: c ? String(c.usefulLife) : d.usefulLife, specs: {} });
          }}>
          <option value="">— Pilih kategori —</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {db.categories.filter((c) => c.group === g).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="Nama Aset" required error={errors.name} span2>
        <input className={cls(errors, "name")} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="mis. Helikopter Serbaguna HX-4106" />
      </Field>
      <Field label="Merek / Pabrikan">
        <input className="input" value={d.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="mis. Bell Textron" />
      </Field>
      <Field label="Model / Tipe">
        <input className="input" value={d.model} onChange={(e) => set({ model: e.target.value })} placeholder="mis. Bell 412EPI" />
      </Field>
      {d.categoryId && !noSerial(d.categoryId) && (
        <Field label="Nomor Seri" required error={errors.serialNumber}>
          <input className={cls(errors, "serialNumber")} value={d.serialNumber} onChange={(e) => set({ serialNumber: e.target.value })} placeholder="mis. SN-882134" />
        </Field>
      )}
      {d.categoryId && d.categoryId !== "bangunan" && (
        <Field label={registrationLabel(d.categoryId)} required={registrationRequired(d.categoryId)} error={errors.registration}>
          <input className={cls(errors, "registration")} value={d.registration} onChange={(e) => set({ registration: e.target.value.toUpperCase() })} placeholder={isAviation(d.categoryId) ? "mis. HX-4106" : d.categoryId === "tanah" ? "mis. SHP No. 01200" : "opsional"} />
        </Field>
      )}
      <Field label="Tahun Pembuatan" required error={errors.year}>
        <input className={cls(errors, "year")} type="number" value={d.year} onChange={(e) => set({ year: e.target.value })} />
      </Field>
      <Field label="Tanggal Perolehan" required error={errors.acquisitionDate}>
        <input className={cls(errors, "acquisitionDate")} type="date" value={d.acquisitionDate} onChange={(e) => set({ acquisitionDate: e.target.value })} />
      </Field>
      <Field label="Sumber Dana">
        <select className="select" value={d.fundingSource} onChange={(e) => set({ fundingSource: e.target.value as Asset["fundingSource"] })}>
          {["APBN", "Hibah", "PNBP", "Kredit Ekspor", "Lainnya"].map((x) => <option key={x}>{x}</option>)}
        </select>
      </Field>
    </div>
  );
}

export function SpecSection({ d, set, errors, showStatus }: SectionProps & { showStatus?: boolean }) {
  const preset = CATEGORY_SPEC_FIELDS[d.categoryId as CategoryId] ?? [];
  const value = num(d.acquisitionValue);
  return (
    <div className="stack">
      <div className="form-grid">
        <Field label="Nilai Perolehan" required error={errors.acquisitionValue} hint={value > 0 ? formatRupiah(value) : undefined}>
          <div className="input-affix"><span>Rp</span>
            <input className={cls(errors, "acquisitionValue")} type="number" min={0} value={d.acquisitionValue} onChange={(e) => set({ acquisitionValue: e.target.value })} placeholder="0" />
          </div>
        </Field>
        <Field label="Umur Ekonomis (tahun)" required error={errors.usefulLife} hint={d.usefulLife === "0" ? "0 = tidak disusutkan (mis. tanah)" : "Metode penyusutan: garis lurus"}>
          <input className={cls(errors, "usefulLife")} type="number" min={0} value={d.usefulLife} onChange={(e) => set({ usefulLife: e.target.value })} />
        </Field>
        <Field label="Nilai Residu" error={errors.residualValue} hint="Perkiraan nilai di akhir umur ekonomis">
          <div className="input-affix"><span>Rp</span>
            <input className={cls(errors, "residualValue")} type="number" min={0} value={d.residualValue} onChange={(e) => set({ residualValue: e.target.value })} placeholder="0" />
          </div>
        </Field>
        <Field label="Kondisi">
          <select className="select" value={d.condition} onChange={(e) => set({ condition: e.target.value as Condition })}>
            {["Baik", "Rusak Ringan", "Rusak Berat"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        {showStatus && (
          <Field label="Status">
            <select className="select" value={d.status} onChange={(e) => set({ status: e.target.value as AssetStatus })}>
              {["Aktif", "Dalam Pemeliharaan", "Dipinjam", "Diusulkan Hapus", "Dihapus"].map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
        )}
        {preset.map((f) => (
          <Field key={f.key} label={f.label} required={f.required} error={errors[`spec:${f.key}`]}>
            <input className={cls(errors, `spec:${f.key}`)} value={d.specs[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => set({ specs: { ...d.specs, [f.key]: e.target.value } })} />
          </Field>
        ))}
      </div>

      {isAviation(d.categoryId) && (
        <div>
          <div className="section-title" style={{ fontSize: 14 }}>Data Kelaikan Udara</div>
          <div className="section-sub">Dipakai untuk memantau jam terbang, inspeksi berkala, dan sertifikat kelaikan.</div>
          <div className="form-grid cols-3">
            <Field label="Status Kelaikan">
              <select className="select" value={d.airworthiness} onChange={(e) => set({ airworthiness: e.target.value as Airworthiness })}>
                {["Laik", "Laik Terbatas", "Tidak Laik"].map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Total Jam Terbang" error={errors.flightHours}>
              <input className={cls(errors, "flightHours")} type="number" min={0} step="0.1" value={d.flightHours} onChange={(e) => set({ flightHours: e.target.value })} />
            </Field>
            <Field label="Jumlah Siklus (Landing)">
              <input className="input" type="number" min={0} value={d.cycles} onChange={(e) => set({ cycles: e.target.value })} />
            </Field>
            <Field label="Interval Inspeksi (jam)" error={errors.inspectionIntervalHours}>
              <input className={cls(errors, "inspectionIntervalHours")} type="number" min={1} value={d.inspectionIntervalHours} onChange={(e) => set({ inspectionIntervalHours: e.target.value })} />
            </Field>
            <Field label="Jam pada Inspeksi Terakhir" error={errors.lastInspectionHours}>
              <input className={cls(errors, "lastInspectionHours")} type="number" min={0} step="0.1" value={d.lastInspectionHours} onChange={(e) => set({ lastInspectionHours: e.target.value })} />
            </Field>
            <Field label="Tanggal Inspeksi Terakhir">
              <input className="input" type="date" value={d.lastInspectionDate} onChange={(e) => set({ lastInspectionDate: e.target.value })} />
            </Field>
            <Field label="No. Sertifikat Kelaikan" required error={errors.certificateNo}>
              <input className={cls(errors, "certificateNo")} value={d.certificateNo} onChange={(e) => set({ certificateNo: e.target.value })} placeholder="mis. SKL/HX-4106/2026" />
            </Field>
            <Field label="Sertifikat Berlaku s.d." required error={errors.certificateExpiry}>
              <input className={cls(errors, "certificateExpiry")} type="date" value={d.certificateExpiry} onChange={(e) => set({ certificateExpiry: e.target.value })} />
            </Field>
            <Field label="Mesin">
              <input className="input" value={d.engine} onChange={(e) => set({ engine: e.target.value })} placeholder="mis. 2× PT6T-9" />
            </Field>
          </div>
        </div>
      )}

      <div>
        <div className="form-label" style={{ marginBottom: 6 }}>Spesifikasi Tambahan <span className="muted" style={{ fontWeight: 400 }}>(opsional)</span></div>
        <div className="stack" style={{ gap: 8 }}>
          {d.extraSpecs.map((s, i) => (
            <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
              <input className="input" style={{ flex: 1 }} value={s.key} placeholder="Nama (mis. Daya)" onChange={(e) => set({ extraSpecs: d.extraSpecs.map((x, k) => (k === i ? { ...x, key: e.target.value } : x)) })} />
              <input className="input" style={{ flex: 1.4 }} value={s.value} placeholder="Nilai (mis. 400 W)" onChange={(e) => set({ extraSpecs: d.extraSpecs.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)) })} />
              <button type="button" className="icon-btn" aria-label="Hapus baris" onClick={() => set({ extraSpecs: d.extraSpecs.filter((_, k) => k !== i) })}><Icon name="x" /></button>
            </div>
          ))}
          <div><button type="button" className="btn btn-plain btn-sm" onClick={() => set({ extraSpecs: [...d.extraSpecs, { key: "", value: "" }] })}><Icon name="plus" />Tambah spesifikasi</button></div>
        </div>
      </div>

      <Field label="Catatan">
        <textarea className="textarea" value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Keterangan tambahan tentang aset..." />
      </Field>
    </div>
  );
}

export function LocationSection({ d, set, errors, db }: SectionProps) {
  const locations = db.locations.filter((l) => l.unitId === d.unitId);
  const users = db.users.filter((u) => u.active);
  const pic = db.users.find((u) => u.id === d.picId);
  return (
    <div className="form-grid">
      <Field label="Satuan Pemilik" required error={errors.unitId}>
        <select className={cls(errors, "unitId", "select")} value={d.unitId} onChange={(e) => set({ unitId: e.target.value, locationId: "" })}>
          <option value="">— Pilih satuan —</option>
          {db.units.map((u) => <option key={u.id} value={u.id}>{u.code} · {u.name}</option>)}
        </select>
      </Field>
      <Field label="Lokasi" required error={errors.locationId} hint={d.unitId && !locations.length ? "Satuan ini belum memiliki lokasi. Tambahkan di Master Data." : undefined}>
        <select className={cls(errors, "locationId", "select")} value={d.locationId} disabled={!d.unitId} onChange={(e) => set({ locationId: e.target.value })}>
          <option value="">{d.unitId ? "— Pilih lokasi —" : "Pilih satuan dahulu"}</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.kind})</option>)}
        </select>
      </Field>
      <Field label="Penanggung Jawab" required error={errors.picId}>
        <select className={cls(errors, "picId", "select")} value={d.picId} onChange={(e) => set({ picId: e.target.value })}>
          <option value="">— Pilih personel —</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.position}</option>)}
        </select>
      </Field>
      <Field label="NIP / Jabatan Penanggung Jawab">
        <input className="input" disabled value={pic ? `${pic.nip} · ${pic.position}` : ""} />
      </Field>
    </div>
  );
}
