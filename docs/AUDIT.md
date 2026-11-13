# Audit singkat Menuflow

Cakupan: logika alokasi dan Rencana Produksi, aksesibilitas, tampilan 360px, tampilan cetak, dan bug. Stack asli: JavaScript vanilla (ES modules), tanpa bundler, server statis `dev.mjs`. Data demo disimpan di `localStorage`.

Kolom **Status** diperbarui di akhir pekerjaan (lihat PR untuk bukti).

## Baseline (sebelum perubahan)

| Langkah | Hasil |
| --- | --- |
| install | tidak ada dependency (`package.json` hanya skrip `dev` dan `test`) |
| typecheck / lint | tidak ada |
| test | `npm test` lulus, 1 berkas (`tests/allocation.test.mjs`, skrip top-level dengan `assert`) |
| build | tidak ada (situs statis) |
| CI | tidak ada |

## A. Logika alokasi dan Rencana Produksi

Alokasi (`app/js/allocation.js`) sudah berupa fungsi murni dan aturannya konsisten dengan teks UI (persetujuan pelanggan, alergi/diet sebagai batas keras, kapasitas tidak pernah dilampaui, FIFO, pilihan utama lebih dulu). Aturan tidak diubah.

Agregasi Rencana Produksi **tidak** murni: ia tertanam di `production()` dan `planText()` pada `merchant.js`, yang mengimpor `store.js` (memakai `window` dan `localStorage` saat dimuat), sehingga tidak bisa dites di Node.

| # | Temuan | Dampak | Status |
| --- | --- | --- | --- |
| L1 | Agregasi produksi tidak bisa dites | Tidak ada jaring pengaman | Diekstrak ke `app/js/production.js` tanpa mengubah keluaran; dites |
| L2 | Lebar bilah `used / capacity * 100` menghasilkan `NaN`/`Infinity` bila kapasitas 0 dan tidak dibatasi di 100% | Bilah rusak pada data tidak lazim | Persentase dihitung aman (`barPercent`), dites |
| L3 | `production()` membaca `o.diet.length` dan `o.allergies.length` tanpa pengaman, padahal `conflicts()` memakai `|| []` | Halaman bisa error pada pesanan lama tanpa kolom itu | Diberi pengaman di modul baru, dites |
| L4 | Total produksi (`fin.length`) menghitung pesanan yang `finalMenu`-nya tidak lagi ada di `session.menus`, sedangkan daftar per menu tidak menampilkannya | Total tidak sama dengan jumlah baris | Dicatat, dites sebagai karakterisasi, **tidak diubah** (keputusan bisnis) |
| L5 | `saveMenu` (merchant) mengubah kapasitas semua sesi `draft/open/closed` yang memuat menu itu, termasuk sesi `closed` yang sudah punya pesanan terkonfirmasi | Kapasitas bisa turun di bawah jumlah terkonfirmasi (`left` negatif) | Dicatat sebagai temuan, **tidak diubah** |
| L6 | `confirmAllocation` tidak menolak baris dengan `orderId` ganda (kapasitas terhitung ganda) atau `orderId` tak dikenal (melempar `TypeError`, bukan galat yang jelas) | Hanya terjadi bila baris dimanipulasi; tetap melempar | Dites sebagai karakterisasi, tidak diubah |
| L7 | `byQueue` memakai `localeCompare` untuk imbang waktu | Urutan imbang bisa bergantung locale untuk id non-ASCII; id demo aman | Dicatat |
| L8 | `ALLERGENS`/`otherAllergy` dicocokkan dengan pencocokan substring pada bahan | Bisa positif palsu (aman) atau negatif palsu untuk sinonim; ini batas pendekatan, bukan bug | Dicatat |

## B. Aksesibilitas

| # | Temuan | Status |
| --- | --- | --- |
| A1 | Kontras `--text2` (#6a7571) di atas latar `--bg` 4,48:1 dan di atas `--mint` 4,20:1 (butuh 4,5:1); teks `--warn` (#B97A1B) 3,36:1 | Diperbaiki (token diganti) |
| A2 | Dialog (`openModal`) tanpa nama aksesibel (`aria-labelledby`), fokus tidak terjebak, latar belakang tetap bisa dijangkau Tab | Diperbaiki |
| A3 | `render()` mengganti seluruh `innerHTML`; `focusId` dihitung tetapi tidak dipakai, sehingga fokus keyboard hilang setelah setiap aksi (mis. Tandai semua siap) | Diperbaiki (fokus dipulihkan) |
| A4 | Tidak ada tautan lewati ke konten utama pada shell merchant | Diperbaiki |
| A5 | Bilah progres produksi hanya visual, tanpa `role="progressbar"`/nilai | Diperbaiki |
| A6 | Ilustrasi hidangan memakai `role="img"` dengan label "Ilustrasi teriyaki" (derau bagi pembaca layar; dekoratif) | Dicatat (di luar halaman produksi) |
| A7 | `aria-live` ganda: `#toast-root[aria-live]` dan tiap toast `role="status"` | Dicatat |

## C. Layar 360px

Diukur dengan Chromium pada 360px (data setelah alokasi dikonfirmasi): `scrollWidth` dokumen.

| Halaman | Sebelum | Akar masalah | Status |
| --- | --- | --- | --- |
| Pusat Alokasi | 569px | item grid `.ws` dan `.grid-2` berkolom `1fr` (min-content tabel menahan lebar); perlu `minmax(0,1fr)` | Diperbaiki di akar |
| Kinerja | 416px | `.kpis` dengan `1fr` serupa; judul KPI tidak bisa membungkus | Diperbaiki di akar |
| Rencana Produksi | 360px (tidak meluap) | tetap dijaga tes e2e | Dijaga |

Tidak memakai `overflow-x:hidden` pada `body`.

## D. Tampilan cetak

Diperiksa dengan `page.pdf()` Chromium (A4).

| # | Temuan | Status |
| --- | --- | --- |
| P1 | Tombol "Tandai semua siap diambil" dan "Simulasikan pengambilan" ikut tercetak (README menyatakan tombol disembunyikan) | Diperbaiki |
| P2 | Padding `.m-content` dari aturan cetak (0) kalah oleh aturan layar yang ditulis lebih akhir di berkas | Diperbaiki |
| P3 | Bilah produksi tidak tercetak (browser membuang warna latar); angka tetap ada tetapi bilah kosong | Diperbaiki (`print-color-adjust`) |
| P4 | KPI pecah 3+1 karena aturan `max-width:1100px` ikut berlaku di kertas A4 | Diperbaiki |
| P5 | Kartu bisa terpotong di tengah halaman | Diperbaiki (`break-inside: avoid`) |

## E. Hal lain

- Hanya satu tes dan tanpa CI; ditambahkan (lihat PR).
- Font Google Fonts dimuat dari jaringan; tanpa jaringan, font cadangan dipakai. Tidak diubah.
- Tidak ada linter/typecheck pada repo; menambah linter dianggap perubahan di luar mode aman minimal dan dicatat di PR.
