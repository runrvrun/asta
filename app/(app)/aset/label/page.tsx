"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { QRCode } from "@/components/QRCode";
import { useDB } from "@/lib/store";
import { categoryName, unitName } from "@/lib/domain";
import styles from "./label.module.css";

function LabelSheet() {
  const db = useDB();
  const ids = (useSearchParams().get("ids") ?? "").split(",").filter(Boolean);
  const assets = ids.map((id) => db.assets.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a);

  return (
    <>
      <PageHeader title="Cetak Label QR" subtitle={`${assets.length} label · kertas A4, 3 kolom`} back
        actions={assets.length > 0 && <button className="btn btn-primary" onClick={() => window.print()}><Icon name="printer" />Cetak</button>} />
      {assets.length === 0 ? (
        <div className="panel"><EmptyState icon="scan" title="Tidak ada aset dipilih">Pilih aset dari <Link className="link" href="/aset">daftar aset</Link>, lalu klik “Cetak Label QR”.</EmptyState></div>
      ) : (
        <>
          <div className="alert info no-print"><Icon name="info" />Gunakan pengaturan cetak “Skala 100%” agar ukuran label sesuai (±6 × 7 cm per label).</div>
          <div className={styles.sheet}>
            {assets.map((a) => (
              <div key={a.id} className={styles.label}>
                <div className={styles.head}><span className={styles.brand}>ASTA</span><span>{unitName(db, a.unitId)}</span></div>
                <QRCode value={a.code} size={130} />
                <div className="qr-code-text">{a.code}</div>
                <div className={styles.name}>{a.name}</div>
                <div className={styles.meta}>{categoryName(db, a.categoryId)}{a.registration ? ` · ${a.registration}` : ""}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LabelSheet />
    </Suspense>
  );
}
