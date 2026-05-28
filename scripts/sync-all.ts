/**
 * YackBang 전체 DB 동기화 스크립트
 * ─────────────────────────────────────────────────────────────────
 * Supabase의 모든 테이블을 식약처 공공 API 기준으로 최신화합니다.
 *
 * 대상 테이블 (9개):
 *   1. drug_products          — 약품 기본정보 (허가정보 + 낱알이미지 병합)
 *   2. dur_prohibition        — 병용금기
 *   3. dur_pregnancy          — 임부금기
 *   4. dur_efficacy_duplication — 효능군중복
 *   5. dur_elderly_caution    — 노인주의
 *   6. dur_age_restriction    — 특정연령대금기
 *   7. dur_dosage_caution     — 용량주의
 *   8. dur_duration_caution   — 투여기간주의
 *   9. dur_tablet_split_caution — 서방정분할주의
 *
 * 실행:
 *   node --env-file=.env.local --experimental-strip-types scripts/sync-all.ts
 *
 * 소요 시간: 약 10~20분 (전체 기준, API rate limit 대기 포함)
 *
 * ⚠ DUR 테이블(2~9)은 truncate → insert 방식으로 동기화됩니다.
 *   동기화 중 잠깐 데이터가 비어 있을 수 있으므로 트래픽이 적은 시간대에 실행하세요.
 */

import { createClient } from "@supabase/supabase-js";

// ── 환경변수 ──────────────────────────────────────────────────────
const API_KEY      = process.env.DUR_API_KEY ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ 환경변수 누락. .env.local 파일을 확인하세요.");
  console.error("   필요: DUR_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// ── API 서비스 상수 ───────────────────────────────────────────────
const BASE            = "https://apis.data.go.kr/1471000";
const SVC_PERMIT      = "DrugPrdtPrmsnInfoService07";   // 허가정보
const SVC_GRAIN       = "MdcinGrnIdntfcInfoService03";  // 낱알이미지
const SVC_DUR         = "DURPrdlstInfoService03";        // DUR 전체

const ROWS_PER_PAGE   = 500;   // 식약처 API 최대 (500 권장 — 100이면 호출 수 5배로 rate limit 위험)
const DELAY_MS        = 150;   // 페이지 간 대기 (rate limit 방지)
const UPSERT_CHUNK    = 500;   // 한 번에 upsert할 행 수

// ── Supabase 클라이언트 ───────────────────────────────────────────
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── 공통 유틸 ────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json() as Promise<Record<string, unknown>>;
}

function buildUrl(svc: string, ep: string, page: number): string {
  return (
    `${BASE}/${svc}/${ep}` +
    `?serviceKey=${encodeURIComponent(API_KEY)}&type=json` +
    `&numOfRows=${ROWS_PER_PAGE}&pageNo=${page}`
  );
}

function progressBar(done: number, total: number): string {
  const pct  = total > 0 ? Math.floor((done / total) * 100) : 0;
  const fill = "█".repeat(Math.floor(pct / 5));
  const empty = "░".repeat(20 - Math.floor(pct / 5));
  return `[${fill}${empty}] ${pct}% (${done.toLocaleString()}/${total.toLocaleString()})`;
}

// 배열을 지정 크기로 나누기
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ── 범용 페이지네이션 동기화 ──────────────────────────────────────
interface SyncOptions<T> {
  label:     string;
  service:   string;
  endpoint:  string;
  table:     string;
  /** true: 동기화 전 기존 데이터 전체 삭제 (DUR 테이블용) */
  truncate?: boolean;
  /** 지정 시 upsert, 미지정 시 insert */
  upsertOn?: string;
  mapper:    (item: Record<string, string>) => T;
}

async function syncTable<T extends Record<string, unknown>>(opts: SyncOptions<T>) {
  const { label, service, endpoint, table, truncate, upsertOn, mapper } = opts;

  process.stdout.write(`\n  [${label}] `);

  // DUR 테이블: TRUNCATE (DELETE는 대용량에서 statement timeout 발생)
  if (truncate) {
    const { error } = await sb.rpc("truncate_dur_table", { tbl: table });
    if (error) {
      console.error(`\n  ❌ TRUNCATE 실패 (${table}): ${error.message}`);
      console.error("     Supabase SQL Editor에서 수동으로 실행하세요:");
      console.error(`     TRUNCATE ${table} RESTART IDENTITY;`);
      return;   // 중복 삽입 방지를 위해 이 테이블은 건너뜀
    }
    process.stdout.write("초기화 완료 → ");
  }

  let page   = 1;
  let total  = 0;
  let synced = 0;
  let errors = 0;

  while (true) {
    let json: Record<string, unknown>;
    try {
      json = await fetchJson(buildUrl(service, endpoint, page));
    } catch (err) {
      // 첫 페이지에서 404 → 해당 API 미신청 / 엔드포인트 없음 → 스킵
      if (page === 1 && err instanceof Error && err.message.includes("404")) {
        console.log(`\n  ⚠ 엔드포인트 없음 (404) — ${endpoint} 스킵`);
        return;
      }
      throw err;
    }
    const body  = (json.body ?? {}) as Record<string, unknown>;
    const items = (body.items ?? []) as Record<string, string>[];

    if (page === 1) {
      total = (body.totalCount as number) ?? 0;
      if (total === 0) {
        console.log("데이터 없음, 스킵");
        return;
      }
    }
    if (!items.length) break;

    const rows = items.map(mapper);

    // 대량 삽입 시 chunk 단위로 나눠서 upsert/insert
    for (const batch of chunk(rows, UPSERT_CHUNK)) {
      const { error } = upsertOn
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? await sb.from(table).upsert(batch as any[], { onConflict: upsertOn })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : await sb.from(table).insert(batch as any[]);
      if (error) { errors++; console.error(`\n    ⚠ ${page}p: ${error.message}`); }
      else synced += batch.length;
    }

    process.stdout.write(`\r  [${label}] ${progressBar(synced, total)}`);

    if (items.length < ROWS_PER_PAGE || synced + errors >= total) break;
    page++;
    await sleep(DELAY_MS);
  }

  const status = errors > 0 ? `⚠ 오류 ${errors}건 포함` : "✓";
  console.log(`\n  ${status} ${synced.toLocaleString()}건 완료`);
}

// ════════════════════════════════════════════════════════════════
// 1. drug_products — 허가정보 + 낱알이미지 병합
// ════════════════════════════════════════════════════════════════
async function loadGrainMap(): Promise<Map<string, string>> {
  process.stdout.write("\n  [낱알이미지 선로드] ");
  const map = new Map<string, string>();
  let page = 1, total = 0;

  while (true) {
    const json  = await fetchJson(buildUrl(SVC_GRAIN, "getMdcinGrnIdntfcInfoList03", page));
    const body  = (json.body ?? {}) as Record<string, unknown>;
    const items = (body.items ?? []) as Record<string, string>[];

    if (page === 1) total = (body.totalCount as number) ?? 0;
    if (!items.length) break;

    for (const it of items) {
      if (it.ITEM_SEQ && it.ITEM_IMAGE) map.set(it.ITEM_SEQ, it.ITEM_IMAGE);
    }

    process.stdout.write(`\r  [낱알이미지 선로드] ${progressBar(map.size, total)}`);
    if (map.size >= total || items.length < ROWS_PER_PAGE) break;
    page++;
    await sleep(DELAY_MS);
  }

  console.log(`\n  ✓ ${map.size.toLocaleString()}건 로드`);
  return map;
}

async function syncDrugProducts() {
  console.log("\n━━━ [1/9] drug_products ━━━");
  const grainMap = await loadGrainMap();

  await syncTable({
    label:    "허가정보",
    service:  SVC_PERMIT,
    endpoint: "getDrugPrdtPrmsnInq07",
    table:    "drug_products",
    upsertOn: "item_seq",          // PK 기반 upsert (기존 데이터 보존)
    mapper:   (p) => ({
      item_seq:        p.ITEM_SEQ,
      item_name:       p.ITEM_NAME,
      entp_name:       p.ENTP_NAME        ?? null,
      item_ingr_name:  p.ITEM_INGR_NAME   ?? null,
      spclty_pblc:     p.SPCLTY_PBLC      ?? null,
      prduct_type:     p.PRDUCT_TYPE       ?? null,
      box_image_url:   p.BIG_PRDT_IMG_URL ?? null,
      pill_image_url:  grainMap.get(p.ITEM_SEQ) ?? null,
      cancel_name:     p.CANCEL_NAME       ?? "정상",
      updated_at:      new Date().toISOString(),
    }),
  });
}

// ════════════════════════════════════════════════════════════════
// 2~9. DUR 테이블 — truncate + insert
// ════════════════════════════════════════════════════════════════

async function syncDurProhibition() {
  console.log("\n━━━ [2/9] dur_prohibition (병용금기) ━━━");
  await syncTable({
    label:    "병용금기",
    service:  SVC_DUR,
    endpoint: "getUsjntTabooInfoList03",
    table:    "dur_prohibition",
    truncate: true,
    mapper:   (r) => ({
      dur_seq:               r.DUR_SEQ              ?? null,
      ingr_code:             r.INGR_CODE             ?? null,
      ingr_kor_name:         r.INGR_KOR_NAME         ?? "",
      ingr_eng_name:         r.INGR_ENG_NAME         ?? null,
      item_seq:              r.ITEM_SEQ              ?? null,
      item_name:             r.ITEM_NAME             ?? null,
      entp_name:             r.ENTP_NAME             ?? null,
      mixture_ingr_code:     r.MIXTURE_INGR_CODE     ?? null,
      mixture_ingr_kor_name: r.MIXTURE_INGR_KOR_NAME ?? "",
      mixture_ingr_eng_name: r.MIXTURE_INGR_ENG_NAME ?? null,
      mixture_item_name:     r.MIXTURE_ITEM_NAME     ?? null,
      prohbt_content:        r.PROHBT_CONTENT        ?? null,
      notification_date:     r.NOTIFICATION_DATE     ?? null,
    }),
  });
}

async function syncDurPregnancy() {
  console.log("\n━━━ [3/9] dur_pregnancy (임부금기) ━━━");
  await syncTable({
    label:    "임부금기",
    service:  SVC_DUR,
    endpoint: "getPwnmTabooInfoList03",
    table:    "dur_pregnancy",
    truncate: true,
    mapper:   (r) => ({
      ingr_code:         r.INGR_CODE         ?? null,
      ingr_kor_name:     r.INGR_KOR_NAME     ?? "",
      ingr_eng_name:     r.INGR_ENG_NAME     ?? null,
      item_seq:          r.ITEM_SEQ          ?? null,
      item_name:         r.ITEM_NAME         ?? null,
      entp_name:         r.ENTP_NAME         ?? null,
      prohbt_content:    r.PROHBT_CONTENT    ?? null,
      notification_date: r.NOTIFICATION_DATE ?? null,
    }),
  });
}

async function syncDurEfficacyDuplication() {
  console.log("\n━━━ [4/9] dur_efficacy_duplication (효능군중복) ━━━");
  await syncTable({
    label:    "효능군중복",
    service:  SVC_DUR,
    endpoint: "getEfcyDplctInfoList03",
    table:    "dur_efficacy_duplication",
    truncate: true,
    // API에 따라 INGR_NAME 또는 INGR_KOR_NAME 중 하나만 있을 수 있어 양쪽 모두 시도
    mapper:   (r) => ({
      ingr_name:         r.INGR_NAME         ?? r.INGR_KOR_NAME ?? "",
      ingr_code:         r.INGR_CODE         ?? null,
      sers_name:         r.SERS_NAME         ?? null,
      etc_otc_name:      r.ETC_OTC_NAME      ?? null,
      item_seq:          r.ITEM_SEQ          ?? null,
      item_name:         r.ITEM_NAME         ?? null,
      entp_name:         r.ENTP_NAME         ?? null,
      notification_date: r.NOTIFICATION_DATE ?? null,
      change_date:       r.CHANGE_DATE       ?? null,
    }),
  });
}

async function syncDurElderlyCaution() {
  console.log("\n━━━ [5/9] dur_elderly_caution (노인주의) ━━━");
  await syncTable({
    label:    "노인주의",
    service:  SVC_DUR,
    endpoint: "getOdsnAtentInfoList03",
    table:    "dur_elderly_caution",
    truncate: true,
    mapper:   (r) => ({
      ingr_name:         r.INGR_NAME         ?? r.INGR_KOR_NAME ?? "",
      ingr_code:         r.INGR_CODE         ?? null,
      class_name:        r.CLASS_NAME        ?? null,
      etc_otc_name:      r.ETC_OTC_NAME      ?? null,
      item_seq:          r.ITEM_SEQ          ?? null,
      item_name:         r.ITEM_NAME         ?? null,
      entp_name:         r.ENTP_NAME         ?? null,
      note:              r.NOTE              ?? null,
      notification_date: r.NOTIFICATION_DATE ?? null,
      change_date:       r.CHANGE_DATE       ?? null,
    }),
  });
}

async function syncDurAgeRestriction() {
  console.log("\n━━━ [6/9] dur_age_restriction (특정연령대금기) ━━━");
  await syncTable({
    label:    "특정연령대금기",
    service:  SVC_DUR,
    endpoint: "getSpcifyAgrdeTabooInfoList03",
    table:    "dur_age_restriction",
    truncate: true,
    mapper:   (r) => ({
      ingr_name:         r.INGR_NAME         ?? r.INGR_KOR_NAME ?? "",
      ingr_code:         r.INGR_CODE         ?? null,
      prohbt_content:    r.PROHBT_CONTENT    ?? null,
      etc_otc_name:      r.ETC_OTC_NAME      ?? null,
      item_seq:          r.ITEM_SEQ          ?? null,
      item_name:         r.ITEM_NAME         ?? null,
      entp_name:         r.ENTP_NAME         ?? null,
      notification_date: r.NOTIFICATION_DATE ?? null,
      change_date:       r.CHANGE_DATE       ?? null,
    }),
  });
}

async function syncDurDosageCaution() {
  console.log("\n━━━ [7/9] dur_dosage_caution (용량주의) ━━━");
  await syncTable({
    label:    "용량주의",
    service:  SVC_DUR,
    endpoint: "getCpctyAtentInfoList03",
    table:    "dur_dosage_caution",
    truncate: true,
    mapper:   (r) => ({
      ingr_name:         r.INGR_NAME         ?? r.INGR_KOR_NAME ?? "",
      ingr_code:         r.INGR_CODE         ?? null,
      class_name:        r.CLASS_NAME        ?? null,
      etc_otc_name:      r.ETC_OTC_NAME      ?? null,
      item_seq:          r.ITEM_SEQ          ?? null,
      item_name:         r.ITEM_NAME         ?? null,
      entp_name:         r.ENTP_NAME         ?? null,
      note:              r.NOTE              ?? null,
      notification_date: r.NOTIFICATION_DATE ?? null,
      change_date:       r.CHANGE_DATE       ?? null,
    }),
  });
}

async function syncDurDurationCaution() {
  console.log("\n━━━ [8/9] dur_duration_caution (투여기간주의) ━━━");
  await syncTable({
    label:    "투여기간주의",
    service:  SVC_DUR,
    endpoint: "getMdctnPdAtentInfoList03",
    table:    "dur_duration_caution",
    truncate: true,
    mapper:   (r) => ({
      ingr_name:         r.INGR_NAME         ?? r.INGR_KOR_NAME ?? "",
      ingr_code:         r.INGR_CODE         ?? null,
      class_name:        r.CLASS_NAME        ?? null,
      etc_otc_name:      r.ETC_OTC_NAME      ?? null,
      item_seq:          r.ITEM_SEQ          ?? null,
      item_name:         r.ITEM_NAME         ?? null,
      entp_name:         r.ENTP_NAME         ?? null,
      note:              r.NOTE              ?? null,
      notification_date: r.NOTIFICATION_DATE ?? null,
      change_date:       r.CHANGE_DATE       ?? null,
    }),
  });
}

async function syncDurTabletSplitCaution() {
  console.log("\n━━━ [9/9] dur_tablet_split_caution (서방정분할주의) ━━━");
  await syncTable({
    label:    "서방정분할주의",
    service:  SVC_DUR,
    endpoint: "getSeobangjeongPartitnAtentInfoList03",
    table:    "dur_tablet_split_caution",
    truncate: true,
    mapper:   (r) => ({
      ingr_name:         r.INGR_NAME         ?? r.INGR_KOR_NAME ?? "",
      ingr_code:         r.INGR_CODE         ?? null,
      class_name:        r.CLASS_NAME        ?? null,
      etc_otc_name:      r.ETC_OTC_NAME      ?? null,
      item_seq:          r.ITEM_SEQ          ?? null,
      item_name:         r.ITEM_NAME         ?? null,
      entp_name:         r.ENTP_NAME         ?? null,
      note:              r.NOTE              ?? null,
      notification_date: r.NOTIFICATION_DATE ?? null,
      change_date:       r.CHANGE_DATE       ?? null,
    }),
  });
}

// ── 완료 후 각 테이블 행 수 출력 ──────────────────────────────────
async function printSummary() {
  console.log("\n━━━ 동기화 결과 ━━━");
  const tables = [
    "drug_products",
    "dur_prohibition",
    "dur_pregnancy",
    "dur_efficacy_duplication",
    "dur_elderly_caution",
    "dur_age_restriction",
    "dur_dosage_caution",
    "dur_duration_caution",
    "dur_tablet_split_caution",
  ];
  for (const t of tables) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t.padEnd(32)} ${(count ?? 0).toLocaleString()}건`);
  }
}

// ── 메인 ─────────────────────────────────────────────────────────
async function main() {
  console.log("=== YackBang 전체 DB 동기화 시작 ===");
  const start = Date.now();

  await syncDrugProducts();
  await syncDurProhibition();
  await syncDurPregnancy();
  await syncDurEfficacyDuplication();
  await syncDurElderlyCaution();
  await syncDurAgeRestriction();
  await syncDurDosageCaution();
  await syncDurDurationCaution();
  await syncDurTabletSplitCaution();

  await printSummary();

  const min = ((Date.now() - start) / 60000).toFixed(1);
  console.log(`\n=== 완료 (${min}분 소요) ===\n`);
}

main().catch((err) => {
  console.error("\n❌ 치명적 오류:", err);
  process.exit(1);
});
