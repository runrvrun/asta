"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { ConfirmDialog, toast } from "@/components/ui";
import { useCurrentUser, useDB } from "@/lib/store";
import { currentStep } from "@/lib/domain";
import { approveRequest, canActOn, findRequest, rejectRequest, type RequestKind } from "@/lib/workflow";

/**
 * Setujui / Tolak buttons for the current approval step. Renders nothing if the
 * signed-in user can't act. `variant="sticky"` renders the mobile bottom bar.
 */
export function ApprovalActions({ kind, id, variant = "inline", size }: { kind: RequestKind; id: string; variant?: "inline" | "sticky"; size?: "sm" }) {
  const db = useDB();
  const user = useCurrentUser();
  const req = findRequest(db, kind, id);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  if (!req || !canActOn(req, user?.role)) return null;
  const step = currentStep(req.approvals)!;
  const btn = size === "sm" ? "btn-sm" : "";

  const buttons = (
    <>
      <button className={`btn btn-ghost ${btn}`} onClick={() => setRejectOpen(true)}><Icon name="x" />Tolak</button>
      <button className={`btn btn-primary ${btn}`} onClick={() => setApproveOpen(true)}><Icon name="check" />Setujui</button>
    </>
  );

  return (
    <>
      {variant === "sticky" ? <div className="sticky-actions no-print">{buttons}</div> : <div className="row no-print">{buttons}</div>}
      <ConfirmDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title={`Setujui tahap "${step.title}"?`}
        message={<>Usulan <b>{req.no}</b> akan diteruskan ke tahap berikutnya{req.approvals.indexOf(step) === req.approvals.length - 1 ? " dan dinyatakan disetujui final" : ""}.</>}
        noteLabel="Catatan (opsional)"
        confirmLabel="Setujui"
        onConfirm={(note) => { if (approveRequest(kind, id, note)) toast.success(`${req.no} disetujui pada tahap ${step.title}`); else toast.error("Gagal menyetujui usulan"); }}
      />
      <ConfirmDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        danger
        title="Alasan penolakan"
        message="Alasan akan dikirim kembali ke pengusul beserta usulan yang ditolak."
        noteLabel="Alasan penolakan"
        noteRequired
        confirmLabel="Kirim penolakan"
        onConfirm={(note) => { if (rejectRequest(kind, id, note)) toast.info(`${req.no} ditolak`); else toast.error("Gagal menolak usulan"); }}
      />
    </>
  );
}
