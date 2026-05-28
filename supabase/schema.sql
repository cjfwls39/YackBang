-- ============================================================
-- YackBang (약방) — Supabase 전체 스키마
-- Supabase 대시보드 > SQL Editor에서 실행
-- 마지막 업데이트: 2026-05
-- ============================================================


-- ── pg_trgm 확장 (약품명 부분 검색 인덱스용) ──────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ============================================================
-- 약품 기본정보 (검색용)
-- 식약처 허가정보 API + 낱알이미지 API를 병합해 저장
-- sync-all.ts 스크립트로 정기 동기화
-- ============================================================

CREATE TABLE IF NOT EXISTS drug_products (
  item_seq        TEXT PRIMARY KEY,       -- 품목일련번호 (허가정보 ITEM_SEQ)
  item_name       TEXT NOT NULL,          -- 제품명 (예: 타이레놀정500밀리그람)
  entp_name       TEXT,                   -- 제조사명
  item_ingr_name  TEXT,                   -- 성분명 (영문, 다성분은 '/'로 구분)
  spclty_pblc     TEXT,                   -- "전문의약품" | "일반의약품"
  prduct_type     TEXT,                   -- 약품 분류 (예: [01140]해열.진통.소염제)
  box_image_url   TEXT,                   -- 박스 이미지 URL (BIG_PRDT_IMG_URL)
  pill_image_url  TEXT,                   -- 낱알 이미지 URL (ITEM_IMAGE)
  cancel_name     TEXT,                   -- 허가 상태 ("정상" | "취소" 등)
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 약품명 trigram 인덱스 (ilike '%검색어%' 고속화)
CREATE INDEX IF NOT EXISTS idx_drug_products_name_trgm
  ON drug_products USING gin (item_name gin_trgm_ops);

-- 허가 상태 필터용
CREATE INDEX IF NOT EXISTS idx_drug_products_cancel
  ON drug_products (cancel_name);


-- ============================================================
-- DUR (의약품 안전사용 서비스) 테이블
-- ============================================================

-- ── 병용금기 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dur_prohibition (
  id                     BIGSERIAL PRIMARY KEY,
  dur_seq                TEXT,
  ingr_code              TEXT,
  ingr_kor_name          TEXT NOT NULL,          -- 성분 한글명 (검색 기준)
  ingr_eng_name          TEXT,
  item_seq               TEXT,
  item_name              TEXT,
  entp_name              TEXT,
  mixture_ingr_code      TEXT,
  mixture_ingr_kor_name  TEXT NOT NULL,          -- 병용금기 상대 성분 한글명
  mixture_ingr_eng_name  TEXT,
  mixture_item_name      TEXT,
  prohbt_content         TEXT,                   -- 금기 이유 원문 (전문용어)
  notification_date      TEXT
);

-- ── 임부금기 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dur_pregnancy (
  id                BIGSERIAL PRIMARY KEY,
  ingr_code         TEXT,
  ingr_kor_name     TEXT NOT NULL,
  ingr_eng_name     TEXT,
  item_seq          TEXT,
  item_name         TEXT,
  entp_name         TEXT,
  prohbt_content    TEXT,
  notification_date TEXT
);

-- ── 영문↔한글 성분명 매핑 ─────────────────────────────────────────
-- 허가정보 API가 영문 성분명을 반환하므로 DUR 조회 시 한글 변환에 사용
CREATE TABLE IF NOT EXISTS ingr_mapping (
  id            BIGSERIAL PRIMARY KEY,
  ingr_eng_name TEXT NOT NULL,
  ingr_kor_name TEXT NOT NULL,
  ingr_code     TEXT,
  UNIQUE (ingr_eng_name)
);

-- ── 효능군중복 ───────────────────────────────────────────────────
-- 같은 효능군 계열 약을 중복 복용 시 경고 (7,057건)
CREATE TABLE IF NOT EXISTS dur_efficacy_duplication (
  id                BIGSERIAL PRIMARY KEY,
  ingr_name         TEXT NOT NULL,   -- 성분명 (한글)
  ingr_code         TEXT,
  sers_name         TEXT,            -- 효능군명 (예: HMG-CoA환원효소억제제)
  etc_otc_name      TEXT,
  item_seq          TEXT,
  item_name         TEXT,
  entp_name         TEXT,
  notification_date TEXT,
  change_date       TEXT
);

-- ── 노인주의 ─────────────────────────────────────────────────────
-- 고령자에게 특별 주의가 필요한 성분 (2,010건)
CREATE TABLE IF NOT EXISTS dur_elderly_caution (
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

-- ── 특정연령대금기 ───────────────────────────────────────────────
-- 소아 등 특정 연령대 사용 금지 성분 (2,670건)
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

-- ── 용량주의 ─────────────────────────────────────────────────────
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

-- ── 투여기간주의 ─────────────────────────────────────────────────
-- 장기 복용 시 주의 성분 (624건)
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

-- ── 서방정분할주의 ───────────────────────────────────────────────
-- 서방형 제제 분할 복용 금지 성분 (2,105건)
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


-- ============================================================
-- 인덱스
-- ============================================================

-- 병용금기: 성분명 / 성분코드 양방향 조회
CREATE INDEX IF NOT EXISTS idx_prohibition_ingr
  ON dur_prohibition (ingr_kor_name);
CREATE INDEX IF NOT EXISTS idx_prohibition_mixture
  ON dur_prohibition (mixture_ingr_kor_name);
CREATE INDEX IF NOT EXISTS idx_prohibition_ingr_code
  ON dur_prohibition (ingr_code);
CREATE INDEX IF NOT EXISTS idx_prohibition_mixture_ingr_code
  ON dur_prohibition (mixture_ingr_code);
-- item_seq 역조회 (다성분 약 성분명 확보)
CREATE INDEX IF NOT EXISTS idx_prohibition_item_seq
  ON dur_prohibition (item_seq);

-- 임부금기
CREATE INDEX IF NOT EXISTS idx_pregnancy_ingr
  ON dur_pregnancy (ingr_kor_name);

-- 성분명 매핑
CREATE INDEX IF NOT EXISTS idx_mapping_eng
  ON ingr_mapping (ingr_eng_name);

-- 효능군중복
CREATE INDEX IF NOT EXISTS idx_efficacy_dup_ingr
  ON dur_efficacy_duplication (ingr_name);
CREATE INDEX IF NOT EXISTS idx_efficacy_dup_sers
  ON dur_efficacy_duplication (sers_name);
CREATE INDEX IF NOT EXISTS idx_efficacy_dup_item_seq
  ON dur_efficacy_duplication (item_seq);

-- 노인주의
CREATE INDEX IF NOT EXISTS idx_elderly_ingr
  ON dur_elderly_caution (ingr_name);
CREATE INDEX IF NOT EXISTS idx_elderly_item_seq
  ON dur_elderly_caution (item_seq);

-- 특정연령대금기
CREATE INDEX IF NOT EXISTS idx_age_restrict_ingr
  ON dur_age_restriction (ingr_name);

-- 용량주의
CREATE INDEX IF NOT EXISTS idx_dosage_ingr
  ON dur_dosage_caution (ingr_name);
CREATE INDEX IF NOT EXISTS idx_dosage_item_seq
  ON dur_dosage_caution (item_seq);

-- 투여기간주의
CREATE INDEX IF NOT EXISTS idx_duration_ingr
  ON dur_duration_caution (ingr_name);

-- 서방정분할주의
CREATE INDEX IF NOT EXISTS idx_tablet_split_ingr
  ON dur_tablet_split_caution (ingr_name);


-- ============================================================
-- 동기화 스크립트용 TRUNCATE RPC
-- DELETE ... WHERE id != 0 는 대용량 테이블에서 statement timeout 발생.
-- TRUNCATE는 즉시 완료되므로 이 함수를 통해 호출한다.
-- ============================================================

CREATE OR REPLACE FUNCTION truncate_dur_table(tbl TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF tbl NOT IN (
    'dur_prohibition',
    'dur_pregnancy',
    'dur_efficacy_duplication',
    'dur_elderly_caution',
    'dur_age_restriction',
    'dur_dosage_caution',
    'dur_duration_caution',
    'dur_tablet_split_caution'
  ) THEN
    RAISE EXCEPTION '허가되지 않은 테이블: %', tbl;
  END IF;
  EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY', tbl);
END;
$$;


-- ============================================================
-- RLS 비활성화 (service_role key로만 접근)
-- ============================================================

ALTER TABLE drug_products             DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_prohibition           DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_pregnancy             DISABLE ROW LEVEL SECURITY;
ALTER TABLE ingr_mapping              DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_efficacy_duplication  DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_elderly_caution       DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_age_restriction       DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_dosage_caution        DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_duration_caution      DISABLE ROW LEVEL SECURITY;
ALTER TABLE dur_tablet_split_caution  DISABLE ROW LEVEL SECURITY;
