// Helpers shared by the dashboard and the report pages.
import type { Asset, DB } from "./types";
import { todayISO } from "./format";

/** Validated categorical palette (brand blue first, then the reference slots). Fixed order, never cycled. */
export const SERIES = ["#1B5FA8", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
/** Status colors for Laik / Laik Terbatas / Tidak Laik — always shown with a text label. */
export const STATUS_COLORS = { good: "#2F7D5B", warning: "#B57A1F", critical: "#A8503A" };

/** The unit plus all of its descendants. Empty unitId = all units (returns null). */
export function unitScope(db: DB, unitId: string): Set<string> | null {
  if (!unitId) return null;
  const out = new Set([unitId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of db.units) {
      if (u.parentId && out.has(u.parentId) && !out.has(u.id)) {
        out.add(u.id);
        grew = true;
      }
    }
  }
  return out;
}

export function inScope(scope: Set<string> | null, unitId: string) {
  return !scope || scope.has(unitId);
}

/** Inclusive date check on the YYYY-MM-DD part of an ISO date/time. */
export function inPeriod(iso: string | undefined, from: string, to: string) {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
}

export function startOfYearISO() {
  return `${new Date().getFullYear()}-01-01`;
}

export function defaultPeriod() {
  return { from: startOfYearISO(), to: todayISO() };
}

export function activeAssets(db: DB) {
  return db.assets.filter((a) => a.status !== "Dihapus");
}

export function filterAssets(db: DB, unitId: string, categoryId: string, includeDeleted = false): Asset[] {
  const scope = unitScope(db, unitId);
  return db.assets.filter(
    (a) => (includeDeleted || a.status !== "Dihapus") && inScope(scope, a.unitId) && (!categoryId || a.categoryId === categoryId),
  );
}

/** Last n months as {key:"YYYY-MM", year, month} oldest first. */
export function lastMonths(n: number) {
  const out: { key: string; year: number; month: number }[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ key: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`, year: x.getFullYear(), month: x.getMonth() });
  }
  return out;
}

export function sum<T>(rows: T[], f: (r: T) => number) {
  return rows.reduce((s, r) => s + (f(r) || 0), 0);
}
