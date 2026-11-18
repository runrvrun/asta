"use client";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { EmptyState, PageHeader } from "@/components/ui";
import { useCurrentUser } from "@/lib/store";
import { can } from "@/lib/permissions";

const REPORTS: { slug: string; title: string; desc: string; icon: IconName; tag: string }[] = [
  { slug: "aset", title: "Daftar & Rekapitulasi Aset", desc: "Seluruh aset beserta rekap jumlah dan nilai per kategori dan per satuan.", icon: "box", tag: "Inventaris" },
  { slug: "penyusutan", title: "Nilai & Penyusutan Aset", desc: "Nilai perolehan, akumulasi penyusutan garis lurus, dan nilai buku per tanggal tertentu.", icon: "chart", tag: "Keuangan" },
  { slug: "kondisi", title: "Kondisi & Status Aset", desc: "Matriks kondisi (baik/rusak) dan status aset per satuan.", icon: "activity", tag: "Inventaris" },
  { slug: "pemeliharaan", title: "Pemeliharaan (Work Order)", desc: "Rekap WO per periode, jam kerja estimasi vs realisasi, dan biaya suku cadang.", icon: "clipboard", tag: "Pemeliharaan" },
  { slug: "kelaikan", title: "Kesiapan Armada & Jam Terbang", desc: "Status kelaikan, inspeksi berkala, dan jam terbang per pesawat dalam periode.", icon: "plane", tag: "Kelaikan" },
  { slug: "mutasi", title: "Mutasi & Peminjaman", desc: "Daftar mutasi antar satuan dan peminjaman aset beserta statusnya.", icon: "transfer", tag: "Pergerakan" },
  { slug: "penghapusan", title: "Penghapusan Aset", desc: "Usulan penghapusan, metode, nilai, dan hasil persetujuan berjenjang.", icon: "trash", tag: "Pergerakan" },
  { slug: "inventarisasi", title: "Hasil Inventarisasi", desc: "Hasil penghitungan fisik per sesi: ditemukan, tidak ditemukan, dan selisih.", icon: "list", tag: "Kendali" },
  { slug: "suku-cadang", title: "Posisi Stok Suku Cadang", desc: "Stok, nilai persediaan, item di bawah minimum, dan mutasi stok periode.", icon: "package", tag: "Logistik" },
];

export default function LaporanPage() {
  const user = useCurrentUser();
  if (!can(user?.role, "report.view")) return <div className="panel"><EmptyState icon="lock" title="Akses ditolak" /></div>;
  return (
    <div>
      <PageHeader title="Pusat Laporan" subtitle="Pilih laporan untuk melihat, menyaring, mengekspor ke CSV (Excel), atau mencetak." />
      <div className="grid-3">
        {REPORTS.map((r) => (
          <Link key={r.slug} href={`/laporan/${r.slug}`} className="panel row" style={{ alignItems: "flex-start", flexWrap: "nowrap", gap: 14, marginTop: 0 }}>
            <div className="thumb lg"><Icon name={r.icon} /></div>
            <div style={{ minWidth: 0 }}>
              <span className="chip">{r.tag}</span>
              <div className="cell-strong" style={{ fontSize: 14.5, margin: "6px 0 3px", fontFamily: "var(--font-head)" }}>{r.title}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>{r.desc}</div>
              <div className="link small" style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>Buka laporan <Icon name="arrowRight" size={13} /></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
