"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { RequireRole } from "@/components/RequireRole";
import { EmptyState, PageHeader, SearchBox, usePaged } from "@/components/ui";
import { useDB } from "@/lib/store";
import { userName } from "@/lib/domain";
import { formatDateTime, todayISO } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { inPeriod } from "@/lib/reports";

export default function AuditPage() {
  return <RequireRole roles={["admin", "auditor", "pimpinan"]}><AuditTrail /></RequireRole>;
}

function AuditTrail() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState("");
  const [mod, setMod] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const modules = useMemo(() => Array.from(new Set(db.audit.map((a) => a.module))).sort(), [db.audit]);
  const actions = useMemo(() => Array.from(new Set(db.audit.map((a) => a.action))).sort(), [db.audit]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.audit.filter((a) => (!userId || a.userId === userId) && (!mod || a.module === mod) && (!action || a.action === action)
      && ((!from && !to) || inPeriod(a.at, from, to))
      && (!s || [a.ref, a.detail, a.action, a.module, userName(db, a.userId)].some((v) => v?.toLowerCase().includes(s))));
  }, [db, q, userId, mod, action, from, to]);
  const { rows: page, pager } = usePaged(rows, 20);
  const reset = () => { setQ(""); setUserId(""); setMod(""); setAction(""); setFrom(""); setTo(""); };

  return (
    <div>
      <PageHeader title="Jejak Audit" subtitle="Seluruh aktivitas pengguna tercatat dan tidak dapat diubah"
        actions={<button className="btn btn-secondary" onClick={() => downloadCSV(`jejak-audit-${todayISO()}`, rows, [
          { header: "Waktu", value: (a) => formatDateTime(a.at) }, { header: "Pengguna", value: (a) => userName(db, a.userId) }, { header: "Aksi", value: (a) => a.action },
          { header: "Modul", value: (a) => a.module }, { header: "Referensi", value: (a) => a.ref ?? "" }, { header: "Detail", value: (a) => a.detail ?? "" },
        ])}><Icon name="download" />Ekspor CSV</button>} />
      <div className="panel">
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="Cari referensi, detail, pengguna..." />
          <select className="select" value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Pengguna"><option value="">Semua pengguna</option>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <select className="select" value={mod} onChange={(e) => setMod(e.target.value)} aria-label="Modul"><option value="">Semua modul</option>{modules.map((m) => <option key={m}>{m}</option>)}</select>
          <select className="select" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Aksi"><option value="">Semua aksi</option>{actions.map((m) => <option key={m}>{m}</option>)}</select>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Dari" />
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Sampai" />
          <button className="btn btn-plain btn-sm" onClick={reset}>Reset filter</button>
        </div>
        <div className="field-hint" style={{ marginBottom: 10 }}>{rows.length} catatan</div>
        {rows.length === 0 ? <EmptyState icon="shield" title="Tidak ada catatan yang cocok" /> : (
          <>
            <div className="table-wrap desktop-only"><table className="table">
              <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Modul</th><th>Referensi</th><th>Detail</th></tr></thead>
              <tbody>{page.map((a) => (
                <tr key={a.id}><td className="nowrap">{formatDateTime(a.at)}</td><td>{userName(db, a.userId)}</td><td className="cell-strong">{a.action}</td><td><span className="chip">{a.module}</span></td><td className="mono">{a.ref ?? "-"}</td><td>{a.detail ?? "-"}</td></tr>
              ))}</tbody>
            </table></div>
            <div className="mobile-only">{page.map((a) => (
              <div key={a.id} className="list-card">
                <div className="list-card-top"><div className="list-card-title">{a.action} · {a.module}</div><span className="cell-sub nowrap">{formatDateTime(a.at)}</span></div>
                <div className="cell-sub">{userName(db, a.userId)}{a.ref ? ` · ${a.ref}` : ""}</div>
                {a.detail && <div style={{ fontSize: 12.5, marginTop: 4 }}>{a.detail}</div>}
              </div>
            ))}</div>
            {pager}
          </>
        )}
      </div>
    </div>
  );
}
