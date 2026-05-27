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

-- ── 효능군중복 테이블 ──────────────────────────────────────────
-- 같은 효능군 계열 약을 중복 복용할 때의 경고 데이터 (7,057건)
CREATE TABLE IF NOT EXISTS dur_efficacy_duplication (
  id                BIGSERIAL PRIMARY KEY,
  ingr_name         TEXT NOT NULL,   -- 성분명 (한글)
  ingr_code         TEXT,
  sers_name         TEXT,            -- 효능군명 (예: HMG-CoA환원효소억제제)
  etc_otc_name      TEXT,            -- 전문/일반
  item_seq          TEXT,
  item_name         TEXT,
  entp_name         TEXT,
  notification_date TEXT,
  change_date       TEXT
);

-- ── 노인주의 테이블 ──────────────────────────────────────────────
-- 노인에게 특별히 주의가 필요한 성분 목록 (2,010건)
CREATE TABLE IF NOT EXISTS dur_elderly_caution (
  id                BIGSERIAL PRIMARY KEY,
  ingr_name         TEXT NOT NULL,
  ingr_code         TEXT,
  class_name        TEXT,            -- 주의 분류명
  etc_otc_name      TEXT,
  item_seq          TEXT,
  item_name         TEXT,
  entp_name         TEXT,
  note              TEXT,            -- 주의 내용
  notification_date TEXT,
  change_date       TEXT
);

-- ── 특정연령대금기 테이블 ────────────────────────────────────────
-- 소아 등 특정 연령대에 사용 금지인 성분 (2,670건)
CREATE TABLE IF NOT EXISTS dur_age_restriction (
  id                BIGSERIAL PRIMARY KEY,
  ingr_name         TEXT NOT NULL,
  ingr_code         TEXT,
  prohbt_content    TEXT,            -- 금기 내용 (예: "3세 미만 소아 사용 금지")
  etc_otc_name      TEXT,
  item_seq          TEXT,
  item_name         TEXT,
  entp_name         TEXT,
  notification_date TEXT,
  change_date       TEXT
);

-- ── 용량주의 테이블 ──────────────────────────────────────────────
-- 특정 상황에서 용량 조절이 필요한 성분 (6,652건)
CREATE TABLE IF NOT EXISTS dur_dosage_caution (
  id                BIGSERIAL PRIMARY KEY,
  ingr_name         TEXT NOT NULL,
  ingr_code         TEXT,
  class_name        TEXT,
  etc_otc_name      TEXT,
  item_seq          TEXT,
  item_name         TEXT,
  entp_name         TEXT,
  note              TEXT,
  notification_date TEXT,
  change_date       TEXT
);

-- ── 투여기간주의 테이블 ──────────────────────────────────────────
-- 장기 복용 시 주의가 필요한 성분 (624건)
CREATE TABLE IF NOT EXISTS dur_duration_caution (
  id                BIGSERIAL PRIMARY KEY,
  ingr_name         TEXT NOT NULL,
  ingr_code         TEXT,
  class_name        TEXT,
  etc_otc_name      TEXT,
  item_seq          TEXT,
  item_name         TEXT,
  entp_name         TEXT,
  note              TEXT,
  notification_date TEXT,
  change_date       TEXT
);

-- ── 서방정분할주의 테이블 ────────────────────────────────────────
-- 서방형 제제를 분할 복용하면 안 되는 성분 (2,105건)
CREATE TABLE IF NOT EXISTS dur_tablet_split_caution (
  id                BIGSERIAL PRIMARY KEY,
  ingr_name         TEXT NOT NULL,
  ingr_code         TEXT,
  class_name        TEXT,
  etc_otc_name      TEXT,
  item_seq          TEXT,
  item_name         TEXT,
  entp_name         TEXT,
  note              TEXT,
  notification_date TEXT,
  change_date       TEXT
);

-- ── 인덱스 (새 테이블) ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_efficacy_dup_ingr
  ON dur_efficacy_duplication (ingr_name);

CREATE INDEX IF NOT EXISTS idx_efficacy_dup_sers
  ON dur_efficacy_duplication (sers_name);

CREATE INDEX IF NOT EXISTS idx_elderly_ingr
  ON dur_elderly_caution (ingr_name);

CREATE INDEX IF NOT EXISTS idx_age_restrict_ingr
  ON dur_age_restriction (ingr_name);

CREATE INDEX IF NOT EXISTS idx_dosage_ingr
  ON dur_dosage_caution (ingr_name);

CREATE INDEX IF NOT EXISTS idx_duration_ingr
  ON dur_duration_caution (ingr_name);

CREATE INDEX IF NOT EXISTS idx_tablet_split_ingr
  ON dur_tablet_split_caution (ingr_name);

-- ── RLS 비활성화 (service role key로만 접근) ─────────────────
ALTER TABLE dur_prohibition          DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_pregnancy            DISABLE ROW LEVEL SECURITY;
ALTER TABLE ingr_mapping             DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_efficacy_duplication DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_elderly_caution      DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_age_restriction      DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_dosage_caution       DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_duration_caution     DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_tablet_split_caution DISABLE ROW LEVEL SECURITY;
