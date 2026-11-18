"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Field, FileDrop, PageHeader, Panel, toast } from "@/components/ui";
import { RequireRole } from "@/components/RequireRole";
import { AssetPicker } from "@/components/workflow/AssetPicker";
import { useCurrentUser, useDB, useStore, uid } from "@/lib/store";
import { depreciation, nextNo } from "@/lib/domain";
import { formatRupiah } from "@/lib/format";
import { disposalSteps } from "@/lib/seed";
import type { Disposal } from "@/lib/types";

const METHODS: { id: Disposal["method"]; desc: string }[] = [
  { id: "Lelang", desc: "Dijual melalui lelang negara" },
  { id: "Hibah", desc: "Diserahkan kepada instansi lain" },
  { id: "Pemusnahan", desc: "Dimusnahkan (mis. alat sensitif, rusak total)" },
  { id: "Pemindahtanganan", desc: "Tukar menukar / penyertaan modal" },
];

function NewDisposalForm() {
  const db = useDB();
  const user = useCurrentUser()!;
  const mutate = useStore((s) => s.mutate);
  const notify = useStore((s) => s.notify);
  const router = useRouter();
  const params = useSearchParams();

  const candidates = useMemo(() => db.assets.filter((a) => a.status === "Aktif" || a.status === "Dalam Pemeliharaan"), [db.assets]);
  const pre = candidates.find((a) => a.id === params.get("assetId"));
  const [assetIds, setAssetIds] = useState<string[]>(pre ? [pre.id] : []);
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<Disposal["method"]>("Lelang");
  const [estimate, setEstimate] = useState<string>("");
  const [files, setFiles] = useState<{ name: string; size: number }[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const selected = assetIds.map((id) => db.assets.find((a) => a.id === id)!).filter(Boolean);
  const bookTotal = selected.reduce((n, a) => n + depreciation(a).bookValue, 0);
  const estimatedValue = estimate === "" ? Math.round(bookTotal) : Number(estimate.replace(/\D/g, "")) || 0;
  const inMaintenance = selected.filter((a) => a.status === "Dalam Pemeliharaan");

  const errors: Record<string, string> = {};
  if (!assetIds.length) errors.assets = "Pilih minimal satu aset.";
  if (reason.trim().length < 15) errors.reason = "Jelaskan alasan penghapusan (minimal 15 karakter).";
  if (!files.length) errors.files = "Lampirkan minimal satu dokumen pendukung (mis. berita acara pemeriksaan).";
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) { toast.error("Periksa kembali isian formulir"); return; }
    const no = nextNo(db.disposals.map((d) => d.no), `PHP-${new Date().getFullYear()}`);
    const id = uid("php");
    const now = new Date().toISOString();
    const d: Disposal = {
      id, no, assetIds, reason: reason.trim(), method, estimatedValue, createdBy: user.id, createdAt: now, status: "diajukan",
      approvals: disposalSteps(), attachments: files.map((f) => f.name),
    };
    mutate((db2) => {
      db2.disposals.unshift(d);
      db2.assets.forEach((a) => { if (assetIds.includes(a.id)) { a.status = "Diusulkan Hapus"; a.updatedAt = now; } });
    }, { action: "Mengajukan", module: "Penghapusan", ref: no, detail: `${assetIds.length} aset · ${method}` });
    notify({ role: "petugas", title: "Usulan penghapusan perlu verifikasi", body: `${no} · ${assetIds.length} aset · ${method}`, href: `/penghapusan/detail?id=${id}` });
    toast.success(`${no} berhasil diajukan`);
    router.push(`/penghapusan/detail?id=${id}`);
  };

  return (
    <>
      <PageHeader back="/penghapusan" title="Usulkan Penghapusan Aset" subtitle="Usulan melalui 4 tahap: Verifikasi Petugas Aset → Pemeriksaan Teknis → Reviu Inspektorat → Persetujuan Pimpinan" />
      <div className="layout-main-side">
        <Panel title="Aset yang diusulkan" subtitle="Aset berstatus Aktif atau Dalam Pemeliharaan. Nilai buku dihitung dengan penyusutan garis lurus.">
          <AssetPicker db={db} candidates={candidates} selected={assetIds} onChange={setAssetIds} showBookValue />
          {err("assets") && <div className="field-error" style={{ marginTop: 8 }}>{err("assets")}</div>}
          {selected.length > 0 && (
            <div className="row" style={{ justifyContent: "space-between", background: "var(--panel)", borderRadius: 9, padding: "10px 14px", marginTop: 12, fontSize: 12.5, fontWeight: 700 }}>
              <span>{selected.length} aset dipilih</span>
              <span>Total nilai buku: {formatRupiah(bookTotal)}</span>
            </div>
          )}
          {inMaintenance.length > 0 && (
            <div className="alert warning" style={{ marginTop: 12, marginBottom: 0 }}><Icon name="alert" />{inMaintenance.length} aset masih dalam pemeliharaan. Pastikan work order terkait dibatalkan atau diselesaikan.</div>
          )}
        </Panel>

        <Panel title="Detail usulan">
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <Field label="Metode penghapusan" required>
              <select className="select" value={method} onChange={(e) => setMethod(e.target.value as Disposal["method"])}>
                {METHODS.map((m) => <option key={m.id} value={m.id}>{m.id} — {m.desc}</option>)}
              </select>
            </Field>
            <Field label="Estimasi nilai" hint={estimate === "" ? "Otomatis dari total nilai buku. Ubah bila ada hasil penilaian (appraisal)." : "Nilai diisi manual."}>
              <div className="input-affix">
                <span>Rp</span>
                <input className="input" inputMode="numeric" value={estimate === "" ? Math.round(bookTotal).toLocaleString("id-ID") : Number(estimate || 0).toLocaleString("id-ID")}
                  onChange={(e) => setEstimate(e.target.value.replace(/\D/g, ""))} />
              </div>
            </Field>
            <Field label="Alasan penghapusan" required error={err("reason")}>
              <textarea className={`textarea ${err("reason") ? "invalid" : ""}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: rusak berat, biaya perbaikan melebihi 50% nilai perolehan berdasarkan hasil pemeriksaan teknis…" />
            </Field>
            <Field label="Dokumen pendukung" required error={err("files")}>
              <FileDrop files={files} onChange={setFiles} />
            </Field>
          </div>
          <div className="row" style={{ marginTop: 18, justifyContent: "flex-end" }}>
            <button className="btn btn-plain" onClick={() => router.push("/penghapusan")}>Batal</button>
            <button className="btn btn-primary" onClick={submit}><Icon name="check" />Ajukan usulan</button>
          </div>
        </Panel>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["admin", "petugas"]}>
      <Suspense fallback={null}><NewDisposalForm /></Suspense>
    </RequireRole>
  );
}
