"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CATEGORY_ICON, Icon } from "@/components/Icon";
import { Badge, ConfirmDialog, EmptyState, KV, PageHeader, Panel, SearchBox, StatCard, toast } from "@/components/ui";
import { PrintHeader, SignatureBlocks } from "@/components/workflow/PrintHeader";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import { APPROVAL_TONE, CONDITION_TONE, STATUS_LABEL, locationName, unitName, userName } from "@/lib/domain";
import { can } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import type { Asset, Condition, StockTake } from "@/lib/types";

const CONDITIONS: Condition[] = ["Baik", "Rusak Ringan", "Rusak Berat"];
const REGISTER_MARK = "Kondisi register:";
type Item = StockTake["items"][number];
type ResultFilter = "semua" | Item["result"];

const RESULT_LABEL: Record<Item["result"], string> = { belum: "Belum diperiksa", ditemukan: "Ditemukan", tidak_ditemukan: "Tidak ditemukan" };
const RESULT_TONE = { belum: "neutral", ditemukan: "normal", tidak_ditemukan: "critical" } as const;

function StockTakeDetail() {
  const db = useDB();
  const user = useCurrentUser()!;
  const mutate = useStore((s) => s.mutate);
  const id = useSearchParams().get("id") ?? "";
  const st = db.stockTakes.find((s) => s.id === id);

  const [filter, setFilter] = useState<ResultFilter>("semua");
  const [loc, setLoc] = useState("");
  const [q, setQ] = useState("");
  const [code, setCode] = useState("");
  const [highlight, setHighlight] = useState("");
  const [cond, setCond] = useState<Record<string, Condition>>({});
  const [missingFor, setMissingFor] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);

  const assetOf = useMemo(() => new Map(db.assets.map((a) => [a.id, a])), [db.assets]);

  if (!st) {
    return (
      <>
        <PageHeader back="/inventarisasi" title="Sesi tidak ditemukan" />
        <div className="panel"><EmptyState icon="list" title="Sesi inventarisasi tidak ditemukan"><Link className="link" href="/inventarisasi">Kembali</Link></EmptyState></div>
      </>
    );
  }

  const running = st.status === "berjalan";
  const canCount = running && can(user.role, "stocktake.count");
  const canManage = running && can(user.role, "stocktake.manage");
  const items = st.items.filter((i) => assetOf.has(i.assetId));
  const counts = {
    ditemukan: items.filter((i) => i.result === "ditemukan").length,
    tidak_ditemukan: items.filter((i) => i.result === "tidak_ditemukan").length,
    belum: items.filter((i) => i.result === "belum").length,
  };
  const pct = items.length ? Math.round(((counts.ditemukan + counts.tidak_ditemukan) / items.length) * 100) : 0;
  const locations = Array.from(new Set(items.map((i) => assetOf.get(i.assetId)!.locationId)));

  const s = q.trim().toLowerCase();
  const visible = items.filter((i) => {
    const a = assetOf.get(i.assetId)!;
    return (filter === "semua" || i.result === filter) && (!loc || a.locationId === loc) &&
      (!s || [a.name, a.code, a.registration ?? ""].some((v) => v.toLowerCase().includes(s)));
  });

  // Discrepancies: not found, or condition found differs from the register.
  const conditionChanged = (i: Item, a: Asset) =>
    i.result === "ditemukan" && (running ? !!i.condition && i.condition !== a.condition : !!i.note?.startsWith(REGISTER_MARK));
  const discrepancies = items.filter((i) => i.result === "tidak_ditemukan" || conditionChanged(i, assetOf.get(i.assetId)!));

  const setItem = (assetId: string, patch: Partial<Item>, audit?: string) => {
    mutate((d) => {
      const r = d.stockTakes.find((x) => x.id === st.id)!;
      const it = r.items.find((x) => x.assetId === assetId)!;
      Object.assign(it, patch);
    }, audit ? { action: "Memeriksa", module: "Inventarisasi", ref: st.no, detail: audit } : undefined);
  };

  const markFound = (a: Asset) => {
    const c = cond[a.id] ?? a.condition;
    setItem(a.id, { result: "ditemukan", condition: c, note: undefined, checkedAt: new Date().toISOString(), checkedBy: user.id }, `${a.code} ditemukan · ${c}`);
    toast.success(`${a.code} ditandai ditemukan`);
  };
  const markMissing = (assetId: string, note: string) => {
    const a = assetOf.get(assetId)!;
    setItem(assetId, { result: "tidak_ditemukan", condition: undefined, note, checkedAt: new Date().toISOString(), checkedBy: user.id }, `${a.code} tidak ditemukan`);
    toast.info(`${a.code} ditandai tidak ditemukan`);
  };
  const resetItem = (assetId: string) => setItem(assetId, { result: "belum", condition: undefined, note: undefined, checkedAt: undefined, checkedBy: undefined });

  const jump = () => {
    const c = code.trim().toLowerCase();
    if (!c) return;
    const it = items.find((i) => { const a = assetOf.get(i.assetId)!; return a.code.toLowerCase() === c || (a.registration ?? "").toLowerCase() === c; })
      ?? items.find((i) => assetOf.get(i.assetId)!.code.toLowerCase().includes(c));
    if (!it) { toast.error("Kode tidak termasuk daftar periksa sesi ini"); return; }
    setFilter("semua"); setLoc(""); setQ("");
    setHighlight(it.assetId);
    setCode("");
    setTimeout(() => document.getElementById(`item-${it.assetId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const finish = () => {
    const now = new Date().toISOString();
    let changed = 0;
    mutate((d) => {
      const r = d.stockTakes.find((x) => x.id === st.id)!;
      r.status = "selesai";
      r.completedAt = now;
      for (const it of r.items) {
        if (it.result !== "ditemukan" || !it.condition) continue;
        const a = d.assets.find((x) => x.id === it.assetId);
        if (a && a.condition !== it.condition) {
          it.note = `${REGISTER_MARK} ${a.condition} → ${it.condition}`;
          a.condition = it.condition;
          a.updatedAt = now;
          changed++;
        }
      }
    }, { action: "Menyelesaikan", module: "Inventarisasi", ref: st.no, detail: `${counts.ditemukan} ditemukan, ${counts.tidak_ditemukan} tidak ditemukan, ${counts.belum} belum diperiksa` });
    toast.success(`Inventarisasi selesai${changed ? ` · kondisi ${changed} aset diperbarui` : ""}`);
  };

  const exportCSV = () =>
    downloadCSV(`selisih-${st.no}`, discrepancies, [
      { header: "Kode", value: (i) => assetOf.get(i.assetId)!.code },
      { header: "Nama aset", value: (i) => assetOf.get(i.assetId)!.name },
      { header: "Lokasi tercatat", value: (i) => locationName(db, assetOf.get(i.assetId)!.locationId) },
      { header: "Hasil", value: (i) => RESULT_LABEL[i.result] },
      { header: "Kondisi register", value: (i) => assetOf.get(i.assetId)!.condition },
      { header: "Kondisi ditemukan", value: (i) => i.condition ?? "" },
      { header: "Catatan", value: (i) => i.note ?? "" },
      { header: "Diperiksa", value: (i) => (i.checkedAt ? formatDateTime(i.checkedAt) : "") },
    ]);

  return (
    <>
      <PrintHeader title={`Laporan Hasil Inventarisasi · ${unitName(db, st.unitId)} · ${st.period}`} docNo={st.no} />
      <PageHeader
        back="/inventarisasi"
        breadcrumb={<><Link href="/inventarisasi">Inventarisasi</Link> / {st.no}</>}
        title={<>{st.no} <span style={{ verticalAlign: "middle" }}><Badge tone={APPROVAL_TONE[st.status]}>{STATUS_LABEL[st.status]}</Badge></span></>}
        subtitle={`${unitName(db, st.unitId)} · ${st.period} · Ketua tim ${userName(db, st.leaderId)}`}
        actions={<>
          <button className="btn btn-secondary" onClick={() => window.print()}><Icon name="printer" />Cetak</button>
          {canManage && <button className="btn btn-primary" onClick={() => setFinishOpen(true)}><Icon name="checkCircle" />Selesaikan</button>}
        </>}
      />

      <div className="kpi-grid">
        <StatCard label="Progres" value={`${pct}%`} icon="activity" sub={`${items.length - counts.belum} dari ${items.length} aset`} />
        <StatCard label="Ditemukan" value={counts.ditemukan} icon="checkCircle" onClick={() => setFilter("ditemukan")} />
        <StatCard label="Tidak ditemukan" value={counts.tidak_ditemukan} icon="alert" accent="var(--critical)" onClick={() => setFilter("tidak_ditemukan")} />
        <StatCard label="Belum diperiksa" value={counts.belum} icon="clock" accent="var(--warning)" onClick={() => setFilter("belum")} />
      </div>
      <div className="progress no-print" style={{ marginBottom: 16, height: 10 }}><div style={{ width: `${pct}%` }} /></div>

      <div className="layout-main-side">
        <div className="panel no-print">
          <div className="panel-head"><div><h3>Daftar periksa</h3><p>{running ? "Tandai setiap aset sesuai hasil pemeriksaan fisik" : `Selesai ${formatDateTime(st.completedAt)}`}</p></div></div>
          {canCount && (
            <form className="row" style={{ marginBottom: 12, flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); jump(); }}>
              <div className="search-box" style={{ maxWidth: "none" }}>
                <Icon name="scan" />
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ketik / scan kode aset atau registrasi…" />
              </div>
              <button className="btn btn-secondary" type="submit">Cari</button>
            </form>
          )}
          <div className="toolbar">
            <div className="filter-pills">
              {(["semua", "belum", "ditemukan", "tidak_ditemukan"] as ResultFilter[]).map((f) => (
                <button key={f} className={`pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                  {f === "semua" ? "Semua" : RESULT_LABEL[f]} <span className="count">{f === "semua" ? items.length : counts[f]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="toolbar">
            <select className="select" value={loc} onChange={(e) => setLoc(e.target.value)}>
              <option value="">Semua lokasi</option>
              {locations.map((l) => <option key={l} value={l}>{locationName(db, l)}</option>)}
            </select>
            <SearchBox value={q} onChange={setQ} placeholder="Cari aset..." />
          </div>

          {visible.length === 0 && <EmptyState icon="list" title="Tidak ada aset pada filter ini" />}
          {visible.map((i) => {
            const a = assetOf.get(i.assetId)!;
            return (
              <div key={i.assetId} id={`item-${i.assetId}`} className="list-card" style={highlight === i.assetId ? { borderColor: "var(--blue)", boxShadow: "0 0 0 3px rgba(46,134,214,0.2)" } : undefined}>
                <div className="list-card-top">
                  <div className="row" style={{ flexWrap: "nowrap", gap: 10, minWidth: 0 }}>
                    <div className="thumb"><Icon name={CATEGORY_ICON[a.categoryId]} /></div>
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/aset/detail?id=${a.id}`} className="list-card-title">{a.name}</Link>
                      <div className="cell-sub">{a.code} · {locationName(db, a.locationId)} · register: {a.condition}</div>
                    </div>
                  </div>
                  <Badge tone={RESULT_TONE[i.result]}>{RESULT_LABEL[i.result]}</Badge>
                </div>
                {i.result !== "belum" && (
                  <div className="cell-sub">
                    {i.condition && <>Kondisi: <b style={{ color: "var(--navy)" }}>{i.condition}</b> · </>}
                    {i.checkedAt && <>diperiksa {formatDateTime(i.checkedAt)} oleh {userName(db, i.checkedBy)}</>}
                    {i.note && <div className="stage-note">{i.note}</div>}
                  </div>
                )}
                {canCount && i.result === "belum" && (
                  <div className="row" style={{ marginTop: 10 }}>
                    <select className="select" style={{ flex: "1 1 140px", width: "auto" }} value={cond[a.id] ?? a.condition} onChange={(e) => setCond({ ...cond, [a.id]: e.target.value as Condition })} aria-label="Kondisi ditemukan">
                      {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <button className="btn btn-primary" style={{ flex: "1 1 120px" }} onClick={() => markFound(a)}><Icon name="check" />Ditemukan</button>
                    <button className="btn btn-ghost" style={{ flex: "1 1 120px" }} onClick={() => setMissingFor(a.id)}><Icon name="x" />Tidak ada</button>
                  </div>
                )}
                {canCount && i.result !== "belum" && (
                  <button className="btn btn-plain btn-sm" style={{ marginTop: 8 }} onClick={() => resetItem(a.id)}><Icon name="refresh" />Periksa ulang</button>
                )}
              </div>
            );
          })}
        </div>

        <div className="stack">
          <Panel className="no-print" title="Informasi sesi">
            <div className="kv-grid">
              <KV label="Satuan">{unitName(db, st.unitId)}</KV>
              <KV label="Periode">{st.period}</KV>
              <KV label="Ketua tim">{userName(db, st.leaderId)}</KV>
              <KV label="Dimulai">{formatDate(st.startedAt)}</KV>
              <KV label="Selesai">{st.completedAt ? formatDate(st.completedAt) : "-"}</KV>
              <KV label="Jumlah aset">{items.length}</KV>
            </div>
          </Panel>
          <Panel title={`Selisih & temuan (${discrepancies.length})`} subtitle="Aset tidak ditemukan atau kondisinya berbeda dari register"
            actions={<button className="btn btn-plain btn-sm no-print" onClick={exportCSV} disabled={!discrepancies.length}><Icon name="download" />CSV</button>}>
            {discrepancies.length === 0 ? <EmptyState icon="checkCircle" title="Tidak ada selisih">Seluruh aset yang telah diperiksa sesuai register.</EmptyState> : (
              <div className="table-wrap">
                <table className="table compact">
                  <thead><tr><th>Aset</th><th>Temuan</th></tr></thead>
                  <tbody>
                    {discrepancies.map((i) => {
                      const a = assetOf.get(i.assetId)!;
                      return (
                        <tr key={i.assetId}>
                          <td><div className="cell-strong">{a.name}</div><div className="cell-sub">{a.code} · {locationName(db, a.locationId)}</div></td>
                          <td>
                            {i.result === "tidak_ditemukan"
                              ? <Badge tone="critical">Tidak ditemukan</Badge>
                              : <Badge tone={CONDITION_TONE[i.condition ?? "Baik"]}>{running ? `${a.condition} → ${i.condition}` : i.note?.replace(REGISTER_MARK, "").trim()}</Badge>}
                            {i.result === "tidak_ditemukan" && i.note && <div className="cell-sub" style={{ marginTop: 3 }}>{i.note}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <div className="print-only" style={{ fontSize: 11.5 }}>
            Ringkasan: {items.length} aset diperiksa — {counts.ditemukan} ditemukan, {counts.tidak_ditemukan} tidak ditemukan, {counts.belum} belum diperiksa.
          </div>
          <SignatureBlocks blocks={[{ role: "Ketua Tim Inventarisasi", name: userName(db, st.leaderId) }, { role: "Mengetahui", sub: `Komandan ${unitName(db, st.unitId)}` }]} />
        </div>
      </div>

      <ConfirmDialog open={!!missingFor} onClose={() => setMissingFor(null)} danger
        title="Tandai tidak ditemukan"
        message={missingFor ? `${assetOf.get(missingFor)?.name} (${assetOf.get(missingFor)?.code}) tidak berada di lokasi tercatat.` : ""}
        noteLabel="Keterangan" noteRequired confirmLabel="Simpan"
        onConfirm={(note) => missingFor && markMissing(missingFor, note)} />

      <ConfirmDialog open={finishOpen} onClose={() => setFinishOpen(false)}
        title="Selesaikan inventarisasi?"
        message={<>
          {counts.belum > 0 && <div className="alert warning" style={{ marginBottom: 10 }}><Icon name="alert" />{counts.belum} aset belum diperiksa dan akan tercatat apa adanya.</div>}
          Kondisi aset yang ditemukan akan diperbarui ke register. Sesi tidak dapat diubah setelah diselesaikan.
        </>}
        confirmLabel="Selesaikan" onConfirm={finish} />
    </>
  );
}

export default function Page() {
  return <Suspense fallback={null}><StockTakeDetail /></Suspense>;
}
