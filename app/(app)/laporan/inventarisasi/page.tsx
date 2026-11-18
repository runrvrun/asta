"use client";
import { useMemo, useState } from "react";
import { ReportLayout, ReportTable, UnitSelect, describeFilters } from "@/components/reports/ReportLayout";
import { Badge, StatCard } from "@/components/ui";
import { useDB } from "@/lib/store";
import { APPROVAL_TONE, STATUS_LABEL, byId, locationName, unitName, userName } from "@/lib/domain";
import { formatDate, formatNumber, formatRupiah, todayISO } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { sum, unitScope } from "@/lib/reports";

export default function Page() {
  const db = useDB();
  const [unitId, setUnitId] = useState("");
  const sessions = useMemo(() => {
    const scope = unitScope(db, unitId);
    return db.stockTakes.filter((s) => !scope || scope.has(s.unitId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [db, unitId]);
  const [sel, setSel] = useState("");
  const session = sessions.find((s) => s.id === sel) ?? sessions[0];

  const stat = (s: (typeof sessions)[number]) => {
    const found = s.items.filter((i) => i.result === "ditemukan").length;
    const missing = s.items.filter((i) => i.result === "tidak_ditemukan");
    const pending = s.items.filter((i) => i.result === "belum").length;
    const condDiff = s.items.filter((i) => { const a = byId(db.assets, i.assetId); return i.result === "ditemukan" && i.condition && a && i.condition !== a.condition; }).length;
    return { total: s.items.length, found, missing: missing.length, pending, condDiff, missingValue: sum(missing, (i) => byId(db.assets, i.assetId)?.acquisitionValue ?? 0) };
  };
  const exceptions = session ? session.items.filter((i) => i.result !== "ditemukan" || (i.condition && i.condition !== byId(db.assets, i.assetId)?.condition)) : [];
  const resLabel = { ditemukan: "Ditemukan", tidak_ditemukan: "Tidak ditemukan", belum: "Belum diperiksa" } as const;

  return (
    <ReportLayout
      title="Hasil Inventarisasi"
      subtitle="Rekap seluruh sesi dan rincian selisih sesi terpilih"
      filterDesc={describeFilters(db, { unitId }) + (session ? ` · Rincian: ${session.no} (${session.period})` : "")}
      filters={<>
        <UnitSelect db={db} value={unitId} onChange={setUnitId} />
        <select className="select" value={session?.id ?? ""} onChange={(e) => setSel(e.target.value)} aria-label="Sesi">{sessions.map((s) => <option key={s.id} value={s.id}>{s.no} · {s.period}</option>)}</select>
      </>}
      onExport={() => session && downloadCSV(`inventarisasi-${session.no}-${todayISO()}`, session.items, [
        { header: "Kode", value: (i) => byId(db.assets, i.assetId)?.code }, { header: "Nama Aset", value: (i) => byId(db.assets, i.assetId)?.name },
        { header: "Lokasi Tercatat", value: (i) => locationName(db, byId(db.assets, i.assetId)?.locationId) }, { header: "Hasil", value: (i) => resLabel[i.result] },
        { header: "Kondisi Tercatat", value: (i) => byId(db.assets, i.assetId)?.condition }, { header: "Kondisi Fisik", value: (i) => i.condition ?? "" },
        { header: "Catatan", value: (i) => i.note ?? "" }, { header: "Diperiksa", value: (i) => i.checkedAt?.slice(0, 10) ?? "" }, { header: "Pemeriksa", value: (i) => (i.checkedBy ? userName(db, i.checkedBy) : "") },
      ])}
      summary={session ? (() => { const s = stat(session); return <>
        <StatCard label="Aset diperiksa" icon="list" value={`${s.total - s.pending}/${s.total}`} sub={`${s.total ? Math.round(((s.total - s.pending) / s.total) * 100) : 0}% selesai`} />
        <StatCard label="Ditemukan" icon="checkCircle" value={formatNumber(s.found)} />
        <StatCard label="Tidak ditemukan" icon="alert" accent="#A8503A" value={formatNumber(s.missing)} sub={`Nilai ${formatRupiah(s.missingValue)}`} />
        <StatCard label="Selisih kondisi" icon="activity" accent="#B57A1F" value={formatNumber(s.condDiff)} sub="Kondisi fisik ≠ tercatat" />
      </>; })() : undefined}
    >
      <ReportTable title="Rekap sesi inventarisasi">
        <thead><tr><th>Nomor</th><th>Periode</th><th>Satuan</th><th>Ketua tim</th><th>Mulai / selesai</th><th>Status</th><th className="text-right">Aset</th><th className="text-right">Ditemukan</th><th className="text-right">Tidak ditemukan</th><th className="text-right">Belum</th></tr></thead>
        <tbody>
          {sessions.map((s) => { const x = stat(s); return (
            <tr key={s.id}>
              <td className="cell-strong">{s.no}</td><td>{s.period}</td><td>{unitName(db, s.unitId)}</td><td>{userName(db, s.leaderId)}</td>
              <td className="nowrap">{formatDate(s.startedAt)}{s.completedAt ? ` – ${formatDate(s.completedAt)}` : ""}</td>
              <td><Badge tone={APPROVAL_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge></td>
              <td className="text-right">{x.total}</td><td className="text-right">{x.found}</td><td className={`text-right ${x.missing ? "text-critical" : ""}`}>{x.missing}</td><td className="text-right">{x.pending}</td>
            </tr>); })}
        </tbody>
        <tfoot><tr><td colSpan={6}>Total ({sessions.length} sesi)</td><td className="text-right">{sum(sessions, (s) => stat(s).total)}</td><td className="text-right">{sum(sessions, (s) => stat(s).found)}</td><td className="text-right">{sum(sessions, (s) => stat(s).missing)}</td><td className="text-right">{sum(sessions, (s) => stat(s).pending)}</td></tr></tfoot>
      </ReportTable>
      {session && (
        <ReportTable title={`Selisih & pengecualian · ${session.no}`}>
          <thead><tr><th>Kode</th><th>Nama aset</th><th>Lokasi tercatat</th><th>Hasil</th><th>Kondisi tercatat → fisik</th><th>Catatan</th></tr></thead>
          <tbody>
            {exceptions.map((i) => { const a = byId(db.assets, i.assetId); return (
              <tr key={i.assetId}>
                <td className="nowrap cell-strong">{a?.code}</td><td>{a?.name}</td><td>{locationName(db, a?.locationId)}</td>
                <td><Badge tone={i.result === "tidak_ditemukan" ? "critical" : i.result === "belum" ? "neutral" : "warning"}>{resLabel[i.result]}</Badge></td>
                <td>{a?.condition}{i.condition && i.condition !== a?.condition ? ` → ${i.condition}` : ""}</td>
                <td>{i.note ?? "-"}</td>
              </tr>); })}
            {exceptions.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: "center" }}>Tidak ada selisih.</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={6}>{exceptions.length} item memerlukan tindak lanjut</td></tr></tfoot>
        </ReportTable>
      )}
    </ReportLayout>
  );
}
