# Alur Data & Privasi Anak — Draft v0.1 (untuk review ahli hukum)

Status: **draft rekayasa, bukan nasihat hukum.** Dasar: prinsip Privacy by Design dan COPPA/GDPR-K dari Dokumen Analisis; UU PDP (UU No. 27/2022) sebagai [BP], perlu diverifikasi penasihat hukum.

## Data yang dikumpulkan
| Data | Subjek | Tujuan | Catatan |
|---|---|---|---|
| Email, hash password | Orang tua | Akun & persetujuan | Hash kuat; tidak dijual/dibagikan |
| Alias, tahun lahir, avatar | Anak | Personalisasi & penyesuaian usia | **Tanpa nama lengkap, foto, lokasi, kontak** |
| Event gameplay (aktivitas, percobaan, petunjuk, selesai) | Anak (pseudonim) | Progres, dashboard orang tua, adaptasi | Hanya `pseudonym` UUID, bukan identitas |
| Pengaturan screen time | Anak | Kontrol orang tua | Server authority |
| Catatan persetujuan | Orang tua | Bukti kepatuhan | Versi kebijakan + waktu |

## Yang TIDAK dilakukan
Tanpa iklan, tanpa SDK iklan/pelacak pihak ketiga, tanpa profiling untuk pemasaran, tanpa chat antar anak, tanpa tautan keluar, tanpa pembelian di mode anak, tanpa perangkat ID iklan.

## Kontrol
- Persetujuan orang tua sebelum profil anak dibuat; metode verifikasi final menunggu penasihat hukum.
- Parental gate untuk semua area orang tua di aplikasi.
- Enkripsi TLS in transit; enkripsi at rest di server dan DB lokal perangkat.
- Isolasi tenant: RLS PostgreSQL (`db/test_rls.sh` menguji).
- Hak orang tua: ekspor (`GET /children/{id}/export`) dan hapus (`DELETE /children/{id}`).
- Retensi: periode retensi & anonimisasi otomatis **[KEPUTUSAN — ditentukan bersama penasihat hukum]**.

## Pertanyaan terbuka untuk penasihat hukum
1. Metode verifikasi persetujuan orang tua yang dapat diterima di Indonesia.
2. Periode retensi data anak dan dasar hukum penyimpanannya.
3. Residensi data/region hosting (keputusan hosting ditunda oleh Gunady).
4. Persyaratan Google Play Families dan Apple Kids Category saat pengajuan.
