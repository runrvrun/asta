"use client";
import { useMemo, useState } from "react";
import { PeriodInputs, ReportLayout, ReportTable, UnitSelect, describeFilters } from "@/components/reports/ReportLayout";
import { Badge, StatCard } from "@/components/ui";
import { useDB } from "@/lib/store";
import { APPROVAL_TONE, STATUS_LABEL, byId, currentStep, userName } from "@/lib/domain";
import { formatDate, formatNumber, formatRupiah, formatRupiahShort } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { defaultPeriod, inPeriod, sum, unitScope } from "@/lib/reports";
import type { Disposal } from "@/lib/types";

export default function Page() {
  const db = useDB();
  const [unitId, setUnitId] = useState("");
  const [method, setMethod] = useState("");
  const [{ from, to }, setPeriod] = useState(defaultPeriod);

  const rows = useMemo(() => {
    const scope = unitScope(db, unitId);
    return db.disposals.filter((d) => inPeriod(d.createdAt, from, to) && (!method || d.method === method)
      && (!scope || d.assetIds.some((id) => { const a = byId(db.assets, id); return a && scope.has(a.unitId); })))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [db, unitId, method, from, to]);
  const bookCost = (d: Disposal) => sum(d.assetIds, (id) => byId(db.assets, id)?.acquisitionValue ?? 0);
  const names = (d: Disposal) => d.assetIds.length ? d.assetIds.map((id) => byId(db.assets, id)?.name ?? id).join(", ") : "Aset non-register (lihat lampiran)";
  const stage = (d: Disposal) => d.status === "diajukan" ? currentStep(d.approvals)?.title ?? "-" : d.status === "ditolak" ? `Ditolak pada ${d.approvals.find((s) => s.status === "ditolak")?.title ?? "-"}` : "Selesai";
  const approved = rows.filter((d) => d.status === "disetujui");

  return (
    <ReportLayout
      title="Laporan Penghapusan Aset"
      filterDesc={describeFilters(db, { unitId, from, to }) + (method ? ` · Metode: ${method}` : "")}
      filters={<>
        <PeriodInputs from={from} to={to} onFrom={(v) => setPeriod((p) => ({ ...p, from: v }))} onTo={(v) => setPeriod((p) => ({ ...p, to: v }))} />
        <UnitSelect db={db} value={unitId} onChange={setUnitId} />
        <select className="select" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Metode"><option value="">Semua metode</option>{["Lelang", "Hibah", "Pemusnahan", "Pemindahtanganan"].map((m) => <option key={m}>{m}</option>)}</select>
      </>}
      onExport={() => downloadCSV(`penghapusan-aset-${from}-${to}`, rows, [
        { header: "Nomor", value: (d) => d.no }, { header: "Tanggal", value: (d) => d.createdAt.slice(0, 10) }, { header: "Aset", value: names },
        { header: "Jumlah Aset", value: (d) => d.assetIds.length }, { header: "Metode", value: (d) => d.method }, { header: "Alasan", value: (d) => d.reason },
        { header: "Pengusul", value: (d) => userName(db, d.createdBy) }, { header: "Status", value: (d) => STATUS_LABEL[d.status] }, { header: "Tahap", value: stage },
        { header: "Nilai Perolehan", value: bookCost }, { header: "Estimasi Nilai Jual/Limit", value: (d) => d.estimatedValue },
      ])}
      summary={<>
        <StatCard label="Usulan penghapusan" icon="trash" value={formatNumber(rows.length)} sub={`${sum(rows, (d) => d.assetIds.length)} aset terdaftar`} />
        <StatCard label="Dalam proses" icon="clock" accent="#B57A1F" value={formatNumber(rows.filter((d) => d.status === "diajukan").length)} />
        <StatCard label="Disetujui" icon="checkCircle" value={formatNumber(approved.length)} sub={`Estimasi nilai ${formatRupiahShort(sum(approved, (d) => d.estimatedValue))}`} />
        <StatCard label="Ditolak" icon="x" accent="#A8503A" value={formatNumber(rows.filter((d) => d.status === "ditolak").length)} />
      </>}
    >
      <ReportTable>
        <thead><tr><th>Nomor</th><th>Tanggal</th><th>Aset</th><th>Metode</th><th>Status / tahap</th><th className="text-right">Nilai perolehan</th><th className="text-right">Estimasi nilai</th></tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="cell-strong nowrap">{d.no}<div className="cell-sub">{userName(db, d.createdBy)}</div></td>
              <td className="nowrap">{formatDate(d.createdAt)}</td>
              <td>{names(d)}<div className="cell-sub">{d.reason}</div></td>
              <td>{d.method}</td>
              <td><Badge tone={APPROVAL_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge><div className="cell-sub">{stage(d)}</div></td>
              <td className="text-right nowrap">{formatRupiah(bookCost(d))}</td>
              <td className="text-right nowrap">{formatRupiah(d.estimatedValue)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: "center" }}>Tidak ada usulan pada periode ini.</td></tr>}
        </tbody>
        <tfoot><tr><td colSpan={5}>Total ({rows.length} usulan)</td><td className="text-right nowrap">{formatRupiah(sum(rows, bookCost))}</td><td className="text-right nowrap">{formatRupiah(sum(rows, (d) => d.estimatedValue))}</td></tr></tfoot>
      </ReportTable>
    </ReportLayout>
  );
}
