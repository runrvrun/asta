import type { IconName } from "@/components/Icon";
import type { Role } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  roles?: Role[]; // omitted = all roles
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    label: "Utama",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/scan", label: "Scan QR Aset", icon: "scan" },
      { href: "/persetujuan", label: "Kotak Persetujuan", icon: "inbox" },
    ],
  },
  {
    label: "Aset",
    items: [
      { href: "/aset", label: "Daftar Aset", icon: "box" },
      { href: "/aset/baru", label: "Pendaftaran Aset", icon: "plus", roles: ["admin", "petugas"] },
      { href: "/mutasi", label: "Mutasi & Peminjaman", icon: "transfer" },
      { href: "/inventarisasi", label: "Inventarisasi", icon: "list" },
      { href: "/penghapusan", label: "Penghapusan Aset", icon: "trash" },
    ],
  },
  {
    label: "Pemeliharaan & Kelaikan",
    items: [
      { href: "/pemeliharaan", label: "Work Order", icon: "clipboard" },
      { href: "/kelaikan", label: "Kelaikan & Jam Terbang", icon: "plane" },
      { href: "/suku-cadang", label: "Suku Cadang & Gudang", icon: "package" },
    ],
  },
  {
    label: "Kendali & Pelaporan",
    items: [
      { href: "/laporan", label: "Laporan", icon: "file" },
      { href: "/audit", label: "Jejak Audit", icon: "shield", roles: ["admin", "auditor", "pimpinan"] },
      { href: "/pengguna", label: "Manajemen Pengguna", icon: "users", roles: ["admin"] },
      { href: "/master", label: "Master Data", icon: "database", roles: ["admin"] },
    ],
  },
];

export const BOTTOM_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/aset", label: "Aset", icon: "box" },
  { href: "/scan", label: "Scan", icon: "scan" },
  { href: "/pemeliharaan", label: "WO", icon: "clipboard" },
  { href: "/persetujuan", label: "Approval", icon: "inbox" },
];

export function navForRole(role: Role) {
  return NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || i.roles.includes(role)) })).filter((s) => s.items.length);
}

/** Longest nav href matching the pathname (so /aset/baru doesn't also light up /aset). */
export function activeHref(pathname: string) {
  const all = NAV.flatMap((s) => s.items.map((i) => i.href));
  const clean = pathname.replace(/\/$/, "") || "/";
  return all.filter((h) => clean === h || clean.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0];
}
