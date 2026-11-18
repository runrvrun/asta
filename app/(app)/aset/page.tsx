"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, EmptyState, PageHeader, SearchBox, usePaged } from "@/components/ui";
import { CATEGORY_ICON, Icon } from "@/components/Icon";
import { useCurrentUser, useDB } from "@/lib/store";
import { can } from "@/lib/permissions";
import { ASSET_STATUS_TONE, CONDITION_TONE, categoryName, locationName, unitName, userName } from "@/lib/domain";
import { formatDate, formatNumber, formatRupiah, formatRupiahShort } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import type { Asset, AssetStatus, Condition } from "@/lib/types";

const STATUSES: AssetStatus[] = ["Aktif", "Dalam Pemeliharaan", "Dipinjam", "Diusulkan Hapus", "Dihapus"];
const CONDITIONS: Condition[] = ["Baik", "Rusak Ringan", "Rusak Berat"];

function AssetList() {
  const db = useDB();
  const user = useCurrentUser()!;
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [cat, setCat] = useState(params.get("kategori") ?? "");
  const [group, setGroup] = useState("");
  const [unit, setUnit] = useState("");
  const [status, setStatus] = useState("");
  const [cond, setCond] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // Follow ?q= changes from the topbar search while staying on this page.
  const urlQ = params.get("q") ?? "";
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  if (urlQ !== lastUrlQ) { setLastUrlQ(urlQ); setQ(urlQ); }

  const groups = Array.from(new Set(db.categories.map((c) => c.group)));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.assets.filter((a) => {
      if (!showDeleted && a.status === "Dihapus" && status !== "Dihapus") return false;
      if (cat && a.categoryId !== cat) return false;
      if (group && db.categories.find((c) => c.id === a.categoryId)?.group !== group) return false;
      if (unit && a.unitId !== unit) return false;
      if (status && a.status !== status) return false;
      if (cond && a.condition !== cond) return false;
      if (s) {
        const hay = [a.name, a.code, a.registration, a.serialNumber, a.brand, a.model, ...Object.values(a.specs)].join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [db, q, cat, group, unit, status, cond, showDeleted]);

  const total = filtered.reduce((s, a) => s + a.acquisitionValue, 0);
  const { rows, pager, setPage } = usePaged(filtered, 15);
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  const exportCSV = () =>
    downloadCSV<Asset>(`daftar-aset-${new Date().toISOString().slice(0, 10)}`, filtered, [
      { header: "Kode", value: (a) => a.code },
      { header: "Nama", value: (a) => a.name },
      { header: "Kategori", value: (a) => categoryName(db, a.categoryId) },
      { header: "Merek", value: (a) => a.brand },
      { header: "Model", value: (a) => a.model },
      { header: "No. Seri", value: (a) => a.serialNumber },
      { header: "No. Registrasi", value: (a) => a.registration ?? "" },
      { header: "Tahun", value: (a) => a.year },
      { header: "Tanggal Perolehan", value: (a) => a.acquisitionDate },
      { header: "Nilai Perolehan (Rp)", value: (a) => a.acquisitionValue },
      { header: "Satuan", value: (a) => unitName(db, a.unitId) },
      { header: "Lokasi", value: (a) => locationName(db, a.locationId) },
      { header: "Penanggung Jawab", value: (a) => userName(db, a.picId) },
      { header: "Kondisi", value: (a) => a.condition },
      { header: "Status", value: (a) => a.status },
    ]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allOnPage = rows.length > 0 && rows.every((a) => selected.includes(a.id));
  const togglePage = () => setSelected((s) => (allOnPage ? s.filter((id) => !rows.some((a) => a.id === id)) : Array.from(new Set([...s, ...rows.map((a) => a.id)]))));

  const filtersActive = q || cat || group || unit || status || cond;

  return (
    <>
      <PageHeader
        title="Daftar Aset"
        subtitle="Seluruh aset yang tercatat: alutsista udara, peralatan, kendaraan, dan properti"
        actions={<>
          <button className="btn btn-secondary" onClick={exportCSV}><Icon name="download" />Ekspor CSV</button>
          {can(user.role, "asset.create") && <Link className="btn btn-primary" href="/aset/baru"><Icon name="plus" />Daftarkan Aset</Link>}
        </>}
      />

      <div className="filter-pills" style={{ marginBottom: 12 }}>
        <button className={`pill ${!group && !cat ? "active" : ""}`} onClick={() => { setGroup(""); setCat(""); setPage(1); }}>Semua</button>
        {groups.map((g) => (
          <button key={g} className={`pill ${group === g ? "active" : ""}`} onClick={() => { setGroup(group === g ? "" : g); setCat(""); setPage(1); }}>
            {g} <span className="count">{db.assets.filter((a) => a.status !== "Dihapus" && db.categories.find((c) => c.id === a.categoryId)?.group === g).length}</span>
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="toolbar">
          <SearchBox value={q} onChange={resetPage(setQ)} placeholder="Cari nama, kode, registrasi, nomor seri..." />
          <select className="select" value={cat} onChange={(e) => resetPage(setCat)(e.target.value)}>
            <option value="">Semua kategori</option>
            {db.categories.filter((c) => !group || c.group === group).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select" value={unit} onChange={(e) => resetPage(setUnit)(e.target.value)}>
            <option value="">Semua satuan</option>
            {db.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className="select" value={status} onChange={(e) => resetPage(setStatus)(e.target.value)}>
            <option value="">Semua status</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="select" value={cond} onChange={(e) => resetPage(setCond)(e.target.value)}>
            <option value="">Semua kondisi</option>
            {CONDITIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <label className="checkbox"><input type="checkbox" checked={showDeleted} onChange={(e) => { setShowDeleted(e.target.checked); setPage(1); }} />Tampilkan aset dihapus</label>
          {filtersActive && <button className="btn btn-plain btn-sm" onClick={() => { setQ(""); setCat(""); setGroup(""); setUnit(""); setStatus(""); setCond(""); setPage(1); }}>Reset filter</button>}
        </div>

        <div className="row" style={{ marginBottom: 14, justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="chip">{formatNumber(filtered.length)} aset</span>
            <span className="chip" title={formatRupiah(total)}>Nilai perolehan {formatRupiahShort(total)}</span>
          </div>
          {selected.length > 0 && (
            <div className="row" style={{ gap: 8 }}>
              <span className="small muted">{selected.length} dipilih</span>
              <button className="btn btn-plain btn-sm" onClick={() => setSelected([])}>Batal pilih</button>
              <Link className="btn btn-primary btn-sm" href={`/aset/label?ids=${selected.join(",")}`}><Icon name="printer" />Cetak Label QR</Link>
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon="search" title="Tidak ada aset yang cocok">Ubah kata kunci atau filter pencarian.</EmptyState>
        ) : (
          <>
            <div className="table-wrap desktop-only">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}><input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Pilih semua di halaman ini" /></th>
                    <th>Aset</th><th>Kategori</th><th>Satuan / Lokasi</th><th className="text-right">Nilai Perolehan</th><th>Kondisi</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="clickable" onClick={() => router.push(`/aset/detail?id=${a.id}`)}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} aria-label={`Pilih ${a.code}`} /></td>
                      <td>
                        <div className="row" style={{ flexWrap: "nowrap" }}>
                          <div className="thumb"><Icon name={CATEGORY_ICON[a.categoryId]} /></div>
                          <div style={{ minWidth: 0 }}>
                            <div className="cell-strong">{a.name}</div>
                            <div className="cell-sub">{a.code}{a.registration ? ` · ${a.registration}` : ""} · {a.brand !== "-" ? `${a.brand} ` : ""}{a.model !== "-" ? a.model : ""}</div>
                          </div>
                        </div>
                      </td>
                      <td>{categoryName(db, a.categoryId)}</td>
                      <td>{unitName(db, a.unitId)}<div className="cell-sub">{locationName(db, a.locationId)}</div></td>
                      <td className="text-right nowrap" title={formatRupiah(a.acquisitionValue)}>{formatRupiahShort(a.acquisitionValue)}<div className="cell-sub">{formatDate(a.acquisitionDate)}</div></td>
                      <td><Badge tone={CONDITION_TONE[a.condition]}>{a.condition}</Badge></td>
                      <td><Badge tone={ASSET_STATUS_TONE[a.status]}>{a.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-only">
              {rows.map((a) => (
                <Link key={a.id} href={`/aset/detail?id=${a.id}`} className="list-card">
                  <div className="list-card-top">
                    <div className="row" style={{ flexWrap: "nowrap", minWidth: 0 }}>
                      <div className="thumb"><Icon name={CATEGORY_ICON[a.categoryId]} /></div>
                      <div style={{ minWidth: 0 }}>
                        <div className="list-card-title">{a.name}</div>
                        <div className="cell-sub">{a.code}{a.registration ? ` · ${a.registration}` : ""}</div>
                      </div>
                    </div>
                    <Badge tone={ASSET_STATUS_TONE[a.status]}>{a.status}</Badge>
                  </div>
                  <div className="list-card-grid">
                    <div><b>{categoryName(db, a.categoryId)}</b>Kategori</div>
                    <div><b>{formatRupiahShort(a.acquisitionValue)}</b>Nilai perolehan</div>
                    <div><b>{unitName(db, a.unitId)}</b>{locationName(db, a.locationId)}</div>
                    <div><Badge tone={CONDITION_TONE[a.condition]}>{a.condition}</Badge></div>
                  </div>
                </Link>
              ))}
            </div>
            {pager}
          </>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AssetList />
    </Suspense>
  );
}
