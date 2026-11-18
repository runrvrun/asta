"use client";
import { useState } from "react";
import { Field, Modal, toast } from "@/components/ui";
import { uid, useCurrentUser, useDB, useStore } from "@/lib/store";
import { byId } from "@/lib/domain";
import { formatNumber, todayISO } from "@/lib/format";
import type { SparePart } from "@/lib/types";

export const PART_CATEGORIES: SparePart["category"][] = ["Mesin", "Avionik", "Hidrolik", "Kelistrikan", "Struktur", "Roda & Rem", "Consumable", "Kendaraan"];

type PartDraft = { partNumber: string; name: string; category: SparePart["category"]; uom: string; stock: string; minStock: string; price: string; locationId: string; compatible: string };

/** Create (no `part`) or edit a spare part. */
export function PartFormDialog({ open, onClose, part, onSaved }: { open: boolean; onClose: () => void; part?: SparePart; onSaved?: (id: string) => void }) {
  const db = useDB();
  const mutate = useStore((s) => s.mutate);
  const user = useCurrentUser()!;
  const warehouses = db.locations.filter((l) => l.kind === "Gudang" || l.kind === "Bengkel");
  const init = (): PartDraft => ({
    partNumber: part?.partNumber ?? "", name: part?.name ?? "", category: part?.category ?? "Consumable", uom: part?.uom ?? "pcs",
    stock: String(part?.stock ?? 0), minStock: String(part?.minStock ?? 1), price: String(part?.price ?? ""), locationId: part?.locationId ?? warehouses[0]?.id ?? "", compatible: part?.compatible ?? "",
  });
  const [f, setF] = useState<PartDraft>(init);
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof PartDraft>(k: K, v: PartDraft[K]) => setF((x) => ({ ...x, [k]: v }));

  const errors: Record<string, string> = {};
  if (f.partNumber.trim().length < 3) errors.partNumber = "Minimal 3 karakter.";
  else if (db.spareParts.some((p) => p.partNumber.toLowerCase() === f.partNumber.trim().toLowerCase() && p.id !== part?.id)) errors.partNumber = "Part number sudah terdaftar.";
  if (f.name.trim().length < 3) errors.name = "Minimal 3 karakter.";
  if (!part && !(parseInt(f.stock, 10) >= 0)) errors.stock = "Isi angka ≥ 0.";
  if (!(parseInt(f.minStock, 10) >= 0)) errors.minStock = "Isi angka ≥ 0.";
  if (!(parseFloat(f.price) > 0)) errors.price = "Isi harga satuan.";
  if (!f.uom.trim()) errors.uom = "Isi satuan.";
  const err = (k: string) => (touched ? errors[k] : undefined);

  const close = () => { setTouched(false); setF(init()); onClose(); };
  const save = () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    const data = {
      partNumber: f.partNumber.trim().toUpperCase(), name: f.name.trim(), category: f.category, uom: f.uom.trim(),
      minStock: parseInt(f.minStock, 10), price: Math.round(parseFloat(f.price)), locationId: f.locationId, compatible: f.compatible.trim() || "Umum",
    };
    if (part) {
      mutate((d) => { const p = d.spareParts.find((x) => x.id === part.id); if (p) Object.assign(p, data); }, { action: "Mengubah", module: "Suku Cadang", ref: data.partNumber, detail: data.name });
      toast.success("Data suku cadang diperbarui");
      onSaved?.(part.id);
    } else {
      const id = uid("prt");
      const stock = parseInt(f.stock, 10);
      mutate((d) => {
        d.spareParts.push({ id, ...data, stock });
        if (stock > 0) d.stockMovements.unshift({ id: uid("mv"), partId: id, type: "masuk", qty: stock, date: todayISO(), ref: "Saldo awal", by: user.id });
      }, { action: "Menambah", module: "Suku Cadang", ref: data.partNumber, detail: `${data.name} · stok awal ${stock}` });
      toast.success(`${data.partNumber} ditambahkan`);
      onSaved?.(id);
    }
    close();
  };

  return (
    <Modal open={open} onClose={close} title={part ? "Ubah suku cadang" : "Tambah suku cadang"} size="lg"
      footer={<><button className="btn btn-plain" onClick={close}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan</button></>}>
      <div className="form-grid">
        <Field label="Part number" required error={err("partNumber")}><input className="input" value={f.partNumber} onChange={(e) => set("partNumber", e.target.value)} placeholder="mis. BRG-4471" /></Field>
        <Field label="Nama" required error={err("name")}><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Kategori" required>
          <select className="select" value={f.category} onChange={(e) => set("category", e.target.value as SparePart["category"])}>{PART_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Satuan" required error={err("uom")}><input className="input" value={f.uom} onChange={(e) => set("uom", e.target.value)} placeholder="pcs, set, liter, kg" /></Field>
        {!part && <Field label="Stok awal" required error={err("stock")}><input className="input" inputMode="numeric" value={f.stock} onChange={(e) => set("stock", e.target.value)} /></Field>}
        <Field label="Stok minimum" required error={err("minStock")}><input className="input" inputMode="numeric" value={f.minStock} onChange={(e) => set("minStock", e.target.value)} /></Field>
        <Field label="Harga satuan" required error={err("price")}>
          <div className="input-affix"><span>Rp</span><input className="input" inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value.replace(/[^\d]/g, ""))} /></div>
        </Field>
        <Field label="Lokasi gudang" required>
          <select className="select" value={f.locationId} onChange={(e) => set("locationId", e.target.value)}>
            {warehouses.map((l) => <option key={l.id} value={l.id}>{l.name} · {byId(db.units, l.unitId)?.name}</option>)}
          </select>
        </Field>
        <Field label="Kompatibilitas" span2 hint="Tipe pesawat / kendaraan / peralatan yang memakai part ini"><input className="input" value={f.compatible} onChange={(e) => set("compatible", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

/** Stock receipt (movement "masuk"). */
export function ReceiveDialog({ open, onClose, partId }: { open: boolean; onClose: () => void; partId?: string }) {
  const db = useDB();
  const mutate = useStore((s) => s.mutate);
  const user = useCurrentUser()!;
  const [pid, setPid] = useState(partId ?? "");
  const [qty, setQty] = useState("");
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const selected = partId ?? pid;
  const part = byId(db.spareParts, selected);
  const n = parseInt(qty, 10);
  const errors: Record<string, string> = {};
  if (!selected) errors.part = "Pilih suku cadang.";
  if (!(n > 0)) errors.qty = "Isi jumlah > 0.";
  if (ref.trim().length < 3) errors.ref = "Isi nomor dokumen penerimaan.";
  const err = (k: string) => (touched ? errors[k] : undefined);
  const close = () => { setTouched(false); setQty(""); setRef(""); setNote(""); setDate(todayISO()); if (!partId) setPid(""); onClose(); };
  const save = () => {
    setTouched(true);
    if (Object.keys(errors).length || !part) return;
    mutate((d) => {
      const p = d.spareParts.find((x) => x.id === part.id);
      if (p) p.stock += n;
      d.stockMovements.unshift({ id: uid("mv"), partId: part.id, type: "masuk", qty: n, date, ref: ref.trim(), note: note.trim() || undefined, by: user.id });
    }, { action: "Menerima stok", module: "Suku Cadang", ref: part.partNumber, detail: `+${n} ${part.uom} (${ref.trim()})` });
    toast.success(`Stok ${part.partNumber} bertambah ${n} ${part.uom}`);
    close();
  };
  return (
    <Modal open={open} onClose={close} title="Penerimaan stok" subtitle="Catat barang masuk dari pengadaan atau pengiriman gudang"
      footer={<><button className="btn btn-plain" onClick={close}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan penerimaan</button></>}>
      <div className="form-grid">
        {!partId && (
          <Field label="Suku cadang" required error={err("part")} span2>
            <select className="select" value={pid} onChange={(e) => setPid(e.target.value)}>
              <option value="">— Pilih —</option>
              {db.spareParts.map((p) => <option key={p.id} value={p.id}>{p.partNumber} · {p.name} (stok {p.stock}/{p.minStock})</option>)}
            </select>
          </Field>
        )}
        <Field label="Jumlah diterima" required error={err("qty")} hint={part ? `Stok saat ini ${formatNumber(part.stock)} ${part.uom}` : undefined}><input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Tanggal" required><input type="date" className="input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="No. dokumen (BAPB / surat jalan)" required error={err("ref")}><input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={`BAPB/${new Date().getFullYear()}/...`} /></Field>
        <Field label="Keterangan"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Kontrak pengadaan triwulan IV" /></Field>
      </div>
    </Modal>
  );
}
