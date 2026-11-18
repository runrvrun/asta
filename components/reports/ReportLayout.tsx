"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { EmptyState, PageHeader } from "@/components/ui";
import { useCurrentUser, useDB } from "@/lib/store";
import { can } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/format";
import { unitName, categoryName } from "@/lib/domain";
import type { DB } from "@/lib/types";

export function ReportLayout({ title, subtitle, filters, filterDesc, summary, onExport, children }: {
  title: string;
  subtitle?: string;
  filters?: ReactNode;
  /** Human-readable description of the active filters, printed in the header. */
  filterDesc: string;
  summary?: ReactNode;
  onExport?: () => void;
  children: ReactNode;
}) {
  const user = useCurrentUser();
  if (!can(user?.role, "report.view")) {
    return (
      <div className="panel">
        <EmptyState icon="lock" title="Akses ditolak">Peran Anda tidak dapat melihat laporan.</EmptyState>
      </div>
    );
  }
  return (
    <div>
      <div className="print-header">
        <div>
          <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 14 }}>ASTA · Sistem Manajemen Aset</div>
          <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 16, marginTop: 4 }}>{title}</div>
          <div style={{ fontSize: 11 }}>{filterDesc}</div>
        </div>
        <div style={{ fontSize: 10.5, textAlign: "right" }}>
          Dicetak {formatDateTime(new Date())}<br />oleh {user ? `${user.rank} ${user.name}` : "-"}
        </div>
      </div>

      <div className="no-print">
        <PageHeader
          back="/laporan"
          breadcrumb={<><Link href="/laporan">Laporan</Link> / {title}</>}
          title={title}
          subtitle={subtitle}
          actions={<>
            {onExport && <button className="btn btn-secondary" onClick={onExport}><Icon name="download" />Ekspor CSV</button>}
            <button className="btn btn-primary" onClick={() => window.print()}><Icon name="printer" />Cetak</button>
          </>}
        />
        {filters && <div className="panel" style={{ marginBottom: 16, padding: 14 }}><div className="toolbar" style={{ marginBottom: 0 }}>{filters}</div><div className="field-hint" style={{ marginTop: 8 }}>{filterDesc}</div></div>}
      </div>

      {summary && <div className="kpi-grid">{summary}</div>}
      {children}

      <div className="print-only" style={{ marginTop: 36 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
          <div style={{ textAlign: "center", width: 220 }}>
            Mengetahui,<br />Pejabat Penyetuju<br /><br /><br /><br />(.................................)
          </div>
          <div style={{ textAlign: "center", width: 220 }}>
            {formatDate(new Date())}<br />Dibuat oleh<br /><br /><br /><br />{user ? `${user.rank} ${user.name}` : ""}<br />NRP {user?.nrp}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Table in a panel with horizontal scroll. */
export function ReportTable({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      {title && <div className="panel-head"><h3>{title}</h3></div>}
      <div className="table-wrap"><table className="table">{children}</table></div>
    </div>
  );
}

// ---------- filter controls ----------
export function UnitSelect({ db, value, onChange }: { db: DB; value: string; onChange: (v: string) => void }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Satuan">
      <option value="">Semua satuan</option>
      {db.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  );
}

export function CategorySelect({ db, value, onChange, only }: { db: DB; value: string; onChange: (v: string) => void; only?: string[] }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Kategori">
      <option value="">Semua kategori</option>
      {db.categories.filter((c) => !only || only.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

export function PeriodInputs({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      <input type="date" className="input" value={from} onChange={(e) => onFrom(e.target.value)} aria-label="Dari tanggal" />
      <span className="muted small">s.d.</span>
      <input type="date" className="input" value={to} onChange={(e) => onTo(e.target.value)} aria-label="Sampai tanggal" />
    </div>
  );
}

export function describeFilters(db: DB, opts: { unitId?: string; categoryId?: string; from?: string; to?: string; asOf?: string }) {
  const parts: string[] = [];
  if (opts.from !== undefined || opts.to !== undefined) parts.push(`Periode ${opts.from ? formatDate(opts.from) : "awal"} s.d. ${opts.to ? formatDate(opts.to) : "sekarang"}`);
  if (opts.asOf) parts.push(`Per tanggal ${formatDate(opts.asOf)}`);
  parts.push(opts.unitId ? `Satuan: ${unitName(db, opts.unitId)} (termasuk satuan di bawahnya)` : "Semua satuan");
  if (opts.categoryId !== undefined) parts.push(opts.categoryId ? `Kategori: ${categoryName(db, opts.categoryId)}` : "Semua kategori");
  return parts.join(" · ");
}

/** Convenience hook for report pages. */
export function useReportDB() {
  return useDB();
}
