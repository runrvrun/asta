"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Badge, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { ApprovalActions } from "@/components/workflow/ApprovalActions";
import { useCurrentUser, useDB } from "@/lib/store";
import { APPROVAL_TONE, STATUS_LABEL, currentStep, pendingApprovalsFor, unitName, userName } from "@/lib/domain";
import { ROLE_LABEL } from "@/lib/permissions";
import { formatDateTime, formatRupiah, timeAgo } from "@/lib/format";
import { requestHref, requestModule, type RequestKind } from "@/lib/workflow";
import type { DB, Disposal, Role, Transfer } from "@/lib/types";

type Entry = { kind: RequestKind; req: Transfer | Disposal; at: string; requester: string };

const ROLE_HINT: Record<Role, string> = {
  admin: "Sebagai administrator, Anda dapat bertindak pada tahap mana pun.",
  pimpinan: "Tahap Persetujuan Pimpinan untuk mutasi, peminjaman, dan penghapusan akan muncul di sini.",
  petugas: "Tahap Verifikasi Petugas Aset untuk mutasi, peminjaman, dan penghapusan akan muncul di sini.",
  teknisi: "Tahap Pemeriksaan Teknis pada usulan penghapusan akan muncul di sini.",
  auditor: "Tahap Reviu Inspektorat pada usulan penghapusan akan muncul di sini.",
};

function toEntry(kind: RequestKind, req: Transfer | Disposal): Entry {
  return kind === "transfer"
    ? { kind, req, at: (req as Transfer).requestedAt, requester: (req as Transfer).requestedBy }
    : { kind, req, at: (req as Disposal).createdAt, requester: (req as Disposal).createdBy };
}

function summary(db: DB, e: Entry) {
  const names = e.req.assetIds.map((id) => db.assets.find((a) => a.id === id)?.name).filter(Boolean) as string[];
  const assetText = names.length ? `${names[0]}${names.length > 1 ? ` +${names.length - 1} lainnya` : ""}` : "Barang non-register";
  if (e.kind === "transfer") {
    const t = e.req as Transfer;
    return `${assetText} · ${unitName(db, t.fromUnitId)} → ${unitName(db, t.toUnitId)}`;
  }
  const d = e.req as Disposal;
  return `${assetText} · ${d.method} · ${formatRupiah(d.estimatedValue)}`;
}

function EntryCard({ db, e, actions, myStep }: { db: DB; e: Entry; actions?: boolean; myStep?: string }) {
  const step = e.req.status === "diajukan" ? currentStep(e.req.approvals) : undefined;
  const done = e.req.approvals.filter((s) => s.status === "disetujui").length;
  return (
    <div className="list-card">
      <div className="list-card-top">
        <div className="row" style={{ flexWrap: "nowrap", gap: 10, minWidth: 0 }}>
          <div className="thumb"><Icon name={e.kind === "transfer" ? "transfer" : "trash"} /></div>
          <div style={{ minWidth: 0 }}>
            <Link href={requestHref(e.kind, e.req.id)} className="list-card-title">{requestModule(e.kind, e.req)} · {e.req.no}</Link>
            <div className="cell-sub">{summary(db, e)}</div>
          </div>
        </div>
        <Badge tone={APPROVAL_TONE[e.req.status]}>{STATUS_LABEL[e.req.status]}</Badge>
      </div>
      <div className="list-card-grid">
        <div><b>{userName(db, e.requester)}</b>Pengaju · {timeAgo(e.at)}</div>
        <div><b>{step ? step.title : myStep ?? "-"}</b>{step ? `Tahap ${done + 1} dari ${e.req.approvals.length}` : "Tindakan Anda"}</div>
      </div>
      <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
        <Link className="btn btn-plain btn-sm" href={requestHref(e.kind, e.req.id)}><Icon name="eye" />Lihat detail</Link>
        {actions && <ApprovalActions kind={e.kind} id={e.req.id} size="sm" />}
      </div>
    </div>
  );
}

export default function PersetujuanPage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const [tab, setTab] = useState<"menunggu" | "riwayat">("menunggu");

  const pending = useMemo(() => {
    const p = pendingApprovalsFor(db, user);
    return [...p.transfers.map((t) => toEntry("transfer", t)), ...p.disposals.map((d) => toEntry("disposal", d))].sort((a, b) => a.at.localeCompare(b.at));
  }, [db, user]);

  const history = useMemo(() => {
    const seeAll = user.role === "admin" || user.role === "auditor";
    const all = [...db.transfers.map((t) => toEntry("transfer", t)), ...db.disposals.map((d) => toEntry("disposal", d))];
    return all
      .filter((e) => seeAll ? e.req.status !== "diajukan" || e.req.approvals.some((s) => s.by) : e.req.approvals.some((s) => s.by === user.id))
      .map((e) => {
        const mine = [...e.req.approvals].reverse().find((s) => s.by === user.id);
        const lastAt = e.req.approvals.reduce((m, s) => (s.at && s.at > m ? s.at : m), e.at);
        return { e, mine, lastAt };
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [db, user]);

  return (
    <>
      <PageHeader title="Kotak Persetujuan" subtitle={`Permohonan yang menunggu tindakan Anda sebagai ${ROLE_LABEL[user.role]}`} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "menunggu", label: <>Menunggu saya {pending.length > 0 && <span className="nav-count" style={{ marginLeft: 6 }}>{pending.length}</span>}</> },
        { id: "riwayat", label: "Riwayat" },
      ]} />

      {tab === "menunggu" && (
        pending.length === 0 ? (
          <div className="panel"><EmptyState icon="checkCircle" title="Tidak ada permohonan yang menunggu Anda">{ROLE_HINT[user.role]}</EmptyState></div>
        ) : (
          <div className="grid-2">
            {pending.map((e) => <EntryCard key={e.req.id} db={db} e={e} actions />)}
          </div>
        )
      )}

      {tab === "riwayat" && (
        history.length === 0 ? (
          <div className="panel"><EmptyState icon="inbox" title="Belum ada riwayat persetujuan">Permohonan yang pernah Anda setujui atau tolak akan tercatat di sini.</EmptyState></div>
        ) : (
          <div className="panel">
            <div className="table-wrap desktop-only">
              <table className="table">
                <thead><tr><th>Dokumen</th><th>Ringkasan</th><th>Tindakan Anda</th><th>Status akhir</th></tr></thead>
                <tbody>
                  {history.map(({ e, mine }) => (
                    <tr key={e.req.id}>
                      <td className="nowrap"><Link className="cell-strong" href={requestHref(e.kind, e.req.id)}>{e.req.no}</Link><div className="cell-sub">{requestModule(e.kind, e.req)}</div></td>
                      <td>{summary(db, e)}</td>
                      <td>
                        {mine ? <><Badge tone={APPROVAL_TONE[mine.status]}>{STATUS_LABEL[mine.status]}</Badge><div className="cell-sub" style={{ marginTop: 3 }}>{mine.title} · {formatDateTime(mine.at)}</div></> : <span className="muted">-</span>}
                      </td>
                      <td><Badge tone={APPROVAL_TONE[e.req.status]}>{STATUS_LABEL[e.req.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-only">
              {history.map(({ e, mine }) => <EntryCard key={e.req.id} db={db} e={e} myStep={mine ? `${STATUS_LABEL[mine.status]} · ${mine.title}` : undefined} />)}
            </div>
          </div>
        )
      )}
    </>
  );
}
