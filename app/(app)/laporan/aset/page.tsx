"use client";
import { useMemo, useState } from "react";
import { CategorySelect, ReportLayout, ReportTable, UnitSelect, describeFilters } from "@/components/reports/ReportLayout";
import { Badge, StatCard, Tabs } from "@/components/ui";
import { useDB } from "@/lib/store";
import { ASSET_STATUS_TONE, CONDITION_TONE, categoryName, locationName, unitName } from "@/lib/domain";
import { formatNumber, formatRupiah, formatRupiahShort, todayISO } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { filterAssets, sum } from "@/lib/reports";

type View = "daftar" | "kategori" | "satuan";

export default function Page() {
  const db = useDB();
  const [unitId, setUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [view, setView] = useState<View>("daftar");
  const assets = useMemo(() => filterAssets(db, unitId, categoryId).sort((a, b) => a.code.localeCompare(b.code)), [db, unitId, categoryId]);
  const total = sum(assets, (a) => a.acquisitionValue);

  const byCat = db.categories.map((c) => {
    const list = assets.filter((a) => a.categoryId === c.id);
    return { id: c.id, name: c.name, count: list.length, value: sum(list, (a) => a.acquisitionValue), baik: list.filter((a) => a.condition === "Baik").length };
  }).filter((r) => r.count);
  const byUnit = db.units.map((u) => {
    const list = assets.filter((a) => a.unitId === u.id);
    return { id: u.id, name: u.name, count: list.length, value: sum(list, (a) => a.acquisitionValue), baik: list.filter((a) => a.condition === "Baik").length };
  }).filter((r) => r.count);

  const exportCSV = () => {
    if (view === "daftar") {
      downloadCSV(`laporan-aset-${todayISO()}`, assets, [
        { header: "Kode", value: (a) => a.code }, { header: "Nama", value: (a) => a.name }, { header: "Kategori", value: (a) => categoryName(db, a.categoryId) },
        { header: "Merek/Model", value: (a) => `${a.brand} ${a.model}` }, { header: "No. Registrasi", value: (a) => a.registration ?? "" }, { header: "Tahun", value: (a) => a.year },
        { header: "Satuan", value: (a) => unitName(db, a.unitId) }, { header: "Lokasi", value: (a) => locationName(db, a.locationId) },
        { header: "Kondisi", value: (a) => a.condition }, { header: "Status", value: (a) => a.status }, { header: "Nilai Perolehan", value: (a) => a.acquisitionValue },
      ]);
    } else {
      const rows = view === "kategori" ? byCat : byUnit;
      downloadCSV(`rekap-aset-per-${view}-${todayISO()}`, rows, [
        { header: view === "kategori" ? "Kategori" : "Satuan", value: (r) => r.name }, { header: "Jumlah", value: (r) => r.count },
        { header: "Kondisi Baik", value: (r) => r.baik }, { header: "Nilai Perolehan", value: (r) => r.value },
      ]);
    }
  };

  return (
    <ReportLayout
      title="Daftar & Rekapitulasi Aset"
      subtitle="Aset aktif (tidak termasuk yang telah dihapus)"
      filterDesc={describeFilters(db, { unitId, categoryId })}
      filters={<><UnitSelect db={db} value={unitId} onChange={setUnitId} /><CategorySelect db={db} value={categoryId} onChange={setCategoryId} /></>}
      onExport={exportCSV}
      summary={<>
        <StatCard label="Jumlah aset" icon="box" value={formatNumber(assets.length)} />
        <StatCard label="Nilai perolehan" icon="chart" value={formatRupiahShort(total)} />
        <StatCard label="Kondisi baik" icon="checkCircle" value={formatNumber(assets.filter((a) => a.condition === "Baik").length)} sub={`${assets.length ? Math.round((assets.filter((a) => a.condition === "Baik").length / assets.length) * 100) : 0}% dari total`} />
        <StatCard label="Kategori / satuan" icon="list" value={`${byCat.length} / ${byUnit.length}`} />
      </>}
    >
      <div className="no-print"><Tabs<View> value={view} onChange={setView} tabs={[{ id: "daftar", label: "Daftar aset" }, { id: "kategori", label: "Rekap per kategori" }, { id: "satuan", label: "Rekap per satuan" }]} /></div>
      {view === "daftar" ? (
        <ReportTable>
          <thead><tr><th>No</th><th>Kode</th><th>Nama aset</th><th>Kategori</th><th>Satuan / lokasi</th><th>Tahun</th><th>Kondisi</th><th>Status</th><th className="text-right">Nilai perolehan</th></tr></thead>
          <tbody>
            {assets.map((a, i) => (
              <tr key={a.id}>
                <td>{i + 1}</td>
                <td className="nowrap cell-strong">{a.code}</td>
                <td>{a.name}<div className="cell-sub">{a.brand} {a.model}{a.registration ? ` · ${a.registration}` : ""}</div></td>
                <td>{categoryName(db, a.categoryId)}</td>
                <td>{unitName(db, a.unitId)}<div className="cell-sub">{locationName(db, a.locationId)}</div></td>
                <td>{a.year}</td>
                <td><Badge tone={CONDITION_TONE[a.condition]}>{a.condition}</Badge></td>
                <td><Badge tone={ASSET_STATUS_TONE[a.status]}>{a.status}</Badge></td>
                <td className="text-right nowrap">{formatRupiah(a.acquisitionValue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={8}>Total ({assets.length} aset)</td><td className="text-right nowrap">{formatRupiah(total)}</td></tr></tfoot>
        </ReportTable>
      ) : (
        <ReportTable>
          <thead><tr><th>{view === "kategori" ? "Kategori" : "Satuan"}</th><th className="text-right">Jumlah</th><th className="text-right">Kondisi baik</th><th className="text-right">Nilai perolehan</th><th className="text-right">Porsi nilai</th></tr></thead>
          <tbody>
            {(view === "kategori" ? byCat : byUnit).map((r) => (
              <tr key={r.id}>
                <td className="cell-strong">{r.name}</td>
                <td className="text-right">{formatNumber(r.count)}</td>
                <td className="text-right">{formatNumber(r.baik)}</td>
                <td className="text-right nowrap">{formatRupiah(r.value)}</td>
                <td className="text-right">{total ? formatNumber((r.value / total) * 100, 1) : 0}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td><td className="text-right">{formatNumber(assets.length)}</td><td className="text-right">{formatNumber(assets.filter((a) => a.condition === "Baik").length)}</td><td className="text-right nowrap">{formatRupiah(total)}</td><td className="text-right">100%</td></tr></tfoot>
        </ReportTable>
      )}
    </ReportLayout>
  );
}
