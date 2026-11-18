"use client";
// Shared UI building blocks. Styles live in app/globals.css.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import { Icon, type IconName } from "./Icon";
import type { Tone } from "@/lib/domain";
import type { ApprovalStep, DB } from "@/lib/types";
import { formatBytes, formatDateTime } from "@/lib/format";
import { userName } from "@/lib/domain";
import { ROLE_LABEL } from "@/lib/permissions";

// ---------- Badge ----------
export function Badge({ tone = "neutral", children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

// ---------- Page header ----------
export function PageHeader({ title, subtitle, back, actions, breadcrumb }: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** true = router.back(), string = link target */
  back?: boolean | string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="page-head">
      <div className="page-head-title">
        {back && (
          <button className="back-btn no-print" aria-label="Kembali" onClick={() => (typeof back === "string" ? router.push(back) : router.back())}>
            <Icon name="arrowLeft" />
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          {breadcrumb && <div className="breadcrumb">{breadcrumb}</div>}
          <h1>{title}</h1>
          {subtitle && <div className="subtitle">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

// ---------- Panel ----------
export function Panel({ title, subtitle, actions, children, className = "", style }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div className={`panel ${className}`} style={style}>
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// ---------- KPI card ----------
export function StatCard({ label, value, sub, icon, accent, onClick }: {
  label: string; value: ReactNode; sub?: ReactNode; icon: IconName; accent?: string; onClick?: () => void;
}) {
  return (
    <div className={`kpi-card ${onClick ? "clickable" : ""}`} style={accent ? ({ "--kpi-accent": accent } as React.CSSProperties) : undefined} onClick={onClick}>
      <div className="kpi-top">
        <div className="kpi-label">{label}</div>
        <div className="kpi-icon"><Icon name={icon} /></div>
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, subtitle, children, footer, size }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-box ${size ?? ""}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup"><Icon name="x" /></button>
        </div>
        {children}
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirmation dialog, optionally asking for a note (e.g. rejection reason). */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Ya, lanjutkan", danger, noteLabel, noteRequired }: {
  open: boolean; onClose: () => void; onConfirm: (note: string) => void; title: string; message?: ReactNode;
  confirmLabel?: string; danger?: boolean; noteLabel?: string; noteRequired?: boolean;
}) {
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const invalid = !!noteRequired && note.trim().length < 5;
  const close = () => { setNote(""); setTouched(false); onClose(); };
  return (
    <Modal open={open} onClose={close} title={title}
      footer={<>
        <button className="btn btn-plain" onClick={close}>Batal</button>
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={() => { setTouched(true); if (invalid) return; onConfirm(note.trim()); close(); }}>{confirmLabel}</button>
      </>}>
      {message && <div className="muted" style={{ fontSize: 13 }}>{message}</div>}
      {noteLabel && (
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">{noteLabel}{noteRequired && <span className="req">*</span>}</label>
          <textarea className={`textarea ${touched && invalid ? "invalid" : ""}`} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          {touched && invalid && <div className="field-error">Wajib diisi (minimal 5 karakter).</div>}
        </div>
      )}
    </Modal>
  );
}

// ---------- Toast ----------
type ToastKind = "success" | "error" | "info";
interface ToastItem { id: number; kind: ToastKind; text: string }
const useToastStore = create<{ items: ToastItem[]; push: (kind: ToastKind, text: string) => void; remove: (id: number) => void }>((set) => ({
  items: [],
  push: (kind, text) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items, { id, kind, text }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 3500);
  },
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

/** toast.success("Aset disimpan") — callable from anywhere on the client. */
export const toast = {
  success: (t: string) => useToastStore.getState().push("success", t),
  error: (t: string) => useToastStore.getState().push("error", t),
  info: (t: string) => useToastStore.getState().push("info", t),
};

export function Toaster() {
  const items = useToastStore((s) => s.items);
  const remove = useToastStore((s) => s.remove);
  return (
    <div className="toast-stack" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => remove(t.id)}>
          <Icon name={t.kind === "success" ? "checkCircle" : t.kind === "error" ? "alert" : "info"} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Empty state ----------
export function EmptyState({ icon = "inbox", title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <div className="empty-title">{title}</div>
      {children && <div style={{ fontSize: 12.5 }}>{children}</div>}
    </div>
  );
}

// ---------- Search box ----------
export function SearchBox({ value, onChange, placeholder = "Cari..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="search-box">
      <Icon name="search" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && <button onClick={() => onChange("")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex" }} aria-label="Hapus pencarian"><Icon name="x" size={14} /></button>}
    </div>
  );
}

// ---------- Tabs ----------
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={`tab-btn ${value === t.id ? "active" : ""}`} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

// ---------- Form field ----------
export function Field({ label, required, hint, error, span2, children }: { label: string; required?: boolean; hint?: ReactNode; error?: string; span2?: boolean; children: ReactNode }) {
  return (
    <div className={`form-group ${span2 ? "span-2" : ""}`}>
      <label className="form-label">{label}{required && <span className="req">*</span>}</label>
      {children}
      {error ? <div className="field-error">{error}</div> : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}

// ---------- Key-value ----------
export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="kv-label">{label}</div>
      <div className="kv-value">{children ?? "-"}</div>
    </div>
  );
}

// ---------- Approval stages ----------
export function ApprovalStages({ db, steps }: { db: DB; steps: ApprovalStep[] }) {
  const rejected = steps.some((s) => s.status === "ditolak");
  const currentIdx = rejected ? -1 : steps.findIndex((s) => s.status === "menunggu");
  return (
    <ul className="stage-list">
      {steps.map((s, i) => {
        let cls = "waiting";
        if (s.status === "disetujui") cls = "approved";
        else if (s.status === "ditolak") cls = "rejected";
        else if (i === currentIdx) cls = "reviewing";
        return (
          <li key={i} className={`stage-item ${cls}`}>
            <div className="stage-icon">
              {cls === "approved" ? <Icon name="check" /> : cls === "rejected" ? <Icon name="x" /> : cls === "reviewing" ? <Icon name="clock" /> : <span style={{ fontSize: 12, fontWeight: 700 }}>{i + 1}</span>}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="stage-title">{s.title}</div>
              <div className="stage-name">
                {s.by ? userName(db, s.by) : ROLE_LABEL[s.role]}
                {cls === "reviewing" && " · sedang ditinjau"}
                {cls === "waiting" && !rejected && " · menunggu tahap sebelumnya"}
              </div>
              {s.at && <div className="stage-meta">{s.status === "ditolak" ? "Ditolak" : "Disetujui"} · {formatDateTime(s.at)}</div>}
              {s.note && <div className="stage-note">“{s.note}”</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- File picker (stores names/sizes only) ----------
export function FileDrop({ files, onChange, hint = "PDF, JPG, PNG, XLSX · maks. 10 MB per file" }: {
  files: { name: string; size: number }[]; onChange: (f: { name: string; size: number }[]) => void; hint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const add = (list: FileList | null) => {
    if (!list) return;
    onChange([...files, ...Array.from(list).map((f) => ({ name: f.name, size: f.size }))]);
  };
  return (
    <div>
      <label className={`dropzone ${drag ? "drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}>
        <Icon name="upload" />
        <div><strong>Klik untuk memilih</strong> atau tarik file ke sini</div>
        <div className="small">{hint}</div>
        <input ref={ref} type="file" multiple hidden onChange={(e) => { add(e.target.files); if (ref.current) ref.current.value = ""; }} />
      </label>
      {files.length > 0 && (
        <div className="file-chip-list">
          {files.map((f, i) => (
            <span key={i} className="file-chip">
              <Icon name="paperclip" />{f.name} <span className="muted">({formatBytes(f.size)})</span>
              <button aria-label="Hapus" onClick={() => onChange(files.filter((_, k) => k !== i))}><Icon name="x" size={13} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Pagination ----------
export function usePaged<T>(rows: T[], pageSize = 15) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const slice = rows.slice((current - 1) * pageSize, current * pageSize);
  const pager = rows.length > pageSize ? (
    <div className="pagination">
      <span>Menampilkan {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, rows.length)} dari {rows.length}</span>
      <div className="row">
        <button className="btn btn-plain btn-sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Sebelumnya</button>
        <span>Hal. {current}/{pages}</span>
        <button className="btn btn-plain btn-sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Berikutnya</button>
      </div>
    </div>
  ) : null;
  return { rows: slice, pager, setPage };
}
