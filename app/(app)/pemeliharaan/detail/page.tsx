"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon, CATEGORY_ICON } from "@/components/Icon";
import { Badge, ConfirmDialog, EmptyState, Field, Modal, PageHeader, toast } from "@/components/ui";
import { uid, useCurrentUser, useDB, useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { PRIORITY_TONE, WO_STATUS_LABEL, WO_STATUS_TONE, byId, categoryName, locationName, unitName, userName } from "@/lib/domain";
import { formatDate, formatDateTime, formatNumber, formatRupiah, daysUntil } from "@/lib/format";
import { OPEN_WO, isOverdue, releaseAssetIfIdle } from "@/lib/maintenance";
import type { DB, WorkOrder } from "@/lib/types";
import styles from "@/components/maintenance/maint.module.css";

type Dialog = null | "start" | "wait" | "resume" | "finish" | "cancel" | "assign" | "part" | "hours";

function WorkOrderDetail() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const db = useDB();
  const user = useCurrentUser()!;
  const mutate = useStore((s) => s.mutate);
  const notify = useStore((s) => s.notify);
  const [dialog, setDialog] = useState<Dialog>(null);

  const wo = byId(db.workOrders, id);
  if (!wo) {
    return (
      <>
        <PageHeader title="Work order tidak ditemukan" back="/pemeliharaan" />
        <div className="panel"><EmptyState icon="clipboard" title="Data tidak ditemukan">Work order mungkin sudah dihapus atau tautan tidak valid. <Link className="link" href="/pemeliharaan">Kembali ke daftar</Link></EmptyState></div>
      </>
    );
  }
  const asset = byId(db.assets, wo.assetId);
  const canWork = can(user.role, "wo.work") && (user.role === "admin" || !wo.assigneeId || wo.assigneeId === user.id);
  const canAssign = can(user.role, "wo.assign");
  const canUsePart = can(user.role, "part.use");
  const open = OPEN_WO.includes(wo.status);
  const doneCount = wo.checklist.filter((c) => c.done).length;
  const overdue = isOverdue(wo);
  const hoursPct = wo.estHours ? Math.min(100, (wo.actualHours / wo.estHours) * 100) : 0;
  const partsCost = wo.parts.reduce((s, p) => s + (byId(db.spareParts, p.partId)?.price ?? 0) * p.qty, 0);

  /** Apply a change to this WO, append a timeline entry and audit it. */
  const update = (text: string, fn: (w: WorkOrder, d: DB) => void, auditAction = "Mengubah status") => {
    mutate(
      (d) => {
        const w = d.workOrders.find((x) => x.id === wo.id);
        if (!w) return;
        fn(w, d);
        w.timeline.push({ at: new Date().toISOString(), text, by: user.id });
      },
      { action: auditAction, module: "Work Order", ref: wo.no, detail: text },
    );
  };

  const start = () => {
    update("Mulai dikerjakan", (w, d) => {
      w.status = "dikerjakan";
      if (!w.assigneeId && user.role === "teknisi") w.assigneeId = user.id;
      const a = d.assets.find((x) => x.id === w.assetId);
      if (a && a.status === "Aktif") { a.status = "Dalam Pemeliharaan"; a.updatedAt = new Date().toISOString(); }
    });
    toast.success("Status: Dikerjakan");
  };
  const toggleCheck = (ckId: string) => {
    const item = wo.checklist.find((c) => c.id === ckId);
    if (!item) return;
    update(`${item.done ? "Membatalkan centang" : "Menyelesaikan langkah"}: ${item.text}`, (w) => {
      const c = w.checklist.find((x) => x.id === ckId);
      if (c) c.done = !c.done;
    }, "Memperbarui checklist");
  };

  const actions: { key: string; label: string; cls: string; onClick: () => void; show: boolean }[] = [
    { key: "cancel", label: "Batalkan", cls: "btn-ghost", onClick: () => setDialog("cancel"), show: open && (canAssign || user.role === "admin") },
    { key: "assign", label: wo.assigneeId ? "Ubah Teknisi" : "Tugaskan", cls: "btn-plain", onClick: () => setDialog("assign"), show: open && canAssign },
    { key: "start", label: "Mulai Kerjakan", cls: "btn-primary", onClick: start, show: wo.status === "baru" && canWork },
    { key: "wait", label: "Menunggu Part", cls: "btn-secondary", onClick: () => setDialog("wait"), show: wo.status === "dikerjakan" && canWork },
    { key: "resume", label: "Lanjutkan", cls: "btn-primary", onClick: () => setDialog("resume"), show: wo.status === "menunggu_part" && canWork },
    { key: "finish", label: "Selesaikan", cls: "btn-primary", onClick: () => setDialog("finish"), show: wo.status === "dikerjakan" && canWork },
  ];
  const visibleActions = actions.filter((a) => a.show);

  return (
    <>
      <PageHeader
        title={wo.no}
        breadcrumb={<><Link href="/pemeliharaan">Work Order</Link> / Detail</>}
        subtitle={`${wo.type} · Dibuat ${formatDateTime(wo.createdAt)} oleh ${userName(db, wo.createdBy)}`}
        back="/pemeliharaan"
        actions={<div className={styles.desktopFlex}>{visibleActions.map((a) => <button key={a.key} className={`btn ${a.cls}`} onClick={a.onClick}>{a.label}</button>)}</div>}
      />

      {overdue && <div className="alert critical"><Icon name="alert" />Work order ini melewati target selesai ({formatDate(wo.dueDate)}, {Math.abs(daysUntil(wo.dueDate))} hari lalu).</div>}
      {wo.status === "menunggu_part" && <div className="alert warning"><Icon name="clock" />Pekerjaan tertunda menunggu suku cadang.</div>}

      <div className="layout-main-side" style={{ paddingBottom: visibleActions.length ? 70 : 0 }}>
        <div className="stack">
          <div className="panel">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 18, color: "var(--navy)" }}>{wo.title}</div>
                <div className="row" style={{ marginTop: 6, gap: 6 }}>
                  <Badge tone={WO_STATUS_TONE[wo.status]}>{WO_STATUS_LABEL[wo.status]}</Badge>
                  <Badge tone={PRIORITY_TONE[wo.priority]}>Prioritas {wo.priority}</Badge>
                </div>
              </div>
            </div>

            {asset && (
              <Link href={`/aset/detail?id=${asset.id}`} className="row" style={{ background: "var(--panel)", borderRadius: 10, padding: 12, margin: "14px 0", flexWrap: "nowrap" }}>
                <div className="thumb"><Icon name={CATEGORY_ICON[asset.categoryId]} /></div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="cell-strong">{asset.name} — {asset.code}</div>
                  <div className="cell-sub">{categoryName(db, asset.categoryId)} · {unitName(db, asset.unitId)}, {locationName(db, asset.locationId)} · Status aset: {asset.status}</div>
                </div>
                <Icon name="chevronRight" size={18} />
              </Link>
            )}

            <div className="kv-grid cols-4" style={{ marginBottom: 16 }}>
              <div><div className="kv-label">Teknisi</div><div className="kv-value">{wo.assigneeId ? userName(db, wo.assigneeId) : "Belum ditugaskan"}</div></div>
              <div><div className="kv-label">Target selesai</div><div className={`kv-value ${overdue ? "text-critical" : ""}`}>{formatDate(wo.dueDate)}</div></div>
              <div><div className="kv-label">Selesai</div><div className="kv-value">{wo.completedAt ? formatDateTime(wo.completedAt) : "-"}</div></div>
              <div><div className="kv-label">Biaya suku cadang</div><div className="kv-value">{formatRupiah(partsCost)}</div></div>
            </div>

            <h3 className="section-title" style={{ fontSize: 13.5 }}>Deskripsi</h3>
            <p className="muted" style={{ fontSize: 13.5, margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{wo.description || "Tidak ada deskripsi."}</p>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Checklist pekerjaan</h3>
                <p>{doneCount} dari {wo.checklist.length} langkah selesai{wo.status !== "dikerjakan" && open ? " · mulai kerjakan untuk mencentang" : ""}</p>
              </div>
            </div>
            <div className="progress" style={{ marginBottom: 10 }}><div style={{ width: `${wo.checklist.length ? (doneCount / wo.checklist.length) * 100 : 0}%` }} /></div>
            {wo.checklist.length === 0 && <div className="muted small">Tidak ada checklist.</div>}
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {wo.checklist.map((c) => {
                const enabled = canWork && wo.status === "dikerjakan";
                return (
                  <li key={c.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--panel)", alignItems: "flex-start" }}>
                    <input type="checkbox" id={c.id} checked={c.done} disabled={!enabled} onChange={() => toggleCheck(c.id)} style={{ width: 20, height: 20, accentColor: "var(--blue)", marginTop: 1, flexShrink: 0 }} />
                    <label htmlFor={c.id} style={{ fontSize: 13.5, cursor: enabled ? "pointer" : "default", textDecoration: c.done ? "line-through" : undefined, color: c.done ? "var(--text-secondary)" : "var(--navy)" }}>{c.text}</label>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Suku cadang terpakai</h3>
                <p>Stok gudang otomatis berkurang saat suku cadang dicatat.</p>
              </div>
              {canUsePart && open && wo.status !== "baru" && <button className="btn btn-secondary btn-sm" onClick={() => setDialog("part")}><Icon name="plus" />Tambah suku cadang</button>}
            </div>
            {wo.parts.length === 0 ? <div className="muted small">Belum ada suku cadang yang dipakai.</div> : (
              <div className="table-wrap">
                <table className="table compact">
                  <thead><tr><th>Part</th><th>Jumlah</th><th className="text-right">Nilai</th></tr></thead>
                  <tbody>
                    {wo.parts.map((p, i) => {
                      const part = byId(db.spareParts, p.partId);
                      return (
                        <tr key={i}>
                          <td>{part ? <Link className="link" href={`/suku-cadang/detail?id=${part.id}`}>{part.name}</Link> : "-"}<div className="cell-sub">{part?.partNumber}</div></td>
                          <td className="nowrap">{formatNumber(p.qty)} {part?.uom}</td>
                          <td className="text-right nowrap">{formatRupiah((part?.price ?? 0) * p.qty)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr><td colSpan={2}>Total</td><td className="text-right">{formatRupiah(partsCost)}</td></tr></tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Jam kerja</h3>
                <p>Estimasi vs realisasi</p>
              </div>
              {canWork && open && wo.status !== "baru" && <button className="btn btn-plain btn-sm" onClick={() => setDialog("hours")}><Icon name="clock" />Catat jam kerja</button>}
            </div>
            <div className="row" style={{ gap: 24 }}>
              <div><div className="kpi-value" style={{ fontSize: 22 }}>{formatNumber(wo.estHours, wo.estHours % 1 ? 1 : 0)} jam</div><div className="muted small">Estimasi</div></div>
              <div><div className="kpi-value" style={{ fontSize: 22 }}>{formatNumber(wo.actualHours, wo.actualHours % 1 ? 1 : 0)} jam</div><div className="muted small">Realisasi</div></div>
            </div>
            <div className={`progress ${wo.actualHours > wo.estHours ? "critical" : ""}`} style={{ marginTop: 10 }}><div style={{ width: `${hoursPct}%` }} /></div>
            {wo.actualHours > wo.estHours && <div className="small text-critical" style={{ marginTop: 6, fontWeight: 600 }}>Melebihi estimasi {formatNumber(wo.actualHours - wo.estHours, 1)} jam</div>}
          </div>

          <div className="panel">
            <h3 className="section-title" style={{ marginBottom: 12 }}>Timeline progres</h3>
            <div className="timeline">
              {wo.timeline.map((t, i) => (
                <div key={i} className="timeline-item">
                  <div className="timeline-dot" />
                  <div>
                    <div className="timeline-text">{t.text}</div>
                    <div className="timeline-meta">{formatDateTime(t.at)} · {userName(db, t.by)}</div>
                  </div>
                </div>
              ))}
              {open && (
                <div className="timeline-item">
                  <div className="timeline-dot pending" />
                  <div><div className="timeline-text muted">Menunggu penyelesaian</div><div className="timeline-meta">Target {formatDate(wo.dueDate)}</div></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {visibleActions.length > 0 && (
        <div className="sticky-actions">
          {visibleActions.slice(-3).map((a) => <button key={a.key} className={`btn ${a.cls}`} onClick={a.onClick}>{a.label}</button>)}
        </div>
      )}

      <ConfirmDialog open={dialog === "wait"} onClose={() => setDialog(null)} title="Tandai menunggu suku cadang?" noteLabel="Suku cadang yang ditunggu" noteRequired confirmLabel="Simpan"
        onConfirm={(note) => { update(`Menunggu suku cadang: ${note}`, (w) => { w.status = "menunggu_part"; }); toast.info("Status: Menunggu Part"); }} />
      <ConfirmDialog open={dialog === "resume"} onClose={() => setDialog(null)} title="Lanjutkan pekerjaan?" message="Status kembali menjadi Dikerjakan." confirmLabel="Lanjutkan"
        onConfirm={() => { update("Suku cadang tersedia, pekerjaan dilanjutkan", (w) => { w.status = "dikerjakan"; }); toast.success("Status: Dikerjakan"); }} />
      <ConfirmDialog open={dialog === "finish"} onClose={() => setDialog(null)} title="Selesaikan work order?"
        message={doneCount < wo.checklist.length
          ? <div className="alert warning" style={{ margin: 0 }}><Icon name="alert" />Masih ada {wo.checklist.length - doneCount} langkah checklist yang belum dicentang. Tetap selesaikan?</div>
          : "Aset akan kembali berstatus Aktif bila tidak ada work order lain yang masih terbuka."}
        noteLabel="Catatan penyelesaian (opsional)" confirmLabel="Selesaikan"
        onConfirm={(note) => {
          update(note ? `Selesai dikerjakan — ${note}` : "Selesai dikerjakan", (w, d) => {
            w.status = "selesai";
            w.completedAt = new Date().toISOString();
            releaseAssetIfIdle(d, d.assets.find((a) => a.id === w.assetId), w.id);
          }, "Menyelesaikan");
          if (wo.createdBy !== user.id) notify({ userId: wo.createdBy, title: "Work order selesai", body: `${wo.no} · ${wo.title}`, href: `/pemeliharaan/detail?id=${wo.id}` });
          toast.success(`${wo.no} selesai`);
        }} />
      <ConfirmDialog open={dialog === "cancel"} onClose={() => setDialog(null)} title="Batalkan work order?" danger noteLabel="Alasan pembatalan" noteRequired confirmLabel="Batalkan WO"
        onConfirm={(note) => {
          update(`WO dibatalkan — ${note}`, (w, d) => {
            w.status = "dibatalkan";
            releaseAssetIfIdle(d, d.assets.find((a) => a.id === w.assetId), w.id);
          }, "Membatalkan");
          toast.info(`${wo.no} dibatalkan`);
        }} />
      <AssignDialog open={dialog === "assign"} onClose={() => setDialog(null)} wo={wo} db={db}
        onSave={(tid) => {
          update(`Ditugaskan ke ${userName(db, tid)}`, (w) => { w.assigneeId = tid; }, "Menugaskan");
          notify({ userId: tid, title: "Work order ditugaskan kepada Anda", body: `${wo.no} · ${wo.title}`, href: `/pemeliharaan/detail?id=${wo.id}` });
          toast.success("Teknisi ditugaskan");
        }} />
      <PartDialog open={dialog === "part"} onClose={() => setDialog(null)} db={db}
        onSave={(partId, qty) => {
          const part = byId(db.spareParts, partId)!;
          update(`Memakai ${qty} ${part.uom} ${part.name}`, (w, d) => {
            const p = d.spareParts.find((x) => x.id === partId);
            if (!p) return;
            p.stock -= qty;
            const existing = w.parts.find((x) => x.partId === partId);
            if (existing) existing.qty += qty; else w.parts.push({ partId, qty });
            d.stockMovements.unshift({ id: uid("mv"), partId, type: "keluar", qty, date: new Date().toISOString().slice(0, 10), ref: w.no, by: user.id });
          }, "Memakai suku cadang");
          const after = part.stock - qty;
          if (after < part.minStock) notify({ role: "petugas", title: "Stok suku cadang di bawah minimum", body: `${part.partNumber} · ${part.name} tersisa ${after} ${part.uom}`, href: `/suku-cadang/detail?id=${part.id}` });
          toast.success("Suku cadang dicatat, stok diperbarui");
        }} />
      <HoursDialog open={dialog === "hours"} onClose={() => setDialog(null)}
        onSave={(h, note) => { update(`Mencatat ${formatNumber(h, 1)} jam kerja${note ? ` — ${note}` : ""}`, (w) => { w.actualHours = Math.round((w.actualHours + h) * 10) / 10; }, "Mencatat jam kerja"); toast.success("Jam kerja dicatat"); }} />
    </>
  );
}

function AssignDialog({ open, onClose, wo, db, onSave }: { open: boolean; onClose: () => void; wo: WorkOrder; db: DB; onSave: (id: string) => void }) {
  const [tid, setTid] = useState(wo.assigneeId ?? "");
  const techs = db.users.filter((u) => u.role === "teknisi" && u.active);
  const load = (id: string) => db.workOrders.filter((w) => w.assigneeId === id && OPEN_WO.includes(w.status)).length;
  return (
    <Modal open={open} onClose={onClose} title="Tugaskan teknisi" subtitle={wo.no}
      footer={<><button className="btn btn-plain" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!tid || tid === wo.assigneeId} onClick={() => { onSave(tid); onClose(); }}>Simpan</button></>}>
      <div className="stack" style={{ gap: 8 }}>
        {techs.map((t) => (
          <label key={t.id} className="row" style={{ border: `1.5px solid ${tid === t.id ? "var(--blue)" : "var(--panel2)"}`, borderRadius: 10, padding: 10, cursor: "pointer", flexWrap: "nowrap" }}>
            <input type="radio" name="tech" checked={tid === t.id} onChange={() => setTid(t.id)} style={{ accentColor: "var(--blue)" }} />
            <div style={{ flex: 1 }}>
              <div className="cell-strong">{t.rank} {t.name}</div>
              <div className="cell-sub">{t.position} · {unitName(db, t.unitId)}</div>
            </div>
            <span className="chip">{load(t.id)} WO aktif</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

function PartDialog({ open, onClose, db, onSave }: { open: boolean; onClose: () => void; db: DB; onSave: (partId: string, qty: number) => void }) {
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState("1");
  const [q, setQ] = useState("");
  const part = byId(db.spareParts, partId);
  const n = parseFloat(qty.replace(",", "."));
  const error = !partId ? "" : !(n > 0) ? "Jumlah harus lebih dari 0." : part && n > part.stock ? `Stok tidak cukup (tersedia ${part.stock} ${part.uom}).` : "";
  const list = db.spareParts.filter((p) => !q || `${p.partNumber} ${p.name} ${p.compatible}`.toLowerCase().includes(q.toLowerCase()) || p.id === partId);
  const close = () => { setPartId(""); setQty("1"); setQ(""); onClose(); };
  return (
    <Modal open={open} onClose={close} title="Tambah suku cadang" subtitle="Stok gudang akan berkurang sesuai jumlah"
      footer={<><button className="btn btn-plain" onClick={close}>Batal</button><button className="btn btn-primary" disabled={!partId || !!error} onClick={() => { onSave(partId, n); close(); }}>Catat pemakaian</button></>}>
      <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
        <Field label="Cari suku cadang"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Part number, nama, atau kompatibilitas" /></Field>
        <Field label="Suku cadang" required>
          <select className="select" value={partId} onChange={(e) => setPartId(e.target.value)}>
            <option value="">— Pilih —</option>
            {list.map((p) => <option key={p.id} value={p.id} disabled={p.stock <= 0}>{p.partNumber} · {p.name} (stok {p.stock} {p.uom})</option>)}
          </select>
        </Field>
        <Field label="Jumlah" required error={error} hint={part ? `Tersedia ${part.stock} ${part.uom} · ${locationName(db, part.locationId)}` : undefined}>
          <input className={`input ${error ? "invalid" : ""}`} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function HoursDialog({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (h: number, note: string) => void }) {
  const [h, setH] = useState("1");
  const [note, setNote] = useState("");
  const n = parseFloat(h.replace(",", "."));
  const valid = n > 0 && n <= 24;
  const close = () => { setH("1"); setNote(""); onClose(); };
  return (
    <Modal open={open} onClose={close} title="Catat jam kerja" subtitle="Ditambahkan ke realisasi jam kerja"
      footer={<><button className="btn btn-plain" onClick={close}>Batal</button><button className="btn btn-primary" disabled={!valid} onClick={() => { onSave(n, note.trim()); close(); }}>Simpan</button></>}>
      <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
        <Field label="Jam kerja" required error={!valid ? "Isi antara 0,1 – 24 jam." : undefined}><input className="input" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} /></Field>
        <Field label="Keterangan"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Pembongkaran housing" /></Field>
      </div>
    </Modal>
  );
}

export default function WorkOrderDetailPage() {
  return (
    <Suspense fallback={<div className="loader-screen"><div className="spinner" /></div>}>
      <WorkOrderDetail />
    </Suspense>
  );
}
