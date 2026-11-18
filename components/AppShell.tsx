"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { ConfirmDialog, toast } from "./ui";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import { BOTTOM_NAV, activeHref, navForRole } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/permissions";
import { initials, timeAgo } from "@/lib/format";
import { pendingApprovalsFor } from "@/lib/domain";
import type { DB, User } from "@/lib/types";

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, close]);
  return ref;
}

export function visibleNotifications(db: DB, user: User) {
  return db.notifications.filter((n) => (!n.userId && !n.role) || n.userId === user.id || n.role === user.role || (user.role === "admin" && !!n.role));
}

function Sidebar({ user, pendingCount, drawer, onNavigate }: { user: User; pendingCount: number; drawer?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = activeHref(pathname);
  return (
    <aside className={drawer ? "sidebar drawer" : "sidebar"}>
      <Link href="/dashboard" className="brand" onClick={onNavigate}>
        <div className="logo-mark"><Icon name="logo" /></div>
        <div className="brand-text">ASTA<span>Sistem Manajemen Aset</span></div>
      </Link>
      {navForRole(user.role).map((section) => (
        <div key={section.label}>
          <div className="nav-section-label">{section.label}</div>
          {section.items.map((item) => (
            <Link key={item.href} href={item.href} className={`nav-item ${active === item.href ? "active" : ""}`} onClick={onNavigate}>
              <Icon name={item.icon} />
              {item.label}
              {item.href === "/persetujuan" && pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}
            </Link>
          ))}
        </div>
      ))}
      <div className="sidebar-foot">Asta · versi demo<br />Data tersimpan di browser ini</div>
    </aside>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const user = useCurrentUser()!;
  const db = useDB();
  const router = useRouter();
  const pathname = usePathname();
  const logout = useStore((s) => s.logout);
  const resetDemo = useStore((s) => s.resetDemo);
  const mutate = useStore((s) => s.mutate);

  const [drawer, setDrawer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [q, setQ] = useState("");
  const menuRef = useOutsideClose(menuOpen, () => setMenuOpen(false));
  const bellRef = useOutsideClose(bellOpen, () => setBellOpen(false));

  // Close the drawer and popovers whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawer(false);
    setMenuOpen(false);
    setBellOpen(false);
  }

  const pending = pendingApprovalsFor(db, user);
  const pendingCount = pending.transfers.length + pending.disposals.length;
  const notifs = useMemo(() => visibleNotifications(db, user), [db, user]);
  const unread = notifs.filter((n) => !n.read.includes(user.id)).length;
  const active = activeHref(pathname);

  const markAllRead = () => mutate((d) => d.notifications.forEach((n) => { if (!n.read.includes(user.id)) n.read.push(user.id); }));
  const openNotif = (id: string, href?: string) => {
    mutate((d) => { const n = d.notifications.find((x) => x.id === id); if (n && !n.read.includes(user.id)) n.read.push(user.id); });
    setBellOpen(false);
    if (href) router.push(href);
  };

  return (
    <div className="app">
      <Sidebar user={user} pendingCount={pendingCount} />
      {drawer && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawer(false)} />
          <Sidebar user={user} pendingCount={pendingCount} drawer onNavigate={() => setDrawer(false)} />
        </>
      )}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Menu" onClick={() => setDrawer(true)}><Icon name="menu" /></button>
          <Link href="/dashboard" className="topbar-brand"><div className="logo-mark"><Icon name="logo" /></div>ASTA</Link>
          <form className="topbar-search" onSubmit={(e) => { e.preventDefault(); router.push(`/aset?q=${encodeURIComponent(q)}`); }}>
            <div className="search-box" style={{ maxWidth: "none" }}>
              <Icon name="search" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari aset: nama, kode, nomor registrasi..." />
            </div>
          </form>
          <div className="topbar-right">
            <div className="popover-anchor" ref={bellRef}>
              <button className="icon-btn" aria-label="Notifikasi" onClick={() => setBellOpen((v) => !v)}>
                <Icon name="bell" />
                {unread > 0 && <span className="dot">{unread}</span>}
              </button>
              {bellOpen && (
                <div className="popover notif-list">
                  <div className="popover-head row" style={{ justifyContent: "space-between" }}>
                    <b style={{ fontSize: 13.5 }}>Notifikasi</b>
                    {unread > 0 && <button className="link" style={{ border: "none", background: "none", fontSize: 12 }} onClick={markAllRead}>Tandai semua dibaca</button>}
                  </div>
                  {notifs.length === 0 && <div className="muted small" style={{ padding: 12 }}>Belum ada notifikasi.</div>}
                  {notifs.slice(0, 15).map((n) => (
                    <div key={n.id} className={`notif-item ${n.read.includes(user.id) ? "" : "unread"}`} onClick={() => openNotif(n.id, n.href)}>
                      <div className="notif-title">{n.title}</div>
                      <div className="notif-body">{n.body}</div>
                      <div className="notif-meta">{timeAgo(n.at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="popover-anchor" ref={menuRef}>
              <button className="avatar-wrap" onClick={() => setMenuOpen((v) => !v)}>
                <div className="avatar">{initials(user.name)}</div>
                <div className="avatar-meta">
                  <div className="avatar-name">{user.rank} {user.name}</div>
                  <div className="avatar-role">{ROLE_LABEL[user.role]}</div>
                </div>
              </button>
              {menuOpen && (
                <div className="popover">
                  <div className="popover-head">
                    <div className="avatar-name">{user.rank} {user.name}</div>
                    <div className="avatar-role">{user.position}</div>
                  </div>
                  <Link className="popover-item" href="/profil"><Icon name="user" />Profil & kata sandi</Link>
                  <button className="popover-item" onClick={() => { setMenuOpen(false); setConfirmReset(true); }}><Icon name="refresh" />Reset data demo</button>
                  <div className="popover-sep" />
                  <button className="popover-item danger" onClick={() => { logout(); router.replace("/login"); }}><Icon name="logout" />Keluar</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content">{children}</main>

        <footer className="footer">
          <div>
            <div className="footer-accent"><span style={{ background: "#0B2A4A" }} /><span style={{ background: "#1B5FA8" }} /><span style={{ background: "#8FC6EE" }} /></div>
            <div className="footer-text" style={{ marginTop: 8 }}>Asta · Sistem Manajemen Aset © {new Date().getFullYear()}</div>
          </div>
          <div className="footer-text">Versi demo · seluruh data bersifat fiktif dan tersimpan di browser Anda</div>
        </footer>
      </div>

      <nav className="bottom-nav">
        {BOTTOM_NAV.map((item) => (
          <Link key={item.href} href={item.href} className={`bn-item ${active === item.href ? "active" : ""}`}>
            <Icon name={item.icon} />
            {item.label}
            {item.href === "/persetujuan" && pendingCount > 0 && <span className="bn-dot" />}
          </Link>
        ))}
      </nav>

      <ConfirmDialog open={confirmReset} onClose={() => setConfirmReset(false)} danger confirmLabel="Reset data"
        title="Reset data demo?"
        message="Semua perubahan yang Anda buat di browser ini akan dihapus dan data contoh dimuat ulang. Anda tetap masuk."
        onConfirm={() => { resetDemo(); toast.success("Data demo telah dimuat ulang"); router.push("/dashboard"); }} />
    </div>
  );
}
