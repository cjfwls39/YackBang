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
  notification_date      TEXT,
  sync_batch_id          BIGINT                  -- 동기화 배치 식별자 (지연 삭제용, 기술적 도전 5번 참고)
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
  notification_date TEXT,
  sync_batch_id     BIGINT
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
  change_date       TEXT,
  sync_batch_id     BIGINT
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
  change_date       TEXT,
  sync_batch_id     BIGINT
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
  change_date       TEXT,
  sync_batch_id     BIGINT
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
  change_date       TEXT,
  sync_batch_id     BIGINT
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
  change_date       TEXT,
  sync_batch_id     BIGINT
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
  change_date       TEXT,
  sync_batch_id     BIGINT
);


-- ============================================================
-- 마이그레이션: 기존 DB에 sync_batch_id 컬럼 추가
-- (CREATE TABLE IF NOT EXISTS는 이미 존재하는 테이블에 컬럼을 추가하지 않으므로 별도 실행)
-- ============================================================

ALTER TABLE dur_prohibition          ADD COLUMN IF NOT EXISTS sync_batch_id BIGINT;
ALTER TABLE dur_pregnancy            ADD COLUMN IF NOT EXISTS sync_batch_id BIGINT;
ALTER TABLE dur_efficacy_duplication ADD COLUMN IF NOT EXISTS sync_batch_id BIGINT;
ALTER TABLE dur_elderly_caution      ADD COLUMN IF NOT EXISTS sync_batch_id BIGINT;
ALTER TABLE dur_age_restriction      ADD COLUMN IF NOT EXISTS sync_batch_id BIGINT;
ALTER TABLE dur_dosage_caution       ADD COLUMN IF NOT EXISTS sync_batch_id BIGINT;
ALTER TABLE dur_duration_caution     ADD COLUMN IF NOT EXISTS sync_batch_id BIGINT;
ALTER TABLE dur_tablet_split_caution ADD COLUMN IF NOT EXISTS sync_batch_id BIGINT;


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

-- sync_batch_id (동기화 후 이전 배치 정리 시 조회용 — 기술적 도전 5번 참고)
CREATE INDEX IF NOT EXISTS idx_prohibition_sync_batch          ON dur_prohibition          (sync_batch_id);
CREATE INDEX IF NOT EXISTS idx_pregnancy_sync_batch             ON dur_pregnancy            (sync_batch_id);
CREATE INDEX IF NOT EXISTS idx_efficacy_dup_sync_batch          ON dur_efficacy_duplication (sync_batch_id);
CREATE INDEX IF NOT EXISTS idx_elderly_sync_batch                ON dur_elderly_caution      (sync_batch_id);
CREATE INDEX IF NOT EXISTS idx_age_restrict_sync_batch          ON dur_age_restriction      (sync_batch_id);
CREATE INDEX IF NOT EXISTS idx_dosage_sync_batch                 ON dur_dosage_caution       (sync_batch_id);
CREATE INDEX IF NOT EXISTS idx_duration_sync_batch               ON dur_duration_caution     (sync_batch_id);
CREATE INDEX IF NOT EXISTS idx_tablet_split_sync_batch          ON dur_tablet_split_caution (sync_batch_id);


-- ============================================================
-- 동기화 스크립트용 배치 정리 RPC
--
-- 예전엔 TRUNCATE 후 재적재했는데, TRUNCATE와 재적재가 각각 별도 트랜잭션이라
-- 그 사이 조회가 들어오면 테이블이 비어 "병용금기 없음(안전)"으로 오판정될 수 있었음.
-- (자세한 내용은 README "기술적 도전과 해결" 5번 참고)
--
-- 이제는 TRUNCATE 없이 새 행에 sync_batch_id를 태그해 INSERT만 하고,
-- 적재가 끝난 뒤 이전 배치(sync_batch_id가 다른 행)만 이 RPC로 청크 단위 삭제.
-- DELETE ... WHERE id != 0 전체를 한 번에 실행하면 대용량에서 statement timeout이
-- 나므로, batch_size만큼만 지워 호출 측(sync-all.ts)이 0건이 될 때까지 반복 호출한다.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_stale_dur_batch(tbl TEXT, keep_batch BIGINT, batch_size INT DEFAULT 2000)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'  -- 인덱스를 못 타는 예외 상황에서도 타임아웃으로 끊기지 않도록 방어
AS $$
DECLARE
  deleted_count INT;
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

  -- "sync_batch_id IS DISTINCT FROM $1"는 btree 인덱스를 못 타서 매번 전체 테이블을
  -- 풀스캔함(80만 건 테이블에서 statement timeout 발생 확인). 대신 IS NULL / < / >로
  -- 풀어써서 인덱스(idx_..._sync_batch)를 통한 비트맵 스캔이 가능하도록 함.
  EXECUTE format(
    'DELETE FROM %I WHERE id IN (
       SELECT id FROM %I
       WHERE sync_batch_id IS NULL
          OR sync_batch_id < $1
          OR sync_batch_id > $1
       LIMIT $2
     )',
    tbl, tbl
  ) USING keep_batch, batch_size;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 더 이상 사용하지 않는 이전 RPC 제거 (기존 DB에 남아있다면 정리)
DROP FUNCTION IF EXISTS truncate_dur_table(TEXT);


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
