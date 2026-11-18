"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, ConfirmDialog, EmptyState, FileDrop, KV, PageHeader, Panel, Tabs, toast } from "@/components/ui";
import { CATEGORY_ICON, Icon } from "@/components/Icon";
import { QRCode } from "@/components/QRCode";
import { uid, useCurrentUser, useDB, useMutate } from "@/lib/store";
import { can } from "@/lib/permissions";
import {
  AIRWORTHINESS_TONE, APPROVAL_TONE, ASSET_STATUS_TONE, CONDITION_TONE, PRIORITY_TONE, STATUS_LABEL, WO_STATUS_LABEL, WO_STATUS_TONE,
  categoryName, depreciation, inspectionStatus, locationName, unitName, userName,
} from "@/lib/domain";
import { formatBytes, formatDate, formatDateTime, formatNumber, formatRupiah } from "@/lib/format";
import type { Asset, DB } from "@/lib/types";

type TabId = "ringkasan" | "kelaikan" | "pemeliharaan" | "riwayat" | "dokumen" | "label";

interface HistoryItem { at: string; text: string; meta: string; tone?: "warning" | "critical" | "pending"; href?: string }

function buildHistory(db: DB, a: Asset): HistoryItem[] {
  const items: HistoryItem[] = [];
  for (const e of db.audit) {
    if (e.ref !== a.code && e.ref !== a.registration) continue;
    items.push({ at: e.at, text: `${e.action}${e.detail ? ` — ${e.detail}` : ""}`, meta: `${e.module} · ${userName(db, e.userId)}` });
  }
  for (const w of db.workOrders.filter((w) => w.assetId === a.id)) {
    items.push({ at: w.createdAt, text: `Work order ${w.no} dibuat: ${w.title}`, meta: `Pemeliharaan · ${userName(db, w.createdBy)}`, href: `/pemeliharaan/detail?id=${w.id}` });
    if (w.completedAt) items.push({ at: w.completedAt, text: `Work order ${w.no} selesai`, meta: "Pemeliharaan", href: `/pemeliharaan/detail?id=${w.id}` });
  }
  for (const t of db.transfers.filter((t) => t.assetIds.includes(a.id))) {
    const kind = t.type === "mutasi" ? "Mutasi" : "Peminjaman";
    items.push({ at: t.requestedAt, text: `${kind} ${t.no} diajukan: ${unitName(db, t.fromUnitId)} → ${unitName(db, t.toUnitId)}`, meta: `${kind} · ${userName(db, t.requestedBy)}`, href: `/mutasi/detail?id=${t.id}` });
    if (t.status === "ditolak") {
      const rej = t.approvals.find((s) => s.status === "ditolak");
      if (rej?.at) items.push({ at: rej.at, text: `${kind} ${t.no} ditolak`, meta: userName(db, rej.by), tone: "critical", href: `/mutasi/detail?id=${t.id}` });
    }
    if (t.handoverAt) items.push({ at: t.handoverAt, text: `Serah terima ${kind.toLowerCase()} ${t.no} (BAST)`, meta: kind, href: `/mutasi/detail?id=${t.id}` });
    if (t.returnedAt) items.push({ at: t.returnedAt, text: `Aset dikembalikan (${t.no})`, meta: kind, href: `/mutasi/detail?id=${t.id}` });
  }
  for (const p of db.disposals.filter((p) => p.assetIds.includes(a.id))) {
    items.push({ at: p.createdAt, text: `Diusulkan penghapusan ${p.no} (${p.method})`, meta: `Penghapusan · ${userName(db, p.createdBy)}`, tone: "warning", href: `/penghapusan/detail?id=${p.id}` });
    if (p.status !== "diajukan") {
      const last = [...p.approvals].reverse().find((s) => s.at);
      if (last?.at) items.push({ at: last.at, text: `Usulan penghapusan ${p.no} ${p.status === "disetujui" ? "disetujui" : "ditolak"}`, meta: "Penghapusan", tone: p.status === "ditolak" ? "critical" : undefined, href: `/penghapusan/detail?id=${p.id}` });
    }
  }
  for (const s of db.stockTakes) {
    const it = s.items.find((i) => i.assetId === a.id);
    if (!it || !it.checkedAt) continue;
    items.push({
      at: it.checkedAt,
      text: `Inventarisasi ${s.no}: ${it.result === "ditemukan" ? `ditemukan (${it.condition ?? "-"})` : "tidak ditemukan"}`,
      meta: `Inventarisasi · ${userName(db, it.checkedBy)}`,
      tone: it.result === "tidak_ditemukan" ? "critical" : undefined,
      href: `/inventarisasi/detail?id=${s.id}`,
    });
  }
  items.push({ at: a.createdAt, text: "Aset tercatat dalam sistem", meta: "Aset" });
  return items.sort((x, y) => y.at.localeCompare(x.at));
}

function AssetDetail() {
  const db = useDB();
  const user = useCurrentUser()!;
  const mutate = useMutate();
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const asset = db.assets.find((a) => a.id === id);
  const [tab, setTab] = useState<TabId>("ringkasan");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newFiles, setNewFiles] = useState<{ name: string; size: number }[]>([]);
  const [removeDoc, setRemoveDoc] = useState<string | null>(null);

  const history = useMemo(() => (asset ? buildHistory(db, asset) : []), [db, asset]);

  if (!asset) {
    return (
      <>
        <PageHeader title="Aset tidak ditemukan" back="/aset" />
        <div className="panel"><EmptyState icon="search" title="Data aset tidak ditemukan">Aset mungkin telah dihapus dari sistem. <Link className="link" href="/aset">Kembali ke daftar aset</Link></EmptyState></div>
      </>
    );
  }

  const a = asset;
  const dep = depreciation(a);
  const insp = inspectionStatus(a);
  const wos = db.workOrders.filter((w) => w.assetId === a.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const flights = db.flightLogs.filter((f) => f.assetId === a.id);
  const linked = wos.length + flights.length + db.transfers.filter((t) => t.assetIds.includes(a.id)).length + db.disposals.filter((p) => p.assetIds.includes(a.id)).length + db.stockTakes.filter((s) => s.items.some((i) => i.assetId === a.id)).length;
  const canEdit = can(user.role, "asset.edit") && a.status !== "Dihapus";
  const movable = a.status === "Aktif";
  const disposable = a.status === "Aktif" || a.status === "Dalam Pemeliharaan";

  const tabs: { id: TabId; label: string }[] = [
    { id: "ringkasan", label: "Ringkasan" },
    ...(a.aviation ? [{ id: "kelaikan" as const, label: "Kelaikan" }] : []),
    { id: "pemeliharaan", label: `Pemeliharaan (${wos.length})` },
    { id: "riwayat", label: "Riwayat" },
    { id: "dokumen", label: `Dokumen (${a.documents.length})` },
    { id: "label", label: "Label QR" },
  ];

  const addDocs = () => {
    if (!newFiles.length) return;
    const now = new Date().toISOString();
    mutate((d) => {
      const x = d.assets.find((y) => y.id === a.id)!;
      x.documents.push(...newFiles.map((f) => ({ id: uid("doc"), name: f.name, size: f.size, uploadedAt: now, uploadedBy: user.id })));
      x.updatedAt = now;
    }, { action: "Mengunggah dokumen", module: "Aset", ref: a.code, detail: newFiles.map((f) => f.name).join(", ") });
    toast.success(`${newFiles.length} dokumen ditambahkan`);
    setNewFiles([]);
  };

  const deleteAsset = () => {
    mutate((d) => { d.assets = d.assets.filter((y) => y.id !== a.id); }, { action: "Menghapus data", module: "Aset", ref: a.code, detail: a.name });
    toast.success(`Data aset ${a.code} dihapus`);
    router.push("/aset");
  };

  return (
    <>
      <PageHeader
        back="/aset"
        breadcrumb={<><Link href="/aset">Daftar Aset</Link> / {categoryName(db, a.categoryId)}</>}
        title={a.name}
        subtitle={<>{a.code}{a.registration ? ` · ${a.registration}` : ""} · {unitName(db, a.unitId)}</>}
        actions={<>
          {canEdit && <Link className="btn btn-secondary" href={`/aset/edit?id=${a.id}`}><Icon name="edit" />Ubah</Link>}
          {can(user.role, "wo.create") && a.status !== "Dihapus" && <Link className="btn btn-secondary" href={`/pemeliharaan/baru?assetId=${a.id}`}><Icon name="wrench" />Buat WO</Link>}
          {can(user.role, "transfer.create") && movable && <>
            <Link className="btn btn-secondary" href={`/mutasi/baru?assetId=${a.id}`}><Icon name="transfer" />Ajukan Mutasi</Link>
            <Link className="btn btn-secondary" href={`/mutasi/baru?type=pinjam&assetId=${a.id}`}><Icon name="arrowRight" />Pinjamkan</Link>
          </>}
          {can(user.role, "disposal.create") && disposable && <Link className="btn btn-ghost" href={`/penghapusan/baru?assetId=${a.id}`}><Icon name="trash" />Usulkan Penghapusan</Link>}
          {can(user.role, "asset.delete") && <button className="btn btn-ghost" onClick={() => setConfirmDelete(true)}><Icon name="x" />Hapus Data</button>}
        </>}
      />

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: "flex-start", gap: 14 }}>
          <div className="thumb lg"><Icon name={CATEGORY_ICON[a.categoryId]} /></div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="row" style={{ gap: 6, marginBottom: 8 }}>
              <Badge tone={ASSET_STATUS_TONE[a.status]}>{a.status}</Badge>
              <Badge tone={CONDITION_TONE[a.condition]}>Kondisi: {a.condition}</Badge>
              {a.aviation && <Badge tone={AIRWORTHINESS_TONE[a.aviation.airworthiness]}>{a.aviation.airworthiness}</Badge>}
            </div>
            <div className="kv-grid cols-4">
              <KV label="Kategori">{categoryName(db, a.categoryId)}</KV>
              <KV label="Lokasi">{locationName(db, a.locationId)}</KV>
              <KV label="Penanggung Jawab">{userName(db, a.picId)}</KV>
              <KV label="Nilai Buku">{formatRupiah(dep.bookValue)}</KV>
            </div>
          </div>
        </div>
        {a.status === "Dihapus" && <div className="alert info" style={{ marginTop: 14, marginBottom: 0 }}><Icon name="info" />Aset ini telah dihapus dari daftar aset aktif dan hanya tersimpan sebagai arsip.</div>}
        {a.status === "Diusulkan Hapus" && <div className="alert warning" style={{ marginTop: 14, marginBottom: 0 }}><Icon name="alert" />Aset ini sedang dalam proses usulan penghapusan.</div>}
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "ringkasan" && (
        <div className="layout-main-side">
          <div className="stack">
            <Panel title="Identitas & Spesifikasi">
              <div className="kv-grid cols-3">
                <KV label="Kode Aset">{a.code}</KV>
                <KV label="Merek / Pabrikan">{a.brand}</KV>
                <KV label="Model / Tipe">{a.model}</KV>
                <KV label="Nomor Seri">{a.serialNumber}</KV>
                <KV label={a.categoryId === "tanah" ? "No. Sertifikat" : "No. Registrasi"}>{a.registration ?? "-"}</KV>
                <KV label="Tahun">{a.year}</KV>
                {Object.entries(a.specs).map(([k, v]) => <KV key={k} label={k}>{v}</KV>)}
                {a.aviation && <KV label="Mesin">{a.aviation.engine}</KV>}
              </div>
              {a.notes && <div style={{ marginTop: 14 }}><div className="kv-label">Catatan</div><div style={{ fontSize: 13 }}>{a.notes}</div></div>}
            </Panel>
            <Panel title="Penempatan">
              <div className="kv-grid cols-3">
                <KV label="Satuan">{unitName(db, a.unitId)}</KV>
                <KV label="Lokasi">{locationName(db, a.locationId)}</KV>
                <KV label="Penanggung Jawab">{userName(db, a.picId)}</KV>
                <KV label="Dicatat">{formatDateTime(a.createdAt)}</KV>
                <KV label="Diperbarui">{formatDateTime(a.updatedAt)}</KV>
              </div>
            </Panel>
          </div>
          <Panel title="Nilai & Penyusutan" subtitle="Metode garis lurus">
            <div className="kv-grid">
              <KV label="Tanggal Perolehan">{formatDate(a.acquisitionDate)}</KV>
              <KV label="Sumber Dana">{a.fundingSource}</KV>
              <KV label="Nilai Perolehan">{formatRupiah(a.acquisitionValue)}</KV>
              <KV label="Umur Ekonomis">{a.usefulLife ? `${a.usefulLife} tahun` : "Tidak disusutkan"}</KV>
              <KV label="Nilai Residu">{formatRupiah(a.residualValue)}</KV>
              <KV label="Penyusutan / Tahun">{formatRupiah(dep.perYear)}</KV>
              <KV label="Akumulasi Penyusutan">{formatRupiah(dep.accumulated)}</KV>
              <KV label="Nilai Buku">{formatRupiah(dep.bookValue)}</KV>
            </div>
            {a.usefulLife > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="row small muted" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span>Telah disusutkan {formatNumber(dep.pct * 100, 1)}%</span>
                  <span>Usia {formatNumber(dep.ageYears, 1)} / {a.usefulLife} th</span>
                </div>
                <div className={`progress ${dep.pct > 0.9 ? "critical" : dep.pct > 0.7 ? "warning" : ""}`}><div style={{ width: `${Math.min(100, dep.pct * 100)}%` }} /></div>
              </div>
            )}
          </Panel>
        </div>
      )}

      {tab === "kelaikan" && a.aviation && insp && (
        <Panel title="Status Kelaikan" actions={<Link className="btn btn-secondary btn-sm" href={`/kelaikan/detail?id=${a.id}`}>Buka modul kelaikan<Icon name="arrowRight" /></Link>}>
          <div className="kv-grid cols-4">
            <KV label="Status"><Badge tone={AIRWORTHINESS_TONE[a.aviation.airworthiness]}>{a.aviation.airworthiness}</Badge></KV>
            <KV label="Total Jam Terbang">{formatNumber(a.aviation.flightHours, 1)} jam</KV>
            <KV label="Siklus (Landing)">{formatNumber(a.aviation.cycles)}</KV>
            <KV label="Jumlah Penerbangan Tercatat">{formatNumber(flights.length)}</KV>
            <KV label="Inspeksi Terakhir">{formatNumber(a.aviation.lastInspectionHours, 1)} jam · {formatDate(a.aviation.lastInspectionDate)}</KV>
            <KV label="Inspeksi Berikutnya">{formatNumber(insp.nextDueHours, 1)} jam</KV>
            <KV label="Sertifikat Kelaikan">{a.aviation.certificateNo}</KV>
            <KV label="Berlaku s.d.">
              <span className={insp.certDays < 0 ? "text-critical" : insp.certDays <= 30 ? "text-warning" : ""}>
                {formatDate(a.aviation.certificateExpiry)} ({insp.certDays < 0 ? `lewat ${-insp.certDays} hari` : `${insp.certDays} hari lagi`})
              </span>
            </KV>
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="row small" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <b>Menuju inspeksi berkala {a.aviation.inspectionIntervalHours} jam</b>
              <span className={insp.remainingHours <= 0 ? "text-critical" : insp.tone === "warning" ? "text-warning" : "muted"}>
                {insp.remainingHours <= 0 ? `Terlewati ${formatNumber(-insp.remainingHours, 1)} jam` : `Sisa ${formatNumber(insp.remainingHours, 1)} jam`}
              </span>
            </div>
            <div className={`progress ${insp.tone === "critical" ? "critical" : insp.tone === "warning" ? "warning" : ""}`}>
              <div style={{ width: `${Math.min(100, ((a.aviation.flightHours - a.aviation.lastInspectionHours) / a.aviation.inspectionIntervalHours) * 100)}%` }} />
            </div>
          </div>
        </Panel>
      )}

      {tab === "pemeliharaan" && (
        <Panel title="Riwayat Work Order" actions={can(user.role, "wo.create") && a.status !== "Dihapus" ? <Link className="btn btn-primary btn-sm" href={`/pemeliharaan/baru?assetId=${a.id}`}><Icon name="plus" />Buat Work Order</Link> : undefined}>
          {wos.length === 0 ? <EmptyState icon="clipboard" title="Belum ada work order untuk aset ini" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nomor WO</th><th>Pekerjaan</th><th>Prioritas</th><th>Teknisi</th><th>Target</th><th>Status</th></tr></thead>
                <tbody>
                  {wos.map((w) => (
                    <tr key={w.id} className="clickable" onClick={() => router.push(`/pemeliharaan/detail?id=${w.id}`)}>
                      <td className="cell-strong nowrap">{w.no}</td>
                      <td>{w.title}<div className="cell-sub">{w.type}</div></td>
                      <td><Badge tone={PRIORITY_TONE[w.priority]}>{w.priority}</Badge></td>
                      <td>{w.assigneeId ? userName(db, w.assigneeId) : <span className="muted">Belum ditugaskan</span>}</td>
                      <td className="nowrap">{formatDate(w.dueDate)}</td>
                      <td><Badge tone={WO_STATUS_TONE[w.status]}>{WO_STATUS_LABEL[w.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === "riwayat" && (
        <Panel title="Riwayat Aset" subtitle="Gabungan aktivitas: pencatatan, pemeliharaan, mutasi, inventarisasi, dan penghapusan">
          <div className="timeline">
            {history.map((h, i) => (
              <div key={i} className="timeline-item">
                <div className={`timeline-dot ${h.tone ?? ""}`} />
                <div>
                  <div className="timeline-text">{h.href ? <Link href={h.href} className="link" style={{ fontWeight: 600 }}>{h.text}</Link> : h.text}</div>
                  <div className="timeline-meta">{formatDateTime(h.at)} · {h.meta}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 16 }}>
            {db.transfers.filter((t) => t.assetIds.includes(a.id)).map((t) => <Badge key={t.id} tone={APPROVAL_TONE[t.status]}>{t.no}: {STATUS_LABEL[t.status]}</Badge>)}
          </div>
        </Panel>
      )}

      {tab === "dokumen" && (
        <Panel title="Dokumen Aset">
          {a.documents.length === 0 ? <EmptyState icon="file" title="Belum ada dokumen" /> : a.documents.map((doc) => (
            <div key={doc.id} className="attach-item">
              <Icon name="file" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{doc.name}</div>
                <div className="cell-sub" style={{ fontWeight: 400 }}>{formatBytes(doc.size)} · {formatDateTime(doc.uploadedAt)} · {userName(db, doc.uploadedBy)}</div>
              </div>
              <button className="btn btn-plain btn-sm" onClick={() => toast.info("Versi demo: isi file tidak disimpan, hanya metadata.")}><Icon name="download" /></button>
              {canEdit && <button className="btn btn-ghost btn-sm" aria-label="Hapus dokumen" onClick={() => setRemoveDoc(doc.id)}><Icon name="trash" /></button>}
            </div>
          ))}
          {canEdit && (
            <div style={{ marginTop: 16 }}>
              <FileDrop files={newFiles} onChange={setNewFiles} />
              {newFiles.length > 0 && <div className="row" style={{ marginTop: 10, justifyContent: "flex-end" }}><button className="btn btn-primary" onClick={addDocs}><Icon name="upload" />Unggah {newFiles.length} dokumen</button></div>}
            </div>
          )}
        </Panel>
      )}

      {tab === "label" && (
        <Panel title="Label QR Aset" subtitle="Tempel label pada aset; pindai dengan menu Scan QR untuk membuka data aset">
          <div className="row" style={{ alignItems: "flex-start", gap: 24 }}>
            <div className="qr-label">
              <QRCode value={a.code} size={180} />
              <div className="qr-code-text">{a.code}</div>
              <div className="qr-code-sub">{a.name}</div>
              <div className="qr-code-sub">{unitName(db, a.unitId)}</div>
            </div>
            <div className="stack" style={{ maxWidth: 360 }}>
              <div className="muted" style={{ fontSize: 13 }}>QR berisi kode aset <b className="mono">{a.code}</b>. Label dicetak pada kertas stiker A4 dan dapat dicetak bersamaan dengan aset lain dari halaman daftar aset.</div>
              <div><Link className="btn btn-primary" href={`/aset/label?ids=${a.id}`}><Icon name="printer" />Cetak Label</Link></div>
            </div>
          </div>
        </Panel>
      )}

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)}
        title={linked ? "Data tidak dapat dihapus" : "Hapus data aset?"}
        danger={!linked}
        confirmLabel={linked ? "Mengerti" : "Hapus permanen"}
        message={linked
          ? <>Aset ini memiliki {linked} catatan terkait (work order, jam terbang, mutasi, inventarisasi, atau penghapusan). Untuk mengeluarkan aset dari daftar, gunakan <b>Usulkan Penghapusan</b> agar melalui persetujuan berjenjang.</>
          : <>Data <b>{a.code}</b> akan dihapus permanen. Gunakan ini hanya untuk memperbaiki salah input. Penghapusan aset fisik harus melalui menu Penghapusan Aset.</>}
        onConfirm={() => { if (!linked) deleteAsset(); }} />

      <ConfirmDialog open={!!removeDoc} onClose={() => setRemoveDoc(null)} danger confirmLabel="Hapus dokumen" title="Hapus dokumen?"
        message={a.documents.find((x) => x.id === removeDoc)?.name}
        onConfirm={() => {
          const doc = a.documents.find((x) => x.id === removeDoc);
          mutate((d) => { const x = d.assets.find((y) => y.id === a.id)!; x.documents = x.documents.filter((y) => y.id !== removeDoc); x.updatedAt = new Date().toISOString(); },
            { action: "Menghapus dokumen", module: "Aset", ref: a.code, detail: doc?.name });
          toast.success("Dokumen dihapus");
        }} />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AssetDetail />
    </Suspense>
  );
}
