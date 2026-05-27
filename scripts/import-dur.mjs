/**
 * DUR 전체 데이터 → Supabase 임포트 스크립트
 *
 * 실행 방법:
 *   node scripts/import-dur.mjs
 *
 * 사전 조건:
 *   .env.local 에 DUR_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 설정 필요
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ── 환경변수 로드 ──────────────────────────────────────────────
const env = readFileSync(".env.local", "utf-8");
const getEnv = (key) => env.match(new RegExp(`^${key}=(.+)`, "m"))?.[1]?.trim() ?? "";

const DUR_API_KEY = getEnv("DUR_API_KEY");
const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!DUR_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ .env.local에 DUR_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 설정해주세요.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BASE = "https://apis.data.go.kr/1471000";
const ROWS = 500;  // 페이지당 행 수 (API 최대 500)
const BATCH = 500; // Supabase 배치 크기

// ── 유틸 ──────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(endpoint, pageNo, extra = "") {
  const url = `${BASE}/${endpoint}?serviceKey=${DUR_API_KEY}&type=json&numOfRows=${ROWS}&pageNo=${pageNo}${extra}`;
  const res = await fetch(url);
  const json = await res.json();
  return {
    items: json?.body?.items ?? [],
    total: json?.body?.totalCount ?? 0,
  };
}

async function batchInsert(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      console.error(`  ⚠️  insert 오류 (${table}):`, error.message);
    }
  }
}

// ── 1. 병용금기 임포트 ────────────────────────────────────────
async function importProhibition() {
  console.log("\n📦 병용금기(dur_prohibition) 임포트 시작...");

  // 기존 데이터 삭제
  await supabase.from("dur_prohibition").delete().neq("id", 0);

  const { total } = await fetchPage("DURPrdlstInfoService03/getUsjntTabooInfoList03", 1);
  const pages = Math.ceil(total / ROWS);
  console.log(`   총 ${total.toLocaleString()}건 / ${pages}페이지`);

  let imported = 0;
  for (let page = 1; page <= pages; page++) {
    const { items } = await fetchPage("DURPrdlstInfoService03/getUsjntTabooInfoList03", page);
    if (!items.length) break;

    const rows = items.map((it) => ({
      dur_seq:               it.DUR_SEQ          ?? null,
      ingr_code:             it.INGR_CODE         ?? null,
      ingr_kor_name:         it.INGR_KOR_NAME     ?? "",
      ingr_eng_name:         it.INGR_ENG_NAME     ?? null,
      item_seq:              it.ITEM_SEQ           ?? null,
      item_name:             it.ITEM_NAME          ?? null,
      entp_name:             it.ENTP_NAME          ?? null,
      mixture_ingr_code:     it.MIXTURE_INGR_CODE  ?? null,
      mixture_ingr_kor_name: it.MIXTURE_INGR_KOR_NAME ?? "",
      mixture_ingr_eng_name: it.MIXTURE_INGR_ENG_NAME ?? null,
      mixture_item_name:     it.MIXTURE_ITEM_NAME  ?? null,
      prohbt_content:        it.PROHBT_CONTENT     ?? null,
      notification_date:     it.NOTIFICATION_DATE  ?? null,
    }));

    await batchInsert("dur_prohibition", rows);
    imported += rows.length;
    process.stdout.write(`\r   ${page}/${pages}페이지 완료 (${imported.toLocaleString()}건)`);

    // API 과부하 방지
    if (page % 10 === 0) await sleep(500);
  }
  console.log(`\n✅ 병용금기 ${imported.toLocaleString()}건 완료`);
}

// ── 2. 임부금기 임포트 ────────────────────────────────────────
async function importPregnancy() {
  console.log("\n📦 임부금기(dur_pregnancy) 임포트 시작...");

  await supabase.from("dur_pregnancy").delete().neq("id", 0);

  const { total } = await fetchPage("DURPrdlstInfoService03/getPwnmTabooInfoList03", 1);
  const pages = Math.ceil(total / ROWS);
  console.log(`   총 ${total.toLocaleString()}건 / ${pages}페이지`);

  let imported = 0;
  for (let page = 1; page <= pages; page++) {
    const { items } = await fetchPage("DURPrdlstInfoService03/getPwnmTabooInfoList03", page);
    if (!items.length) break;

    const rows = items.map((it) => ({
      ingr_code:         it.INGR_CODE         ?? null,
      ingr_kor_name:     it.INGR_NAME         ?? it.INGR_KOR_NAME ?? "",
      ingr_eng_name:     it.INGR_ENG_NAME     ?? null,
      item_seq:          it.ITEM_SEQ           ?? null,
      item_name:         it.ITEM_NAME          ?? null,
      entp_name:         it.ENTP_NAME          ?? null,
      prohbt_content:    it.PROHBT_CONTENT     ?? null,
      notification_date: it.NOTIFICATION_DATE  ?? null,
    }));

    await batchInsert("dur_pregnancy", rows);
    imported += rows.length;
    process.stdout.write(`\r   ${page}/${pages}페이지 완료 (${imported.toLocaleString()}건)`);

    if (page % 10 === 0) await sleep(500);
  }
  console.log(`\n✅ 임부금기 ${imported.toLocaleString()}건 완료`);
}

// ── 3. 효능군중복 임포트 ──────────────────────────────────────
async function importEfficacyDuplication() {
  console.log("\n📦 효능군중복(dur_efficacy_duplication) 임포트 시작...");
  await supabase.from("dur_efficacy_duplication").delete().neq("id", 0);

  const { total } = await fetchPage("DURPrdlstInfoService03/getEfcyDplctInfoList03", 1);
  const pages = Math.ceil(total / ROWS);
  console.log(`   총 ${total.toLocaleString()}건 / ${pages}페이지`);

  let imported = 0;
  for (let page = 1; page <= pages; page++) {
    const { items } = await fetchPage("DURPrdlstInfoService03/getEfcyDplctInfoList03", page);
    if (!items.length) break;

    const rows = items.map((it) => ({
      ingr_name:         it.INGR_NAME ?? it.INGR_KOR_NAME ?? "",
      ingr_code:         it.INGR_CODE         ?? null,
      sers_name:         it.SERS_NAME         ?? null,
      etc_otc_name:      it.ETC_OTC_NAME      ?? null,
      item_seq:          it.ITEM_SEQ           ?? null,
      item_name:         it.ITEM_NAME          ?? null,
      entp_name:         it.ENTP_NAME          ?? null,
      notification_date: it.NOTIFICATION_DATE  ?? null,
      change_date:       it.CHANGE_DATE        ?? null,
    }));

    await batchInsert("dur_efficacy_duplication", rows);
    imported += rows.length;
    process.stdout.write(`\r   ${page}/${pages}페이지 완료 (${imported.toLocaleString()}건)`);
    if (page % 10 === 0) await sleep(500);
  }
  console.log(`\n✅ 효능군중복 ${imported.toLocaleString()}건 완료`);
}

// ── 4. 노인주의 임포트 ────────────────────────────────────────
async function importElderlyCaution() {
  console.log("\n📦 노인주의(dur_elderly_caution) 임포트 시작...");
  await supabase.from("dur_elderly_caution").delete().neq("id", 0);

  const { total } = await fetchPage("DURPrdlstInfoService03/getOdsnAtentInfoList03", 1);
  const pages = Math.ceil(total / ROWS);
  console.log(`   총 ${total.toLocaleString()}건 / ${pages}페이지`);

  let imported = 0;
  for (let page = 1; page <= pages; page++) {
    const { items } = await fetchPage("DURPrdlstInfoService03/getOdsnAtentInfoList03", page);
    if (!items.length) break;

    const rows = items.map((it) => ({
      ingr_name:         it.INGR_NAME ?? it.INGR_KOR_NAME ?? "",
      ingr_code:         it.INGR_CODE         ?? null,
      class_name:        it.CLASS_NAME        ?? null,
      etc_otc_name:      it.ETC_OTC_NAME      ?? null,
      item_seq:          it.ITEM_SEQ           ?? null,
      item_name:         it.ITEM_NAME          ?? null,
      entp_name:         it.ENTP_NAME          ?? null,
      note:              it.NOTE ?? it.ATENT_CONTENT ?? it.CONTENT ?? null,
      notification_date: it.NOTIFICATION_DATE  ?? null,
      change_date:       it.CHANGE_DATE        ?? null,
    }));

    await batchInsert("dur_elderly_caution", rows);
    imported += rows.length;
    process.stdout.write(`\r   ${page}/${pages}페이지 완료 (${imported.toLocaleString()}건)`);
    if (page % 10 === 0) await sleep(500);
  }
  console.log(`\n✅ 노인주의 ${imported.toLocaleString()}건 완료`);
}

// ── 5. 특정연령대금기 임포트 ──────────────────────────────────
async function importAgeRestriction() {
  console.log("\n📦 특정연령대금기(dur_age_restriction) 임포트 시작...");
  await supabase.from("dur_age_restriction").delete().neq("id", 0);

  const { total } = await fetchPage("DURPrdlstInfoService03/getSpcifyAgrdeTabooInfoList03", 1);
  const pages = Math.ceil(total / ROWS);
  console.log(`   총 ${total.toLocaleString()}건 / ${pages}페이지`);

  let imported = 0;
  for (let page = 1; page <= pages; page++) {
    const { items } = await fetchPage("DURPrdlstInfoService03/getSpcifyAgrdeTabooInfoList03", page);
    if (!items.length) break;

    const rows = items.map((it) => ({
      ingr_name:         it.INGR_NAME ?? it.INGR_KOR_NAME ?? "",
      ingr_code:         it.INGR_CODE         ?? null,
      prohbt_content:    it.PROHBT_CONTENT    ?? null,
      etc_otc_name:      it.ETC_OTC_NAME      ?? null,
      item_seq:          it.ITEM_SEQ           ?? null,
      item_name:         it.ITEM_NAME          ?? null,
      entp_name:         it.ENTP_NAME          ?? null,
      notification_date: it.NOTIFICATION_DATE  ?? null,
      change_date:       it.CHANGE_DATE        ?? null,
    }));

    await batchInsert("dur_age_restriction", rows);
    imported += rows.length;
    process.stdout.write(`\r   ${page}/${pages}페이지 완료 (${imported.toLocaleString()}건)`);
    if (page % 10 === 0) await sleep(500);
  }
  console.log(`\n✅ 특정연령대금기 ${imported.toLocaleString()}건 완료`);
}

// ── 6. 용량주의 임포트 ────────────────────────────────────────
async function importDosageCaution() {
  console.log("\n📦 용량주의(dur_dosage_caution) 임포트 시작...");
  await supabase.from("dur_dosage_caution").delete().neq("id", 0);

  const { total } = await fetchPage("DURPrdlstInfoService03/getCpctyAtentInfoList03", 1);
  const pages = Math.ceil(total / ROWS);
  console.log(`   총 ${total.toLocaleString()}건 / ${pages}페이지`);

  let imported = 0;
  for (let page = 1; page <= pages; page++) {
    const { items } = await fetchPage("DURPrdlstInfoService03/getCpctyAtentInfoList03", page);
    if (!items.length) break;

    const rows = items.map((it) => ({
      ingr_name:         it.INGR_NAME ?? it.INGR_KOR_NAME ?? "",
      ingr_code:         it.INGR_CODE         ?? null,
      class_name:        it.CLASS_NAME        ?? null,
      etc_otc_name:      it.ETC_OTC_NAME      ?? null,
      item_seq:          it.ITEM_SEQ           ?? null,
      item_name:         it.ITEM_NAME          ?? null,
      entp_name:         it.ENTP_NAME          ?? null,
      note:              it.NOTE ?? it.ATENT_CONTENT ?? it.CONTENT ?? null,
      notification_date: it.NOTIFICATION_DATE  ?? null,
      change_date:       it.CHANGE_DATE        ?? null,
    }));

    await batchInsert("dur_dosage_caution", rows);
    imported += rows.length;
    process.stdout.write(`\r   ${page}/${pages}페이지 완료 (${imported.toLocaleString()}건)`);
    if (page % 10 === 0) await sleep(500);
  }
  console.log(`\n✅ 용량주의 ${imported.toLocaleString()}건 완료`);
}

// ── 7. 투여기간주의 임포트 ────────────────────────────────────
async function importDurationCaution() {
  console.log("\n📦 투여기간주의(dur_duration_caution) 임포트 시작...");
  await supabase.from("dur_duration_caution").delete().neq("id", 0);

  const { total } = await fetchPage("DURPrdlstInfoService03/getMdctnPdAtentInfoList03", 1);
  const pages = Math.ceil(total / ROWS);
  console.log(`   총 ${total.toLocaleString()}건 / ${pages}페이지`);

  let imported = 0;
  for (let page = 1; page <= pages; page++) {
    const { items } = await fetchPage("DURPrdlstInfoService03/getMdctnPdAtentInfoList03", page);
    if (!items.length) break;

    const rows = items.map((it) => ({
      ingr_name:         it.INGR_NAME ?? it.INGR_KOR_NAME ?? "",
      ingr_code:         it.INGR_CODE         ?? null,
      class_name:        it.CLASS_NAME        ?? null,
      etc_otc_name:      it.ETC_OTC_NAME      ?? null,
      item_seq:          it.ITEM_SEQ           ?? null,
      item_name:         it.ITEM_NAME          ?? null,
      entp_name:         it.ENTP_NAME          ?? null,
      note:              it.NOTE ?? it.ATENT_CONTENT ?? it.CONTENT ?? null,
      notification_date: it.NOTIFICATION_DATE  ?? null,
      change_date:       it.CHANGE_DATE        ?? null,
    }));

    await batchInsert("dur_duration_caution", rows);
    imported += rows.length;
    process.stdout.write(`\r   ${page}/${pages}페이지 완료 (${imported.toLocaleString()}건)`);
    if (page % 10 === 0) await sleep(500);
  }
  console.log(`\n✅ 투여기간주의 ${imported.toLocaleString()}건 완료`);
}

// ── 8. 서방정분할주의 임포트 ──────────────────────────────────
async function importTabletSplitCaution() {
  console.log("\n📦 서방정분할주의(dur_tablet_split_caution) 임포트 시작...");
  await supabase.from("dur_tablet_split_caution").delete().neq("id", 0);

  const { total } = await fetchPage("DURPrdlstInfoService03/getSeobangjeongPartitnAtentInfoList03", 1);
  const pages = Math.ceil(total / ROWS);
  console.log(`   총 ${total.toLocaleString()}건 / ${pages}페이지`);

  let imported = 0;
  for (let page = 1; page <= pages; page++) {
    const { items } = await fetchPage("DURPrdlstInfoService03/getSeobangjeongPartitnAtentInfoList03", page);
    if (!items.length) break;

    const rows = items.map((it) => ({
      ingr_name:         it.INGR_NAME ?? it.INGR_KOR_NAME ?? "",
      ingr_code:         it.INGR_CODE         ?? null,
      class_name:        it.CLASS_NAME        ?? null,
      etc_otc_name:      it.ETC_OTC_NAME      ?? null,
      item_seq:          it.ITEM_SEQ           ?? null,
      item_name:         it.ITEM_NAME          ?? null,
      entp_name:         it.ENTP_NAME          ?? null,
      note:              it.NOTE ?? it.ATENT_CONTENT ?? it.CONTENT ?? null,
      notification_date: it.NOTIFICATION_DATE  ?? null,
      change_date:       it.CHANGE_DATE        ?? null,
    }));

    await batchInsert("dur_tablet_split_caution", rows);
    imported += rows.length;
    process.stdout.write(`\r   ${page}/${pages}페이지 완료 (${imported.toLocaleString()}건)`);
    if (page % 10 === 0) await sleep(500);
  }
  console.log(`\n✅ 서방정분할주의 ${imported.toLocaleString()}건 완료`);
}

// ── 9. 영문↔한글 성분명 매핑 생성 ────────────────────────────
async function buildIngrMapping() {
  console.log("\n🔗 ingr_mapping 생성 중...");

  await supabase.from("ingr_mapping").delete().neq("id", 0);

  // dur_prohibition에서 영문·한글 쌍 추출 (중복 제거는 ON CONFLICT로)
  const { data, error } = await supabase
    .from("dur_prohibition")
    .select("ingr_code, ingr_kor_name, ingr_eng_name")
    .not("ingr_eng_name", "is", null);

  if (error || !data) {
    console.error("  ⚠️  dur_prohibition 조회 오류:", error?.message);
    return;
  }

  const seen = new Map();
  for (const row of data) {
    const eng = row.ingr_eng_name?.toLowerCase().trim();
    if (eng && !seen.has(eng)) {
      seen.set(eng, { ingr_eng_name: eng, ingr_kor_name: row.ingr_kor_name, ingr_code: row.ingr_code });
    }
  }

  const mappingRows = [...seen.values()];
  for (let i = 0; i < mappingRows.length; i += BATCH) {
    const chunk = mappingRows.slice(i, i + BATCH);
    await supabase.from("ingr_mapping").upsert(chunk, { onConflict: "ingr_eng_name" });
  }
  console.log(`✅ 성분명 매핑 ${mappingRows.length.toLocaleString()}건 완료`);
}

// ── 실행 ──────────────────────────────────────────────────────
// 사용 예시:
//   node scripts/import-dur.mjs                  (전체)
//   node scripts/import-dur.mjs prohibition      (병용금기만)
//   node scripts/import-dur.mjs pregnancy        (임부금기만)
//   node scripts/import-dur.mjs efficacy         (효능군중복만)
//   node scripts/import-dur.mjs elderly          (노인주의만)
//   node scripts/import-dur.mjs age              (특정연령대금기만)
//   node scripts/import-dur.mjs dosage           (용량주의만)
//   node scripts/import-dur.mjs duration         (투여기간주의만)
//   node scripts/import-dur.mjs tablet           (서방정분할주의만)
//   node scripts/import-dur.mjs mapping          (성분명 매핑만)
//   node scripts/import-dur.mjs cautions         (노인/연령/용량/기간/서방정 묶음)
(async () => {
  const mode = process.argv[2];

  try {
    if (!mode || mode === "prohibition") await importProhibition();
    if (!mode || mode === "pregnancy")   await importPregnancy();
    if (!mode || mode === "efficacy")    await importEfficacyDuplication();
    if (!mode || mode === "elderly"   || mode === "cautions") await importElderlyCaution();
    if (!mode || mode === "age"       || mode === "cautions") await importAgeRestriction();
    if (!mode || mode === "dosage"    || mode === "cautions") await importDosageCaution();
    if (!mode || mode === "duration"  || mode === "cautions") await importDurationCaution();
    if (!mode || mode === "tablet"    || mode === "cautions") await importTabletSplitCaution();
    if (!mode || mode === "mapping")     await buildIngrMapping();
    console.log("\n🎉 모든 임포트 완료!");
  } catch (err) {
    console.error("\n❌ 오류:", err);
    process.exit(1);
  }
})();
