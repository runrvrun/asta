"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Badge, EmptyState, Field, Modal, PageHeader, StatCard, toast } from "@/components/ui";
import { useCurrentUser, useDB, useStore, uid } from "@/lib/store";
import { APPROVAL_TONE, STATUS_LABEL, nextNo, unitName, userName } from "@/lib/domain";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import type { DB, StockTake } from "@/lib/types";

function defaultPeriod(d = new Date()) {
  return `Semester ${d.getMonth() < 6 ? "I" : "II"} ${d.getFullYear()}`;
}

/** Unit plus all of its descendants. */
function unitTree(db: DB, rootId: string) {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of db.units) if (u.parentId && ids.has(u.parentId) && !ids.has(u.id)) { ids.add(u.id); grew = true; }
  }
  return ids;
}

function progress(st: StockTake) {
  const found = st.items.filter((i) => i.result === "ditemukan").length;
  const missing = st.items.filter((i) => i.result === "tidak_ditemukan").length;
  const done = found + missing;
  return { found, missing, done, total: st.items.length, pct: st.items.length ? Math.round((done / st.items.length) * 100) : 0 };
}

export default function InventarisasiPage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const mutate = useStore((s) => s.mutate);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState(user.unitId);
  const [period, setPeriod] = useState(defaultPeriod());
  const [leaderId, setLeaderId] = useState(user.id);

  const sessions = useMemo(() => [...db.stockTakes].sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [db.stockTakes]);
  const running = sessions.filter((s) => s.status === "berjalan");
  const leaders = db.users.filter((u) => u.active && ["admin", "petugas", "auditor"].includes(u.role));
  const scopeIds = unitTree(db, unitId);
  const scopeAssets = db.assets.filter((a) => a.status !== "Dihapus" && scopeIds.has(a.unitId));
  const duplicate = running.find((s) => s.unitId === unitId);

  const start = () => {
    if (!scopeAssets.length) { toast.error("Tidak ada aset di satuan ini"); return; }
    if (!period.trim()) { toast.error("Isi periode inventarisasi"); return; }
    const no = nextNo(db.stockTakes.map((s) => s.no), `OPN-${new Date().getFullYear()}`);
    const id = uid("opn");
    const st: StockTake = {
      id, no, unitId, locationIds: [], period: period.trim(), startedAt: new Date().toISOString(), status: "berjalan", leaderId,
      items: scopeAssets.map((a) => ({ assetId: a.id, result: "belum" })),
    };
    mutate((d) => { d.stockTakes.unshift(st); }, { action: "Memulai", module: "Inventarisasi", ref: no, detail: `${st.period} · ${unitName(db, unitId)} · ${st.items.length} aset` });
    toast.success(`${no} dimulai dengan ${st.items.length} aset`);
    setOpen(false);
    router.push(`/inventarisasi/detail?id=${id}`);
  };

  const totalMissing = running.reduce((n, s) => n + progress(s).missing, 0);

  return (
    <>
      <PageHeader
        title="Inventarisasi Aset"
        subtitle="Penghitungan fisik berkala per satuan untuk memastikan keberadaan dan kondisi aset sesuai register"
        actions={can(user.role, "stocktake.manage") && (
          <button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" />Mulai Inventarisasi</button>
        )}
      />

      <div className="kpi-grid">
        <StatCard label="Sedang berjalan" value={running.length} icon="clock" accent="var(--warning)" sub="Sesi inventarisasi aktif" />
        <StatCard label="Belum diperiksa" value={running.reduce((n, s) => n + s.items.filter((i) => i.result === "belum").length, 0)} icon="list" sub="Pada sesi berjalan" />
        <StatCard label="Tidak ditemukan" value={totalMissing} icon="alert" accent="var(--critical)" sub="Perlu penelusuran" />
        <StatCard label="Sesi selesai" value={sessions.filter((s) => s.status === "selesai").length} icon="checkCircle" sub="Seluruh periode" />
      </div>

      <div className="panel">
        <div className="panel-head"><div><h3>Sesi inventarisasi</h3><p>Klik sesi untuk melakukan pemeriksaan atau melihat hasil</p></div></div>
        {sessions.length === 0 ? <EmptyState icon="list" title="Belum ada sesi inventarisasi" /> : (
          <>
            <div className="table-wrap desktop-only">
              <table className="table">
                <thead><tr><th>Nomor</th><th>Satuan</th><th>Periode</th><th>Ketua tim</th><th>Mulai</th><th style={{ width: 220 }}>Progres</th><th>Status</th></tr></thead>
                <tbody>
                  {sessions.map((s) => {
                    const p = progress(s);
                    return (
                      <tr key={s.id} className="clickable" onClick={() => router.push(`/inventarisasi/detail?id=${s.id}`)}>
                        <td className="cell-strong">{s.no}</td>
                        <td>{unitName(db, s.unitId)}</td>
                        <td>{s.period}</td>
                        <td>{userName(db, s.leaderId)}</td>
                        <td className="nowrap">{formatDate(s.startedAt)}{s.completedAt && <div className="cell-sub">Selesai {formatDate(s.completedAt)}</div>}</td>
                        <td>
                          <div className="progress"><div style={{ width: `${p.pct}%` }} /></div>
                          <div className="cell-sub" style={{ marginTop: 4 }}>{p.done}/{p.total} diperiksa · {p.missing} tidak ditemukan</div>
                        </td>
                        <td><Badge tone={APPROVAL_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mobile-only">
              {sessions.map((s) => {
                const p = progress(s);
                return (
                  <Link key={s.id} href={`/inventarisasi/detail?id=${s.id}`} className="list-card">
                    <div className="list-card-top">
                      <div><div className="list-card-title">{s.no}</div><div className="cell-sub">{s.period}</div></div>
                      <Badge tone={APPROVAL_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>{unitName(db, s.unitId)}</div>
                    <div className="progress"><div style={{ width: `${p.pct}%` }} /></div>
                    <div className="cell-sub" style={{ marginTop: 4 }}>{p.done}/{p.total} diperiksa · {p.missing} tidak ditemukan</div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Mulai inventarisasi" subtitle="Seluruh aset (selain yang sudah dihapus) di satuan terpilih beserta satuan di bawahnya akan masuk daftar periksa."
        footer={<><button className="btn btn-plain" onClick={() => setOpen(false)}>Batal</button><button className="btn btn-primary" onClick={start}>Mulai</button></>}>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
          <Field label="Satuan" required hint={`${scopeAssets.length} aset akan diperiksa`}>
            <select className="select" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {db.units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
            </select>
          </Field>
          {duplicate && <div className="alert warning" style={{ margin: 0 }}><Icon name="alert" />Sudah ada sesi berjalan untuk satuan ini ({duplicate.no}).</div>}
          <Field label="Periode" required>
            <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </Field>
          <Field label="Ketua tim" required>
            <select className="select" value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
              {leaders.map((u) => <option key={u.id} value={u.id}>{u.rank} {u.name}</option>)}
            </select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
