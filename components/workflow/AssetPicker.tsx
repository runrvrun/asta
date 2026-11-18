"use client";
import { useMemo, useState } from "react";
import { CATEGORY_ICON, Icon } from "@/components/Icon";
import { Badge, EmptyState, SearchBox } from "@/components/ui";
import { CONDITION_TONE, depreciation, unitName } from "@/lib/domain";
import { formatRupiah } from "@/lib/format";
import type { Asset, DB } from "@/lib/types";

/** Searchable checkbox list of assets. */
export function AssetPicker({ db, candidates, selected, onChange, showBookValue, disabledReason }: {
  db: DB;
  candidates: Asset[];
  selected: string[];
  onChange: (ids: string[]) => void;
  showBookValue?: boolean;
  /** Return a reason to disable an asset (e.g. different unit), or undefined. */
  disabledReason?: (a: Asset) => string | undefined;
}) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return candidates.filter((a) => !s || [a.name, a.code, a.registration ?? "", a.model].some((v) => v.toLowerCase().includes(s)));
  }, [candidates, q]);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <SearchBox value={q} onChange={setQ} placeholder="Cari nama, kode, registrasi..." />
        <span className="muted small">{selected.length} dipilih</span>
      </div>
      <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--panel2)", borderRadius: 10 }}>
        {rows.length === 0 && <EmptyState icon="box" title="Tidak ada aset yang cocok" />}
        {rows.map((a) => {
          const reason = selected.includes(a.id) ? undefined : disabledReason?.(a);
          const checked = selected.includes(a.id);
          return (
            <label key={a.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderBottom: "1px solid var(--panel)", cursor: reason ? "not-allowed" : "pointer", opacity: reason ? 0.5 : 1, background: checked ? "var(--panel)" : undefined }}>
              <input type="checkbox" checked={checked} disabled={!!reason} onChange={() => toggle(a.id)} style={{ width: 18, height: 18, accentColor: "var(--blue)", flexShrink: 0 }} />
              <div className="thumb"><Icon name={CATEGORY_ICON[a.categoryId]} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cell-strong" style={{ fontSize: 13 }}>{a.name}</div>
                <div className="cell-sub">{a.code} · {unitName(db, a.unitId)}{reason ? ` · ${reason}` : ""}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <Badge tone={CONDITION_TONE[a.condition]}>{a.condition}</Badge>
                {showBookValue && <div className="cell-sub" style={{ marginTop: 3 }}>{formatRupiah(depreciation(a).bookValue)}</div>}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
