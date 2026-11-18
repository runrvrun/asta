"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Badge, EmptyState, PageHeader, SearchBox, StatCard, Tabs, usePaged } from "@/components/ui";
import { useCurrentUser, useDB } from "@/lib/store";
import { APPROVAL_TONE, STATUS_LABEL, currentStep, unitName, userName } from "@/lib/domain";
import { can } from "@/lib/permissions";
import { daysUntil, formatDate } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { isOverdue } from "@/lib/workflow";
import type { DB, Transfer } from "@/lib/types";

type TypeTab = "semua" | "mutasi" | "pinjam";
const STATUSES = ["semua", "diajukan", "disetujui", "diserahkan", "dikembalikan", "ditolak"] as const;

function assetSummary(db: DB, t: Transfer) {
  const first = db.assets.find((a) => a.id === t.assetIds[0]);
  if (!first) return "-";
  return t.assetIds.length > 1 ? `${first.name} +${t.assetIds.length - 1} lainnya` : first.name;
}

export default function MutasiListPage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const router = useRouter();
  const [tab, setTab] = useState<TypeTab>("semua");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("semua");
  const [q, setQ] = useState("");

  const all = useMemo(() => [...db.transfers].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)), [db.transfers]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((t) =>
      (tab === "semua" || t.type === tab) &&
      (status === "semua" || t.status === status) &&
      (!s || [t.no, assetSummary(db, t), unitName(db, t.fromUnitId), unitName(db, t.toUnitId), t.reason].some((v) => v.toLowerCase().includes(s))),
    );
  }, [all, tab, status, q, db]);
  const { rows: page, pager } = usePaged(rows, 12);

  const activeLoans = db.transfers.filter((t) => t.type === "pinjam" && t.status === "diserahkan");
  const overdue = activeLoans.filter(isOverdue);
  const waiting = db.transfers.filter((t) => t.status === "diajukan");

  const exportCSV = () =>
    downloadCSV(`mutasi-peminjaman-${new Date().toISOString().slice(0, 10)}`, rows, [
      { header: "Nomor", value: (t) => t.no },
      { header: "Jenis", value: (t) => (t.type === "pinjam" ? "Peminjaman" : "Mutasi") },
      { header: "Aset", value: (t) => t.assetIds.map((id) => db.assets.find((a) => a.id === id)?.code ?? id).join(", ") },
      { header: "Dari", value: (t) => unitName(db, t.fromUnitId) },
      { header: "Ke", value: (t) => unitName(db, t.toUnitId) },
      { header: "Tanggal Mulai", value: (t) => t.startDate },
      { header: "Tanggal Kembali", value: (t) => t.returnDate ?? "" },
      { header: "Status", value: (t) => STATUS_LABEL[t.status] },
      { header: "Pengaju", value: (t) => userName(db, t.requestedBy) },
      { header: "Alasan", value: (t) => t.reason },
    ]);

  const statusBadge = (t: Transfer) => (
    <>
      <Badge tone={APPROVAL_TONE[t.status]}>{t.type === "pinjam" && t.status === "diserahkan" ? "Dipinjam" : STATUS_LABEL[t.status]}</Badge>
      {isOverdue(t) && <div style={{ marginTop: 4 }}><Badge tone="critical">Terlambat {-daysUntil(t.returnDate!)} hari</Badge></div>}
    </>
  );

  return (
    <>
      <PageHeader
        title="Mutasi & Peminjaman"
        subtitle="Pemindahan permanen dan peminjaman aset antar satuan, lengkap dengan persetujuan dan berita acara serah terima"
        actions={<>
          <button className="btn btn-secondary" onClick={exportCSV}><Icon name="download" />Ekspor CSV</button>
          {can(user.role, "transfer.create") && (
            <Link className="btn btn-primary" href="/mutasi/baru"><Icon name="plus" />Ajukan</Link>
          )}
        </>}
      />

      <div className="kpi-grid">
        <StatCard label="Menunggu persetujuan" value={waiting.length} icon="clock" accent="var(--warning)" sub="Mutasi & peminjaman" onClick={() => setStatus("diajukan")} />
        <StatCard label="Peminjaman aktif" value={activeLoans.length} icon="transfer" sub="Aset sedang dipinjam" onClick={() => { setTab("pinjam"); setStatus("diserahkan"); }} />
        <StatCard label="Peminjaman terlambat" value={overdue.length} icon="alert" accent="var(--critical)" sub="Melewati tanggal kembali" />
        <StatCard label="Total dokumen" value={db.transfers.length} icon="file" sub={`${db.transfers.filter((t) => t.type === "mutasi").length} mutasi · ${db.transfers.filter((t) => t.type === "pinjam").length} pinjam`} />
      </div>

      {overdue.length > 0 && (
        <div className="alert critical">
          <Icon name="alert" />
          <div>
            <b>{overdue.length} peminjaman melewati tanggal kembali:</b>{" "}
            {overdue.map((t, i) => (
              <span key={t.id}>{i > 0 && ", "}<Link className="link" href={`/mutasi/detail?id=${t.id}`}>{t.no}</Link></span>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <Tabs<TypeTab> value={tab} onChange={setTab} tabs={[{ id: "semua", label: "Semua" }, { id: "mutasi", label: "Mutasi" }, { id: "pinjam", label: "Peminjaman" }]} />
        <div className="toolbar">
          <div className="filter-pills">
            {STATUSES.map((s) => (
              <button key={s} className={`pill ${status === s ? "active" : ""}`} onClick={() => setStatus(s)}>
                {s === "semua" ? "Semua" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <SearchBox value={q} onChange={setQ} placeholder="Cari nomor, aset, satuan..." />
        </div>

        {rows.length === 0 ? (
          <EmptyState icon="transfer" title="Tidak ada dokumen">Ubah filter atau ajukan mutasi/peminjaman baru.</EmptyState>
        ) : (
          <>
            <div className="table-wrap desktop-only">
              <table className="table">
                <thead><tr><th>Nomor</th><th>Jenis</th><th>Aset</th><th>Dari → Ke</th><th>Jadwal</th><th>Tahap</th><th>Status</th></tr></thead>
                <tbody>
                  {page.map((t) => {
                    const step = t.status === "diajukan" ? currentStep(t.approvals) : undefined;
                    return (
                      <tr key={t.id} className="clickable" onClick={() => router.push(`/mutasi/detail?id=${t.id}`)} style={isOverdue(t) ? { background: "rgba(168,80,58,0.05)" } : undefined}>
                        <td className="cell-strong nowrap">{t.no}<div className="cell-sub">{formatDate(t.requestedAt)}</div></td>
                        <td><span className="chip">{t.type === "pinjam" ? "Peminjaman" : "Mutasi"}</span></td>
                        <td>{assetSummary(db, t)}</td>
                        <td>{unitName(db, t.fromUnitId)}<div className="cell-sub">→ {unitName(db, t.toUnitId)}</div></td>
                        <td className="nowrap">{formatDate(t.startDate)}{t.returnDate && <div className="cell-sub">s.d. {formatDate(t.returnDate)}</div>}</td>
                        <td className="cell-sub">{step ? step.title : "-"}</td>
                        <td>{statusBadge(t)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mobile-only">
              {page.map((t) => (
                <Link key={t.id} href={`/mutasi/detail?id=${t.id}`} className="list-card" style={isOverdue(t) ? { borderColor: "var(--critical)" } : undefined}>
                  <div className="list-card-top">
                    <div>
                      <div className="list-card-title">{t.no}</div>
                      <div className="cell-sub">{t.type === "pinjam" ? "Peminjaman" : "Mutasi"} · {formatDate(t.requestedAt)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>{statusBadge(t)}</div>
                  </div>
                  <div style={{ fontSize: 13 }}>{assetSummary(db, t)}</div>
                  <div className="list-card-grid">
                    <div><b>{unitName(db, t.fromUnitId)}</b>Dari</div>
                    <div><b>{unitName(db, t.toUnitId)}</b>Ke</div>
                    <div><b>{formatDate(t.startDate)}</b>Mulai</div>
                    {t.returnDate && <div><b>{formatDate(t.returnDate)}</b>Kembali</div>}
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
