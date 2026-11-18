"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CATEGORY_ICON, Icon } from "@/components/Icon";
import { ApprovalStages, Badge, EmptyState, PageHeader, Panel } from "@/components/ui";
import { ApprovalActions } from "@/components/workflow/ApprovalActions";
import { PrintHeader, SignatureBlocks } from "@/components/workflow/PrintHeader";
import { useDB } from "@/lib/store";
import { APPROVAL_TONE, ASSET_STATUS_TONE, CONDITION_TONE, STATUS_LABEL, categoryName, currentStep, depreciation, unitName, userName } from "@/lib/domain";
import { formatDate, formatRupiah } from "@/lib/format";

function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="kv-label">{label}</div>
      <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 14.5, color: "var(--navy)" }}>{children}</div>
    </div>
  );
}

function DisposalDetail() {
  const db = useDB();
  const id = useSearchParams().get("id") ?? "";
  const d = db.disposals.find((x) => x.id === id);

  if (!d) {
    return (
      <>
        <PageHeader back="/penghapusan" title="Usulan tidak ditemukan" />
        <div className="panel"><EmptyState icon="trash" title="Usulan penghapusan tidak ditemukan"><Link className="link" href="/penghapusan">Kembali</Link></EmptyState></div>
      </>
    );
  }

  const assets = d.assetIds.map((aid) => db.assets.find((a) => a.id === aid)).filter((a) => !!a);
  const bookTotal = assets.reduce((n, a) => n + depreciation(a).bookValue, 0);
  const step = d.status === "diajukan" ? currentStep(d.approvals) : undefined;
  const creator = db.users.find((u) => u.id === d.createdBy);
  const rejected = d.approvals.find((s) => s.status === "ditolak");

  return (
    <>
      <PrintHeader title="Usulan Penghapusan Barang Milik Negara" docNo={d.no} />
      <PageHeader
        back="/penghapusan"
        breadcrumb={<><Link href="/penghapusan">Penghapusan Aset</Link> / {d.no}</>}
        title={<>Usulan {d.no} <span style={{ verticalAlign: "middle" }}><Badge tone={APPROVAL_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge></span></>}
        subtitle={step ? `Menunggu ${step.title}` : d.status === "disetujui" ? "Disetujui seluruh tahap · aset berstatus Dihapus" : "Usulan ditolak · aset dikembalikan ke status Aktif"}
        actions={<button className="btn btn-secondary" onClick={() => window.print()}><Icon name="printer" />Cetak</button>}
      />

      {rejected && (
        <div className="alert critical"><Icon name="alert" /><div><b>Ditolak pada tahap {rejected.title}</b> oleh {userName(db, rejected.by)}: “{rejected.note}”</div></div>
      )}

      <div style={{ background: "var(--panel2)", borderRadius: "var(--radius)", padding: 18, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
          <SummaryItem label="Pengusul">
            <span style={{ fontSize: 13 }}>{userName(db, d.createdBy)}</span>
            <div className="cell-sub" style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}>{creator?.position}</div>
          </SummaryItem>
          <SummaryItem label="Tanggal usulan"><span style={{ fontSize: 13 }}>{formatDate(d.createdAt)}</span></SummaryItem>
          <SummaryItem label="Metode">{d.method}</SummaryItem>
          <SummaryItem label="Jumlah aset">{d.assetIds.length} unit</SummaryItem>
          <SummaryItem label="Total nilai buku">{formatRupiah(bookTotal)}</SummaryItem>
          <SummaryItem label="Estimasi nilai">{formatRupiah(d.estimatedValue)}</SummaryItem>
        </div>
      </div>

      <div className="layout-main-side">
        <div className="stack">
          <Panel title="Aset yang diusulkan penghapusan" subtitle="Tinjau kondisi dan nilai setiap unit sebelum memberikan keputusan">
            {assets.length === 0 ? (
              <EmptyState icon="box" title="Tidak ada aset tercatat">Usulan ini merujuk pada barang yang tidak tercatat sebagai aset individual.</EmptyState>
            ) : (
              <>
                <div className="table-wrap desktop-only">
                  <table className="table">
                    <thead><tr><th></th><th>Kode / Nama aset</th><th>Satuan</th><th>Kondisi</th><th>Status</th><th className="text-right">Nilai perolehan</th><th className="text-right">Nilai buku</th></tr></thead>
                    <tbody>
                      {assets.map((a) => (
                        <tr key={a.id}>
                          <td><div className="thumb"><Icon name={CATEGORY_ICON[a.categoryId]} /></div></td>
                          <td><Link className="cell-strong" href={`/aset/detail?id=${a.id}`}>{a.name}</Link><div className="cell-sub">{a.code} · {categoryName(db, a.categoryId)}</div></td>
                          <td>{unitName(db, a.unitId)}</td>
                          <td><Badge tone={CONDITION_TONE[a.condition]}>{a.condition}</Badge></td>
                          <td><Badge tone={ASSET_STATUS_TONE[a.status]}>{a.status}</Badge></td>
                          <td className="text-right nowrap">{formatRupiah(a.acquisitionValue)}</td>
                          <td className="text-right nowrap">{formatRupiah(depreciation(a).bookValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr><td colSpan={6}>Total nilai buku</td><td className="text-right nowrap">{formatRupiah(bookTotal)}</td></tr></tfoot>
                  </table>
                </div>
                <div className="mobile-only">
                  {assets.map((a) => (
                    <Link key={a.id} href={`/aset/detail?id=${a.id}`} className="list-card">
                      <div className="list-card-top">
                        <div className="row" style={{ flexWrap: "nowrap", gap: 10 }}>
                          <div className="thumb"><Icon name={CATEGORY_ICON[a.categoryId]} /></div>
                          <div><div className="list-card-title">{a.name}</div><div className="cell-sub">{a.code}</div></div>
                        </div>
                      </div>
                      <div className="row"><Badge tone={CONDITION_TONE[a.condition]}>{a.condition}</Badge><Badge tone={ASSET_STATUS_TONE[a.status]}>{a.status}</Badge></div>
                      <div className="list-card-grid">
                        <div><b>{formatRupiah(depreciation(a).bookValue)}</b>Nilai buku</div>
                        <div><b>{unitName(db, a.unitId)}</b>Satuan</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--panel)" }}>
              <div className="kv-label">Alasan penghapusan</div>
              <div style={{ fontSize: 13.5 }}>{d.reason}</div>
            </div>
            <div className="desktop-only" style={{ marginTop: 18 }}><ApprovalActions kind="disposal" id={d.id} /></div>
          </Panel>
          <SignatureBlocks blocks={[
            { role: "Pengusul", name: userName(db, d.createdBy), sub: creator?.position },
            ...d.approvals.filter((s) => s.status === "disetujui").slice(-1).map((s) => ({ role: s.title, name: userName(db, s.by) })),
          ]} />
        </div>

        <div className="stack">
          <Panel title="Jalur persetujuan berjenjang" subtitle={`${d.approvals.length} tahap persetujuan sebelum penghapusan final`}>
            <ApprovalStages db={db} steps={d.approvals} />
          </Panel>
          <Panel title="Lampiran">
            {d.attachments.length === 0 && <div className="muted small">Tidak ada lampiran.</div>}
            {d.attachments.map((f) => (
              <div key={f} className="attach-item"><Icon name="file" />{f}</div>
            ))}
          </Panel>
        </div>
      </div>
      <div className="mobile-only"><ApprovalActions kind="disposal" id={d.id} variant="sticky" /></div>
    </>
  );
}

export default function Page() {
  return <Suspense fallback={null}><DisposalDetail /></Suspense>;
}
