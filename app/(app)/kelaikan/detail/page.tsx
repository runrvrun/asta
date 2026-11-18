"use client";
import "@/components/charts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { CHART_COLORS, gridColor } from "@/components/charts";
import { Icon } from "@/components/Icon";
import { Badge, ConfirmDialog, EmptyState, Field, KV, Modal, PageHeader, toast, usePaged } from "@/components/ui";
import { FlightLogDialog } from "@/components/maintenance/FlightLogDialog";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { AIRWORTHINESS_TONE, PRIORITY_TONE, WO_STATUS_LABEL, WO_STATUS_TONE, byId, categoryName, inspectionStatus, locationName, unitName } from "@/lib/domain";
import { formatDate, formatNumber, monthLabel, todayISO } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { MISSIONS } from "@/lib/maintenance";
import type { Airworthiness, AviationInfo } from "@/lib/types";

function AircraftDetail() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const db = useDB();
  const user = useCurrentUser()!;
  const mutate = useStore((s) => s.mutate);
  const [dialog, setDialog] = useState<null | "log" | "status" | "inspection" | "cert">(null);

  const asset = byId(db.assets, id);
  const logs = db.flightLogs.filter((f) => f.assetId === id).sort((a, b) => b.date.localeCompare(a.date));
  const { rows: pageLogs, pager } = usePaged(logs, 12);

  const monthly = (() => {
    const now = new Date();
    const months: { label: string; key: string; hours: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: monthLabel(d.getFullYear(), d.getMonth()), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, hours: 0 });
    }
    for (const f of logs) {
      const m = months.find((x) => x.key === f.date.slice(0, 7));
      if (m) m.hours += f.hours;
    }
    return months;
  })();
  const missionMix = MISSIONS.map((m) => ({ m, h: logs.filter((f) => f.mission === m).reduce((s, f) => s + f.hours, 0) })).filter((x) => x.h > 0);

  if (!asset || !asset.aviation) {
    return (
      <>
        <PageHeader title="Pesawat tidak ditemukan" back="/kelaikan" />
        <div className="panel"><EmptyState icon="plane" title="Data tidak ditemukan">Aset ini bukan pesawat atau tautan tidak valid. <Link className="link" href="/kelaikan">Kembali</Link></EmptyState></div>
      </>
    );
  }
  const av = asset.aviation;
  const s = inspectionStatus(asset)!;
  const used = Math.max(0, Math.min(100, ((av.flightHours - av.lastInspectionHours) / av.inspectionIntervalHours) * 100));
  const wos = db.workOrders.filter((w) => w.assetId === asset.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const hours12 = monthly.reduce((t, m) => t + m.hours, 0);
  const canLog = can(user.role, "flight.log") && asset.status !== "Dihapus";
  const canEdit = can(user.role, "airworthiness.edit") && asset.status !== "Dihapus";
  const ref = asset.registration ?? asset.code;

  const updateAv = (fn: (a: AviationInfo) => void, action: string, detail: string) =>
    mutate((d) => {
      const a = d.assets.find((x) => x.id === asset.id);
      if (a?.aviation) { fn(a.aviation); a.updatedAt = new Date().toISOString(); }
    }, { action, module: "Kelaikan", ref, detail });

  return (
    <>
      <PageHeader
        title={`${asset.registration} · ${asset.model}`}
        breadcrumb={<><Link href="/kelaikan">Kelaikan</Link> / Detail</>}
        subtitle={`${categoryName(db, asset.categoryId)} · ${unitName(db, asset.unitId)}, ${locationName(db, asset.locationId)}`}
        back="/kelaikan"
        actions={<>
          <Link className="btn btn-plain" href={`/aset/detail?id=${asset.id}`}><Icon name="box" />Data aset</Link>
          {can(user.role, "wo.create") && <Link className="btn btn-secondary" href={`/pemeliharaan/baru?assetId=${asset.id}`}><Icon name="wrench" />Buat WO Inspeksi</Link>}
          {canLog && <button className="btn btn-primary" onClick={() => setDialog("log")}><Icon name="plus" />Catat Penerbangan</button>}
        </>}
      />

      {s.remainingHours <= 0 && <div className="alert critical"><Icon name="alert" />Melewati batas inspeksi berkala sebesar {formatNumber(Math.abs(s.remainingHours))} jam. Jadwalkan inspeksi segera.</div>}
      {s.certDays < 0 && <div className="alert critical"><Icon name="alert" />Sertifikat kelaikan kedaluwarsa sejak {formatDate(av.certificateExpiry)}.</div>}
      {s.certDays >= 0 && s.certDays <= 30 && <div className="alert warning"><Icon name="clock" />Sertifikat kelaikan berakhir dalam {s.certDays} hari ({formatDate(av.certificateExpiry)}).</div>}

      <div className="layout-main-side">
        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <div><h3>Status kelaikan</h3><p>Diperbarui {formatDate(asset.updatedAt)}</p></div>
              <div className="row">
                <Badge tone={AIRWORTHINESS_TONE[av.airworthiness]}>{av.airworthiness}</Badge>
                {canEdit && <button className="btn btn-plain btn-sm" onClick={() => setDialog("status")}><Icon name="edit" />Ubah</button>}
              </div>
            </div>
            <div className="kv-grid cols-4">
              <KV label="Total jam terbang">{formatNumber(av.flightHours, av.flightHours % 1 ? 1 : 0)} jam</KV>
              <KV label="Siklus">{formatNumber(av.cycles)}</KV>
              <KV label="Mesin">{av.engine}</KV>
              <KV label="Jam 12 bulan">{formatNumber(hours12, 1)} jam</KV>
              <KV label="Interval inspeksi">{av.inspectionIntervalHours} jam</KV>
              <KV label="Inspeksi terakhir">{formatNumber(av.lastInspectionHours)} jam · {formatDate(av.lastInspectionDate)}</KV>
              <KV label="No. sertifikat">{av.certificateNo}</KV>
              <KV label="Sertifikat berlaku s.d.">{formatDate(av.certificateExpiry)}</KV>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div><h3>Jam terbang per bulan</h3><p>12 bulan terakhir</p></div>
            </div>
            <div className="chart-box">
              <Bar
                data={{ labels: monthly.map((m) => m.label), datasets: [{ data: monthly.map((m) => Math.round(m.hours * 10) / 10), backgroundColor: "#1B5FA8", borderRadius: 5, maxBarThickness: 28 }] }}
                options={{ scales: { x: { grid: { display: false } }, y: { grid: { color: gridColor }, beginAtZero: true, title: { display: true, text: "Jam" } } } }}
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div><h3>Log penerbangan</h3><p>{logs.length} penerbangan tercatat</p></div>
              <button className="btn btn-plain btn-sm" onClick={() => downloadCSV(`log-terbang-${ref}`, logs, [
                { header: "Tanggal", value: (f) => f.date }, { header: "Misi", value: (f) => f.mission }, { header: "Jam", value: (f) => String(f.hours).replace(".", ",") },
                { header: "Siklus", value: (f) => f.cycles }, { header: "Penerbang", value: (f) => f.pilot }, { header: "Rute", value: (f) => f.route },
              ])}><Icon name="download" />CSV</button>
            </div>
            {logs.length === 0 ? <EmptyState icon="clock" title="Belum ada penerbangan" /> : (
              <>
                <div className="table-wrap">
                  <table className="table compact">
                    <thead><tr><th>Tanggal</th><th>Misi</th><th className="text-right">Jam</th><th className="text-right">Siklus</th><th>Penerbang</th><th>Rute</th></tr></thead>
                    <tbody>
                      {pageLogs.map((f) => (
                        <tr key={f.id}>
                          <td className="nowrap">{formatDate(f.date)}</td><td>{f.mission}</td>
                          <td className="text-right">{formatNumber(f.hours, 1)}</td><td className="text-right">{f.cycles}</td>
                          <td>{f.pilot}</td><td className="muted">{f.route}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pager}
              </>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <div><h3>Inspeksi berkala</h3><p>Inspeksi berikut pada {formatNumber(s.nextDueHours)} jam</p></div>
            </div>
            <div className={`progress ${s.remainingHours <= 0 ? "critical" : s.remainingHours <= av.inspectionIntervalHours * 0.1 ? "warning" : ""}`}><div style={{ width: `${used}%` }} /></div>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 8, fontSize: 12.5 }}>
              <span className="muted">Terpakai {formatNumber(av.flightHours - av.lastInspectionHours, 1)} / {av.inspectionIntervalHours} jam</span>
              <b className={s.remainingHours <= 0 ? "text-critical" : ""}>{s.remainingHours <= 0 ? `Lewat ${formatNumber(-s.remainingHours, 1)} jam` : `Sisa ${formatNumber(s.remainingHours, 1)} jam`}</b>
            </div>
            {canEdit && (
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setDialog("inspection")}><Icon name="checkCircle" />Catat inspeksi selesai</button>
                <button className="btn btn-plain btn-sm" onClick={() => setDialog("cert")}><Icon name="file" />Perpanjang sertifikat</button>
              </div>
            )}
          </div>

          <div className="panel">
            <h3 className="section-title" style={{ marginBottom: 10 }}>Komposisi misi</h3>
            {missionMix.length === 0 ? <div className="muted small">Belum ada data.</div> : (
              <div className="row" style={{ flexWrap: "nowrap", gap: 16 }}>
                <div style={{ width: 140, height: 140, flexShrink: 0, position: "relative" }}>
                  <Doughnut data={{ labels: missionMix.map((x) => x.m), datasets: [{ data: missionMix.map((x) => Math.round(x.h * 10) / 10), backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: "#fff" }] }} options={{ cutout: "62%" }} />
                </div>
                <div className="stack" style={{ gap: 6, flex: 1 }}>
                  {missionMix.map((x, i) => (
                    <div key={x.m} className="row" style={{ justifyContent: "space-between", fontSize: 12.5 }}>
                      <span className="legend-item"><span className="legend-dot" style={{ background: CHART_COLORS[i] }} />{x.m}</span>
                      <b>{formatNumber(x.h, 1)} jam</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <div><h3>Work order</h3><p>{wos.length} work order untuk pesawat ini</p></div>
            </div>
            {wos.length === 0 ? <div className="muted small">Belum ada work order.</div> : (
              <div className="stack" style={{ gap: 8 }}>
                {wos.slice(0, 6).map((w) => (
                  <Link key={w.id} href={`/pemeliharaan/detail?id=${w.id}`} className="row" style={{ background: "var(--panel)", borderRadius: 9, padding: "9px 11px", flexWrap: "nowrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cell-strong" style={{ fontSize: 12.5 }}>{w.no}</div>
                      <div className="cell-sub" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.title}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                      <Badge tone={WO_STATUS_TONE[w.status]}>{WO_STATUS_LABEL[w.status]}</Badge>
                      <Badge tone={PRIORITY_TONE[w.priority]} dot={false}>{w.priority}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <FlightLogDialog open={dialog === "log"} onClose={() => setDialog(null)} assetId={asset.id} />
      <StatusDialog open={dialog === "status"} onClose={() => setDialog(null)} current={av.airworthiness}
        onSave={(st, note) => { updateAv((a) => { a.airworthiness = st; }, "Mengubah status kelaikan", `${av.airworthiness} → ${st}: ${note}`); toast.success(`Status kelaikan ${ref}: ${st}`); }} />
      <ConfirmDialog open={dialog === "inspection"} onClose={() => setDialog(null)} title="Catat inspeksi berkala selesai?"
        message={`Inspeksi dicatat pada ${formatNumber(av.flightHours, 1)} jam (hari ini). Inspeksi berikutnya pada ${formatNumber(av.flightHours + av.inspectionIntervalHours)} jam.`}
        noteLabel="Referensi (mis. nomor WO / berita acara)" confirmLabel="Simpan"
        onConfirm={(note) => { updateAv((a) => { a.lastInspectionHours = a.flightHours; a.lastInspectionDate = todayISO(); }, "Mencatat inspeksi", note || `Inspeksi ${av.inspectionIntervalHours} jam`); toast.success("Inspeksi berkala dicatat"); }} />
      <CertDialog open={dialog === "cert"} onClose={() => setDialog(null)} currentNo={av.certificateNo} reg={ref}
        onSave={(no, exp) => { updateAv((a) => { a.certificateNo = no; a.certificateExpiry = exp; }, "Memperpanjang sertifikat", `${no} s.d. ${formatDate(exp)}`); toast.success("Sertifikat kelaikan diperbarui"); }} />
    </>
  );
}

function StatusDialog({ open, onClose, current, onSave }: { open: boolean; onClose: () => void; current: Airworthiness; onSave: (s: Airworthiness, note: string) => void }) {
  const [st, setSt] = useState<Airworthiness>(current);
  const [note, setNote] = useState("");
  const valid = st !== current && note.trim().length >= 5;
  const close = () => { setSt(current); setNote(""); onClose(); };
  return (
    <Modal open={open} onClose={close} title="Ubah status kelaikan"
      footer={<><button className="btn btn-plain" onClick={close}>Batal</button><button className="btn btn-primary" disabled={!valid} onClick={() => { onSave(st, note.trim()); close(); }}>Simpan</button></>}>
      <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
        <Field label="Status baru" required>
          <div className="filter-pills">
            {(["Laik", "Laik Terbatas", "Tidak Laik"] as Airworthiness[]).map((x) => <button key={x} className={`pill ${st === x ? "active" : ""}`} onClick={() => setSt(x)}>{x}</button>)}
          </div>
        </Field>
        <Field label="Alasan / dasar perubahan" required hint="Minimal 5 karakter. Tercatat di jejak audit.">
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Hasil inspeksi 150 jam, temuan retak flap kanan" />
        </Field>
      </div>
    </Modal>
  );
}

function CertDialog({ open, onClose, currentNo, reg, onSave }: { open: boolean; onClose: () => void; currentNo: string; reg: string; onSave: (no: string, exp: string) => void }) {
  const nextYear = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };
  const [no, setNo] = useState(`SKL/${reg}/${new Date().getFullYear()}`);
  const [exp, setExp] = useState(nextYear());
  const valid = no.trim().length >= 4 && exp > todayISO();
  return (
    <Modal open={open} onClose={onClose} title="Perpanjang sertifikat kelaikan" subtitle={`Sertifikat saat ini: ${currentNo}`}
      footer={<><button className="btn btn-plain" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!valid} onClick={() => { onSave(no.trim(), exp); onClose(); }}>Simpan</button></>}>
      <div className="form-grid">
        <Field label="Nomor sertifikat baru" required><input className="input" value={no} onChange={(e) => setNo(e.target.value)} /></Field>
        <Field label="Berlaku sampai" required error={exp <= todayISO() ? "Harus setelah hari ini." : undefined}><input type="date" className="input" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export default function AircraftDetailPage() {
  return (
    <Suspense fallback={<div className="loader-screen"><div className="spinner" /></div>}>
      <AircraftDetail />
    </Suspense>
  );
}
