"use client";
import { useMemo, useState } from "react";
import { CategorySelect, ReportLayout, ReportTable, UnitSelect, describeFilters } from "@/components/reports/ReportLayout";
import { StatCard } from "@/components/ui";
import { useDB } from "@/lib/store";
import { formatNumber, todayISO } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { filterAssets } from "@/lib/reports";
import type { AssetStatus, Condition } from "@/lib/types";

const CONDS: Condition[] = ["Baik", "Rusak Ringan", "Rusak Berat"];
const STATUSES: AssetStatus[] = ["Aktif", "Dalam Pemeliharaan", "Dipinjam", "Diusulkan Hapus"];

export default function Page() {
  const db = useDB();
  const [unitId, setUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const assets = useMemo(() => filterAssets(db, unitId, categoryId), [db, unitId, categoryId]);
  const rows = db.units.map((u) => {
    const list = assets.filter((a) => a.unitId === u.id);
    return { unit: u.name, total: list.length, cond: CONDS.map((c) => list.filter((a) => a.condition === c).length), status: STATUSES.map((s) => list.filter((a) => a.status === s).length) };
  }).filter((r) => r.total);
  const colTotal = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);

  return (
    <ReportLayout
      title="Kondisi & Status Aset"
      subtitle="Matriks kondisi fisik dan status penggunaan per satuan"
      filterDesc={describeFilters(db, { unitId, categoryId })}
      filters={<><UnitSelect db={db} value={unitId} onChange={setUnitId} /><CategorySelect db={db} value={categoryId} onChange={setCategoryId} /></>}
      onExport={() => downloadCSV(`kondisi-aset-${todayISO()}`, rows, [
        { header: "Satuan", value: (r) => r.unit }, { header: "Jumlah", value: (r) => r.total },
        ...CONDS.map((c, i) => ({ header: c, value: (r: (typeof rows)[number]) => r.cond[i] })),
        ...STATUSES.map((s, i) => ({ header: s, value: (r: (typeof rows)[number]) => r.status[i] })),
      ])}
      summary={CONDS.map((c, i) => (
        <StatCard key={c} label={`Kondisi ${c.toLowerCase()}`} icon={i === 0 ? "checkCircle" : "alert"} accent={["#2F7D5B", "#B57A1F", "#A8503A"][i]} value={formatNumber(colTotal((r) => r.cond[i]))} sub={`${assets.length ? Math.round((colTotal((r) => r.cond[i]) / assets.length) * 100) : 0}% dari ${assets.length} aset`} />
      )).concat(<StatCard key="pm" label="Dalam pemeliharaan" icon="wrench" value={formatNumber(colTotal((r) => r.status[1]))} />)}
    >
      <ReportTable>
        <thead>
          <tr><th rowSpan={2}>Satuan</th><th rowSpan={2} className="text-right">Jumlah</th><th colSpan={3} style={{ textAlign: "center" }}>Kondisi</th><th colSpan={4} style={{ textAlign: "center" }}>Status</th></tr>
          <tr>{CONDS.map((c) => <th key={c} className="text-right">{c}</th>)}{STATUSES.map((s) => <th key={s} className="text-right">{s}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.unit}>
              <td className="cell-strong">{r.unit}</td>
              <td className="text-right">{r.total}</td>
              {r.cond.map((v, i) => <td key={i} className={`text-right ${i > 0 && v ? (i === 2 ? "text-critical" : "text-warning") : ""}`}>{v}</td>)}
              {r.status.map((v, i) => <td key={i} className="text-right">{v}</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td>Total</td><td className="text-right">{assets.length}</td>{CONDS.map((_, i) => <td key={i} className="text-right">{colTotal((r) => r.cond[i])}</td>)}{STATUSES.map((_, i) => <td key={i} className="text-right">{colTotal((r) => r.status[i])}</td>)}</tr></tfoot>
      </ReportTable>
    </ReportLayout>
  );
}
