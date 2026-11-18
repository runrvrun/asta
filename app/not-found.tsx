import Link from "next/link";

export default function NotFound() {
  return (
    <div className="loader-screen">
      <div style={{ fontFamily: "var(--font-head)", fontSize: 44, fontWeight: 800, color: "var(--navy)" }}>404</div>
      <div>Halaman tidak ditemukan.</div>
      <Link href="/dashboard" className="btn btn-primary">Kembali ke Dashboard</Link>
    </div>
  );
}
