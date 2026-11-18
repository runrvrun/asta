"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState, PageHeader, Panel, toast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { RequireRole } from "@/components/RequireRole";
import {
  IdentitySection, LocationSection, SpecSection, draftFromAsset, draftToAssetFields, validate,
  type AssetDraft, type DraftErrors,
} from "@/components/aset/AssetForm";
import { useDB, useMutate } from "@/lib/store";
import { locationName, unitName, userName } from "@/lib/domain";
import type { Asset, DB } from "@/lib/types";

/** Human-readable list of changed fields for the audit log. */
function describeChanges(db: DB, before: Asset, after: Partial<Asset>) {
  const out: string[] = [];
  const cmp = (label: string, a: unknown, b: unknown, fmt: (v: unknown) => string = (v) => String(v ?? "-")) => {
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) out.push(`${label}: ${fmt(a)} → ${fmt(b)}`);
  };
  cmp("Nama", before.name, after.name);
  cmp("Status", before.status, after.status);
  cmp("Kondisi", before.condition, after.condition);
  cmp("Satuan", before.unitId, after.unitId, (v) => unitName(db, v as string));
  cmp("Lokasi", before.locationId, after.locationId, (v) => locationName(db, v as string));
  cmp("Penanggung jawab", before.picId, after.picId, (v) => userName(db, v as string));
  cmp("Nilai perolehan", before.acquisitionValue, after.acquisitionValue);
  if (JSON.stringify(before.specs) !== JSON.stringify(after.specs)) out.push("Spesifikasi diperbarui");
  if (JSON.stringify(before.aviation ?? null) !== JSON.stringify(after.aviation ?? null)) out.push("Data kelaikan diperbarui");
  return out.join("; ") || "Tanpa perubahan data utama";
}

function EditForm({ asset }: { asset: Asset }) {
  const db = useDB();
  const mutate = useMutate();
  const router = useRouter();
  const [d, setD] = useState<AssetDraft>(() => draftFromAsset(asset));
  const [errors, setErrors] = useState<DraftErrors>({});
  const set = (patch: Partial<AssetDraft>) => setD((x) => ({ ...x, ...patch }));

  const save = () => {
    const e = { ...validate(d, "identitas", db, asset.id), ...validate(d, "spesifikasi", db, asset.id), ...validate(d, "lokasi", db, asset.id) };
    setErrors(e);
    if (Object.keys(e).length) { toast.error("Periksa kembali isian yang ditandai."); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const fields = draftToAssetFields(d);
    const detail = describeChanges(db, asset, fields);
    mutate((db) => {
      const x = db.assets.find((y) => y.id === asset.id);
      if (x) Object.assign(x, fields, { updatedAt: new Date().toISOString() });
    }, { action: "Mengubah", module: "Aset", ref: asset.code, detail });
    toast.success("Perubahan disimpan");
    router.push(`/aset/detail?id=${asset.id}`);
  };

  return (
    <>
      <PageHeader title={`Ubah ${asset.name}`} subtitle={asset.code} back={`/aset/detail?id=${asset.id}`}
        actions={<>
          <Link className="btn btn-plain" href={`/aset/detail?id=${asset.id}`}>Batal</Link>
          <button className="btn btn-primary" onClick={save}><Icon name="check" />Simpan Perubahan</button>
        </>} />
      <Panel title="Identitas Aset"><IdentitySection d={d} set={set} errors={errors} db={db} code={asset.code} /></Panel>
      <Panel title="Spesifikasi & Nilai"><SpecSection d={d} set={set} errors={errors} db={db} showStatus /></Panel>
      <Panel title="Lokasi & Penanggung Jawab">
        <div className="alert info"><Icon name="info" />Perpindahan antarsatuan sebaiknya diajukan melalui menu Mutasi agar tercatat dengan berita acara serah terima.</div>
        <LocationSection d={d} set={set} errors={errors} db={db} />
      </Panel>
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
        <Link className="btn btn-plain" href={`/aset/detail?id=${asset.id}`}>Batal</Link>
        <button className="btn btn-primary" onClick={save}><Icon name="check" />Simpan Perubahan</button>
      </div>
    </>
  );
}

function EditPage() {
  const db = useDB();
  const id = useSearchParams().get("id") ?? "";
  const asset = db.assets.find((a) => a.id === id);
  if (!asset) {
    return (
      <>
        <PageHeader title="Aset tidak ditemukan" back="/aset" />
        <div className="panel"><EmptyState icon="search" title="Data aset tidak ditemukan"><Link className="link" href="/aset">Kembali ke daftar aset</Link></EmptyState></div>
      </>
    );
  }
  // key: reset the form if the user navigates to another asset's edit page.
  return <EditForm key={asset.id} asset={asset} />;
}

export default function Page() {
  return (
    <RequireRole roles={["admin", "petugas"]}>
      <Suspense fallback={null}>
        <EditPage />
      </Suspense>
    </RequireRole>
  );
}
