"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CATEGORY_ICON, Icon } from "@/components/Icon";
import { ApprovalStages, Badge, ConfirmDialog, EmptyState, KV, Modal, PageHeader, Panel, toast } from "@/components/ui";
import { ApprovalActions } from "@/components/workflow/ApprovalActions";
import { PrintHeader, SignatureBlocks } from "@/components/workflow/PrintHeader";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import { APPROVAL_TONE, CONDITION_TONE, STATUS_LABEL, categoryName, currentStep, locationName, unitName, userName } from "@/lib/domain";
import { can } from "@/lib/permissions";
import { daysUntil, formatDate, formatDateLong, formatDateTime } from "@/lib/format";
import { isOverdue } from "@/lib/workflow";
import type { Condition } from "@/lib/types";

const CONDITIONS: Condition[] = ["Baik", "Rusak Ringan", "Rusak Berat"];

function TransferDetail() {
  const db = useDB();
  const user = useCurrentUser()!;
  const mutate = useStore((s) => s.mutate);
  const notify = useStore((s) => s.notify);
  const id = useSearchParams().get("id") ?? "";
  const t = db.transfers.find((x) => x.id === id);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnCond, setReturnCond] = useState<Record<string, Condition>>({});

  if (!t) {
    return (
      <>
        <PageHeader back="/mutasi" title="Dokumen tidak ditemukan" />
        <div className="panel"><EmptyState icon="transfer" title="Dokumen mutasi/peminjaman tidak ditemukan"><Link className="link" href="/mutasi">Kembali ke daftar</Link></EmptyState></div>
      </>
    );
  }

  const isLoan = t.type === "pinjam";
  const label = isLoan ? "Peminjaman" : "Mutasi";
  const assets = t.assetIds.map((aid) => db.assets.find((a) => a.id === aid)).filter((a) => !!a);
  const step = t.status === "diajukan" ? currentStep(t.approvals) : undefined;
  const canHandover = can(user.role, "transfer.handover");
  const overdue = isOverdue(t);
  const lastApprover = t.approvals[t.approvals.length - 1];

  const doHandover = () => {
    const targetLoc = t.toLocationId ?? db.locations.find((l) => l.unitId === t.toUnitId)?.id;
    const now = new Date().toISOString();
    mutate((d) => {
      const r = d.transfers.find((x) => x.id === t.id)!;
      r.status = "diserahkan";
      r.handoverAt = now;
      d.assets.forEach((a) => {
        if (!t.assetIds.includes(a.id)) return;
        if (isLoan) a.status = "Dipinjam";
        else { a.unitId = t.toUnitId; if (targetLoc) a.locationId = targetLoc; }
        a.updatedAt = now;
      });
    }, { action: "Serah terima", module: label, ref: t.no, detail: `BAST ${assets.length} aset ke ${unitName(db, t.toUnitId)}` });
    notify({ userId: t.requestedBy, title: `${label} telah diserahterimakan`, body: `${t.no} · BAST ditandatangani`, href: `/mutasi/detail?id=${t.id}` });
    toast.success("Serah terima tercatat. Berita acara siap dicetak.");
  };

  const doReturn = () => {
    const now = new Date().toISOString();
    mutate((d) => {
      const r = d.transfers.find((x) => x.id === t.id)!;
      r.status = "dikembalikan";
      r.returnedAt = now;
      d.assets.forEach((a) => {
        if (!t.assetIds.includes(a.id)) return;
        a.status = "Aktif";
        a.condition = returnCond[a.id] ?? a.condition;
        a.updatedAt = now;
      });
    }, { action: "Menerima pengembalian", module: label, ref: t.no, detail: `${assets.length} aset kembali ke ${unitName(db, t.fromUnitId)}` });
    toast.success("Pengembalian aset tercatat");
    setReturnOpen(false);
  };

  const statusText = isLoan && t.status === "diserahkan" ? "Dipinjam" : !isLoan && t.status === "diserahkan" ? "Selesai diserahkan" : STATUS_LABEL[t.status];

  return (
    <>
      <PrintHeader title={`Berita Acara Serah Terima ${label} Aset`} docNo={t.no} />
      <PageHeader
        back="/mutasi"
        breadcrumb={<><Link href="/mutasi">Mutasi & Peminjaman</Link> / {t.no}</>}
        title={<>{t.no} <span style={{ verticalAlign: "middle" }}><Badge tone={APPROVAL_TONE[t.status]}>{statusText}</Badge></span></>}
        subtitle={`${label} · diajukan ${formatDateTime(t.requestedAt)} oleh ${userName(db, t.requestedBy)}`}
        actions={<>
          {(t.status === "diserahkan" || t.status === "dikembalikan") && (
            <button className="btn btn-secondary" onClick={() => window.print()}><Icon name="printer" />Cetak BAST</button>
          )}
          {t.status === "disetujui" && canHandover && (
            <button className="btn btn-primary" onClick={() => setHandoverOpen(true)}><Icon name="clipboard" />Serah Terima (BAST)</button>
          )}
          {isLoan && t.status === "diserahkan" && canHandover && (
            <button className="btn btn-primary" onClick={() => { setReturnCond(Object.fromEntries(assets.map((a) => [a.id, a.condition]))); setReturnOpen(true); }}><Icon name="refresh" />Terima Pengembalian</button>
          )}
        </>}
      />

      {overdue && (
        <div className="alert critical"><Icon name="alert" />Peminjaman ini melewati tanggal kembali ({formatDate(t.returnDate)}) sejak {-daysUntil(t.returnDate!)} hari lalu.</div>
      )}
      {t.status === "disetujui" && (
        <div className="alert info no-print"><Icon name="info" />Pengajuan telah disetujui. Lakukan serah terima (BAST) saat aset diserahkan kepada satuan tujuan.</div>
      )}

      <div className="layout-main-side">
        <div className="stack">
          <Panel title="Ringkasan">
            <div className="kv-grid cols-3">
              <KV label="Jenis">{isLoan ? "Peminjaman sementara" : "Mutasi permanen"}</KV>
              <KV label="Satuan asal">{unitName(db, t.fromUnitId)}</KV>
              <KV label="Satuan tujuan">{unitName(db, t.toUnitId)}{t.toLocationId && <div className="cell-sub">{locationName(db, t.toLocationId)}</div>}</KV>
              <KV label="Tanggal mulai">{formatDate(t.startDate)}</KV>
              {isLoan && <KV label="Tanggal kembali">{formatDate(t.returnDate)}</KV>}
              <KV label="Serah terima">{t.handoverAt ? formatDateTime(t.handoverAt) : "Belum"}</KV>
              {isLoan && <KV label="Dikembalikan">{t.returnedAt ? formatDateTime(t.returnedAt) : "Belum"}</KV>}
              <KV label="Pengaju">{userName(db, t.requestedBy)}</KV>
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="kv-label">Alasan / dasar pengajuan</div>
              <div style={{ fontSize: 13.5 }}>{t.reason}</div>
            </div>
          </Panel>

          <Panel title={`Daftar aset (${assets.length})`}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>No</th><th>Kode / Nama aset</th><th>Kategori</th><th>Lokasi saat ini</th><th>Kondisi</th></tr></thead>
                <tbody>
                  {assets.map((a, i) => (
                    <tr key={a.id}>
                      <td>{i + 1}</td>
                      <td>
                        <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                          <div className="thumb no-print"><Icon name={CATEGORY_ICON[a.categoryId]} /></div>
                          <div>
                            <Link className="cell-strong" href={`/aset/detail?id=${a.id}`}>{a.name}</Link>
                            <div className="cell-sub">{a.code}{a.registration ? ` · ${a.registration}` : ""}</div>
                          </div>
                        </div>
                      </td>
                      <td>{categoryName(db, a.categoryId)}</td>
                      <td>{unitName(db, a.unitId)}<div className="cell-sub">{locationName(db, a.locationId)}</div></td>
                      <td><Badge tone={CONDITION_TONE[a.condition]}>{a.condition}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="print-only" style={{ fontSize: 11.5 }}>
            <p>
              Pada {formatDateLong(t.handoverAt ?? new Date())}, telah dilaksanakan serah terima {isLoan ? "pinjam pakai" : "mutasi"} aset
              sebagaimana daftar di atas dari <b>{unitName(db, t.fromUnitId)}</b> (Pihak Pertama) kepada <b>{unitName(db, t.toUnitId)}</b> (Pihak Kedua)
              {isLoan && t.returnDate ? `, untuk jangka waktu sampai dengan ${formatDateLong(t.returnDate)}` : ""}. Pihak Kedua bertanggung jawab atas
              penggunaan dan pemeliharaan aset tersebut sejak tanggal serah terima.
            </p>
          </div>
          <SignatureBlocks blocks={[
            { role: "Pihak Pertama", sub: unitName(db, t.fromUnitId) },
            { role: "Pihak Kedua", name: userName(db, t.requestedBy), sub: unitName(db, t.toUnitId) },
            { role: "Mengetahui", name: lastApprover?.by ? userName(db, lastApprover.by) : undefined, sub: "Pejabat Penyetuju" },
          ]} />
        </div>

        <div className="stack no-print">
          <Panel title="Jalur persetujuan" subtitle={step ? `Menunggu: ${step.title}` : `${t.approvals.length} tahap`}>
            <ApprovalStages db={db} steps={t.approvals} />
            <div style={{ marginTop: 16 }} className="desktop-only"><ApprovalActions kind="transfer" id={t.id} /></div>
          </Panel>
        </div>
      </div>
      <div className="mobile-only"><ApprovalActions kind="transfer" id={t.id} variant="sticky" /></div>

      <ConfirmDialog
        open={handoverOpen}
        onClose={() => setHandoverOpen(false)}
        title="Catat serah terima (BAST)?"
        message={isLoan
          ? `${assets.length} aset akan berstatus Dipinjam oleh ${unitName(db, t.toUnitId)} hingga dikembalikan.`
          : `${assets.length} aset akan dipindahkan ke ${unitName(db, t.toUnitId)}${t.toLocationId ? ` (${locationName(db, t.toLocationId)})` : ""}.`}
        confirmLabel="Catat serah terima"
        onConfirm={doHandover}
      />

      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} title="Terima pengembalian aset" subtitle="Periksa dan catat kondisi setiap aset saat diterima kembali."
        footer={<><button className="btn btn-plain" onClick={() => setReturnOpen(false)}>Batal</button><button className="btn btn-primary" onClick={doReturn}>Simpan pengembalian</button></>}>
        <div className="stack" style={{ gap: 10 }}>
          {assets.map((a) => (
            <div key={a.id} className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
              <div style={{ minWidth: 0 }}>
                <div className="cell-strong" style={{ fontSize: 13 }}>{a.name}</div>
                <div className="cell-sub">{a.code} · sebelumnya {a.condition}</div>
              </div>
              <select className="select" style={{ width: 150 }} value={returnCond[a.id] ?? a.condition} onChange={(e) => setReturnCond({ ...returnCond, [a.id]: e.target.value as Condition })}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

export default function Page() {
  return <Suspense fallback={null}><TransferDetail /></Suspense>;
}
