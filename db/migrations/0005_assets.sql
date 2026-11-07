BEGIN;
-- Aset konten (gambar, audio instruksi, rekaman suara). Konten global (bukan data anak); disimpan di DB untuk MVP.
-- Saat hosting ditentukan, ganti ke object storage dengan antarmuka yang sama (kolom data -> url).
CREATE TABLE assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL CHECK (kind IN ('image','audio')),
  purpose     text NOT NULL CHECK (purpose IN ('instruksi','umpan_balik','efek','ilustrasi','lainnya')),
  name        text NOT NULL,
  language    text,                    -- mis. 'id', 'en' (audio)
  transcript  text,                    -- teks ucapan, untuk aksesibilitas & pencarian
  mime        text NOT NULL,
  size_bytes  integer NOT NULL,
  sha256      text NOT NULL,
  recorded    boolean NOT NULL DEFAULT false,   -- true = direkam langsung dari browser
  data        bytea NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assets_kind_idx ON assets (kind, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON assets TO app_user;
COMMIT;
