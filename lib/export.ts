// CSV export (opens in Excel; uses ";" separator + BOM for Indonesian locale) and print helpers.
export interface Column<T> {
  header: string;
  value: (row: T) => string | number | undefined | null;
}

export function toCSV<T>(rows: T[], columns: Column<T>[]) {
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => esc(c.header)).join(";"), ...rows.map((r) => columns.map((c) => esc(c.value(r))).join(";"))].join("\r\n");
}

export function downloadCSV<T>(filename: string, rows: T[], columns: Column<T>[]) {
  const blob = new Blob(["﻿" + toCSV(rows, columns)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printPage() {
  window.print();
}
