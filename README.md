# Asta — Sistem Manajemen Aset

**Asta** (bahasa Jawa krama inggil: *memegang* / *membawa*) adalah aplikasi web untuk mengelola seluruh siklus hidup aset: pesawat, helikopter, pesawat nirawak, radar, persenjataan, peralatan pendukung darat, kendaraan, tanah, bangunan, hingga komponen rotable.

Ini adalah **versi demo**. Aplikasi dibangun dengan Next.js lalu diekspor sebagai situs statis. Tidak ada server maupun database: data contoh (seluruhnya fiktif) dimuat ke `localStorage` browser, dan setiap perubahan tersimpan di browser masing-masing pengunjung. Gunakan menu profil → **Reset data demo** untuk memulai ulang.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export ke ./out
npm start          # menyajikan ./out secara lokal
npm run lint
npm run typecheck
```

## Akun demo

Kata sandi semua akun: `asta123`

| Username | Peran | Fokus |
|---|---|---|
| `admin` | Administrator | Semua modul, pengguna, master data |
| `komandan` | Pejabat Penyetuju | Persetujuan mutasi/peminjaman & penghapusan |
| `petugas` | Petugas Aset | Pendaftaran aset, mutasi, inventarisasi, stok |
| `teknisi` | Teknisi | Work order, jam terbang, pemakaian suku cadang |
| `auditor` | Auditor | Jejak audit, reviu penghapusan, laporan |

## Modul

- Dashboard (sesuai peran)
- Daftar aset, pendaftaran, detail, label QR, dan scan QR (kamera)
- Work order pemeliharaan
- Kelaikan & jam terbang
- Suku cadang & gudang
- Mutasi & peminjaman beserta BAST
- Inventarisasi (opname)
- Penghapusan dengan persetujuan berjenjang
- Kotak persetujuan
- Laporan (cetak & CSV)
- Jejak audit
- Manajemen pengguna
- Master data
- Profil

## Deploy ke Vercel

Impor repositori ini di Vercel. Framework terdeteksi otomatis sebagai Next.js, dan `output: "export"` di `next.config.ts` menghasilkan situs statis. Tidak perlu environment variable.

Mockup HTML awal disimpan di `mockups/` sebagai referensi desain.
