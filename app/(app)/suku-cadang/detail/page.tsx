"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/Icon";
import { Badge, EmptyState, Field, KV, Modal, PageHeader, toast } from "@/components/ui";
import { PartFormDialog, ReceiveDialog } from "@/components/maintenance/PartDialogs";
import { uid, useCurrentUser, useDB, useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { WO_STATUS_LABEL, WO_STATUS_TONE, byId, locationName, unitName, userName } from "@/lib/domain";
import { formatDate, formatNumber, formatRupiah, todayISO } from "@/lib/format";
import { movementDelta, stockLabel, stockTone } from "@/lib/maintenance";
import type { SparePart } from "@/lib/types";

function PartDetail() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const db = useDB();
  const user = useCurrentUser()!;
  const [dialog, setDialog] = useState<null | "edit" | "receive" | "adjust">(null);
  const part = byId(db.spareParts, id);

  if (!part) {
    return (
      <>
        <PageHeader title="Suku cadang tidak ditemukan" back="/suku-cadang" />
        <div className="panel"><EmptyState icon="package" title="Data tidak ditemukan"><Link className="link" href="/suku-cadang">Kembali ke daftar</Link></EmptyState></div>
      </>
    );
  }
  const manage = can(user.role, "part.manage");
  const movements = db.stockMovements.filter((m) => m.partId === part.id).sort((a, b) => b.date.localeCompare(a.date));
  const usedBy = db.workOrders.filter((w) => w.parts.some((p) => p.partId === part.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const loc = byId(db.locations, part.locationId);
  const totalOut = movements.filter((m) => m.type === "keluar").reduce((s, m) => s + m.qty, 0);
  const pct = part.minStock ? Math.min(100, (part.stock / (part.minStock * 2)) * 100) : 100;

  return (
    <>
      <PageHeader
        title={part.name}
        breadcrumb={<><Link href="/suku-cadang">Suku Cadang</Link> / Detail</>}
        subtitle={<span className="mono">{part.partNumber}</span>}
        back="/suku-cadang"
        actions={manage && <>
          <button className="btn btn-plain" onClick={() => setDialog("adjust")}><Icon name="refresh" />Penyesuaian</button>
          <button className="btn btn-plain" onClick={() => setDialog("edit")}><Icon name="edit" />Ubah</button>
          <button className="btn btn-primary" onClick={() => setDialog("receive")}><Icon name="download" />Penerimaan Stok</button>
        </>}
      />

      {part.stock < part.minStock && (
        <div className={`alert ${part.stock === 0 ? "critical" : "warning"}`}><Icon name="alert" />
          {part.stock === 0 ? "Stok habis." : `Stok di bawah minimum (${part.stock} dari ${part.minStock} ${part.uom}).`} Ajukan pengadaan ulang sebanyak minimal {formatNumber(part.minStock * 2 - part.stock)} {part.uom}.
        </div>
      )}

      <div className="layout-main-side">
        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <div><h3>Informasi suku cadang</h3></div>
              <Badge tone={stockTone(part)}>{stockLabel(part)}</Badge>
            </div>
            <div className="kv-grid cols-3">
              <KV label="Part number"><span className="mono">{part.partNumber}</span></KV>
              <KV label="Kategori">{part.category}</KV>
              <KV label="Satuan">{part.uom}</KV>
              <KV label="Harga satuan">{formatRupiah(part.price)}</KV>
              <KV label="Nilai persediaan">{formatRupiah(part.price * part.stock)}</KV>
              <KV label="Gudang">{loc?.name} · {unitName(db, loc?.unitId)}</KV>
              <KV label="Kompatibilitas">{part.compatible}</KV>
              <KV label="Total keluar">{formatNumber(totalOut)} {part.uom}</KV>
              <KV label="Dipakai di">{usedBy.length} work order</KV>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><div><h3>Riwayat mutasi stok</h3><p>{movements.length} transaksi</p></div></div>
            {movements.length === 0 ? <div className="muted small">Belum ada mutasi.</div> : (
              <div className="table-wrap">
                <table className="table compact">
                  <thead><tr><th>Tanggal</th><th>Jenis</th><th className="text-right">Jumlah</th><th>Referensi</th><th>Oleh</th></tr></thead>
                  <tbody>
                    {movements.map((m) => {
                      const d = movementDelta(m);
                      const wo = db.workOrders.find((w) => w.no === m.ref);
                      return (
                        <tr key={m.id}>
                          <td className="nowrap">{formatDate(m.date)}</td>
                          <td><Badge tone={m.type === "masuk" ? "normal" : m.type === "keluar" ? "warning" : "neutral"}>{m.type === "masuk" ? "Masuk" : m.type === "keluar" ? "Keluar" : "Penyesuaian"}</Badge></td>
                          <td className={`text-right nowrap ${d < 0 ? "text-critical" : "text-success"}`} style={{ fontWeight: 700 }}>{d > 0 ? "+" : ""}{formatNumber(d)}</td>
                          <td>{wo ? <Link className="link" href={`/pemeliharaan/detail?id=${wo.id}`}>{m.ref}</Link> : m.ref}{m.note && <div className="cell-sub">{m.note}</div>}</td>
                          <td>{userName(db, m.by)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <h3 className="section-title">Stok saat ini</h3>
            <div className="kpi-value" style={{ fontSize: 30, margin: "8px 0 4px" }}>{formatNumber(part.stock)} <span style={{ fontSize: 15, fontWeight: 600 }} className="muted">{part.uom}</span></div>
            <div className={`progress ${stockTone(part) === "normal" ? "" : stockTone(part)}`}><div style={{ width: `${pct}%` }} /></div>
            <div className="muted small" style={{ marginTop: 6 }}>Minimum {formatNumber(part.minStock)} {part.uom} · lokasi {locationName(db, part.locationId)}</div>
          </div>

          <div className="panel">
            <h3 className="section-title" style={{ marginBottom: 10 }}>Dipakai pada work order</h3>
            {usedBy.length === 0 ? <div className="muted small">Belum pernah dipakai.</div> : (
              <div className="stack" style={{ gap: 8 }}>
                {usedBy.map((w) => {
                  const qty = w.parts.filter((p) => p.partId === part.id).reduce((s, p) => s + p.qty, 0);
                  return (
                    <Link key={w.id} href={`/pemeliharaan/detail?id=${w.id}`} className="row" style={{ background: "var(--panel)", borderRadius: 9, padding: "9px 11px", flexWrap: "nowrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cell-strong" style={{ fontSize: 12.5 }}>{w.no} · {qty} {part.uom}</div>
                        <div className="cell-sub">{byId(db.assets, w.assetId)?.name}</div>
                      </div>
                      <Badge tone={WO_STATUS_TONE[w.status]}>{WO_STATUS_LABEL[w.status]}</Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <PartFormDialog key={`edit-${part.id}-${dialog === "edit"}`} open={dialog === "edit"} onClose={() => setDialog(null)} part={part} />
      <ReceiveDialog open={dialog === "receive"} onClose={() => setDialog(null)} partId={part.id} />
      <AdjustDialog key={`adj-${part.stock}-${dialog === "adjust"}`} open={dialog === "adjust"} onClose={() => setDialog(null)} part={part} userId={user.id} />
    </>
  );
}

function AdjustDialog({ open, onClose, part, userId }: { open: boolean; onClose: () => void; part: SparePart; userId: string }) {
  const mutate = useStore((s) => s.mutate);
  const [actual, setActual] = useState(String(part.stock));
  const [reason, setReason] = useState("");
  const n = parseInt(actual, 10);
  const delta = Number.isNaN(n) ? 0 : n - part.stock;
  const valid = n >= 0 && delta !== 0 && reason.trim().length >= 5;
  const close = () => { setActual(String(part.stock)); setReason(""); onClose(); };
  const save = () => {
    mutate((d) => {
      const p = d.spareParts.find((x) => x.id === part.id);
      if (p) p.stock = n;
      d.stockMovements.unshift({ id: uid("mv"), partId: part.id, type: "penyesuaian", qty: delta, date: todayISO(), ref: "Penyesuaian stok", note: reason.trim(), by: userId });
    }, { action: "Menyesuaikan stok", module: "Suku Cadang", ref: part.partNumber, detail: `${part.stock} → ${n} (${reason.trim()})` });
    toast.success(`Stok ${part.partNumber} disesuaikan menjadi ${n} ${part.uom}`);
    close();
  };
  return (
    <Modal open={open} onClose={close} title="Penyesuaian stok" subtitle="Sesuaikan stok sistem dengan hasil hitung fisik"
      footer={<><button className="btn btn-plain" onClick={close}>Batal</button><button className="btn btn-primary" disabled={!valid} onClick={save}>Simpan</button></>}>
      <div className="form-grid">
        <Field label="Stok tercatat"><input className="input" disabled value={`${part.stock} ${part.uom}`} /></Field>
        <Field label="Stok fisik" required hint={delta ? `Selisih ${delta > 0 ? "+" : ""}${delta} ${part.uom}` : "Belum ada selisih"}>
          <input className="input" inputMode="numeric" value={actual} onChange={(e) => setActual(e.target.value.replace(/[^\d]/g, ""))} />
        </Field>
        <Field label="Alasan penyesuaian" required span2 hint="Minimal 5 karakter, tercatat di jejak audit">
          <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="mis. Hasil stock opname gudang triwulan IV" />
        </Field>
      </div>
    </Modal>
  );
}

export default function PartDetailPage() {
  return (
    <Suspense fallback={<div className="loader-screen"><div className="spinner" /></div>}>
      <PartDetail />
    </Suspense>
  );
}
