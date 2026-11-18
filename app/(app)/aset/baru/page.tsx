"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileDrop, KV, PageHeader, toast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { QRCode } from "@/components/QRCode";
import { RequireRole } from "@/components/RequireRole";
import {
  IdentitySection, LocationSection, SpecSection, draftToAssetFields, emptyDraft, validate,
  type AssetDraft, type DraftErrors, type Section,
} from "@/components/aset/AssetForm";
import { uid, useCurrentUser, useDB, useMutate } from "@/lib/store";
import { categoryName, locationName, nextAssetCode, unitName, userName } from "@/lib/domain";
import { formatRupiah } from "@/lib/format";
import type { Asset } from "@/lib/types";

const STEPS: { id: Section | "dokumen"; label: string; sub: string }[] = [
  { id: "identitas", label: "Identitas Aset", sub: "Kategori, nama, nomor seri, dan registrasi" },
  { id: "spesifikasi", label: "Spesifikasi & Nilai", sub: "Nilai perolehan, umur ekonomis, kondisi, dan spesifikasi teknis" },
  { id: "lokasi", label: "Lokasi & Penanggung Jawab", sub: "Satuan pemilik, lokasi penempatan, dan personel penanggung jawab" },
  { id: "dokumen", label: "Dokumen & Label QR", sub: "Unggah dokumen pendukung, lalu tinjau ringkasan dan label QR" },
];

function Wizard() {
  const db = useDB();
  const user = useCurrentUser()!;
  const mutate = useMutate();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<AssetDraft>(() => emptyDraft({ unitId: user.unitId, picId: user.id }));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [files, setFiles] = useState<{ name: string; size: number }[]>([]);
  const set = (patch: Partial<AssetDraft>) => setD((x) => ({ ...x, ...patch }));

  const year = Number(d.year) || new Date().getFullYear();
  const code = useMemo(() => (d.categoryId ? nextAssetCode(db, d.categoryId, year) : ""), [db, d.categoryId, year]);

  const check = (i: number) => {
    const s = STEPS[i].id;
    if (s === "dokumen") return true;
    const e = validate(d, s, db);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Periksa kembali isian yang ditandai.");
      return false;
    }
    return true;
  };
  const next = () => { if (check(step)) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  const prev = () => { setErrors({}); setStep(Math.max(0, step - 1)); };
  const goTo = (i: number) => {
    if (i <= step) { setErrors({}); setStep(i); return; }
    for (let k = step; k < i; k++) if (!check(k)) { setStep(k); return; }
    setStep(i);
  };

  const save = () => {
    for (let k = 0; k < 3; k++) if (!check(k)) { setStep(k); return; }
    const now = new Date().toISOString();
    const id = uid("ast");
    const asset: Asset = {
      ...draftToAssetFields(d),
      id,
      code,
      documents: files.map((f) => ({ id: uid("doc"), name: f.name, size: f.size, uploadedAt: now, uploadedBy: user.id })),
      createdAt: now,
      updatedAt: now,
    };
    mutate((db) => { db.assets.unshift(asset); }, { action: "Mendaftarkan", module: "Aset", ref: code, detail: asset.name });
    toast.success(`Aset ${code} berhasil didaftarkan`);
    router.push(`/aset/detail?id=${id}`);
  };

  const fields = draftToAssetFields(d);

  return (
    <>
      <PageHeader title="Pendaftaran Aset Baru" subtitle="Lengkapi 4 langkah berikut untuk mencatat aset ke dalam sistem" back="/aset" />
      <div className="panel">
        <div className="stepper">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`step ${i < step ? "done" : i === step ? "active" : ""}`} onClick={() => goTo(i)} style={{ cursor: "pointer" }}>
              <div className="step-line" />
              <div className="step-circle">{i < step ? <Icon name="check" /> : i + 1}</div>
              <div className="step-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="section-title">{STEPS[step].label}</div>
        <div className="section-sub">{STEPS[step].sub}</div>

        {step === 0 && <IdentitySection d={d} set={set} errors={errors} db={db} code={code} />}
        {step === 1 && <SpecSection d={d} set={set} errors={errors} db={db} />}
        {step === 2 && <LocationSection d={d} set={set} errors={errors} db={db} />}
        {step === 3 && (
          <div className="layout-main-side">
            <div className="stack">
              <div>
                <div className="form-label" style={{ marginBottom: 6 }}>Foto & Dokumen Pendukung</div>
                <FileDrop files={files} onChange={setFiles} hint="Foto aset, BAST, faktur, sertifikat, manual · maks. 10 MB per file" />
              </div>
              <div>
                <div className="form-label" style={{ marginBottom: 8 }}>Ringkasan</div>
                <div className="kv-grid" style={{ background: "var(--panel)", borderRadius: 10, padding: 14 }}>
                  <KV label="Nama">{fields.name}</KV>
                  <KV label="Kategori">{categoryName(db, d.categoryId)}</KV>
                  <KV label="Merek / Model">{fields.brand} · {fields.model}</KV>
                  <KV label="Registrasi">{fields.registration ?? "-"}</KV>
                  <KV label="Nilai Perolehan">{formatRupiah(fields.acquisitionValue)}</KV>
                  <KV label="Umur Ekonomis">{fields.usefulLife ? `${fields.usefulLife} tahun` : "Tidak disusutkan"}</KV>
                  <KV label="Satuan">{unitName(db, d.unitId)}</KV>
                  <KV label="Lokasi">{locationName(db, d.locationId)}</KV>
                  <KV label="Penanggung Jawab">{userName(db, d.picId)}</KV>
                  <KV label="Kondisi">{d.condition}</KV>
                </div>
              </div>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 8 }}>Pratinjau Label QR</div>
              <div className="qr-label" style={{ width: "100%" }}>
                <QRCode value={code} />
                <div className="qr-code-text">{code}</div>
                <div className="qr-code-sub">{fields.name}</div>
                <div className="qr-code-sub">{unitName(db, d.unitId)}</div>
              </div>
              <div className="field-hint" style={{ marginTop: 8 }}>Label dapat dicetak dari halaman detail aset setelah disimpan.</div>
            </div>
          </div>
        )}

        <div className="row" style={{ marginTop: 22, justifyContent: "space-between" }}>
          <button className="btn btn-plain" onClick={() => (step === 0 ? router.push("/aset") : prev())}>
            <Icon name="arrowLeft" />{step === 0 ? "Batal" : "Sebelumnya"}
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={next}>Lanjut<Icon name="arrowRight" /></button>
          ) : (
            <button className="btn btn-primary" onClick={save}><Icon name="check" />Simpan Aset</button>
          )}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["admin", "petugas"]}>
      <Wizard />
    </RequireRole>
  );
}
