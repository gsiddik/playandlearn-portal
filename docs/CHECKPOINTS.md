# Checkpoints

Tag git tidak dapat di-push dari lingkungan pengembangan ini, jadi checkpoint dicatat di sini (commit pada branch `claude/project-thread-4nqlwj`).

| Checkpoint | Commit | Isi | Status |
|---|---|---|---|
| 0 — Fondasi | `fcdb279` | rencana, scaffold, CI, kontrak/skema/privasi (portal) | menunggu review Gunady, ahli PAUD & hukum |
| 1 — MVP orang tua + anak (Android) | `43ae910` | akun orang tua, profil anak, 3 aktivitas offline, sync, portal orang tua v1 | CI hijau; menunggu uji perangkat nyata + review ahli PAUD/hukum |
| 2 — Kontrol orang tua (tanpa push) | `08f9f54` | jeda sesi tahan restart, radar 5 area, ide aktivitas rumah (draf) | CI hijau; push FCM menunggu keputusan |
| 4 — Jalur sekolah/guru | `347d5ec` | tenant sekolah, kelas, kartu QR + PIN gambar, penugasan, hasil kelas, login murid (Android/iOS) | CI hijau; belum diuji manusia; menunggu review hukum (persetujuan via sekolah) |
| 5 — Buku nilai + Portal operasional | `ad183c1` | buku nilai deskriptif + laporan cetak, konten berversi (validasi/draf/terbit/tarik), ringkasan sekolah | CI hijau; aturan buku nilai & pemetaan kurikulum menunggu validasi ahli PAUD; level builder visual belum ada |
| 6 — Penyusun konten, dasbor real-time, aset | `0eb430e` | penyusun level visual, dasbor kelas WebSocket (sinkron berkala di Android/iOS), pustaka aset + rekam suara di browser | CI hijau; belum diuji manusia; audio aset belum diputar aplikasi anak |
| 7 — Audio instruksi di aplikasi anak + skenario uji | `bf7f824` (portal), `739b68d` (Android), `94d84bb` (iOS) | pack membawa daftar aset; perekam portal WAV; Android/iOS unduh (verifikasi SHA-256), putar saat level mulai dan ulang di petunjuk 1; cadangan TTS; docs/UJI-UJUNG-KE-UJUNG.md | CI hijau di 3 repo; belum diuji manusia/perangkat nyata |

## Review ahli PAUD
- 2026-11-07 — `content/packs/v1.json` (3 aktivitas, 2 level) dan aturan buku nilai (`apps/api/src/gradebook.ts`) dinyatakan layak/sesuai dan ambangnya wajar (dilaporkan Gunady; ahli PAUD). Belum ditinjau: saran aktivitas rumah (`HOME_IDEAS`), metode persetujuan orang tua/`docs/PRIVACY.md` (ahli hukum).
