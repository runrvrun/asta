"use client";
import { useMemo, useState } from "react";
import { CategorySelect, PeriodInputs, ReportLayout, ReportTable, UnitSelect, describeFilters } from "@/components/reports/ReportLayout";
import { Badge, StatCard } from "@/components/ui";
import { useDB } from "@/lib/store";
import { AIRWORTHINESS_TONE, inspectionStatus, unitName } from "@/lib/domain";
import { formatDate, formatNumber } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { defaultPeriod, filterAssets, inPeriod, sum } from "@/lib/reports";
import { AVIATION_CATEGORIES } from "@/lib/seed";

export default function Page() {
  const db = useDB();
  const [unitId, setUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [{ from, to }, setPeriod] = useState(defaultPeriod);

  const rows = useMemo(() => filterAssets(db, unitId, categoryId).filter((a) => a.aviation).map((a) => {
    const logs = db.flightLogs.filter((f) => f.assetId === a.id && inPeriod(f.date, from, to));
    return { a, sorties: logs.length, hours: sum(logs, (f) => f.hours), cycles: sum(logs, (f) => f.cycles), insp: inspectionStatus(a)! };
  }).sort((x, y) => x.a.registration!.localeCompare(y.a.registration!)), [db, unitId, categoryId, from, to]);

  const laik = rows.filter((r) => r.a.aviation!.airworthiness === "Laik").length;
  const terbatas = rows.filter((r) => r.a.aviation!.airworthiness === "Laik Terbatas").length;
  const hours = sum(rows, (r) => r.hours);

  return (
    <ReportLayout
      title="Kesiapan Armada & Jam Terbang"
      subtitle="Pesawat, helikopter, dan pesawat nirawak"
      filterDesc={describeFilters(db, { unitId, categoryId, from, to })}
      filters={<>
        <PeriodInputs from={from} to={to} onFrom={(v) => setPeriod((p) => ({ ...p, from: v }))} onTo={(v) => setPeriod((p) => ({ ...p, to: v }))} />
        <UnitSelect db={db} value={unitId} onChange={setUnitId} />
        <CategorySelect db={db} value={categoryId} onChange={setCategoryId} only={AVIATION_CATEGORIES} />
      </>}
      onExport={() => downloadCSV(`kesiapan-armada-${from}-${to}`, rows, [
        { header: "Registrasi", value: (r) => r.a.registration }, { header: "Tipe", value: (r) => `${r.a.brand} ${r.a.model}` }, { header: "Satuan", value: (r) => unitName(db, r.a.unitId) },
        { header: "Status Kelaikan", value: (r) => r.a.aviation!.airworthiness }, { header: "Total Jam Terbang", value: (r) => r.a.aviation!.flightHours },
        { header: "Sortie Periode", value: (r) => r.sorties }, { header: "Jam Terbang Periode", value: (r) => Math.round(r.hours * 10) / 10 }, { header: "Siklus Periode", value: (r) => r.cycles },
        { header: "Sisa Jam ke Inspeksi", value: (r) => Math.round(r.insp.remainingHours * 10) / 10 }, { header: "Sertifikat Berakhir", value: (r) => r.a.aviation!.certificateExpiry },
      ])}
      summary={<>
        <StatCard label="Kesiapan armada" icon="plane" accent="#2F7D5B" value={rows.length ? `${Math.round((laik / rows.length) * 100)}%` : "-"} sub={`${laik} Laik · ${terbatas} Laik Terbatas · ${rows.length - laik - terbatas} Tidak Laik`} />
        <StatCard label="Jam terbang periode" icon="clock" value={`${formatNumber(hours, 1)} jam`} sub={`${sum(rows, (r) => r.sorties)} sortie`} />
        <StatCard label="Inspeksi jatuh tempo" icon="alert" accent="#B57A1F" value={formatNumber(rows.filter((r) => r.insp.remainingHours <= r.a.aviation!.inspectionIntervalHours * 0.1).length)} sub="Sisa ≤10% interval atau terlewat" />
        <StatCard label="Sertifikat ≤30 hari" icon="shield" accent="#A8503A" value={formatNumber(rows.filter((r) => r.insp.certDays <= 30).length)} sub="Termasuk yang sudah kedaluwarsa" />
      </>}
    >
      <ReportTable>
        <thead><tr><th>Registrasi</th><th>Tipe / satuan</th><th>Kelaikan</th><th className="text-right">Total jam</th><th className="text-right">Sortie</th><th className="text-right">Jam periode</th><th className="text-right">Siklus</th><th className="text-right">Sisa ke inspeksi</th><th>Sertifikat berakhir</th></tr></thead>
        <tbody>
          {rows.map(({ a, sorties, hours: h, cycles, insp }) => (
            <tr key={a.id}>
              <td className="cell-strong">{a.registration}</td>
              <td>{a.model}<div className="cell-sub">{unitName(db, a.unitId)}</div></td>
              <td><Badge tone={AIRWORTHINESS_TONE[a.aviation!.airworthiness]}>{a.aviation!.airworthiness}</Badge></td>
              <td className="text-right">{formatNumber(a.aviation!.flightHours)}</td>
              <td className="text-right">{sorties}</td>
              <td className="text-right">{formatNumber(h, 1)}</td>
              <td className="text-right">{cycles}</td>
              <td className={`text-right nowrap ${insp.remainingHours <= 0 ? "text-critical" : insp.tone === "warning" ? "text-warning" : ""}`}>{insp.remainingHours <= 0 ? `lewat ${formatNumber(-insp.remainingHours, 1)}` : formatNumber(insp.remainingHours, 1)} jam</td>
              <td className={`nowrap ${insp.certDays < 0 ? "text-critical" : insp.certDays <= 30 ? "text-warning" : ""}`}>{formatDate(a.aviation!.certificateExpiry)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={3}>Total ({rows.length} unit)</td><td className="text-right">{formatNumber(sum(rows, (r) => r.a.aviation!.flightHours))}</td><td className="text-right">{sum(rows, (r) => r.sorties)}</td><td className="text-right">{formatNumber(hours, 1)}</td><td className="text-right">{sum(rows, (r) => r.cycles)}</td><td colSpan={2} /></tr></tfoot>
      </ReportTable>
    </ReportLayout>
  );
}
