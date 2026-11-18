"use client";
import { useMemo, useState } from "react";
import { PeriodInputs, ReportLayout, ReportTable, UnitSelect, describeFilters } from "@/components/reports/ReportLayout";
import { Badge, StatCard } from "@/components/ui";
import { useDB } from "@/lib/store";
import { byId, locationName } from "@/lib/domain";
import { formatNumber, formatRupiah, formatRupiahShort } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { defaultPeriod, inPeriod, sum, unitScope } from "@/lib/reports";
import type { SparePart } from "@/lib/types";

const CATS: SparePart["category"][] = ["Mesin", "Avionik", "Hidrolik", "Kelistrikan", "Struktur", "Roda & Rem", "Consumable", "Kendaraan"];

export default function Page() {
  const db = useDB();
  const [unitId, setUnitId] = useState("");
  const [cat, setCat] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [{ from, to }, setPeriod] = useState(defaultPeriod);

  const parts = useMemo(() => {
    const scope = unitScope(db, unitId);
    return db.spareParts.filter((p) => (!scope || scope.has(byId(db.locations, p.locationId)?.unitId ?? "")) && (!cat || p.category === cat) && (!onlyLow || p.stock < p.minStock))
      .sort((a, b) => a.partNumber.localeCompare(b.partNumber));
  }, [db, unitId, cat, onlyLow]);
  const moves = (p: SparePart, type: "masuk" | "keluar") => sum(db.stockMovements.filter((m) => m.partId === p.id && m.type === type && inPeriod(m.date, from, to)), (m) => m.qty);
  const value = sum(parts, (p) => p.stock * p.price);
  const low = parts.filter((p) => p.stock < p.minStock);
  const reorder = sum(low, (p) => (p.minStock - p.stock) * p.price);

  return (
    <ReportLayout
      title="Posisi Stok Suku Cadang"
      subtitle="Stok saat ini, nilai persediaan, dan pergerakan stok dalam periode"
      filterDesc={describeFilters(db, { unitId, from, to }) + (cat ? ` · Kategori: ${cat}` : "") + (onlyLow ? " · Hanya di bawah minimum" : "")}
      filters={<>
        <PeriodInputs from={from} to={to} onFrom={(v) => setPeriod((p) => ({ ...p, from: v }))} onTo={(v) => setPeriod((p) => ({ ...p, to: v }))} />
        <UnitSelect db={db} value={unitId} onChange={setUnitId} />
        <select className="select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori"><option value="">Semua kategori</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <label className="checkbox"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />Hanya di bawah minimum</label>
      </>}
      onExport={() => downloadCSV(`stok-suku-cadang-${to}`, parts, [
        { header: "Part Number", value: (p) => p.partNumber }, { header: "Nama", value: (p) => p.name }, { header: "Kategori", value: (p) => p.category },
        { header: "Gudang", value: (p) => locationName(db, p.locationId) }, { header: "Satuan", value: (p) => p.uom }, { header: "Masuk Periode", value: (p) => moves(p, "masuk") },
        { header: "Keluar Periode", value: (p) => moves(p, "keluar") }, { header: "Stok", value: (p) => p.stock }, { header: "Stok Minimum", value: (p) => p.minStock },
        { header: "Harga Satuan", value: (p) => p.price }, { header: "Nilai Persediaan", value: (p) => p.stock * p.price },
      ])}
      summary={<>
        <StatCard label="Item suku cadang" icon="package" value={formatNumber(parts.length)} />
        <StatCard label="Nilai persediaan" icon="chart" value={formatRupiahShort(value)} />
        <StatCard label="Di bawah minimum" icon="alert" accent="#A8503A" value={formatNumber(low.length)} sub={`${low.filter((p) => p.stock === 0).length} item stok habis`} />
        <StatCard label="Estimasi biaya pengadaan ulang" icon="refresh" accent="#B57A1F" value={formatRupiahShort(reorder)} sub="Untuk kembali ke stok minimum" />
      </>}
    >
      <ReportTable>
        <thead><tr><th>Part number</th><th>Nama / kategori</th><th>Gudang</th><th className="text-right">Masuk</th><th className="text-right">Keluar</th><th className="text-right">Stok / min.</th><th>Status</th><th className="text-right">Harga satuan</th><th className="text-right">Nilai persediaan</th></tr></thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.id}>
              <td className="cell-strong nowrap">{p.partNumber}</td>
              <td>{p.name}<div className="cell-sub">{p.category}</div></td>
              <td>{locationName(db, p.locationId)}</td>
              <td className="text-right">{moves(p, "masuk")}</td>
              <td className="text-right">{moves(p, "keluar")}</td>
              <td className="text-right nowrap">{p.stock} / {p.minStock} {p.uom}</td>
              <td>{p.stock === 0 ? <Badge tone="critical">Habis</Badge> : p.stock < p.minStock ? <Badge tone="warning">Di bawah min.</Badge> : <Badge tone="normal">Aman</Badge>}</td>
              <td className="text-right nowrap">{formatRupiah(p.price)}</td>
              <td className="text-right nowrap">{formatRupiah(p.stock * p.price)}</td>
            </tr>
          ))}
          {parts.length === 0 && <tr><td colSpan={9} className="muted" style={{ textAlign: "center" }}>Tidak ada item.</td></tr>}
        </tbody>
        <tfoot><tr><td colSpan={3}>Total ({parts.length} item)</td><td className="text-right">{sum(parts, (p) => moves(p, "masuk"))}</td><td className="text-right">{sum(parts, (p) => moves(p, "keluar"))}</td><td colSpan={3} /><td className="text-right nowrap">{formatRupiah(value)}</td></tr></tfoot>
      </ReportTable>
    </ReportLayout>
  );
}
