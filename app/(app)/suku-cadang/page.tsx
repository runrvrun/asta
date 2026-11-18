"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Badge, EmptyState, PageHeader, SearchBox, StatCard, Tabs, usePaged } from "@/components/ui";
import { PART_CATEGORIES, PartFormDialog, ReceiveDialog } from "@/components/maintenance/PartDialogs";
import { useCurrentUser, useDB } from "@/lib/store";
import { can } from "@/lib/permissions";
import { byId, locationName, userName } from "@/lib/domain";
import { formatDate, formatNumber, formatRupiah, formatRupiahShort } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import type { DB } from "@/lib/types";
import { stockLabel, stockTone } from "@/lib/maintenance";

type Tab = "stok" | "mutasi";

export default function SparePartsPage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("stok");
  const [dialog, setDialog] = useState<null | "add" | "receive">(null);
  const manage = can(user.role, "part.manage");

  const totalValue = db.spareParts.reduce((s, p) => s + p.stock * p.price, 0);
  const low = db.spareParts.filter((p) => p.stock > 0 && p.stock < p.minStock).length;
  const out = db.spareParts.filter((p) => p.stock === 0).length;

  return (
    <>
      <PageHeader
        title="Suku Cadang & Gudang"
        subtitle="Persediaan suku cadang, batas minimum, dan mutasi stok"
        actions={manage && <>
          <button className="btn btn-secondary" onClick={() => setDialog("receive")}><Icon name="download" />Penerimaan Stok</button>
          <button className="btn btn-primary" onClick={() => setDialog("add")}><Icon name="plus" />Tambah Suku Cadang</button>
        </>}
      />
      <div className="kpi-grid">
        <StatCard label="Item suku cadang" value={formatNumber(db.spareParts.length)} sub={`${new Set(db.spareParts.map((p) => p.locationId)).size} lokasi gudang`} icon="package" />
        <StatCard label="Nilai persediaan" value={formatRupiahShort(totalValue)} sub="Stok × harga satuan" icon="chart" accent="#2E86D6" />
        <StatCard label="Di bawah minimum" value={low} sub="Perlu pengadaan ulang" icon="alert" accent="#B57A1F" />
        <StatCard label="Stok habis" value={out} sub="Dapat menghambat work order" icon="x" accent="#A8503A" />
      </div>

      <Tabs<Tab> tabs={[{ id: "stok", label: "Persediaan" }, { id: "mutasi", label: "Mutasi Stok" }]} value={tab} onChange={setTab} />
      {tab === "stok" ? <StockTable db={db} onOpen={(id) => router.push(`/suku-cadang/detail?id=${id}`)} /> : <MovementTable db={db} />}

      <PartFormDialog open={dialog === "add"} onClose={() => setDialog(null)} onSaved={(id) => router.push(`/suku-cadang/detail?id=${id}`)} />
      <ReceiveDialog open={dialog === "receive"} onClose={() => setDialog(null)} />
    </>
  );
}

function StockTable({ db, onOpen }: { db: DB; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [loc, setLoc] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const locations = db.locations.filter((l) => db.spareParts.some((p) => p.locationId === l.id));
  const rows = useMemo(() => db.spareParts
    .filter((p) => (!cat || p.category === cat) && (!loc || p.locationId === loc) && (!lowOnly || p.stock < p.minStock))
    .filter((p) => !q || `${p.partNumber} ${p.name} ${p.compatible}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.stock / Math.max(1, a.minStock)) - (b.stock / Math.max(1, b.minStock))), [db.spareParts, q, cat, loc, lowOnly]);
  const { rows: pageRows, pager } = usePaged(rows, 15);

  const exportCSV = () => downloadCSV("persediaan-suku-cadang", rows, [
    { header: "Part Number", value: (p) => p.partNumber }, { header: "Nama", value: (p) => p.name }, { header: "Kategori", value: (p) => p.category },
    { header: "Stok", value: (p) => p.stock }, { header: "Minimum", value: (p) => p.minStock }, { header: "Satuan", value: (p) => p.uom },
    { header: "Harga Satuan", value: (p) => p.price }, { header: "Nilai", value: (p) => p.price * p.stock },
    { header: "Lokasi", value: (p) => locationName(db, p.locationId) }, { header: "Kompatibilitas", value: (p) => p.compatible }, { header: "Status", value: (p) => stockLabel(p) },
  ]);

  return (
    <div className="panel">
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Cari part number, nama, kompatibilitas..." />
        <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Semua kategori</option>{PART_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="select" value={loc} onChange={(e) => setLoc(e.target.value)}>
          <option value="">Semua gudang</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <label className="checkbox"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />Hanya stok kurang</label>
        <span className="spacer" />
        <button className="btn btn-plain btn-sm" onClick={exportCSV}><Icon name="download" />CSV</button>
      </div>
      {rows.length === 0 ? <EmptyState icon="package" title="Tidak ada suku cadang yang cocok" /> : (
        <>
          <div className="table-wrap desktop-only">
            <table className="table">
              <thead><tr><th>Part number</th><th>Nama</th><th>Kategori</th><th className="text-right">Stok</th><th className="text-right">Min.</th><th>Status</th><th className="text-right">Nilai</th><th>Gudang</th></tr></thead>
              <tbody>
                {pageRows.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => onOpen(p.id)}>
                    <td className="cell-strong mono">{p.partNumber}</td>
                    <td>{p.name}<div className="cell-sub">{p.compatible}</div></td>
                    <td>{p.category}</td>
                    <td className="text-right nowrap"><b>{formatNumber(p.stock)}</b> {p.uom}</td>
                    <td className="text-right">{formatNumber(p.minStock)}</td>
                    <td><Badge tone={stockTone(p)}>{stockLabel(p)}</Badge></td>
                    <td className="text-right nowrap">{formatRupiahShort(p.stock * p.price)}</td>
                    <td>{locationName(db, p.locationId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-only">
            {pageRows.map((p) => (
              <Link key={p.id} className="list-card" href={`/suku-cadang/detail?id=${p.id}`}>
                <div className="list-card-top">
                  <div><div className="list-card-title">{p.name}</div><div className="cell-sub mono">{p.partNumber}</div></div>
                  <Badge tone={stockTone(p)}>{stockLabel(p)}</Badge>
                </div>
                <div className="list-card-grid">
                  <div><b>{formatNumber(p.stock)} / {formatNumber(p.minStock)} {p.uom}</b>Stok / minimum</div>
                  <div><b>{formatRupiah(p.price)}</b>Harga satuan</div>
                  <div><b>{locationName(db, p.locationId)}</b>Gudang</div>
                  <div><b>{p.category}</b>Kategori</div>
                </div>
              </Link>
            ))}
          </div>
          {pager}
        </>
      )}
    </div>
  );
}

function MovementTable({ db }: { db: DB }) {
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const rows = useMemo(() => db.stockMovements
    .filter((m) => !type || m.type === type)
    .filter((m) => { if (!q) return true; const p = byId(db.spareParts, m.partId); return `${p?.partNumber} ${p?.name} ${m.ref}`.toLowerCase().includes(q.toLowerCase()); })
    .sort((a, b) => b.date.localeCompare(a.date)), [db, type, q]);
  const { rows: pageRows, pager } = usePaged(rows, 20);
  const exportCSV = () => downloadCSV("mutasi-stok", rows, [
    { header: "Tanggal", value: (m) => m.date }, { header: "Part Number", value: (m) => byId(db.spareParts, m.partId)?.partNumber },
    { header: "Nama", value: (m) => byId(db.spareParts, m.partId)?.name }, { header: "Jenis", value: (m) => m.type },
    { header: "Jumlah", value: (m) => (m.type === "keluar" ? -m.qty : m.qty) }, { header: "Referensi", value: (m) => m.ref },
    { header: "Keterangan", value: (m) => m.note }, { header: "Oleh", value: (m) => userName(db, m.by) },
  ]);
  return (
    <div className="panel">
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Cari part atau referensi..." />
        <div className="filter-pills">
          {[["", "Semua"], ["masuk", "Masuk"], ["keluar", "Keluar"], ["penyesuaian", "Penyesuaian"]].map(([v, l]) => (
            <button key={v} className={`pill ${type === v ? "active" : ""}`} onClick={() => setType(v)}>{l}</button>
          ))}
        </div>
        <span className="spacer" />
        <button className="btn btn-plain btn-sm" onClick={exportCSV}><Icon name="download" />CSV</button>
      </div>
      {rows.length === 0 ? <EmptyState icon="refresh" title="Belum ada mutasi stok" /> : (
        <>
          <div className="table-wrap">
            <table className="table compact">
              <thead><tr><th>Tanggal</th><th>Suku cadang</th><th>Jenis</th><th className="text-right">Jumlah</th><th>Referensi</th><th>Oleh</th></tr></thead>
              <tbody>
                {pageRows.map((m) => {
                  const p = byId(db.spareParts, m.partId);
                  const delta = m.type === "keluar" ? -m.qty : m.qty;
                  return (
                    <tr key={m.id}>
                      <td className="nowrap">{formatDate(m.date)}</td>
                      <td>{p ? <Link className="link" href={`/suku-cadang/detail?id=${p.id}`}>{p.name}</Link> : "-"}<div className="cell-sub mono">{p?.partNumber}</div></td>
                      <td><Badge tone={m.type === "masuk" ? "normal" : m.type === "keluar" ? "warning" : "neutral"}>{m.type === "masuk" ? "Masuk" : m.type === "keluar" ? "Keluar" : "Penyesuaian"}</Badge></td>
                      <td className={`text-right nowrap ${delta < 0 ? "text-critical" : "text-success"}`} style={{ fontWeight: 700 }}>{delta > 0 ? "+" : ""}{formatNumber(delta)} {p?.uom}</td>
                      <td>{m.ref}{m.note && <div className="cell-sub">{m.note}</div>}</td>
                      <td>{userName(db, m.by)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pager}
        </>
      )}
    </div>
  );
}
