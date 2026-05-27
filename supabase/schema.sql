-- ============================================================
-- YackBang DUR 스키마
-- Supabase 대시보드 > SQL Editor에서 실행
-- ============================================================

-- ── 병용금기 테이블 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dur_prohibition (
  id               BIGSERIAL PRIMARY KEY,
  dur_seq          TEXT,
  ingr_code        TEXT,
  ingr_kor_name    TEXT NOT NULL,   -- 검색 기준 (한글 성분명)
  ingr_eng_name    TEXT,
  item_seq         TEXT,
  item_name        TEXT,
  entp_name        TEXT,
  mixture_ingr_code      TEXT,
  mixture_ingr_kor_name  TEXT NOT NULL,
  mixture_ingr_eng_name  TEXT,
  mixture_item_name      TEXT,
  prohbt_content         TEXT,      -- 원문 (전문용어)
  notification_date      TEXT
);

-- ── 임부금기 테이블 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dur_pregnancy (
  id               BIGSERIAL PRIMARY KEY,
  ingr_code        TEXT,
  ingr_kor_name    TEXT NOT NULL,   -- 검색 기준
  ingr_eng_name    TEXT,
  item_seq         TEXT,
  item_name        TEXT,
  entp_name        TEXT,
  prohbt_content   TEXT,
  notification_date TEXT
);

-- ── 영문↔한글 성분명 매핑 테이블 ─────────────────────────────
-- 허가정보 API가 영문 성분명을 반환하므로, DUR 조회 시 한글로 변환하는 데 사용
CREATE TABLE IF NOT EXISTS ingr_mapping (
  id            BIGSERIAL PRIMARY KEY,
  ingr_eng_name TEXT NOT NULL,   -- 영문 (소문자 정규화)
  ingr_kor_name TEXT NOT NULL,   -- 한글
  ingr_code     TEXT,
  UNIQUE (ingr_eng_name)
);

-- ── 인덱스 ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prohibition_ingr
  ON dur_prohibition (ingr_kor_name);

CREATE INDEX IF NOT EXISTS idx_prohibition_mixture
  ON dur_prohibition (mixture_ingr_kor_name);

CREATE INDEX IF NOT EXISTS idx_pregnancy_ingr
  ON dur_pregnancy (ingr_kor_name);

CREATE INDEX IF NOT EXISTS idx_mapping_eng
  ON ingr_mapping (ingr_eng_name);

-- ── RLS 비활성화 (service role key로만 접근) ─────────────────
ALTER TABLE dur_prohibition DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_pregnancy   DISABLE ROW LEVEL SECURITY;
ALTER TABLE ingr_mapping    DISABLE ROW LEVEL SECURITY;
