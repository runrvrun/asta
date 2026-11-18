"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Badge, EmptyState, PageHeader, SearchBox, usePaged } from "@/components/ui";
import { useCurrentUser, useDB } from "@/lib/store";
import { can } from "@/lib/permissions";
import { PRIORITY_TONE, WO_STATUS_LABEL, WO_STATUS_TONE, byId, userName } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { PRIORITIES, WO_TYPES, isOverdue } from "@/lib/maintenance";
import type { WOStatus } from "@/lib/types";

const STATUS_PILLS: { id: "all" | WOStatus; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "baru", label: "Baru" },
  { id: "dikerjakan", label: "Dikerjakan" },
  { id: "menunggu_part", label: "Menunggu Part" },
  { id: "selesai", label: "Selesai" },
  { id: "dibatalkan", label: "Dibatalkan" },
];

export default function WorkOrderListPage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const router = useRouter();
  const [status, setStatus] = useState<"all" | WOStatus>("all");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [priority, setPriority] = useState("");
  const [assignee, setAssignee] = useState("");
  const [mine, setMine] = useState(user.role === "teknisi");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const technicians = db.users.filter((u) => u.role === "teknisi");

  const base = useMemo(() => {
    const query = q.trim().toLowerCase();
    return db.workOrders
      .filter((w) => {
        if (mine && w.assigneeId !== user.id) return false;
        if (type && w.type !== type) return false;
        if (priority && w.priority !== priority) return false;
        if (assignee && (assignee === "-" ? !!w.assigneeId : w.assigneeId !== assignee)) return false;
        if (overdueOnly && !isOverdue(w)) return false;
        if (query) {
          const a = byId(db.assets, w.assetId);
          const hay = `${w.no} ${w.title} ${a?.name ?? ""} ${a?.code ?? ""} ${a?.registration ?? ""}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db, q, type, priority, assignee, mine, overdueOnly, user.id]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: base.length };
    for (const w of base) c[w.status] = (c[w.status] ?? 0) + 1;
    return c;
  }, [base]);

  const rows = status === "all" ? base : base.filter((w) => w.status === status);
  const { rows: pageRows, pager } = usePaged(rows, 15);

  const exportCSV = () =>
    downloadCSV("work-order", rows, [
      { header: "No. WO", value: (w) => w.no },
      { header: "Kode Aset", value: (w) => byId(db.assets, w.assetId)?.code },
      { header: "Aset", value: (w) => byId(db.assets, w.assetId)?.name },
      { header: "Jenis", value: (w) => w.type },
      { header: "Judul", value: (w) => w.title },
      { header: "Prioritas", value: (w) => w.priority },
      { header: "Teknisi", value: (w) => (w.assigneeId ? userName(db, w.assigneeId) : "") },
      { header: "Dibuat", value: (w) => formatDate(w.createdAt) },
      { header: "Target Selesai", value: (w) => formatDate(w.dueDate) },
      { header: "Status", value: (w) => WO_STATUS_LABEL[w.status] },
      { header: "Jam Estimasi", value: (w) => w.estHours },
      { header: "Jam Realisasi", value: (w) => w.actualHours },
    ]);

  return (
    <>
      <PageHeader
        title="Work Order"
        subtitle="Pemeliharaan · daftar pekerjaan perawatan dan perbaikan"
        actions={
          <>
            <button className="btn btn-plain" onClick={exportCSV}><Icon name="download" />Ekspor CSV</button>
            {can(user.role, "wo.create") && <Link className="btn btn-primary" href="/pemeliharaan/baru"><Icon name="plus" />Buat Work Order</Link>}
          </>
        }
      />

      <div className="panel">
        <div className="filter-pills" style={{ marginBottom: 12 }}>
          {STATUS_PILLS.map((p) => (
            <button key={p.id} className={`pill ${status === p.id ? "active" : ""}`} onClick={() => setStatus(p.id)}>
              {p.label} <span className="count">{counts[p.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="Cari nomor WO, judul, atau aset..." />
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Semua jenis</option>
            {WO_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Semua prioritas</option>
            {PRIORITIES.map((t) => <option key={t}>{t}</option>)}
          </select>
          {!mine && (
            <select className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Semua teknisi</option>
              <option value="-">Belum ditugaskan</option>
              {technicians.map((t) => <option key={t.id} value={t.id}>{t.rank} {t.name}</option>)}
            </select>
          )}
          <label className="checkbox"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Tugas saya</label>
          <label className="checkbox"><input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />Lewat target</label>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon="clipboard" title="Tidak ada work order">Ubah filter atau pencarian untuk melihat work order lain.</EmptyState>
        ) : (
          <>
            <div className="table-wrap desktop-only">
              <table className="table">
                <thead>
                  <tr><th>Nomor WO</th><th>Aset</th><th>Pekerjaan</th><th>Prioritas</th><th>Teknisi</th><th>Target Selesai</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {pageRows.map((w) => {
                    const a = byId(db.assets, w.assetId);
                    const overdue = isOverdue(w);
                    return (
                      <tr key={w.id} className="clickable" onClick={() => router.push(`/pemeliharaan/detail?id=${w.id}`)}>
                        <td className="cell-strong nowrap">{w.no}</td>
                        <td>{a?.name ?? "-"}<div className="cell-sub">{a?.code}{a?.registration ? ` · ${a.registration}` : ""}</div></td>
                        <td>{w.title}<div className="cell-sub">{w.type}</div></td>
                        <td><Badge tone={PRIORITY_TONE[w.priority]}>{w.priority}</Badge></td>
                        <td>{w.assigneeId ? userName(db, w.assigneeId) : <span className="muted">Belum ditugaskan</span>}</td>
                        <td className="nowrap">
                          <span className={overdue ? "text-critical" : ""} style={{ fontWeight: overdue ? 700 : undefined }}>{formatDate(w.dueDate)}</span>
                          {overdue && <div className="cell-sub text-critical">Lewat target</div>}
                        </td>
                        <td><Badge tone={WO_STATUS_TONE[w.status]}>{WO_STATUS_LABEL[w.status]}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mobile-only">
              {pageRows.map((w) => {
                const a = byId(db.assets, w.assetId);
                const overdue = isOverdue(w);
                return (
                  <Link key={w.id} className="list-card" href={`/pemeliharaan/detail?id=${w.id}`}>
                    <div className="list-card-top">
                      <div className="list-card-title">{w.no}</div>
                      <Badge tone={WO_STATUS_TONE[w.status]}>{WO_STATUS_LABEL[w.status]}</Badge>
                    </div>
                    <div style={{ fontSize: 13 }}>{w.title}</div>
                    <div className="cell-sub">{a?.name} · {a?.code}</div>
                    <div className="list-card-grid">
                      <div><b>{w.type}</b>Jenis</div>
                      <div><b>{w.assigneeId ? userName(db, w.assigneeId) : "-"}</b>Teknisi</div>
                      <div><b className={overdue ? "text-critical" : ""}>{formatDate(w.dueDate)}</b>{overdue ? "Lewat target" : "Target selesai"}</div>
                      <div><Badge tone={PRIORITY_TONE[w.priority]}>{w.priority}</Badge></div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {pager}
          </>
        )}
      </div>
    </>
  );
}
