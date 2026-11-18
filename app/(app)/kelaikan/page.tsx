"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Badge, EmptyState, PageHeader, SearchBox, StatCard, Tabs, usePaged } from "@/components/ui";
import { FlightLogDialog } from "@/components/maintenance/FlightLogDialog";
import styles from "@/components/maintenance/maint.module.css";
import { useCurrentUser, useDB } from "@/lib/store";
import { can } from "@/lib/permissions";
import { AIRWORTHINESS_TONE, byId, inspectionStatus, unitName } from "@/lib/domain";
import { daysUntil, formatDate, formatNumber } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { MISSIONS, aviationAssets, lastFlight } from "@/lib/maintenance";
import { AVIATION_CATEGORIES } from "@/lib/seed";
import type { Airworthiness } from "@/lib/types";

type Tab = "armada" | "log";

export default function AirworthinessPage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("armada");
  const [logOpen, setLogOpen] = useState(false);
  const fleet = useMemo(() => aviationAssets(db), [db]);

  // ----- KPIs & alerts -----
  const counts: Record<Airworthiness, number> = { Laik: 0, "Laik Terbatas": 0, "Tidak Laik": 0 };
  fleet.forEach((a) => counts[a.aviation!.airworthiness]++);
  const availability = fleet.length ? Math.round(((counts.Laik + counts["Laik Terbatas"]) / fleet.length) * 100) : 0;
  const statuses = fleet.map((a) => ({ a, s: inspectionStatus(a)! }));
  const inspDue = statuses.filter(({ a, s }) => s.remainingHours <= a.aviation!.inspectionIntervalHours * 0.1);
  const certDue = statuses.filter(({ s }) => s.certDays <= 30);

  const alerts = [
    ...statuses.filter(({ s }) => s.remainingHours <= 0).map(({ a, s }) => ({ tone: "critical", a, text: `${a.registration} melewati batas inspeksi berkala ${formatNumber(Math.abs(s.remainingHours))} jam` })),
    ...statuses.filter(({ s }) => s.certDays < 0).map(({ a, s }) => ({ tone: "critical", a, text: `Sertifikat kelaikan ${a.registration} kedaluwarsa ${Math.abs(s.certDays)} hari lalu` })),
    ...statuses.filter(({ a, s }) => s.remainingHours > 0 && s.remainingHours <= a.aviation!.inspectionIntervalHours * 0.1).map(({ a, s }) => ({ tone: "warning", a, text: `${a.registration} mendekati inspeksi berkala (sisa ${formatNumber(s.remainingHours)} jam)` })),
    ...statuses.filter(({ s }) => s.certDays >= 0 && s.certDays <= 30).map(({ a, s }) => ({ tone: "warning", a, text: `Sertifikat kelaikan ${a.registration} berakhir dalam ${s.certDays} hari` })),
  ];

  return (
    <>
      <PageHeader
        title="Kelaikan & Jam Terbang"
        subtitle="Status kelaikan armada pesawat, helikopter, dan pesawat nirawak"
        actions={can(user.role, "flight.log") && <button className="btn btn-primary" onClick={() => setLogOpen(true)}><Icon name="plus" />Catat Penerbangan</button>}
      />

      <div className="kpi-grid">
        <StatCard label="Laik terbang" value={counts.Laik} sub={`${counts["Laik Terbatas"]} laik terbatas · ${counts["Tidak Laik"]} tidak laik`} icon="checkCircle" />
        <StatCard label="Kesiapan armada" value={`${availability}%`} sub={`${counts.Laik + counts["Laik Terbatas"]} dari ${fleet.length} pesawat siap`} icon="plane" accent="#2E86D6" />
        <StatCard label="Inspeksi jatuh tempo" value={inspDue.length} sub="Sisa ≤ 10% interval atau terlewat" icon="wrench" accent="#B57A1F" />
        <StatCard label="Sertifikat ≤ 30 hari" value={certDue.length} sub="Termasuk yang sudah kedaluwarsa" icon="file" accent="#A8503A" />
      </div>

      {alerts.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head"><div><h3>Peringatan kelaikan</h3><p>{alerts.length} hal perlu ditindaklanjuti</p></div></div>
          <div className={styles.alertList}>
            {alerts.slice(0, 8).map((al, i) => (
              <Link key={i} href={`/kelaikan/detail?id=${al.a.id}`} className={`${styles.alertRow} ${styles[al.tone]}`}>
                <Icon name="alert" />
                <span style={{ flex: 1 }}>{al.text}</span>
                <Icon name="chevronRight" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <Tabs<Tab> tabs={[{ id: "armada", label: "Status Armada" }, { id: "log", label: "Log Jam Terbang" }]} value={tab} onChange={setTab} />
      {tab === "armada" ? <FleetTable onOpen={(id) => router.push(`/kelaikan/detail?id=${id}`)} /> : <FlightLogTable />}

      <FlightLogDialog open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}

function FleetTable({ onOpen }: { onOpen: (id: string) => void }) {
  const db = useDB();
  const fleet = aviationAssets(db);
  const [cat, setCat] = useState("");
  const [unit, setUnit] = useState("");
  const [aw, setAw] = useState("");
  const [q, setQ] = useState("");
  const units = db.units.filter((u) => fleet.some((a) => a.unitId === u.id));
  const rows = fleet
    .filter((a) => (!cat || a.categoryId === cat) && (!unit || a.unitId === unit) && (!aw || a.aviation!.airworthiness === aw))
    .filter((a) => !q || `${a.registration} ${a.model} ${a.name}`.toLowerCase().includes(q.toLowerCase()))
    .map((a) => ({ a, s: inspectionStatus(a)!, last: lastFlight(db, a.id) }))
    .sort((x, y) => x.s.remainingHours - y.s.remainingHours);

  const exportCSV = () =>
    downloadCSV("status-kelaikan", rows, [
      { header: "Registrasi", value: (r) => r.a.registration },
      { header: "Tipe", value: (r) => r.a.model },
      { header: "Satuan", value: (r) => unitName(db, r.a.unitId) },
      { header: "Kelaikan", value: (r) => r.a.aviation!.airworthiness },
      { header: "Total Jam", value: (r) => r.a.aviation!.flightHours },
      { header: "Siklus", value: (r) => r.a.aviation!.cycles },
      { header: "Inspeksi Berikut (jam)", value: (r) => r.s.nextDueHours },
      { header: "Sisa Jam", value: (r) => Math.round(r.s.remainingHours) },
      { header: "Sertifikat Berakhir", value: (r) => formatDate(r.a.aviation!.certificateExpiry) },
      { header: "Penerbangan Terakhir", value: (r) => (r.last ? formatDate(r.last.date) : "") },
    ]);

  return (
    <div className="panel">
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Cari registrasi atau tipe..." />
        <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Semua kategori</option>
          {db.categories.filter((c) => AVIATION_CATEGORIES.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select" value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="">Semua satuan</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="select" value={aw} onChange={(e) => setAw(e.target.value)}>
          <option value="">Semua status</option>
          <option>Laik</option><option>Laik Terbatas</option><option>Tidak Laik</option>
        </select>
        <span className="spacer" />
        <button className="btn btn-plain btn-sm" onClick={exportCSV}><Icon name="download" />CSV</button>
      </div>
      {rows.length === 0 ? <EmptyState icon="plane" title="Tidak ada pesawat yang cocok" /> : (
        <>
          <div className="table-wrap desktop-only">
            <table className="table">
              <thead><tr><th>Registrasi</th><th>Tipe</th><th>Satuan</th><th>Kelaikan</th><th className="text-right">Total jam</th><th style={{ minWidth: 170 }}>Menuju inspeksi</th><th>Sertifikat</th><th>Terbang terakhir</th></tr></thead>
              <tbody>
                {rows.map(({ a, s, last }) => {
                  const av = a.aviation!;
                  const used = Math.max(0, Math.min(100, ((av.flightHours - av.lastInspectionHours) / av.inspectionIntervalHours) * 100));
                  return (
                    <tr key={a.id} className="clickable" onClick={() => onOpen(a.id)}>
                      <td className="cell-strong nowrap">{a.registration}</td>
                      <td>{a.model}<div className="cell-sub">{a.brand}</div></td>
                      <td>{unitName(db, a.unitId)}</td>
                      <td><Badge tone={AIRWORTHINESS_TONE[av.airworthiness]}>{av.airworthiness}</Badge></td>
                      <td className="text-right nowrap">{formatNumber(av.flightHours, av.flightHours % 1 ? 1 : 0)}</td>
                      <td>
                        <div className={`progress ${s.remainingHours <= 0 ? "critical" : s.tone === "warning" && s.remainingHours <= av.inspectionIntervalHours * 0.1 ? "warning" : ""}`}><div style={{ width: `${used}%` }} /></div>
                        <div className={`cell-sub ${s.remainingHours <= 0 ? "text-critical" : ""}`}>{s.remainingHours <= 0 ? `Lewat ${formatNumber(Math.abs(s.remainingHours))} jam` : `Sisa ${formatNumber(s.remainingHours)} jam`} · interval {av.inspectionIntervalHours} jam</div>
                      </td>
                      <td className="nowrap">
                        {formatDate(av.certificateExpiry)}
                        <div className={`cell-sub ${s.certDays < 0 ? "text-critical" : s.certDays <= 30 ? "text-warning" : ""}`}>{s.certDays < 0 ? `Kedaluwarsa ${Math.abs(s.certDays)} hari` : `${s.certDays} hari lagi`}</div>
                      </td>
                      <td className="nowrap">{last ? formatDate(last.date) : "-"}<div className="cell-sub">{last ? `${last.mission} · ${formatNumber(last.hours, 1)} jam` : ""}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mobile-only">
            {rows.map(({ a, s }) => {
              const av = a.aviation!;
              return (
                <Link key={a.id} className="list-card" href={`/kelaikan/detail?id=${a.id}`}>
                  <div className="list-card-top">
                    <div><div className="list-card-title">{a.registration}</div><div className="cell-sub">{a.model}</div></div>
                    <Badge tone={AIRWORTHINESS_TONE[av.airworthiness]}>{av.airworthiness}</Badge>
                  </div>
                  <div className="list-card-grid">
                    <div><b>{formatNumber(av.flightHours)} jam</b>Total jam terbang</div>
                    <div><b className={s.remainingHours <= 0 ? "text-critical" : ""}>{s.remainingHours <= 0 ? `Lewat ${formatNumber(-s.remainingHours)}` : formatNumber(s.remainingHours)} jam</b>Menuju inspeksi</div>
                    <div><b className={s.certDays <= 30 ? "text-warning" : ""}>{formatDate(av.certificateExpiry)}</b>Sertifikat</div>
                    <div><b>{unitName(db, a.unitId)}</b>Satuan</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function FlightLogTable() {
  const db = useDB();
  const fleet = aviationAssets(db);
  const [assetId, setAssetId] = useState("");
  const [mission, setMission] = useState("");
  const [range, setRange] = useState("30");
  const rows = useMemo(() => {
    return db.flightLogs
      .filter((f) => (!assetId || f.assetId === assetId) && (!mission || f.mission === mission))
      .filter((f) => range === "all" || -daysUntil(f.date) <= parseInt(range, 10))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.flightLogs, assetId, mission, range]);
  const total = rows.reduce((s, f) => s + f.hours, 0);
  const { rows: pageRows, pager } = usePaged(rows, 20);

  const exportCSV = () =>
    downloadCSV("log-jam-terbang", rows, [
      { header: "Tanggal", value: (f) => f.date },
      { header: "Registrasi", value: (f) => byId(db.assets, f.assetId)?.registration },
      { header: "Tipe", value: (f) => byId(db.assets, f.assetId)?.model },
      { header: "Misi", value: (f) => f.mission },
      { header: "Jam", value: (f) => String(f.hours).replace(".", ",") },
      { header: "Siklus", value: (f) => f.cycles },
      { header: "Penerbang", value: (f) => f.pilot },
      { header: "Rute", value: (f) => f.route },
    ]);

  return (
    <div className="panel">
      <div className="toolbar">
        <select className="select" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
          <option value="">Semua pesawat</option>
          {fleet.map((a) => <option key={a.id} value={a.id}>{a.registration} · {a.model}</option>)}
        </select>
        <select className="select" value={mission} onChange={(e) => setMission(e.target.value)}>
          <option value="">Semua misi</option>
          {MISSIONS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select className="select" value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="7">7 hari terakhir</option>
          <option value="30">30 hari terakhir</option>
          <option value="90">90 hari terakhir</option>
          <option value="all">Semua</option>
        </select>
        <span className="spacer" />
        <span className="chip">{rows.length} penerbangan · {formatNumber(total, 1)} jam</span>
        <button className="btn btn-plain btn-sm" onClick={exportCSV}><Icon name="download" />CSV</button>
      </div>
      {rows.length === 0 ? <EmptyState icon="clock" title="Belum ada penerbangan pada periode ini" /> : (
        <>
          <div className="table-wrap">
            <table className="table compact">
              <thead><tr><th>Tanggal</th><th>Pesawat</th><th>Misi</th><th className="text-right">Jam</th><th className="text-right">Siklus</th><th>Penerbang / operator</th><th>Rute</th></tr></thead>
              <tbody>
                {pageRows.map((f) => {
                  const a = byId(db.assets, f.assetId);
                  return (
                    <tr key={f.id}>
                      <td className="nowrap">{formatDate(f.date)}</td>
                      <td className="nowrap"><Link className="link" href={`/kelaikan/detail?id=${f.assetId}`}>{a?.registration}</Link><div className="cell-sub">{a?.model}</div></td>
                      <td>{f.mission}</td>
                      <td className="text-right">{formatNumber(f.hours, 1)}</td>
                      <td className="text-right">{f.cycles}</td>
                      <td>{f.pilot}</td>
                      <td className="muted">{f.route}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pager}
        </>
      )}
    </div>
  );
}
