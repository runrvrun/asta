"use client";
import { useMemo, useState } from "react";
import { CategorySelect, ReportLayout, ReportTable, UnitSelect, describeFilters } from "@/components/reports/ReportLayout";
import { StatCard } from "@/components/ui";
import { useDB } from "@/lib/store";
import { depreciation } from "@/lib/domain";
import { formatNumber, formatRupiah, formatRupiahShort, todayISO } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { filterAssets, sum } from "@/lib/reports";

export default function Page() {
  const db = useDB();
  const [unitId, setUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [asOf, setAsOf] = useState(todayISO());
  const at = useMemo(() => new Date((asOf || todayISO()) + "T23:59:59"), [asOf]);

  const rows = useMemo(() => filterAssets(db, unitId, categoryId)
    .filter((a) => a.acquisitionDate <= (asOf || todayISO()))
    .map((a) => ({ a, dep: depreciation(a, at) })), [db, unitId, categoryId, asOf, at]);

  const groups = db.categories.map((c) => {
    const list = rows.filter((r) => r.a.categoryId === c.id).sort((x, y) => x.a.code.localeCompare(y.a.code));
    return { cat: c, list, cost: sum(list, (r) => r.a.acquisitionValue), acc: sum(list, (r) => r.dep.accumulated), book: sum(list, (r) => r.dep.bookValue) };
  }).filter((g) => g.list.length);

  const cost = sum(rows, (r) => r.a.acquisitionValue);
  const acc = sum(rows, (r) => r.dep.accumulated);
  const book = sum(rows, (r) => r.dep.bookValue);
  const perYear = sum(rows, (r) => r.dep.perYear);

  return (
    <ReportLayout
      title="Nilai & Penyusutan Aset"
      subtitle="Metode garis lurus berdasarkan masa manfaat dan nilai residu tiap aset"
      filterDesc={describeFilters(db, { unitId, categoryId, asOf })}
      filters={<>
        <UnitSelect db={db} value={unitId} onChange={setUnitId} />
        <CategorySelect db={db} value={categoryId} onChange={setCategoryId} />
        <label className="row small muted" style={{ gap: 6 }}>Per tanggal <input type="date" className="input" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></label>
      </>}
      onExport={() => downloadCSV(`penyusutan-aset-${asOf}`, rows, [
        { header: "Kode", value: (r) => r.a.code }, { header: "Nama", value: (r) => r.a.name }, { header: "Kategori", value: (r) => db.categories.find((c) => c.id === r.a.categoryId)?.name },
        { header: "Tgl Perolehan", value: (r) => r.a.acquisitionDate }, { header: "Masa Manfaat (th)", value: (r) => r.a.usefulLife },
        { header: "Nilai Perolehan", value: (r) => r.a.acquisitionValue }, { header: "Penyusutan per Tahun", value: (r) => Math.round(r.dep.perYear) },
        { header: "Akumulasi Penyusutan", value: (r) => Math.round(r.dep.accumulated) }, { header: "Nilai Buku", value: (r) => Math.round(r.dep.bookValue) },
      ])}
      summary={<>
        <StatCard label="Nilai perolehan" icon="box" value={formatRupiahShort(cost)} sub={`${rows.length} aset`} />
        <StatCard label="Akumulasi penyusutan" icon="trendDown" accent="#B57A1F" value={formatRupiahShort(acc)} sub={`${cost ? formatNumber((acc / cost) * 100, 1) : 0}% dari nilai perolehan`} />
        <StatCard label="Nilai buku" icon="chart" value={formatRupiahShort(book)} />
        <StatCard label="Beban penyusutan / tahun" icon="calendar" value={formatRupiahShort(perYear)} />
      </>}
    >
      <ReportTable>
        <thead><tr><th>Kode</th><th>Nama aset</th><th>Perolehan</th><th className="text-right">Umur / manfaat</th><th className="text-right">Nilai perolehan</th><th className="text-right">Akumulasi penyusutan</th><th className="text-right">Nilai buku</th></tr></thead>
        {groups.map((g) => (
          <tbody key={g.cat.id}>
            <tr><td colSpan={7} style={{ background: "var(--panel)", fontWeight: 800 }}>{g.cat.name}{g.cat.usefulLife === 0 && <span className="cell-sub"> · tidak disusutkan</span>}</td></tr>
            {g.list.map(({ a, dep }) => (
              <tr key={a.id}>
                <td className="nowrap">{a.code}</td>
                <td>{a.name}</td>
                <td className="nowrap">{a.acquisitionDate.slice(0, 4)}</td>
                <td className="text-right nowrap">{formatNumber(dep.ageYears, 1)} / {a.usefulLife || "-"} th</td>
                <td className="text-right nowrap">{formatRupiah(a.acquisitionValue)}</td>
                <td className="text-right nowrap">{formatRupiah(dep.accumulated)}</td>
                <td className="text-right nowrap cell-strong">{formatRupiah(dep.bookValue)}</td>
              </tr>
            ))}
            <tr><td colSpan={4} className="cell-strong">Subtotal {g.cat.name}</td><td className="text-right nowrap cell-strong">{formatRupiah(g.cost)}</td><td className="text-right nowrap cell-strong">{formatRupiah(g.acc)}</td><td className="text-right nowrap cell-strong">{formatRupiah(g.book)}</td></tr>
          </tbody>
        ))}
        <tfoot><tr><td colSpan={4}>Total</td><td className="text-right nowrap">{formatRupiah(cost)}</td><td className="text-right nowrap">{formatRupiah(acc)}</td><td className="text-right nowrap">{formatRupiah(book)}</td></tr></tfoot>
      </ReportTable>
    </ReportLayout>
  );
}
