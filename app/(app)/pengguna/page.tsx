"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { RequireRole } from "@/components/RequireRole";
import { Badge, ConfirmDialog, EmptyState, Field, Modal, PageHeader, Panel, SearchBox, toast } from "@/components/ui";
import { uid, useCurrentUser, useDB, useStore } from "@/lib/store";
import { ROLE_DESC, ROLE_LABEL, can, type Permission } from "@/lib/permissions";
import { unitName } from "@/lib/domain";
import { formatDateTime, initials } from "@/lib/format";
import type { Role, User } from "@/lib/types";

const ROLES: Role[] = ["admin", "pimpinan", "petugas", "teknisi", "auditor"];
const RANKS = ["Kolonel", "Letkol", "Mayor", "Kapten", "Lettu", "Letda", "Peltu", "Pelda", "Serma", "Serka", "Sertu", "Serda", "Kopka", "Praka", "PNS III/a", "PNS III/b", "PNS III/c", "PNS III/d", "PNS IV/a"];

const MATRIX: { label: string; perm: Permission }[] = [
  { label: "Mendaftarkan & mengubah aset", perm: "asset.edit" },
  { label: "Membuat work order", perm: "wo.create" },
  { label: "Mengerjakan work order", perm: "wo.work" },
  { label: "Mencatat jam terbang", perm: "flight.log" },
  { label: "Mengelola stok suku cadang", perm: "part.manage" },
  { label: "Mengajukan mutasi/peminjaman", perm: "transfer.create" },
  { label: "Mengelola inventarisasi", perm: "stocktake.manage" },
  { label: "Mengusulkan penghapusan", perm: "disposal.create" },
  { label: "Melihat jejak audit", perm: "audit.view" },
  { label: "Mengelola pengguna & master data", perm: "user.manage" },
];

type Draft = Omit<User, "id" | "lastLogin">;
const EMPTY: Draft = { username: "", password: "", name: "", rank: "Kapten", nrp: "", position: "", role: "petugas", unitId: "", active: true };

export default function PenggunaPage() {
  return <RequireRole roles={["admin"]}><Users /></RequireRole>;
}

function Users() {
  const db = useDB();
  const me = useCurrentUser()!;
  const mutate = useStore((s) => s.mutate);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pwUser, setPwUser] = useState<User | null>(null);
  const [newPw, setNewPw] = useState("");
  const [toggle, setToggle] = useState<User | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.users.filter((u) => (!role || u.role === role) && (!status || (status === "aktif") === u.active)
      && (!s || [u.name, u.username, u.nrp, u.position, u.rank].some((v) => v.toLowerCase().includes(s))));
  }, [db.users, q, role, status]);

  const openNew = () => { setErrors({}); setEditing({ draft: { ...EMPTY, unitId: db.units[0]?.id ?? "" } }); };
  const openEdit = (u: User) => { setErrors({}); setEditing({ id: u.id, draft: { ...u } }); };
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, [k]: v } } : e));

  const save = () => {
    if (!editing) return;
    const d = editing.draft;
    const err: Record<string, string> = {};
    if (!/^[a-z0-9._]{3,}$/i.test(d.username)) err.username = "Minimal 3 karakter: huruf, angka, titik, atau garis bawah.";
    else if (db.users.some((u) => u.username.toLowerCase() === d.username.toLowerCase() && u.id !== editing.id)) err.username = "Nama pengguna sudah dipakai.";
    if (d.name.trim().length < 3) err.name = "Wajib diisi.";
    if (!d.nrp.trim()) err.nrp = "Wajib diisi.";
    if (!d.unitId) err.unitId = "Pilih satuan.";
    if (!editing.id && d.password.length < 6) err.password = "Minimal 6 karakter.";
    if (editing.id === me.id && !d.active) err.active = "Anda tidak dapat menonaktifkan akun sendiri.";
    if (editing.id === me.id && d.role !== "admin") err.role = "Anda tidak dapat mengubah peran akun sendiri.";
    setErrors(err);
    if (Object.keys(err).length) return;
    if (editing.id) {
      mutate((db2) => { const u = db2.users.find((x) => x.id === editing.id)!; Object.assign(u, { ...d, password: u.password, username: d.username.trim(), name: d.name.trim() }); },
        { action: "Mengubah", module: "Pengguna", ref: d.username, detail: `${d.rank} ${d.name} · ${ROLE_LABEL[d.role]}` });
      toast.success("Data pengguna diperbarui");
    } else {
      mutate((db2) => { db2.users.push({ ...d, id: uid("usr"), username: d.username.trim(), name: d.name.trim() }); },
        { action: "Membuat", module: "Pengguna", ref: d.username, detail: `${d.rank} ${d.name} · ${ROLE_LABEL[d.role]}` });
      toast.success("Pengguna baru ditambahkan");
    }
    setEditing(null);
  };

  const resetPw = () => {
    if (!pwUser) return;
    if (newPw.length < 6) { toast.error("Kata sandi minimal 6 karakter"); return; }
    mutate((d) => { d.users.find((u) => u.id === pwUser.id)!.password = newPw; }, { action: "Reset kata sandi", module: "Pengguna", ref: pwUser.username });
    toast.success(`Kata sandi ${pwUser.username} telah direset`);
    setPwUser(null);
    setNewPw("");
  };

  const doToggle = (u: User) => {
    mutate((d) => { const x = d.users.find((y) => y.id === u.id)!; x.active = !x.active; }, { action: u.active ? "Menonaktifkan" : "Mengaktifkan", module: "Pengguna", ref: u.username });
    toast.success(u.active ? "Pengguna dinonaktifkan" : "Pengguna diaktifkan");
  };

  const d = editing?.draft;

  return (
    <div>
      <PageHeader title="Manajemen Pengguna" subtitle={`${db.users.length} akun · ${db.users.filter((u) => u.active).length} aktif`}
        actions={<button className="btn btn-primary" onClick={openNew}><Icon name="plus" />Tambah pengguna</button>} />

      <div className="panel">
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="Cari nama, username, NRP..." />
          <select className="select" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Peran"><option value="">Semua peran</option>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Semua status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select>
        </div>
        {rows.length === 0 ? <EmptyState icon="users" title="Tidak ada pengguna yang cocok" /> : (
          <>
            <div className="table-wrap desktop-only"><table className="table">
              <thead><tr><th>Pengguna</th><th>Username</th><th>Peran</th><th>Satuan / jabatan</th><th>Login terakhir</th><th>Status</th><th /></tr></thead>
              <tbody>{rows.map((u) => (
                <tr key={u.id}>
                  <td><div className="row" style={{ flexWrap: "nowrap" }}><div className="avatar sm">{initials(u.name)}</div><div><div className="cell-strong">{u.rank} {u.name}</div><div className="cell-sub">NRP {u.nrp}</div></div></div></td>
                  <td className="mono">{u.username}</td>
                  <td><Badge tone={u.role === "admin" ? "critical" : u.role === "pimpinan" ? "warning" : "normal"} dot={false}>{ROLE_LABEL[u.role]}</Badge></td>
                  <td>{unitName(db, u.unitId)}<div className="cell-sub">{u.position}</div></td>
                  <td className="nowrap">{formatDateTime(u.lastLogin)}</td>
                  <td><Badge tone={u.active ? "normal" : "done"}>{u.active ? "Aktif" : "Nonaktif"}</Badge></td>
                  <td><UserActions u={u} me={me} onEdit={openEdit} onPw={setPwUser} onToggle={setToggle} /></td>
                </tr>
              ))}</tbody>
            </table></div>
            <div className="mobile-only">{rows.map((u) => (
              <div key={u.id} className="list-card">
                <div className="list-card-top"><div className="row" style={{ flexWrap: "nowrap" }}><div className="avatar sm">{initials(u.name)}</div><div><div className="list-card-title">{u.rank} {u.name}</div><div className="cell-sub">{u.username} · {ROLE_LABEL[u.role]}</div></div></div><Badge tone={u.active ? "normal" : "done"}>{u.active ? "Aktif" : "Nonaktif"}</Badge></div>
                <div className="cell-sub">{unitName(db, u.unitId)} · {u.position}</div>
                <div style={{ marginTop: 10 }}><UserActions u={u} me={me} onEdit={openEdit} onPw={setPwUser} onToggle={setToggle} /></div>
              </div>
            ))}</div>
          </>
        )}
      </div>

      <Panel title="Matriks hak akses" subtitle="Ringkasan wewenang tiap peran" style={{ marginTop: 16 }}>
        <div className="table-wrap"><table className="table compact">
          <thead><tr><th>Wewenang</th>{ROLES.map((r) => <th key={r} style={{ textAlign: "center" }}>{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody>
            {MATRIX.map((m) => (
              <tr key={m.perm}><td>{m.label}</td>{ROLES.map((r) => <td key={r} style={{ textAlign: "center" }}>{can(r, m.perm) ? <span className="text-success" aria-label="Ya"><Icon name="check" size={16} /></span> : <span className="muted" aria-label="Tidak">–</span>}</td>)}</tr>
            ))}
            <tr><td>Menyetujui tahap persetujuan</td>{ROLES.map((r) => <td key={r} style={{ textAlign: "center", fontSize: 11.5 }} className="muted">{r === "admin" ? "Semua tahap" : r === "pimpinan" ? "Persetujuan akhir" : r === "petugas" ? "Verifikasi" : r === "teknisi" ? "Pemeriksaan teknis" : "Reviu"}</td>)}</tr>
          </tbody>
        </table></div>
      </Panel>

      <Modal open={!!editing} onClose={() => setEditing(null)} size="lg" title={editing?.id ? "Ubah pengguna" : "Tambah pengguna"}
        footer={<><button className="btn btn-plain" onClick={() => setEditing(null)}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan</button></>}>
        {d && (
          <div className="form-grid">
            <Field label="Nama pengguna" required error={errors.username}><input className={`input ${errors.username ? "invalid" : ""}`} value={d.username} onChange={(e) => set("username", e.target.value)} autoComplete="off" /></Field>
            {!editing?.id ? (
              <Field label="Kata sandi awal" required error={errors.password} hint="Minimal 6 karakter"><input className={`input ${errors.password ? "invalid" : ""}`} value={d.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" /></Field>
            ) : <div />}
            <Field label="Nama lengkap" required error={errors.name}><input className={`input ${errors.name ? "invalid" : ""}`} value={d.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Pangkat / golongan"><select className="select" value={d.rank} onChange={(e) => set("rank", e.target.value)}>{(RANKS.includes(d.rank) ? RANKS : [d.rank, ...RANKS]).map((r) => <option key={r}>{r}</option>)}</select></Field>
            <Field label="NRP / NIP" required error={errors.nrp}><input className={`input ${errors.nrp ? "invalid" : ""}`} value={d.nrp} onChange={(e) => set("nrp", e.target.value)} /></Field>
            <Field label="Jabatan"><input className="input" value={d.position} onChange={(e) => set("position", e.target.value)} /></Field>
            <Field label="Satuan" required error={errors.unitId}><select className="select" value={d.unitId} onChange={(e) => set("unitId", e.target.value)}>{db.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            <Field label="Peran" required error={errors.role} hint={ROLE_DESC[d.role]}><select className="select" value={d.role} onChange={(e) => set("role", e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
            <Field label="Status" error={errors.active} span2><label className="checkbox"><input type="checkbox" checked={d.active} onChange={(e) => set("active", e.target.checked)} />Akun aktif (dapat masuk ke sistem)</label></Field>
          </div>
        )}
      </Modal>

      <Modal open={!!pwUser} onClose={() => { setPwUser(null); setNewPw(""); }} title="Reset kata sandi" subtitle={pwUser ? `${pwUser.rank} ${pwUser.name} (${pwUser.username})` : ""}
        footer={<><button className="btn btn-plain" onClick={() => { setPwUser(null); setNewPw(""); }}>Batal</button><button className="btn btn-primary" onClick={resetPw}>Simpan kata sandi</button></>}>
        <Field label="Kata sandi baru" required hint="Minimal 6 karakter. Sampaikan kepada pengguna melalui jalur resmi."><input className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoFocus autoComplete="new-password" /></Field>
      </Modal>

      <ConfirmDialog open={!!toggle} onClose={() => setToggle(null)} danger={toggle?.active}
        title={toggle?.active ? "Nonaktifkan pengguna?" : "Aktifkan pengguna?"}
        confirmLabel={toggle?.active ? "Nonaktifkan" : "Aktifkan"}
        message={toggle ? (toggle.active ? `${toggle.rank} ${toggle.name} tidak akan dapat masuk sampai diaktifkan kembali.` : `${toggle.rank} ${toggle.name} akan dapat masuk kembali.`) : ""}
        onConfirm={() => toggle && doToggle(toggle)} />
    </div>
  );
}

function UserActions({ u, me, onEdit, onPw, onToggle }: { u: User; me: User; onEdit: (u: User) => void; onPw: (u: User) => void; onToggle: (u: User) => void }) {
  return (
    <div className="row" style={{ gap: 6, flexWrap: "nowrap", justifyContent: "flex-end" }}>
      <button className="btn btn-plain btn-sm" onClick={() => onEdit(u)} title="Ubah"><Icon name="edit" />Ubah</button>
      <button className="btn btn-plain btn-sm" onClick={() => onPw(u)} title="Reset kata sandi"><Icon name="key" /></button>
      {u.id !== me.id && <button className={`btn btn-sm ${u.active ? "btn-ghost" : "btn-secondary"}`} onClick={() => onToggle(u)}>{u.active ? "Nonaktifkan" : "Aktifkan"}</button>}
    </div>
  );
}
