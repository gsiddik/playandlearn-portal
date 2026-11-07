# Daftar skenario uji ujung ke ujung

Tujuan: dipakai penguji manusia (dan nanti diotomatisasi) untuk memverifikasi alur utama di perangkat nyata. Tandai tiap skenario: ✅ lulus / ❌ gagal / ⛔ diblokir, beserta catatan, versi aplikasi, dan perangkat.

**Status saat ini:** semua logika inti dan API sudah diuji otomatis (CI). Yang **belum pernah** dijalankan manusia: seluruh skenario di bawah pada Android/iOS nyata. Jangan menyatakan aplikasi mobile "teruji" sebelum bagian B–F dijalankan.

## 0. Persiapan
- API + Postgres berjalan (lihat README), akun ops awal dari `BOOTSTRAP_OPS_EMAIL/PASSWORD`.
- Portal web di browser Chrome/Edge/Firefox terbaru (mikrofon diizinkan).
- Perangkat: minimal 1 Android (tablet 8–10" dan ponsel kecil), 1 iPad/iPhone. Uji juga satu perangkat dengan layar kecil dan satu OS lama (Android 8, iOS 16).
- Data uji: 1 akun orang tua, 1 sekolah dengan 1 kelas isi 3 murid, 1 akun guru, 1 akun ops.
- Ahli/orang yang menjalankan: sertakan seorang anak 4–7 th (dengan izin orang tua) untuk bagian usability, diamati, bukan diwawancara.

## A. Operasional (portal, ops_admin / content_designer)
| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| A1 | Masuk sebagai ops dengan kata sandi salah 3×, lalu benar | Pesan generik tanpa membocorkan akun; login benar berhasil |
| A2 | Buat sekolah baru dan admin sekolahnya | Sekolah tampil di ringkasan; admin bisa masuk |
| A3 | Rekam suara di portal ("Ayo urutkan bentuknya"), dengar ulang, simpan | Aset tersimpan sebagai WAV (🎙), dapat diputar ulang di tabel |
| A4 | Unggah gambar PNG/JPG valid; unggah berkas `.png` palsu (isi bukan gambar); unggah >2 MB | Valid diterima; palsu dan terlalu besar ditolak dengan pesan jelas |
| A5 | Rekam >90 detik | Perekaman berhenti otomatis di 90 dtk; tetap tersimpan (<5 MB) |
| A6 | Susun level baru di penyusun visual, kaitkan rekaman instruksi, pratinjau, simpan draf | Draf valid; kesalahan manifest dijelaskan dalam bahasa awam |
| A7 | Terbitkan draf yang merujuk aset dan yang merujuk aset tidak ada/diarsipkan | Yang valid terbit (versi naik); yang tidak valid ditolak |
| A8 | Tarik (retire) versi terbit | Klien baru tidak lagi mendapat versi itu; versi lama tetap bisa dimainkan offline |

## B. Orang tua – Android & iOS
| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| B1 | Daftar akun orang tua, setujui persetujuan, buat profil anak (alias, tahun lahir) | Tidak diminta nama lengkap/foto anak; profil tersimpan |
| B2 | Dari layar anak, tekan ke area orang tua: gerbang orang tua | Soal hitung/gerbang wajib lulus; anak usia 4–7 tidak mudah lolos |
| B3 | Mainkan 3 aktivitas sampai selesai | Umpan balik selalu positif, tanpa layar "gagal", tanpa iklan/tautan keluar |
| B4 | Salah berulang di satu level | Petunjuk bertahap: ulang suara → sorot → tunjukkan jawaban; anak tetap bisa lanjut |
| B5 | Atur batas harian/sesi/jam di portal orang tua, buka lagi aplikasi | Kebijakan terunduh; layar "Istirahat dulu ya" muncul sesuai aturan |
| B6 | Lihat radar 5 area dan laporan perkembangan di portal orang tua | Data sesuai permainan B3 |

## C. Offline-first & sinkronisasi
| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| C1 | Aktifkan mode pesawat setelah konten terunduh; mainkan beberapa level | Semua jalan; event tersimpan lokal |
| C2 | Matikan paksa aplikasi saat main, buka lagi | Tidak ada event ganda atau hilang; jeda sesi tidak ter-reset |
| C3 | Nyalakan jaringan | Event terkirim otomatis; dasbor/portal menampilkan hasil |
| C4 | Kirim ulang batch yang sama (matikan jaringan di tengah sinkron) | Idempoten: tidak ada duplikat di server |
| C5 | Ubah jam perangkat mundur/maju | Server tetap authority atas kebijakan; batas harian tidak mudah dilewati |
| C6 | Terbitkan versi konten baru, buka aplikasi online | Konten baru terunduh; sesi yang sedang berjalan tidak terputus |

## D. Audio instruksi (fitur baru)
| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| D1 | Terbitkan aktivitas dengan `promptAudio`; buka aplikasi online; pastikan unduhan selesai; mode pesawat; mulai level | Rekaman terputar otomatis saat level mulai |
| D2 | Salah sekali (petunjuk 1) | Rekaman diulang; salah lagi → sorotan visual |
| D3 | Aktivitas tanpa `promptAudio` | Suara sintetis (TTS) sebagai cadangan, tidak crash |
| D4 | Aset audio webm/ogg di iOS | Tidak diunduh/diputar; TTS dipakai (tidak crash) |
| D5 | Matikan suara perangkat / mode senyap | Permainan tetap bisa dimainkan dari visual |
| D6 | Arsipkan aset di portal lalu terbitkan versi baru | Klien menghapus berkas yang tak dirujuk lagi |
| D7 | Berkas rusak di jaringan (hash tidak cocok) | Tidak disimpan; TTS dipakai; dicoba lagi pada pembaruan berikutnya |
| D8 | Kualitas suara: dengarkan di speaker tablet murah | Jelas dan tidak terlalu pelan (cek dengan ahli/guru) |

## E. Sekolah & guru
| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| E1 | Admin sekolah membuat kelas dan roster murid (alias saja) | Murid tampil; tidak ada data pribadi berlebih |
| E2 | Cetak kartu QR + PIN gambar | Kartu terbaca jelas; PIN tidak tertulis angka |
| E3 | Murid memindai QR di aplikasi (Android: ML Kit; iOS: VisionKit) lalu memilih 3 gambar PIN | Masuk; salah PIN 5× → terkunci sementara (423) |
| E4 | Guru menugaskan misi ke kelas/murid | Murid melihat hanya aktivitas tertugas |
| E5 | Guru membuka dasbor kelas saat 3 murid bermain | Status murid tampil mendekati real-time (≤ ~10–15 dtk); WebSocket tersambung ulang otomatis setelah jaringan putus |
| E6 | Guru membuka buku nilai dan laporan cetak | Narasi deskriptif (bukan angka), sesuai aturan yang telah divalidasi ahli PAUD |
| E7 | Akses silang tenant: guru sekolah A mencoba data sekolah B (API langsung) | 403/404; tidak ada kebocoran (RLS) |

## F. Privasi, keamanan, aksesibilitas
| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| F1 | Hapus profil anak / permintaan hapus data | Data anak terhapus sesuai `docs/PRIVACY.md` (setelah review hukum) |
| F2 | Periksa lalu lintas jaringan aplikasi anak | Hanya ke API sendiri; tidak ada SDK iklan/analitik pihak ketiga |
| F3 | Token kedaluwarsa saat bermain offline lalu online | Refresh/login ulang tanpa kehilangan event |
| F4 | Keluar (logout) dari mode murid | Token, konten, dan audio lokal dihapus |
| F5 | Uji sentuh: target ≥ 48 dp/pt, jari anak, layar kecil | Semua tombol bisa ditekan; tidak ada target terlalu kecil |
| F6 | Mode gelap, font besar, rotasi layar | Tidak ada tampilan rusak |

## G. Usability dengan anak (diamati ahli PAUD)
- Anak memahami cara bermain tanpa membaca; instruksi suara cukup jelas.
- Durasi perhatian sesuai (sesi ≤ 10 menit); tidak ada frustrasi berulang; jeda sesi dipahami.
- Catat titik kebingungan, bukan nilai anak. Hasil masuk ke backlog konten/UX.

## Otomasi (berikutnya)
Kandidat otomatis di CI: A3–A7 dan E1–E7 sebagai uji API/E2E (sebagian sudah ada di `apps/api/test`); alur portal lewat Playwright; C4, C5, dan D7 sebagai tes unit/integrasi. Android/iOS UI memerlukan emulator/simulator dan perangkat nyata.
