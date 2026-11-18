"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Badge, EmptyState, PageHeader, SearchBox, StatCard, usePaged } from "@/components/ui";
import { useCurrentUser, useDB } from "@/lib/store";
import { APPROVAL_TONE, STATUS_LABEL, currentStep, userName } from "@/lib/domain";
import { can } from "@/lib/permissions";
import { formatDate, formatRupiah, formatRupiahShort } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import type { DB, Disposal } from "@/lib/types";

const STATUSES = ["semua", "diajukan", "disetujui", "ditolak"] as const;

function assetSummary(db: DB, d: Disposal) {
  if (!d.assetIds.length) return d.reason.length > 60 ? d.reason.slice(0, 60) + "…" : d.reason;
  const first = db.assets.find((a) => a.id === d.assetIds[0]);
  return `${first?.name ?? "-"}${d.assetIds.length > 1 ? ` +${d.assetIds.length - 1} lainnya` : ""}`;
}

export default function PenghapusanPage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const router = useRouter();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("semua");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...db.disposals]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((d) => (status === "semua" || d.status === status) &&
        (!s || [d.no, d.method, d.reason, assetSummary(db, d)].some((v) => v.toLowerCase().includes(s))));
  }, [db, status, q]);
  const { rows: page, pager } = usePaged(rows, 12);

  const pending = db.disposals.filter((d) => d.status === "diajukan");
  const approvedYear = db.disposals.filter((d) => d.status === "disetujui" && d.createdAt.startsWith(String(new Date().getFullYear())));
  const proposedAssets = db.assets.filter((a) => a.status === "Diusulkan Hapus").length;
  const total = rows.reduce((n, d) => n + d.estimatedValue, 0);

  const exportCSV = () =>
    downloadCSV(`usulan-penghapusan-${new Date().toISOString().slice(0, 10)}`, rows, [
      { header: "Nomor", value: (d) => d.no },
      { header: "Tanggal", value: (d) => d.createdAt.slice(0, 10) },
      { header: "Aset", value: (d) => d.assetIds.map((id) => db.assets.find((a) => a.id === id)?.code ?? id).join(", ") },
      { header: "Jumlah aset", value: (d) => d.assetIds.length },
      { header: "Metode", value: (d) => d.method },
      { header: "Estimasi nilai (Rp)", value: (d) => d.estimatedValue },
      { header: "Status", value: (d) => STATUS_LABEL[d.status] },
      { header: "Tahap saat ini", value: (d) => (d.status === "diajukan" ? currentStep(d.approvals)?.title ?? "" : "") },
      { header: "Pengusul", value: (d) => userName(db, d.createdBy) },
      { header: "Alasan", value: (d) => d.reason },
    ]);

  return (
    <>
      <PageHeader
        title="Penghapusan Aset"
        subtitle="Usulan penghapusan dengan persetujuan berjenjang 4 tahap: Petugas Aset, Pemeriksaan Teknis, Inspektorat, Pimpinan"
        actions={<>
          <button className="btn btn-secondary" onClick={exportCSV}><Icon name="download" />Ekspor CSV</button>
          {can(user.role, "disposal.create") && <Link className="btn btn-primary" href="/penghapusan/baru"><Icon name="plus" />Usulkan Penghapusan</Link>}
        </>}
      />

      <div className="kpi-grid">
        <StatCard label="Usulan dalam proses" value={pending.length} icon="clock" accent="var(--warning)" sub="Menunggu persetujuan" onClick={() => setStatus("diajukan")} />
        <StatCard label="Aset diusulkan hapus" value={proposedAssets} icon="trash" accent="var(--critical)" sub="Status Diusulkan Hapus" />
        <StatCard label="Disetujui tahun ini" value={approvedYear.length} icon="checkCircle" sub={formatRupiahShort(approvedYear.reduce((n, d) => n + d.estimatedValue, 0))} />
        <StatCard label="Total estimasi (filter)" value={formatRupiahShort(total)} icon="chart" sub={`${rows.length} usulan`} />
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="filter-pills">
            {STATUSES.map((s) => (
              <button key={s} className={`pill ${status === s ? "active" : ""}`} onClick={() => setStatus(s)}>
                {s === "semua" ? "Semua" : STATUS_LABEL[s]}
                <span className="count">{s === "semua" ? db.disposals.length : db.disposals.filter((d) => d.status === s).length}</span>
              </button>
            ))}
          </div>
          <div className="spacer" />
          <SearchBox value={q} onChange={setQ} placeholder="Cari nomor, aset, metode..." />
        </div>

        {rows.length === 0 ? <EmptyState icon="trash" title="Tidak ada usulan penghapusan" /> : (
          <>
            <div className="table-wrap desktop-only">
              <table className="table">
                <thead><tr><th>Nomor</th><th>Aset</th><th>Metode</th><th className="text-right">Estimasi nilai</th><th>Tahap</th><th>Pengusul</th><th>Status</th></tr></thead>
                <tbody>
                  {page.map((d) => {
                    const step = d.status === "diajukan" ? currentStep(d.approvals) : undefined;
                    const done = d.approvals.filter((s) => s.status === "disetujui").length;
                    return (
                      <tr key={d.id} className="clickable" onClick={() => router.push(`/penghapusan/detail?id=${d.id}`)}>
                        <td className="cell-strong nowrap">{d.no}<div className="cell-sub">{formatDate(d.createdAt)}</div></td>
                        <td>{assetSummary(db, d)}<div className="cell-sub">{d.assetIds.length} aset</div></td>
                        <td>{d.method}</td>
                        <td className="text-right nowrap">{formatRupiah(d.estimatedValue)}</td>
                        <td className="cell-sub">{step ? <>{step.title}<div>{done}/{d.approvals.length} tahap</div></> : "-"}</td>
                        <td>{userName(db, d.createdBy)}</td>
                        <td><Badge tone={APPROVAL_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mobile-only">
              {page.map((d) => (
                <Link key={d.id} href={`/penghapusan/detail?id=${d.id}`} className="list-card">
                  <div className="list-card-top">
                    <div><div className="list-card-title">{d.no}</div><div className="cell-sub">{formatDate(d.createdAt)} · {d.method}</div></div>
                    <Badge tone={APPROVAL_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                  </div>
                  <div style={{ fontSize: 13 }}>{assetSummary(db, d)}</div>
                  <div className="list-card-grid">
                    <div><b>{formatRupiahShort(d.estimatedValue)}</b>Estimasi nilai</div>
                    <div><b>{d.status === "diajukan" ? currentStep(d.approvals)?.title : "-"}</b>Tahap</div>
                  </div>
                </Link>
              ))}
            </div>
            {pager}
          </>
        )}
      </div>
    </>
  );
}
