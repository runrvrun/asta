"use client";
import { useMemo, useState } from "react";
import { PeriodInputs, ReportLayout, ReportTable, UnitSelect, describeFilters } from "@/components/reports/ReportLayout";
import { Badge, StatCard } from "@/components/ui";
import { useDB } from "@/lib/store";
import { APPROVAL_TONE, STATUS_LABEL, byId, unitName, userName } from "@/lib/domain";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { defaultPeriod, inPeriod, sum, unitScope } from "@/lib/reports";

export default function Page() {
  const db = useDB();
  const [unitId, setUnitId] = useState("");
  const [type, setType] = useState("");
  const [{ from, to }, setPeriod] = useState(defaultPeriod);

  const rows = useMemo(() => {
    const scope = unitScope(db, unitId);
    return db.transfers.filter((t) => inPeriod(t.requestedAt, from, to) && (!type || t.type === type) && (!scope || scope.has(t.fromUnitId) || scope.has(t.toUnitId)))
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  }, [db, unitId, type, from, to]);
  const value = (ids: string[]) => sum(ids, (id) => byId(db.assets, id)?.acquisitionValue ?? 0);
  const names = (ids: string[]) => ids.map((id) => byId(db.assets, id)?.name ?? id).join(", ");

  return (
    <ReportLayout
      title="Laporan Mutasi & Peminjaman"
      filterDesc={describeFilters(db, { unitId, from, to }) + (type ? ` · Jenis: ${type === "mutasi" ? "Mutasi" : "Peminjaman"}` : "")}
      filters={<>
        <PeriodInputs from={from} to={to} onFrom={(v) => setPeriod((p) => ({ ...p, from: v }))} onTo={(v) => setPeriod((p) => ({ ...p, to: v }))} />
        <UnitSelect db={db} value={unitId} onChange={setUnitId} />
        <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Jenis"><option value="">Mutasi & peminjaman</option><option value="mutasi">Mutasi</option><option value="pinjam">Peminjaman</option></select>
      </>}
      onExport={() => downloadCSV(`mutasi-peminjaman-${from}-${to}`, rows, [
        { header: "Nomor", value: (t) => t.no }, { header: "Jenis", value: (t) => (t.type === "mutasi" ? "Mutasi" : "Peminjaman") }, { header: "Tanggal Pengajuan", value: (t) => t.requestedAt.slice(0, 10) },
        { header: "Aset", value: (t) => names(t.assetIds) }, { header: "Dari", value: (t) => unitName(db, t.fromUnitId) }, { header: "Ke", value: (t) => unitName(db, t.toUnitId) },
        { header: "Pengaju", value: (t) => userName(db, t.requestedBy) }, { header: "Status", value: (t) => STATUS_LABEL[t.status] }, { header: "Jatuh Tempo", value: (t) => t.returnDate ?? "" }, { header: "Nilai Aset", value: (t) => value(t.assetIds) },
      ])}
      summary={<>
        <StatCard label="Total pengajuan" icon="transfer" value={formatNumber(rows.length)} sub={`${rows.filter((t) => t.type === "mutasi").length} mutasi · ${rows.filter((t) => t.type === "pinjam").length} peminjaman`} />
        <StatCard label="Menunggu persetujuan" icon="clock" accent="#B57A1F" value={formatNumber(rows.filter((t) => t.status === "diajukan").length)} />
        <StatCard label="Disetujui / terlaksana" icon="checkCircle" value={formatNumber(rows.filter((t) => ["disetujui", "diserahkan", "dikembalikan"].includes(t.status)).length)} />
        <StatCard label="Ditolak" icon="x" accent="#A8503A" value={formatNumber(rows.filter((t) => t.status === "ditolak").length)} />
      </>}
    >
      <ReportTable>
        <thead><tr><th>Nomor</th><th>Tanggal</th><th>Aset</th><th>Dari → ke</th><th>Pengaju</th><th>Jatuh tempo</th><th>Status</th><th className="text-right">Nilai aset</th></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="cell-strong nowrap">{t.no}<div className="cell-sub">{t.type === "mutasi" ? "Mutasi" : "Peminjaman"}</div></td>
              <td className="nowrap">{formatDate(t.requestedAt)}</td>
              <td>{names(t.assetIds)}</td>
              <td>{unitName(db, t.fromUnitId)}<div className="cell-sub">→ {unitName(db, t.toUnitId)}</div></td>
              <td>{userName(db, t.requestedBy)}</td>
              <td className="nowrap">{t.returnDate ? formatDate(t.returnDate) : "-"}</td>
              <td><Badge tone={APPROVAL_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge></td>
              <td className="text-right nowrap">{formatRupiah(value(t.assetIds))}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: "center" }}>Tidak ada data pada periode ini.</td></tr>}
        </tbody>
        <tfoot><tr><td colSpan={7}>Total ({rows.length} pengajuan)</td><td className="text-right nowrap">{formatRupiah(sum(rows, (t) => value(t.assetIds)))}</td></tr></tfoot>
      </ReportTable>
    </ReportLayout>
  );
}
