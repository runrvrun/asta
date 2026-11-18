"use client";
import { useMemo, useState } from "react";
import { CategorySelect, PeriodInputs, ReportLayout, ReportTable, UnitSelect, describeFilters } from "@/components/reports/ReportLayout";
import { Badge, StatCard } from "@/components/ui";
import { useDB } from "@/lib/store";
import { PRIORITY_TONE, WO_STATUS_LABEL, WO_STATUS_TONE, byId, userName } from "@/lib/domain";
import { formatDate, formatNumber, formatRupiah, formatRupiahShort } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { defaultPeriod, filterAssets, inPeriod, sum } from "@/lib/reports";
import type { WorkOrder, WOStatus } from "@/lib/types";

const TYPES: WorkOrder["type"][] = ["Preventif", "Korektif", "Inspeksi Berkala", "Modifikasi"];
const STATUSES: WOStatus[] = ["baru", "dikerjakan", "menunggu_part", "selesai", "dibatalkan"];

export default function Page() {
  const db = useDB();
  const [unitId, setUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [{ from, to }, setPeriod] = useState(defaultPeriod);
  const partCost = (w: WorkOrder) => sum(w.parts, (p) => (byId(db.spareParts, p.partId)?.price ?? 0) * p.qty);

  const wos = useMemo(() => {
    const ids = new Set(filterAssets(db, unitId, categoryId, true).map((a) => a.id));
    return db.workOrders.filter((w) => ids.has(w.assetId) && inPeriod(w.createdAt, from, to)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [db, unitId, categoryId, from, to]);

  const est = sum(wos, (w) => w.estHours);
  const act = sum(wos, (w) => w.actualHours);
  const cost = sum(wos, partCost);
  const done = wos.filter((w) => w.status === "selesai");
  const onTime = done.filter((w) => w.completedAt && w.completedAt.slice(0, 10) <= w.dueDate).length;

  return (
    <ReportLayout
      title="Laporan Pemeliharaan (Work Order)"
      subtitle="Work order yang dibuat dalam periode"
      filterDesc={describeFilters(db, { unitId, categoryId, from, to })}
      filters={<>
        <PeriodInputs from={from} to={to} onFrom={(v) => setPeriod((p) => ({ ...p, from: v }))} onTo={(v) => setPeriod((p) => ({ ...p, to: v }))} />
        <UnitSelect db={db} value={unitId} onChange={setUnitId} />
        <CategorySelect db={db} value={categoryId} onChange={setCategoryId} />
      </>}
      onExport={() => downloadCSV(`laporan-pemeliharaan-${from}-${to}`, wos, [
        { header: "Nomor WO", value: (w) => w.no }, { header: "Tanggal", value: (w) => w.createdAt.slice(0, 10) },
        { header: "Aset", value: (w) => byId(db.assets, w.assetId)?.name }, { header: "Kode Aset", value: (w) => byId(db.assets, w.assetId)?.code },
        { header: "Jenis", value: (w) => w.type }, { header: "Pekerjaan", value: (w) => w.title }, { header: "Prioritas", value: (w) => w.priority },
        { header: "Teknisi", value: (w) => (w.assigneeId ? userName(db, w.assigneeId) : "") }, { header: "Status", value: (w) => WO_STATUS_LABEL[w.status] },
        { header: "Target", value: (w) => w.dueDate }, { header: "Selesai", value: (w) => w.completedAt?.slice(0, 10) ?? "" },
        { header: "Jam Estimasi", value: (w) => w.estHours }, { header: "Jam Realisasi", value: (w) => w.actualHours }, { header: "Biaya Suku Cadang", value: (w) => partCost(w) },
      ])}
      summary={<>
        <StatCard label="Work order" icon="clipboard" value={formatNumber(wos.length)} sub={`${done.length} selesai · ${wos.filter((w) => ["baru", "dikerjakan", "menunggu_part"].includes(w.status)).length} aktif`} />
        <StatCard label="Selesai tepat waktu" icon="checkCircle" value={done.length ? `${Math.round((onTime / done.length) * 100)}%` : "-"} sub={`${onTime} dari ${done.length} WO selesai`} />
        <StatCard label="Jam kerja" icon="clock" value={`${formatNumber(act, 1)} jam`} sub={`Estimasi ${formatNumber(est, 1)} jam (${est ? Math.round((act / est) * 100) : 0}%)`} />
        <StatCard label="Biaya suku cadang" icon="package" value={formatRupiahShort(cost)} />
      </>}
    >
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <ReportTable title="Rekap per jenis">
          <thead><tr><th>Jenis</th><th className="text-right">Jumlah</th><th className="text-right">Jam realisasi</th><th className="text-right">Biaya part</th></tr></thead>
          <tbody>{TYPES.map((t) => { const l = wos.filter((w) => w.type === t); return <tr key={t}><td>{t}</td><td className="text-right">{l.length}</td><td className="text-right">{formatNumber(sum(l, (w) => w.actualHours), 1)}</td><td className="text-right nowrap">{formatRupiah(sum(l, partCost))}</td></tr>; })}</tbody>
          <tfoot><tr><td>Total</td><td className="text-right">{wos.length}</td><td className="text-right">{formatNumber(act, 1)}</td><td className="text-right nowrap">{formatRupiah(cost)}</td></tr></tfoot>
        </ReportTable>
        <ReportTable title="Rekap per status">
          <thead><tr><th>Status</th><th className="text-right">Jumlah</th><th className="text-right">Porsi</th></tr></thead>
          <tbody>{STATUSES.map((s) => { const n = wos.filter((w) => w.status === s).length; return <tr key={s}><td><Badge tone={WO_STATUS_TONE[s]}>{WO_STATUS_LABEL[s]}</Badge></td><td className="text-right">{n}</td><td className="text-right">{wos.length ? Math.round((n / wos.length) * 100) : 0}%</td></tr>; })}</tbody>
          <tfoot><tr><td>Total</td><td className="text-right">{wos.length}</td><td className="text-right">100%</td></tr></tfoot>
        </ReportTable>
      </div>
      <ReportTable title="Rincian work order">
        <thead><tr><th>Nomor WO</th><th>Tanggal</th><th>Aset</th><th>Jenis / pekerjaan</th><th>Prioritas</th><th>Status</th><th className="text-right">Jam est./real.</th><th className="text-right">Biaya part</th></tr></thead>
        <tbody>
          {wos.map((w) => { const a = byId(db.assets, w.assetId); return (
            <tr key={w.id}>
              <td className="cell-strong nowrap">{w.no}</td>
              <td className="nowrap">{formatDate(w.createdAt)}</td>
              <td>{a?.name}<div className="cell-sub">{a?.code}</div></td>
              <td>{w.title}<div className="cell-sub">{w.type}{w.assigneeId ? ` · ${userName(db, w.assigneeId)}` : ""}</div></td>
              <td><Badge tone={PRIORITY_TONE[w.priority]}>{w.priority}</Badge></td>
              <td><Badge tone={WO_STATUS_TONE[w.status]}>{WO_STATUS_LABEL[w.status]}</Badge></td>
              <td className="text-right nowrap">{formatNumber(w.estHours, 1)} / {formatNumber(w.actualHours, 1)}</td>
              <td className="text-right nowrap">{formatRupiah(partCost(w))}</td>
            </tr>); })}
          {wos.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: "center" }}>Tidak ada work order pada periode ini.</td></tr>}
        </tbody>
        <tfoot><tr><td colSpan={6}>Total ({wos.length} WO)</td><td className="text-right nowrap">{formatNumber(est, 1)} / {formatNumber(act, 1)}</td><td className="text-right nowrap">{formatRupiah(cost)}</td></tr></tfoot>
      </ReportTable>
    </ReportLayout>
  );
}
