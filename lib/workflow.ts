// Approve / reject logic shared by mutasi, peminjaman and penghapusan requests.
import { useStore } from "./store";
import { currentStep } from "./domain";
import { canApproveStep } from "./permissions";
import type { DB, Disposal, Transfer } from "./types";
import { daysUntil } from "./format";

export type RequestKind = "transfer" | "disposal";

export function findRequest(db: DB, kind: RequestKind, id: string): Transfer | Disposal | undefined {
  return kind === "transfer" ? db.transfers.find((t) => t.id === id) : db.disposals.find((d) => d.id === id);
}

export function requestHref(kind: RequestKind, id: string) {
  return kind === "transfer" ? `/mutasi/detail?id=${id}` : `/penghapusan/detail?id=${id}`;
}

export function requestModule(kind: RequestKind, req: Transfer | Disposal) {
  if (kind === "disposal") return "Penghapusan";
  return (req as Transfer).type === "pinjam" ? "Peminjaman" : "Mutasi";
}

function requester(kind: RequestKind, req: Transfer | Disposal) {
  return kind === "transfer" ? (req as Transfer).requestedBy : (req as Disposal).createdBy;
}

function sessionUser() {
  const s = useStore.getState();
  return s.db.users.find((u) => u.id === s.sessionUserId) ?? null;
}

/** Can the signed-in user act on the current step of this request? */
export function canActOn(req: Transfer | Disposal | undefined, role: string | undefined) {
  if (!req || req.status !== "diajukan") return false;
  const step = currentStep(req.approvals);
  return !!step && canApproveStep(role as never, step.role);
}

/** Approve the current step. Returns true on success. */
export function approveRequest(kind: RequestKind, id: string, note?: string): boolean {
  const st = useStore.getState();
  const user = sessionUser();
  const req = findRequest(st.db, kind, id);
  if (!user || !req || !canActOn(req, user.role)) return false;
  const step = currentStep(req.approvals)!;
  const moduleName = requestModule(kind, req);
  const stepIndex = req.approvals.indexOf(step);
  const isLast = stepIndex === req.approvals.length - 1;

  st.mutate(
    (db) => {
      const r = findRequest(db, kind, id)!;
      const s = r.approvals[stepIndex];
      s.status = "disetujui";
      s.by = user.id;
      s.at = new Date().toISOString();
      s.note = note?.trim() || undefined;
      if (isLast) {
        r.status = "disetujui";
        if (kind === "disposal") {
          const now = new Date().toISOString();
          db.assets.forEach((a) => {
            if (r.assetIds.includes(a.id)) { a.status = "Dihapus"; a.updatedAt = now; }
          });
        }
      }
    },
    { action: "Menyetujui", module: moduleName, ref: req.no, detail: step.title },
  );

  const href = requestHref(kind, id);
  if (isLast) {
    st.notify({ userId: requester(kind, req), title: `${moduleName} disetujui`, body: `${req.no} telah disetujui seluruh tahap.`, href });
  } else {
    const next = req.approvals[stepIndex + 1];
    st.notify({ role: next.role, title: `${moduleName} menunggu ${next.title.toLowerCase()}`, body: `${req.no} telah melewati tahap ${step.title}.`, href });
  }
  return true;
}

/** Reject the current step (reason required). Returns true on success. */
export function rejectRequest(kind: RequestKind, id: string, reason: string): boolean {
  const st = useStore.getState();
  const user = sessionUser();
  const req = findRequest(st.db, kind, id);
  if (!user || !req || !canActOn(req, user.role) || !reason.trim()) return false;
  const step = currentStep(req.approvals)!;
  const stepIndex = req.approvals.indexOf(step);
  const moduleName = requestModule(kind, req);

  st.mutate(
    (db) => {
      const r = findRequest(db, kind, id)!;
      const s = r.approvals[stepIndex];
      s.status = "ditolak";
      s.by = user.id;
      s.at = new Date().toISOString();
      s.note = reason.trim();
      r.status = "ditolak";
      if (kind === "disposal") {
        const now = new Date().toISOString();
        db.assets.forEach((a) => {
          if (r.assetIds.includes(a.id) && a.status === "Diusulkan Hapus") { a.status = "Aktif"; a.updatedAt = now; }
        });
      }
    },
    { action: "Menolak", module: moduleName, ref: req.no, detail: `${step.title}: ${reason.trim()}` },
  );
  st.notify({ userId: requester(kind, req), title: `${moduleName} ditolak`, body: `${req.no} ditolak pada tahap ${step.title}.`, href: requestHref(kind, id) });
  return true;
}

/** A loan that has been handed over and is past its return date. */
export function isOverdue(t: Transfer) {
  return t.type === "pinjam" && t.status === "diserahkan" && !!t.returnDate && daysUntil(t.returnDate) < 0;
}
