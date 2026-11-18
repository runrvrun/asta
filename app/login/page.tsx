"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/ui";
import { useStore } from "@/lib/store";
import { DEMO_PASSWORD } from "@/lib/seed";
import { ROLE_LABEL } from "@/lib/permissions";
import type { Role } from "@/lib/types";

const DEMO: { username: string; role: Role }[] = [
  { username: "admin", role: "admin" },
  { username: "komandan", role: "pimpinan" },
  { username: "petugas", role: "petugas" },
  { username: "teknisi", role: "teknisi" },
  { username: "auditor", role: "auditor" },
];

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.sessionUserId);
  const login = useStore((s) => s.login);
  const users = useStore((s) => s.db.users);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hydrated && session) router.replace("/dashboard");
  }, [hydrated, session, router]);

  const submit = (u = username, p = password) => {
    setError("");
    if (!u.trim() || !p) { setError("Masukkan nama pengguna dan kata sandi."); return; }
    const found = users.find((x) => x.username.toLowerCase() === u.trim().toLowerCase());
    if (found && !found.active) { setError("Akun ini dinonaktifkan. Hubungi administrator."); return; }
    const user = login(u, p);
    if (!user) { setError("Nama pengguna atau kata sandi salah."); return; }
    toast.success(`Selamat datang, ${user.rank} ${user.name}`);
    router.replace("/dashboard");
  };

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="row" style={{ gap: 12 }}>
          <div className="logo-mark" style={{ width: 44, height: 44, borderRadius: 12 }}><Icon name="logo" size={22} /></div>
          <div className="brand-text" style={{ fontSize: 22 }}>ASTA<span>Sistem Manajemen Aset</span></div>
        </div>
        <div>
          <h1>Kendali penuh atas setiap aset yang Anda pegang.</h1>
          <p>
            Asta — dari bahasa Jawa krama inggil yang berarti <i>memegang</i> atau <i>membawa</i> — menyatukan pencatatan,
            pemeliharaan, kelaikan, mutasi, hingga penghapusan aset dalam satu sistem: dari pesawat dan helikopter
            sampai kendaraan, persenjataan, tanah, dan bangunan.
          </p>
        </div>
        <div className="login-features">
          <div className="login-feature"><b>Siklus hidup aset</b>Pendaftaran, label QR, mutasi, inventarisasi, dan penghapusan berjenjang.</div>
          <div className="login-feature"><b>Kelaikan armada</b>Jam terbang, inspeksi berkala, dan sertifikat kelaikan yang selalu terpantau.</div>
          <div className="login-feature"><b>Pemeliharaan digital</b>Work order, checklist, dan pemakaian suku cadang langsung dari lapangan.</div>
          <div className="login-feature"><b>Akuntabel</b>Persetujuan berjenjang, jejak audit, dan laporan siap cetak.</div>
        </div>
      </section>

      <section className="login-form-wrap">
        <div className="login-card">
          <h2 style={{ fontSize: 22, margin: "0 0 4px", color: "var(--navy)" }}>Masuk</h2>
          <p className="muted" style={{ margin: "0 0 20px", fontSize: 13 }}>Gunakan akun yang diberikan administrator satuan Anda.</p>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="stack" style={{ gap: 14 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Nama pengguna</label>
              <input id="username" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mis. petugas" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Kata sandi</label>
              <div style={{ position: "relative" }}>
                <input id="password" className="input" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label="Tampilkan kata sandi" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", color: "var(--blue)", cursor: "pointer", display: "flex" }}>
                  <Icon name="eye" size={18} />
                </button>
              </div>
            </div>
            {error && <div className="alert critical" style={{ margin: 0 }}><Icon name="alert" />{error}</div>}
            <button className="btn btn-primary btn-block" type="submit"><Icon name="lock" />Masuk</button>
          </form>

          <div className="panel" style={{ marginTop: 22, padding: 14 }}>
            <div className="form-label">Akun demo</div>
            <div className="field-hint">Klik salah satu untuk langsung masuk. Kata sandi semua akun: <b className="mono">{DEMO_PASSWORD}</b></div>
            <div className="demo-accounts">
              {DEMO.map((d) => {
                const u = users.find((x) => x.username === d.username);
                return (
                  <button key={d.username} type="button" className="demo-account" onClick={() => { setUsername(d.username); setPassword(DEMO_PASSWORD); submit(d.username, u?.password ?? DEMO_PASSWORD); }}>
                    <b>{ROLE_LABEL[d.role]}</b>
                    <span>{d.username}{u ? ` · ${u.rank} ${u.name}` : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 16, textAlign: "center" }}>Versi demo · seluruh data fiktif dan disimpan di browser Anda.</p>
        </div>
      </section>
    </div>
  );
}
