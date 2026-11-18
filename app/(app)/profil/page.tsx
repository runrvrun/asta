"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { ConfirmDialog, Field, KV, PageHeader, Panel, toast } from "@/components/ui";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import { ROLE_DESC, ROLE_LABEL } from "@/lib/permissions";
import { unitName } from "@/lib/domain";
import { formatDateTime, initials, timeAgo } from "@/lib/format";

export default function ProfilPage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const mutate = useStore((s) => s.mutate);
  const resetDemo = useStore((s) => s.resetDemo);
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(user.name);
  const [position, setPosition] = useState(user.position);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErr, setPwErr] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const saveProfile = () => {
    if (name.trim().length < 3) { toast.error("Nama minimal 3 karakter"); return; }
    mutate((d) => { const u = d.users.find((x) => x.id === user.id)!; u.name = name.trim(); u.position = position.trim(); }, { action: "Mengubah profil", module: "Pengguna", ref: user.username });
    setEdit(false);
    toast.success("Profil diperbarui");
  };
  const changePw = () => {
    setPwErr("");
    if (pw.current !== user.password) return setPwErr("Kata sandi saat ini salah.");
    if (pw.next.length < 6) return setPwErr("Kata sandi baru minimal 6 karakter.");
    if (pw.next !== pw.confirm) return setPwErr("Konfirmasi kata sandi tidak sama.");
    mutate((d) => { d.users.find((x) => x.id === user.id)!.password = pw.next; }, { action: "Mengganti kata sandi", module: "Pengguna", ref: user.username });
    setPw({ current: "", next: "", confirm: "" });
    toast.success("Kata sandi berhasil diganti");
  };
  const activity = db.audit.filter((a) => a.userId === user.id).slice(0, 12);

  return (
    <div>
      <PageHeader title="Profil Saya" subtitle="Data akun, kata sandi, dan aktivitas Anda" />
      <div className="layout-main-side">
        <div className="stack">
          <Panel title="Data pengguna" actions={!edit && <button className="btn btn-secondary btn-sm" onClick={() => { setName(user.name); setPosition(user.position); setEdit(true); }}><Icon name="edit" />Ubah</button>}>
            <div className="row" style={{ marginBottom: 16, flexWrap: "nowrap" }}>
              <div className="avatar" style={{ width: 56, height: 56, fontSize: 18 }}>{initials(user.name)}</div>
              <div><div className="cell-strong" style={{ fontSize: 16 }}>{user.name}</div><div className="muted small">{user.position}</div></div>
            </div>
            {edit ? (
              <div className="form-grid">
                <Field label="Nama lengkap" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="Jabatan"><input className="input" value={position} onChange={(e) => setPosition(e.target.value)} /></Field>
                <div className="span-2 row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
                  <button className="btn btn-plain" onClick={() => setEdit(false)}>Batal</button>
                  <button className="btn btn-primary" onClick={saveProfile}>Simpan</button>
                </div>
              </div>
            ) : (
              <div className="kv-grid cols-3">
                <KV label="Nama pengguna">{user.username}</KV>
                <KV label="NIP">{user.nip}</KV>
                <KV label="Peran">{ROLE_LABEL[user.role]}</KV>
                <KV label="Satuan">{unitName(db, user.unitId)}</KV>
                <KV label="Login terakhir">{formatDateTime(user.lastLogin)}</KV>
              </div>
            )}
            <div className="alert info" style={{ marginTop: 16, marginBottom: 0 }}><Icon name="info" />{ROLE_DESC[user.role]}. Peran dan satuan hanya dapat diubah administrator.</div>
          </Panel>

          <Panel title="Ganti kata sandi">
            <form className="form-grid" onSubmit={(e) => { e.preventDefault(); changePw(); }}>
              <Field label="Kata sandi saat ini" required span2><input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
              <Field label="Kata sandi baru" required hint="Minimal 6 karakter"><input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
              <Field label="Ulangi kata sandi baru" required><input className="input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
              {pwErr && <div className="field-error span-2" style={{ gridColumn: "1 / -1" }}>{pwErr}</div>}
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}><button className="btn btn-primary" type="submit"><Icon name="key" />Simpan kata sandi</button></div>
            </form>
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Aktivitas saya">
            {activity.length === 0 ? <div className="muted small">Belum ada aktivitas.</div> : (
              <div className="timeline">{activity.map((a) => (
                <div key={a.id} className="timeline-item"><div className="timeline-dot" /><div>
                  <div className="timeline-text">{a.action} · {a.module}{a.ref ? ` ${a.ref}` : ""}</div>
                  <div className="timeline-meta">{timeAgo(a.at)}{a.detail ? ` · ${a.detail}` : ""}</div>
                </div></div>
              ))}</div>
            )}
          </Panel>
          <Panel title="Data demo" subtitle="Aplikasi ini versi demo: seluruh data fiktif dan disimpan di browser ini saja.">
            <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>Perubahan yang Anda buat (aset baru, work order, persetujuan, dan lainnya) tidak terlihat oleh pengguna lain atau di perangkat lain. Reset untuk mengembalikan data contoh awal.</p>
            <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}><Icon name="refresh" />Reset data demo</button>
          </Panel>
        </div>
      </div>
      <ConfirmDialog open={confirmReset} onClose={() => setConfirmReset(false)} danger confirmLabel="Reset data" title="Reset data demo?"
        message="Semua perubahan di browser ini akan dihapus dan data contoh dimuat ulang."
        onConfirm={() => { resetDemo(); toast.success("Data demo telah dimuat ulang"); router.push("/dashboard"); }} />
    </div>
  );
}
