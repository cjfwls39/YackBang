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
 * DUR 테이블(2~9)은 배치 태그 방식으로 동기화됩니다:
 *   1. 모든 신규 행에 이번 실행의 sync_batch_id(=스크립트 시작 시각)를 태그해 INSERT
 *   2. 적재가 끝난 뒤, 이전 배치(sync_batch_id가 다른 행)만 청크 단위로 DELETE
 * TRUNCATE 후 재적재하던 예전 방식은 그 사이 테이블이 비어 "병용금기 없음"으로
 * 오판정될 수 있었음 — 이 방식은 적재 도중 행이 추가되기만 하므로 그 위험이 없음.
 * (자세한 내용은 README "기술적 도전과 해결" 5번 참고)
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
const CLEANUP_CHUNK   = 2000;  // 이전 배치 정리 시 한 번에 삭제할 행 수

/** 이번 스크립트 실행의 동기화 배치 식별자 — DUR 테이블 신규 행 태깅 + 이전 배치 정리에 사용 */
const SYNC_BATCH_ID = Date.now();

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
  /** true: 적재 완료 후 이전 배치(sync_batch_id가 다른 행) 삭제 (DUR 테이블용) */
  cleanupStaleBatch?: boolean;
  /** 지정 시 upsert, 미지정 시 insert */
  upsertOn?: string;
  mapper:    (item: Record<string, string>) => T;
}

/** 이전 배치(sync_batch_id가 다른 행)를 청크 단위로 삭제 — 0건이 될 때까지 반복 */
async function cleanupStaleRows(table: string): Promise<{ deleted: number; complete: boolean }> {
  let totalDeleted = 0;
  while (true) {
    const { data, error } = await sb.rpc("delete_stale_dur_batch", {
      tbl: table,
      keep_batch: SYNC_BATCH_ID,
      batch_size: CLEANUP_CHUNK,
    });
    if (error) {
      console.error(`\n  ⚠ 이전 배치 정리 실패 (${table}): ${error.message}`);
      return { deleted: totalDeleted, complete: false };
    }
    const deleted = (data as number) ?? 0;
    totalDeleted += deleted;
    if (deleted < CLEANUP_CHUNK) break; // 한 번에 다 못 지웠을 가능성 있으니 가득 찬 경우만 계속
  }
  return { deleted: totalDeleted, complete: true };
}

async function syncTable<T extends Record<string, unknown>>(opts: SyncOptions<T>) {
  const { label, service, endpoint, table, cleanupStaleBatch, upsertOn, mapper } = opts;

  process.stdout.write(`\n  [${label}] `);

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
    // DUR 테이블: 이번 배치 식별자 태깅 — 적재 완료 후 이전 배치만 골라 삭제하는 데 사용
    const taggedRows = cleanupStaleBatch
      ? rows.map((r) => ({ ...r, sync_batch_id: SYNC_BATCH_ID }))
      : rows;

    // 대량 삽입 시 chunk 단위로 나눠서 upsert/insert
    for (const batch of chunk(taggedRows, UPSERT_CHUNK)) {
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

  // 이전 배치 정리는 이번 적재가 오류 없이 끝났을 때만 실행.
  // 일부 chunk가 실패한 상태에서 정리하면, 그 chunk에 해당하던 이전 데이터까지
  // 같이 지워져 새 데이터도 옛 데이터도 없는 진짜 빈 구간이 생길 수 있음.
  if (cleanupStaleBatch && synced > 0 && errors === 0) {
    const { deleted, complete } = await cleanupStaleRows(table);
    if (complete) {
      if (deleted > 0) console.log(`  🧹 이전 배치 ${deleted.toLocaleString()}건 정리`);
    } else {
      console.error(
        `  ⚠ 이전 배치 ${deleted.toLocaleString()}건만 정리됨 — 일부 남아있을 수 있음. ` +
        `node scripts/sync-all.ts 재실행 또는 SQL Editor에서 delete_stale_dur_batch('${table}', ${SYNC_BATCH_ID}) 반복 호출 필요`
      );
    }
  }
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
// 2~9. DUR 테이블 — 배치 태그 insert + 이전 배치 정리
// ════════════════════════════════════════════════════════════════

async function syncDurProhibition() {
  console.log("\n━━━ [2/9] dur_prohibition (병용금기) ━━━");
  await syncTable({
    label:    "병용금기",
    service:  SVC_DUR,
    endpoint: "getUsjntTabooInfoList03",
    table:    "dur_prohibition",
    cleanupStaleBatch: true,
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
    cleanupStaleBatch: true,
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
    cleanupStaleBatch: true,
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
    cleanupStaleBatch: true,
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
    cleanupStaleBatch: true,
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
    cleanupStaleBatch: true,
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
    cleanupStaleBatch: true,
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
    cleanupStaleBatch: true,
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
