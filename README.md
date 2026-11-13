<div align="center">

<img src="assets/logo-original-nobg.png" alt="Menuflow" width="300">

### Better Choices. Smarter Preparation.

<p>Platform pemesanan makanan fleksibel dan koordinasi permintaan dapur untuk kantin, katering, dan penyedia makanan.</p>

<p><img src="https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=white&labelColor=3a3f47" alt="JavaScript ES Modules"> <img src="https://img.shields.io/badge/Node.js-dev%20server-339933?logo=nodedotjs&logoColor=white&labelColor=3a3f47" alt="Node.js dev server"> <img src="https://img.shields.io/badge/mode-prototype-d4a017?labelColor=3a3f47" alt="mode prototype"> <img src="https://img.shields.io/badge/license-MIT-1e3a8a?labelColor=3a3f47" alt="license MIT"></p>

<p><a href="https://menuflow-hazel.vercel.app"><b>Lihat demo langsung &rarr;</b></a></p>
</div>

---

## Fitur Cetak & Rencana Produksi

Setelah alokasi dikonfirmasi, merchant mendapat halaman **Rencana Produksi** yang siap dicetak atau diunduh untuk dapur.

<p align="center">
  <img src="docs/production-plan.png" alt="Halaman Rencana Produksi dengan tombol Cetak dan Unduh Ringkasan Produksi" width="860">
</p>

### Tombol Cetak

Klik **Cetak** untuk membuka dialog cetak browser. Stylesheet khusus cetak menyembunyikan sidebar, bilah atas, tombol, dan pemilih sesi, sehingga hasil cetak hanya berisi isi rencana: kartu ringkasan, produksi per menu, catatan diet khusus, dan status pengambilan.

<p align="center">
  <img src="docs/print-preview.png" alt="Tampilan hasil cetak Rencana Produksi" width="420">
</p>

### Unduh Ringkasan Produksi

Tombol **Unduh Ringkasan Produksi** menghasilkan berkas teks `menuflow-production-summary.txt` berisi nama sesi, jadwal dan lokasi pengambilan, porsi per menu, total, serta catatan alergi dan diet tiap pesanan. Cocok untuk ditempel ke chat dapur atau dicetak dari aplikasi lain.

### Isi yang dicetak

| Bagian | Keterangan |
| --- | --- |
| Total menu terkonfirmasi | Jumlah porsi yang sudah dialokasikan |
| Kapasitas & sisa | Total kapasitas produksi dan sisanya |
| Jadwal pengambilan | Jam dan lokasi pengambilan |
| Produksi per menu | Porsi terkonfirmasi dibanding kapasitas tiap menu |
| Catatan diet khusus | Alergi, pantangan, dan catatan per pesanan |
| Status pengambilan | Terkonfirmasi, siap diambil, sudah diambil |

## Konsep

Menuflow mengoordinasikan pesanan fleksibel dengan kapasitas dapur. Pelanggan memilih satu menu utama dan alternatif yang bersedia mereka terima, plus kebutuhan alergi dan diet. Merchant menjalankan alokasi, meninjau hasilnya, lalu mempublikasikan; setelah itu halaman **Rencana Produksi** menjadi acuan dapur.

Aturan alokasi (`app/js/allocation.js`, fungsi murni tanpa DOM dan tanpa acak):

1. Persetujuan pelanggan adalah batas keras: pesanan hanya bisa mendapat menu utama atau alternatif yang ia setujui.
2. Alergi dan diet adalah batas keras. Menu dengan info bahan/alergen yang belum lengkap tidak dianggap aman bila pelanggan punya kebutuhan.
3. Kapasitas menu tidak pernah dilampaui.
4. Antrean berdasarkan waktu pesan (FIFO, imbang diurutkan menurut nomor pesanan).
5. Semua pilihan utama dilayani lebih dulu, baru sisanya dilayani lewat alternatif yang disetujui.

Agregasi Rencana Produksi ada di `app/js/production.js` (juga murni).

## Menjalankan

Tanpa dependensi, cukup Node.js 22 atau lebih baru.

```bash
npm run dev     # http://localhost:5173/  (aplikasi: /app/)
```

Untuk melihat fitur cetak: buka `/app/`, masuk sebagai **Merchant**, buka **Pusat Alokasi**, buat pratinjau, tinjau, publikasikan, lalu Anda diarahkan ke **Rencana Produksi**.

### Skrip

| Skrip | Fungsi |
| --- | --- |
| `npm run dev` | server statis lokal (`PORT` mengubah port) |
| `npm run check` | pemeriksaan sintaks semua berkas JS (`node --check`) |
| `npm test` | tes unit dengan `node:test` |

Tidak ada langkah build: aplikasi berupa JavaScript ES module statis.

## Tes

```bash
npm test
```

- `tests/allocation.test.mjs`: tes awal (alokasi pada data demo).
- `tests/allocation.rules.test.mjs`: aturan alokasi, kasus tepi (kosong, stok tidak cukup, duplikat, alergi), override, konfirmasi, format uang.
- `tests/production.test.mjs`: agregasi Rencana Produksi, termasuk acuan `tests/fixtures/production-summary.golden.txt` yang diambil dari unduhan aplikasi asli.

Tes tidak bergantung pada zona waktu, locale, jam nyata, atau acak: fixture memakai stempel waktu eksplisit dan format uang memakai locale `id-ID` secara eksplisit. CI (`.github/workflows/ci.yml`) menjalankan `npm ci`, `npm run check`, dan `npm test` di Node 22 dengan `TZ=UTC`.

## Batasan

- Prototipe: data demo tersimpan di `localStorage`, tanpa backend, autentikasi, atau pembayaran. Jam demo dimulai pukul 09.30.
- Pencocokan "alergi lain" memakai kecocokan teks pada daftar bahan, bukan basis data alergen; hasilnya konservatif tetapi tidak lengkap untuk sinonim.
- Data pada halaman Kinerja (7 sesi) adalah data contoh, bukan hasil pengukuran.
- Font dimuat dari Google Fonts; tanpa jaringan, font cadangan dipakai.
- Menuflow tidak menjamin makanan bebas kontaminasi silang; informasi alergen berasal dari pihak kantin.
- Temuan audit dan keputusan yang belum diambil ada di [`docs/AUDIT.md`](docs/AUDIT.md).

## Lisensi

MIT. Hak cipta © 2026 Vassel Goleyu.
