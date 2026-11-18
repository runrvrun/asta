"use client";
import { useState } from "react";
import { CATEGORY_ICON, Icon } from "@/components/Icon";
import { RequireRole } from "@/components/RequireRole";
import { ConfirmDialog, Field, Modal, PageHeader, Panel, Tabs, toast } from "@/components/ui";
import { uid, useDB, useStore } from "@/lib/store";
import { unitName } from "@/lib/domain";
import type { Category, Location, Unit, UnitType } from "@/lib/types";

type Tab = "satuan" | "lokasi" | "kategori";
const UNIT_TYPES: UnitType[] = ["Komando", "Pangkalan", "Skadron", "Depo", "Satuan"];
const LOC_KINDS: Location["kind"][] = ["Hangar", "Gudang", "Apron", "Kantor", "Lahan", "Garasi", "Bengkel", "Lainnya"];

export default function MasterPage() {
  const [tab, setTab] = useState<Tab>("satuan");
  return (
    <RequireRole roles={["admin"]}>
      <PageHeader title="Master Data" subtitle="Satuan, lokasi, dan kategori aset yang dipakai di seluruh modul" />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "satuan", label: "Satuan" }, { id: "lokasi", label: "Lokasi" }, { id: "kategori", label: "Kategori aset" }]} />
      {tab === "satuan" && <Units />}
      {tab === "lokasi" && <Locations />}
      {tab === "kategori" && <Categories />}
    </RequireRole>
  );
}

function Units() {
  const db = useDB();
  const mutate = useStore((s) => s.mutate);
  const [edit, setEdit] = useState<Unit | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [del, setDel] = useState<Unit | null>(null);
  const [err, setErr] = useState("");

  const usage = (id: string) => ({
    assets: db.assets.filter((a) => a.unitId === id).length,
    users: db.users.filter((u) => u.unitId === id).length,
    locations: db.locations.filter((l) => l.unitId === id).length,
    children: db.units.filter((u) => u.parentId === id).length,
  });
  const isDescendant = (candidateParent: string, id: string): boolean => {
    let cur = db.units.find((u) => u.id === candidateParent);
    while (cur) { if (cur.id === id) return true; cur = db.units.find((u) => u.id === cur!.parentId); }
    return false;
  };

  const save = () => {
    if (!edit) return;
    if (!edit.code.trim() || !edit.name.trim()) return setErr("Kode dan nama wajib diisi.");
    if (db.units.some((u) => u.code.toLowerCase() === edit.code.trim().toLowerCase() && u.id !== edit.id)) return setErr("Kode satuan sudah dipakai.");
    if (edit.parentId && !isNew && isDescendant(edit.parentId, edit.id)) return setErr("Induk tidak boleh satuan itu sendiri atau bawahannya.");
    const clean = { ...edit, code: edit.code.trim(), name: edit.name.trim(), parentId: edit.parentId || undefined };
    mutate((d) => { if (isNew) d.units.push(clean); else Object.assign(d.units.find((u) => u.id === edit.id)!, clean); },
      { action: isNew ? "Membuat" : "Mengubah", module: "Master Data", ref: clean.code, detail: `Satuan ${clean.name}` });
    toast.success(isNew ? "Satuan ditambahkan" : "Satuan diperbarui");
    setEdit(null);
  };

  return (
    <Panel title="Satuan" subtitle="Struktur satuan pemilik/pengguna aset" actions={<button className="btn btn-primary btn-sm" onClick={() => { setErr(""); setIsNew(true); setEdit({ id: uid("u"), code: "", name: "", type: "Satuan", city: "" }); }}><Icon name="plus" />Tambah satuan</button>}>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Kode</th><th>Nama</th><th>Jenis</th><th>Kota</th><th>Induk</th><th className="text-right">Aset</th><th className="text-right">Personel</th><th /></tr></thead>
        <tbody>{db.units.map((u) => { const us = usage(u.id); return (
          <tr key={u.id}>
            <td className="mono">{u.code}</td><td className="cell-strong">{u.name}</td><td>{u.type}</td><td>{u.city}</td><td>{u.parentId ? unitName(db, u.parentId) : "-"}</td>
            <td className="text-right">{us.assets}</td><td className="text-right">{us.users}</td>
            <td><div className="row" style={{ gap: 6, flexWrap: "nowrap", justifyContent: "flex-end" }}>
              <button className="btn btn-plain btn-sm" onClick={() => { setErr(""); setIsNew(false); setEdit({ ...u }); }}><Icon name="edit" />Ubah</button>
              <button className="btn btn-ghost btn-sm" aria-label="Hapus" onClick={() => setDel(u)}><Icon name="trash" /></button>
            </div></td>
          </tr>); })}</tbody>
      </table></div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={isNew ? "Tambah satuan" : "Ubah satuan"}
        footer={<><button className="btn btn-plain" onClick={() => setEdit(null)}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan</button></>}>
        {edit && <div className="form-grid">
          <Field label="Kode" required><input className="input" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Jenis"><select className="select" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as UnitType })}>{UNIT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Nama satuan" required span2><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Kota"><input className="input" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></Field>
          <Field label="Satuan induk"><select className="select" value={edit.parentId ?? ""} onChange={(e) => setEdit({ ...edit, parentId: e.target.value })}><option value="">— Tidak ada —</option>{db.units.filter((u) => u.id !== edit.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          {err && <div className="field-error" style={{ gridColumn: "1 / -1" }}>{err}</div>}
        </div>}
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger confirmLabel="Hapus" title="Hapus satuan?"
        message={del ? `Satuan ${del.name} akan dihapus. Satuan yang masih memiliki aset, personel, lokasi, atau satuan bawahan tidak dapat dihapus.` : ""}
        onConfirm={() => {
          if (!del) return;
          const us = usage(del.id);
          if (us.assets || us.users || us.locations || us.children) { toast.error(`Tidak dapat dihapus: masih dipakai ${us.assets} aset, ${us.users} personel, ${us.locations} lokasi, ${us.children} satuan bawahan`); return; }
          mutate((d) => { d.units = d.units.filter((u) => u.id !== del.id); }, { action: "Menghapus", module: "Master Data", ref: del.code, detail: `Satuan ${del.name}` });
          toast.success("Satuan dihapus");
        }} />
    </Panel>
  );
}

function Locations() {
  const db = useDB();
  const mutate = useStore((s) => s.mutate);
  const [unitFilter, setUnitFilter] = useState("");
  const [edit, setEdit] = useState<Location | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [del, setDel] = useState<Location | null>(null);
  const [err, setErr] = useState("");
  const rows = db.locations.filter((l) => !unitFilter || l.unitId === unitFilter);
  const usage = (id: string) => db.assets.filter((a) => a.locationId === id).length + db.spareParts.filter((p) => p.locationId === id).length;

  const save = () => {
    if (!edit) return;
    if (!edit.name.trim() || !edit.unitId) return setErr("Nama dan satuan wajib diisi.");
    if (db.locations.some((l) => l.unitId === edit.unitId && l.name.toLowerCase() === edit.name.trim().toLowerCase() && l.id !== edit.id)) return setErr("Nama lokasi sudah ada di satuan ini.");
    const clean = { ...edit, name: edit.name.trim() };
    mutate((d) => { if (isNew) d.locations.push(clean); else Object.assign(d.locations.find((l) => l.id === edit.id)!, clean); },
      { action: isNew ? "Membuat" : "Mengubah", module: "Master Data", ref: clean.name, detail: `Lokasi · ${unitName(db, clean.unitId)}` });
    toast.success(isNew ? "Lokasi ditambahkan" : "Lokasi diperbarui");
    setEdit(null);
  };

  return (
    <Panel title="Lokasi" subtitle="Hangar, gudang, apron, lahan, dan tempat penyimpanan aset per satuan"
      actions={<>
        <select className="select" style={{ width: "auto", minHeight: 34, padding: "6px 34px 6px 10px", fontSize: 12.5 }} value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} aria-label="Satuan"><option value="">Semua satuan</option>{db.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <button className="btn btn-primary btn-sm" onClick={() => { setErr(""); setIsNew(true); setEdit({ id: uid("l"), name: "", unitId: unitFilter || db.units[0]?.id || "", kind: "Gudang" }); }}><Icon name="plus" />Tambah lokasi</button>
      </>}>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Nama lokasi</th><th>Jenis</th><th>Satuan</th><th className="text-right">Aset & part</th><th /></tr></thead>
        <tbody>{rows.map((l) => (
          <tr key={l.id}>
            <td className="cell-strong">{l.name}</td><td>{l.kind}</td><td>{unitName(db, l.unitId)}</td><td className="text-right">{usage(l.id)}</td>
            <td><div className="row" style={{ gap: 6, flexWrap: "nowrap", justifyContent: "flex-end" }}>
              <button className="btn btn-plain btn-sm" onClick={() => { setErr(""); setIsNew(false); setEdit({ ...l }); }}><Icon name="edit" />Ubah</button>
              <button className="btn btn-ghost btn-sm" aria-label="Hapus" onClick={() => setDel(l)}><Icon name="trash" /></button>
            </div></td>
          </tr>
        ))}</tbody>
      </table></div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={isNew ? "Tambah lokasi" : "Ubah lokasi"}
        footer={<><button className="btn btn-plain" onClick={() => setEdit(null)}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan</button></>}>
        {edit && <div className="form-grid">
          <Field label="Nama lokasi" required span2><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Satuan" required><select className="select" value={edit.unitId} onChange={(e) => setEdit({ ...edit, unitId: e.target.value })}>{db.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          <Field label="Jenis"><select className="select" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Location["kind"] })}>{LOC_KINDS.map((k) => <option key={k}>{k}</option>)}</select></Field>
          {err && <div className="field-error" style={{ gridColumn: "1 / -1" }}>{err}</div>}
        </div>}
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger confirmLabel="Hapus" title="Hapus lokasi?"
        message={del ? `Lokasi ${del.name} akan dihapus. Lokasi yang masih menyimpan aset atau suku cadang tidak dapat dihapus.` : ""}
        onConfirm={() => {
          if (!del) return;
          const n = usage(del.id);
          if (n) { toast.error(`Tidak dapat dihapus: masih dipakai ${n} aset/suku cadang`); return; }
          mutate((d) => { d.locations = d.locations.filter((l) => l.id !== del.id); }, { action: "Menghapus", module: "Master Data", ref: del.name, detail: "Lokasi" });
          toast.success("Lokasi dihapus");
        }} />
    </Panel>
  );
}

function Categories() {
  const db = useDB();
  const mutate = useStore((s) => s.mutate);
  const [edit, setEdit] = useState<Category | null>(null);
  const [err, setErr] = useState("");

  const save = () => {
    if (!edit) return;
    if (!edit.name.trim()) return setErr("Nama wajib diisi.");
    if (!/^[A-Z]{2,5}$/.test(edit.codePrefix)) return setErr("Prefiks kode 2–5 huruf kapital.");
    if (db.categories.some((c) => c.codePrefix === edit.codePrefix && c.id !== edit.id)) return setErr("Prefiks kode sudah dipakai kategori lain.");
    if (edit.usefulLife < 0 || edit.usefulLife > 100) return setErr("Masa manfaat 0–100 tahun.");
    mutate((d) => { Object.assign(d.categories.find((c) => c.id === edit.id)!, { ...edit, name: edit.name.trim() }); },
      { action: "Mengubah", module: "Master Data", ref: edit.codePrefix, detail: `Kategori ${edit.name} · masa manfaat ${edit.usefulLife} th` });
    toast.success("Kategori diperbarui");
    setEdit(null);
  };

  return (
    <Panel title="Kategori aset" subtitle="Kategori bersifat tetap. Nama, prefiks kode, dan masa manfaat default dapat disesuaikan.">
      <div className="alert info"><Icon name="info" />Perubahan masa manfaat berlaku untuk aset baru. Aset yang sudah terdaftar tetap memakai masa manfaat yang tercatat pada asetnya.</div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Kategori</th><th>Kelompok</th><th>Prefiks kode</th><th className="text-right">Masa manfaat</th><th className="text-right">Jumlah aset</th><th /></tr></thead>
        <tbody>{db.categories.map((c) => (
          <tr key={c.id}>
            <td><div className="row" style={{ flexWrap: "nowrap" }}><div className="thumb" style={{ width: 32, height: 32 }}><Icon name={CATEGORY_ICON[c.id]} /></div><span className="cell-strong">{c.name}</span></div></td>
            <td>{c.group}</td><td className="mono">{c.codePrefix}</td>
            <td className="text-right">{c.usefulLife ? `${c.usefulLife} tahun` : "Tidak disusutkan"}</td>
            <td className="text-right">{db.assets.filter((a) => a.categoryId === c.id && a.status !== "Dihapus").length}</td>
            <td className="text-right"><button className="btn btn-plain btn-sm" onClick={() => { setErr(""); setEdit({ ...c }); }}><Icon name="edit" />Ubah</button></td>
          </tr>
        ))}</tbody>
      </table></div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Ubah kategori" subtitle={edit?.group}
        footer={<><button className="btn btn-plain" onClick={() => setEdit(null)}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan</button></>}>
        {edit && <div className="form-grid">
          <Field label="Nama kategori" required span2><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Prefiks kode aset" required hint="Contoh: PSW → PSW-2026-0001"><input className="input" value={edit.codePrefix} onChange={(e) => setEdit({ ...edit, codePrefix: e.target.value.toUpperCase() })} maxLength={5} /></Field>
          <Field label="Masa manfaat default (tahun)" hint="0 = tidak disusutkan (mis. tanah)"><input className="input" type="number" min={0} max={100} value={edit.usefulLife} onChange={(e) => setEdit({ ...edit, usefulLife: Number(e.target.value) })} /></Field>
          {err && <div className="field-error" style={{ gridColumn: "1 / -1" }}>{err}</div>}
        </div>}
      </Modal>
    </Panel>
  );
}
