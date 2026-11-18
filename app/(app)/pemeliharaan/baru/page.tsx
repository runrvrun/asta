"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Field, PageHeader, toast } from "@/components/ui";
import { RequireRole } from "@/components/RequireRole";
import { uid, useCurrentUser, useDB, useStore } from "@/lib/store";
import { byId, nextNo, unitName, userName, yearMonth } from "@/lib/domain";
import { todayISO } from "@/lib/format";
import { CHECKLIST_TEMPLATES, PRIORITIES, WO_TYPES } from "@/lib/maintenance";
import type { WorkOrder } from "@/lib/types";

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function NewWorkOrderForm() {
  const db = useDB();
  const user = useCurrentUser()!;
  const mutate = useStore((s) => s.mutate);
  const notify = useStore((s) => s.notify);
  const router = useRouter();
  const params = useSearchParams();
  const presetAsset = params.get("assetId") ?? "";
  const presetAssetObj = byId(db.assets, presetAsset);

  const [assetQuery, setAssetQuery] = useState("");
  const [assetId, setAssetId] = useState(presetAssetObj ? presetAsset : "");
  const [type, setType] = useState<WorkOrder["type"]>(presetAssetObj?.aviation ? "Inspeksi Berkala" : "Korektif");
  const [title, setTitle] = useState(presetAssetObj?.aviation ? `Inspeksi periodik ${presetAssetObj.aviation.inspectionIntervalHours} jam ${presetAssetObj.registration ?? ""}`.trim() : "");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<WorkOrder["priority"]>("Sedang");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState(addDays(7));
  const [estHours, setEstHours] = useState("8");
  const [checklist, setChecklist] = useState<string[]>(CHECKLIST_TEMPLATES[presetAssetObj?.aviation ? "Inspeksi Berkala" : "Korektif"]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const technicians = db.users.filter((u) => u.role === "teknisi" && u.active);
  const assets = useMemo(() => {
    const q = assetQuery.trim().toLowerCase();
    return db.assets
      .filter((a) => a.status !== "Dihapus")
      .filter((a) => !q || `${a.name} ${a.code} ${a.registration ?? ""}`.toLowerCase().includes(q) || a.id === assetId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [db.assets, assetQuery, assetId]);
  const asset = byId(db.assets, assetId);

  const applyTemplate = (t: WorkOrder["type"]) => setChecklist(CHECKLIST_TEMPLATES[t]);

  const submit = () => {
    const e: Record<string, string> = {};
    if (!assetId) e.asset = "Pilih aset.";
    if (title.trim().length < 5) e.title = "Judul minimal 5 karakter.";
    if (!dueDate) e.dueDate = "Isi target selesai.";
    else if (dueDate < todayISO()) e.dueDate = "Target selesai tidak boleh di masa lalu.";
    const est = parseFloat(estHours.replace(",", "."));
    if (!(est > 0)) e.estHours = "Isi estimasi jam kerja (> 0).";
    setErrors(e);
    if (Object.keys(e).length) { toast.error("Periksa kembali isian formulir."); return; }

    const id = uid("wo");
    const no = nextNo(db.workOrders.map((w) => w.no), `WO-${yearMonth()}`);
    const now = new Date().toISOString();
    const items = checklist.map((t) => t.trim()).filter(Boolean);
    const timeline = [{ at: now, text: "WO dibuat", by: user.id }];
    if (assigneeId) timeline.push({ at: now, text: `Ditugaskan ke ${userName(db, assigneeId)}`, by: user.id });
    mutate(
      (d) => {
        d.workOrders.unshift({
          id, no, assetId, type, title: title.trim(), description: description.trim(), priority,
          status: "baru", assigneeId: assigneeId || undefined, createdBy: user.id, createdAt: now, dueDate,
          estHours: est, actualHours: 0,
          checklist: items.map((text) => ({ id: uid("ck"), text, done: false })),
          parts: [], timeline,
        });
      },
      { action: "Membuat", module: "Work Order", ref: no, detail: title.trim() },
    );
    if (assigneeId) notify({ userId: assigneeId, title: "Work order baru ditugaskan", body: `${no} · ${title.trim()}`, href: `/pemeliharaan/detail?id=${id}` });
    toast.success(`Work order ${no} dibuat`);
    router.push(`/pemeliharaan/detail?id=${id}`);
  };

  return (
    <>
      <PageHeader title="Buat Work Order" subtitle="Pemeliharaan · pekerjaan perawatan atau perbaikan baru" back="/pemeliharaan" />
      <div className="layout-main-side">
        <div className="stack">
          <div className="panel">
            <h3 className="section-title">Aset</h3>
            <p className="section-sub">Pilih aset yang akan dikerjakan.</p>
            <div className="form-grid">
              <Field label="Cari aset" hint="Ketik nama, kode, atau nomor registrasi">
                <input className="input" value={assetQuery} onChange={(e) => setAssetQuery(e.target.value)} placeholder="mis. AX-1301" />
              </Field>
              <Field label="Aset" required error={errors.asset}>
                <select className={`select ${errors.asset ? "invalid" : ""}`} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                  <option value="">— Pilih aset ({assets.length}) —</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                </select>
              </Field>
            </div>
            {asset && (
              <div className="row" style={{ background: "var(--panel)", borderRadius: 10, padding: 12, marginTop: 14 }}>
                <div className="thumb"><Icon name="box" /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="cell-strong">{asset.name}</div>
                  <div className="cell-sub">{asset.code} · {asset.brand} {asset.model} · {unitName(db, asset.unitId)} · Status: {asset.status}</div>
                </div>
              </div>
            )}
          </div>

          <div className="panel">
            <h3 className="section-title">Rincian pekerjaan</h3>
            <p className="section-sub">Jelaskan pekerjaan yang harus dilakukan.</p>
            <div className="form-grid">
              <Field label="Jenis pekerjaan" required>
                <select className="select" value={type} onChange={(e) => setType(e.target.value as WorkOrder["type"])}>
                  {WO_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Prioritas" required>
                <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as WorkOrder["priority"])}>
                  {PRIORITIES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Judul" required error={errors.title} span2>
                <input className={`input ${errors.title ? "invalid" : ""}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Penggantian bearing starter generator" />
              </Field>
              <Field label="Deskripsi kerusakan / lingkup pekerjaan" span2>
                <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Temuan, gejala, atau referensi manual perawatan" />
              </Field>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Checklist pekerjaan</h3>
                <p>Langkah-langkah yang akan dicentang teknisi.</p>
              </div>
              <button className="btn btn-plain btn-sm" onClick={() => applyTemplate(type)}><Icon name="refresh" />Pakai templat {type}</button>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {checklist.map((item, i) => (
                <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
                  <span className="muted small" style={{ width: 20 }}>{i + 1}.</span>
                  <input className="input" value={item} onChange={(e) => setChecklist(checklist.map((c, k) => (k === i ? e.target.value : c)))} />
                  <button className="icon-btn" aria-label="Hapus langkah" onClick={() => setChecklist(checklist.filter((_, k) => k !== i))}><Icon name="trash" /></button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setChecklist([...checklist, ""])}><Icon name="plus" />Tambah langkah</button>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <h3 className="section-title">Penugasan & jadwal</h3>
            <p className="section-sub">Teknisi bisa ditugaskan sekarang atau nanti.</p>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
              <Field label="Teknisi">
                <select className="select" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">Belum ditugaskan</option>
                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.rank} {t.name} · {t.position}</option>)}
                </select>
              </Field>
              <Field label="Target selesai" required error={errors.dueDate}>
                <input type="date" className={`input ${errors.dueDate ? "invalid" : ""}`} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
              <Field label="Estimasi jam kerja" required error={errors.estHours}>
                <input className={`input ${errors.estHours ? "invalid" : ""}`} inputMode="decimal" value={estHours} onChange={(e) => setEstHours(e.target.value)} />
              </Field>
            </div>
            <div className="row" style={{ marginTop: 18 }}>
              <Link className="btn btn-plain" href="/pemeliharaan">Batal</Link>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit}><Icon name="check" />Simpan Work Order</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function NewWorkOrderPage() {
  return (
    <RequireRole roles={["admin", "petugas", "teknisi", "pimpinan"]}>
      <Suspense fallback={<div className="loader-screen"><div className="spinner" /></div>}>
        <NewWorkOrderForm />
      </Suspense>
    </RequireRole>
  );
}
