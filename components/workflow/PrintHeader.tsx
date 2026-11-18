import type { ReactNode } from "react";
import { formatDateLong } from "@/lib/format";

/** Letterhead shown only when printing. */
export function PrintHeader({ title, docNo }: { title: ReactNode; docNo?: string }) {
  return (
    <div className="print-header">
      <div>
        <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 16 }}>ASTA · Sistem Manajemen Aset</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{title}</div>
      </div>
      <div style={{ textAlign: "right", fontSize: 11 }}>
        {docNo && <div><b>No. {docNo}</b></div>}
        <div>Dicetak {formatDateLong(new Date())}</div>
      </div>
    </div>
  );
}

export function SignatureBlocks({ blocks }: { blocks: { role: string; name?: string; sub?: string }[] }) {
  return (
    <div className="print-only" style={{ marginTop: 32 }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${blocks.length}, 1fr)`, gap: 24, textAlign: "center", fontSize: 11.5 }}>
        {blocks.map((b, i) => (
          <div key={i}>
            <div style={{ fontWeight: 700 }}>{b.role}</div>
            <div style={{ height: 64 }} />
            <div style={{ borderTop: "1px solid #0B2A4A", paddingTop: 4, fontWeight: 700 }}>{b.name ?? "(.............................)"}</div>
            {b.sub && <div>{b.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
