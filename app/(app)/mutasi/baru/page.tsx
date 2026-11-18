"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Field, PageHeader, Panel, toast } from "@/components/ui";
import { RequireRole } from "@/components/RequireRole";
import { AssetPicker } from "@/components/workflow/AssetPicker";
import { useCurrentUser, useDB, useStore, uid } from "@/lib/store";
import { nextNo, unitName } from "@/lib/domain";
import { todayISO } from "@/lib/format";
import { transferSteps } from "@/lib/seed";
import type { Transfer } from "@/lib/types";

function NewTransferForm() {
  const db = useDB();
  const user = useCurrentUser()!;
  const mutate = useStore((s) => s.mutate);
  const notify = useStore((s) => s.notify);
  const router = useRouter();
  const params = useSearchParams();

  const preAsset = db.assets.find((a) => a.id === params.get("assetId") && a.status === "Aktif");
  const [type, setType] = useState<Transfer["type"]>(params.get("type") === "pinjam" ? "pinjam" : "mutasi");
  const [assetIds, setAssetIds] = useState<string[]>(preAsset ? [preAsset.id] : []);
  const [toUnitId, setToUnitId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [returnDate, setReturnDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const candidates = useMemo(() => db.assets.filter((a) => a.status === "Aktif"), [db.assets]);
  const fromUnitId = db.assets.find((a) => a.id === assetIds[0])?.unitId ?? "";
  const targetLocations = db.locations.filter((l) => l.unitId === toUnitId);

  const errors: Record<string, string> = {};
  if (!assetIds.length) errors.assets = "Pilih minimal satu aset.";
  if (!toUnitId) errors.toUnit = "Pilih satuan tujuan.";
  else if (toUnitId === fromUnitId) errors.toUnit = "Satuan tujuan harus berbeda dengan satuan asal.";
  if (!startDate) errors.start = "Isi tanggal mulai.";
  if (type === "pinjam") {
    if (!returnDate) errors.ret = "Isi tanggal kembali.";
    else if (returnDate <= startDate) errors.ret = "Tanggal kembali harus setelah tanggal mulai.";
  }
  if (reason.trim().length < 10) errors.reason = "Jelaskan alasan (minimal 10 karakter).";
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) { toast.error("Periksa kembali isian formulir"); return; }
    const year = new Date().getFullYear();
    const no = nextNo(db.transfers.map((t) => t.no), `${type === "pinjam" ? "PJM" : "MUT"}-${year}`);
    const id = uid("trf");
    const t: Transfer = {
      id, no, type, assetIds, fromUnitId, toUnitId, toLocationId: toLocationId || undefined, reason: reason.trim(),
      requestedBy: user.id, requestedAt: new Date().toISOString(), startDate,
      returnDate: type === "pinjam" ? returnDate : undefined, status: "diajukan", approvals: transferSteps(),
    };
    mutate((d) => { d.transfers.unshift(t); }, { action: "Mengajukan", module: type === "pinjam" ? "Peminjaman" : "Mutasi", ref: no, detail: `${assetIds.length} aset → ${unitName(db, toUnitId)}` });
    notify({ role: "petugas", title: `${type === "pinjam" ? "Peminjaman" : "Mutasi"} perlu verifikasi`, body: `${no} · ${assetIds.length} aset ke ${unitName(db, toUnitId)}`, href: `/mutasi/detail?id=${id}` });
    toast.success(`${no} berhasil diajukan`);
    router.push(`/mutasi/detail?id=${id}`);
  };

  return (
    <>
      <PageHeader back="/mutasi" title="Ajukan Mutasi / Peminjaman" subtitle="Dokumen akan melalui verifikasi Petugas Aset dan persetujuan Pimpinan" />
      <div className="layout-main-side">
        <div className="stack">
          <Panel title="Jenis pengajuan">
            <div className="filter-pills">
              <button className={`pill ${type === "mutasi" ? "active" : ""}`} onClick={() => setType("mutasi")}><Icon name="transfer" size={15} />Mutasi permanen</button>
              <button className={`pill ${type === "pinjam" ? "active" : ""}`} onClick={() => setType("pinjam")}><Icon name="clock" size={15} />Peminjaman sementara</button>
            </div>
            <p className="field-hint" style={{ marginTop: 10 }}>
              {type === "mutasi"
                ? "Aset berpindah satuan dan lokasi secara permanen setelah serah terima."
                : "Aset tetap tercatat di satuan asal dan berstatus Dipinjam sampai dikembalikan."}
            </p>
          </Panel>

          <Panel title="Aset" subtitle="Hanya aset berstatus Aktif. Semua aset dalam satu dokumen harus berasal dari satuan yang sama.">
            <AssetPicker db={db} candidates={candidates} selected={assetIds} onChange={setAssetIds}
              disabledReason={(a) => (fromUnitId && a.unitId !== fromUnitId ? "satuan berbeda" : undefined)} />
            {err("assets") && <div className="field-error" style={{ marginTop: 8 }}>{err("assets")}</div>}
          </Panel>
        </div>

        <Panel title="Detail pengajuan">
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <Field label="Satuan asal">
              <input className="input" disabled value={fromUnitId ? unitName(db, fromUnitId) : "Otomatis dari aset yang dipilih"} />
            </Field>
            <Field label="Satuan tujuan" required error={err("toUnit")}>
              <select className={`select ${err("toUnit") ? "invalid" : ""}`} value={toUnitId} onChange={(e) => { setToUnitId(e.target.value); setToLocationId(""); }}>
                <option value="">Pilih satuan…</option>
                {db.units.filter((u) => u.id !== fromUnitId).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
              </select>
            </Field>
            <Field label="Lokasi tujuan" hint="Opsional. Jika kosong, aset ditempatkan di lokasi pertama satuan tujuan.">
              <select className="select" value={toLocationId} onChange={(e) => setToLocationId(e.target.value)} disabled={!toUnitId}>
                <option value="">{toUnitId ? "Pilih lokasi…" : "Pilih satuan tujuan dahulu"}</option>
                {targetLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Tanggal mulai" required error={err("start")}>
              <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            {type === "pinjam" && (
              <Field label="Tanggal kembali" required error={err("ret")}>
                <input type="date" className={`input ${err("ret") ? "invalid" : ""}`} value={returnDate} min={startDate} onChange={(e) => setReturnDate(e.target.value)} />
              </Field>
            )}
            <Field label="Alasan / dasar pengajuan" required error={err("reason")}>
              <textarea className={`textarea ${err("reason") ? "invalid" : ""}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: dukungan operasi latihan gabungan sesuai surat perintah…" />
            </Field>
          </div>
          <div className="row" style={{ marginTop: 18, justifyContent: "flex-end" }}>
            <button className="btn btn-plain" onClick={() => router.push("/mutasi")}>Batal</button>
            <button className="btn btn-primary" onClick={submit}><Icon name="check" />Ajukan</button>
          </div>
        </Panel>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["admin", "petugas"]}>
      <Suspense fallback={null}><NewTransferForm /></Suspense>
    </RequireRole>
  );
}
