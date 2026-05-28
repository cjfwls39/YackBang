import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import type { EasyDrugInfo } from "@/types/drug";
import type {
  SelectedDrug,
  SingleDrugResult,
  MultiDrugResult,
  DurProhibition,
  DurPregnancy,
  DurElderlyCaution,
  DurAgeRestriction,
  DurDosageCaution,
  DurDurationCaution,
  DurTabletSplitCaution,
  EfficacyDuplicationPair,
  IngredientOverlapPair,
  LabelWarning,
} from "@/types/drug";

// ── 병용금기 내용 → 쉬운 한국어 변환 ────────────────────────────
const PLAIN_TEXT_MAP: Array<[RegExp | string, string]> = [
  // 근육/횡문근 관련
  [/횡문근융해/,        "근육이 심하게 손상되어 신장에 부담을 줄 수 있어요. (횡문근융해증)"],
  [/근병증|근육병증/,   "근육에 이상이 생겨 통증이나 쇠약감이 나타날 수 있어요."],
  [/근질환|근증/,       "근육 손상 위험이 높아질 수 있어요."],
  // 심장/혈압 관련
  [/QTc|QT.*연장|Torsade|심실성 부정맥/, "심장 박동이 불규칙해지는 심각한 부정맥이 생길 수 있어요."],
  [/고혈압위기/,        "혈압이 갑자기 매우 높게 올라가는 응급 상황이 생길 수 있어요."],
  [/저혈압/,           "혈압이 갑자기 크게 떨어져 어지럼증이나 실신이 나타날 수 있어요."],
  // 신경/정신 관련
  [/세로토닌/,         "몸 떨림, 발열, 혼란 등 세로토닌 증후군 증상이 생길 수 있어요."],
  [/경련|간질|발작/,   "발작이나 경련이 일어날 수 있어요."],
  [/이상고열|혼수/,    "고열과 의식 이상이 나타날 수 있어요."],
  // 출혈/혈액 관련
  [/출혈/,            "출혈이 잘 멈추지 않거나 과도하게 날 수 있어요."],
  [/혈액학적 독성|메토트렉세이트.*독성/, "혈액 세포가 감소해 감염이나 빈혈 위험이 높아져요."],
  [/혈소판/,          "혈소판이 줄어 멍이 잘 들고 출혈이 쉽게 생길 수 있어요."],
  // 신장/간 관련
  [/신부전|신독성|신세뇨관/, "신장에 심각한 손상을 줄 수 있어요."],
  [/간독성|간손상/,    "간에 심각한 손상을 줄 수 있어요."],
  [/유산 산성증/,      "젖산이 쌓여 산증이 생길 수 있어요."],
  // 혈당/전해질
  [/저혈당/,          "혈당이 위험할 정도로 낮아질 수 있어요."],
  [/고칼슘혈증/,       "혈액 내 칼슘이 높아져 오심, 구토, 피로감이 생길 수 있어요."],
  [/고칼륨혈증/,       "혈액 내 칼륨이 높아져 심장 문제가 생길 수 있어요."],
  // 약물 농도/대사
  [/CYP.*억제|대사.*감소/, "약물 분해가 느려져 부작용이 강해질 수 있어요."],
  [/혈중농도 증가/,    "약물 농도가 높아져 부작용 위험이 증가해요."],
  [/동일계열/,         "같은 계열의 약을 함께 쓰면 효과가 과도하게 강해질 수 있어요."],
  // 급성 독성
  [/급성신부전/,       "갑작스러운 신장 기능 저하가 나타날 수 있어요."],
];

function toPlainText(content: string): string {
  if (!content) return content;
  for (const [pattern, plain] of PLAIN_TEXT_MAP) {
    if (typeof pattern === "string" ? content.includes(pattern) : pattern.test(content)) {
      return plain;
    }
  }
  return content;
}

// ── 식약처 DUR 원문 텍스트 정제 ──────────────────────────────────
// 데이터베이스 원문에서 자주 발생하는 포맷 이슈를 UI 표시 전에 정리
function cleanText(text: string | null | undefined): string | null {
  if (!text) return null;

  let t = text.trim();

  // 의미 없는 더미값 처리
  if (t === "-" || t === "_" || t === "--" || t === "") return null;

  // 쇽 → 쇼크 (shock 오래된 한글 표기)
  t = t.replace(/쇽(?!\s*크)/g, "쇼크");

  // 인코딩 깨진 특수문자 정리
  t = t.replace(/？/g, "・");   // ？ → 중점 (목록 구분)
  t = t.replace(/　/g, " ");   // 전각 공백 → 일반 공백

  // "- 항목1- 항목2" 패턴 → "• 항목1\n• 항목2" (줄바꿈 없이 붙은 대시 목록)
  // 앞 항목 끝에 공백 없이 다음 대시가 오는 경우
  t = t.replace(/([가-힣a-zA-Z0-9,)])\s*-\s+/g, "$1\n• ");

  // 선행 대시 "- 텍스트" → "• 텍스트"
  t = t.replace(/^-\s+/gm, "• ");
  t = t.replace(/^-(?=[가-힣])/gm, "• ");

  // "텍스트.다음텍스트" → "텍스트. 다음텍스트" (마침표 뒤 공백 없음)
  t = t.replace(/([가-힣a-zA-Z0-9])\.\s*([가-힣A-Z])/g, "$1. $2");

  // "노인에서 " / "소아에서 " 등 의학 문서체 → 자연스러운 표현
  t = t.replace(/노인에서\s+(사용|투여|복용)/g, "노인이 $1할 때");
  t = t.replace(/소아에서\s+(사용|투여|복용)/g, "소아가 $1할 때");
  t = t.replace(/신\s+에서/g, "신장에서");
  t = t.replace(/간\s+에서/g, "간에서");

  // 괄호 안 긴 출처 제거 "(FDA 안전성 정보 (FDA Drug Safety Communication)('14.1.8) )"
  t = t.replace(/\(FDA[^)]*\)/gi, "").trim();

  // 마지막 공백·개행 정리
  t = t.replace(/\n{3,}/g, "\n\n").trim();

  return t || null;
}

// ── 영문 성분명 → 한글 성분명 즉시 매핑 ───────────────────────────
// 수출용/영문 표기 제품 대응: DB 조회 없이 즉시 변환
// parseIngredients()가 소문자로 정규화한 키와 일치해야 함
const ENG_KOR_INGR: Record<string, string> = {
  // 해열·진통·소염
  "acetaminophen":                    "아세트아미노펜",
  "acetaminophen anhydrous":          "아세트아미노펜",
  "ibuprofen":                        "이부프로펜",
  "aspirin":                          "아스피린",
  "acetylsalicylic acid":             "아스피린",
  "naproxen":                         "나프록센",
  "naproxen sodium":                  "나프록센",
  "loxoprofen sodium":                "록소프로펜",
  "loxoprofen sodium hydrate":        "록소프로펜",
  "diclofenac sodium":                "디클로페낙나트륨",
  "diclofenac potassium":             "디클로페낙칼륨",
  "celecoxib":                        "셀레콕시브",
  "meloxicam":                        "멜록시캄",
  "isopropylantipyrine":              "이소프로필안티피린",
  "ethenzamide":                      "에텐자미드",
  // 카페인류
  "caffeine":                         "카페인",
  "anhydrous caffeine":               "카페인",
  "caffeine anhydrous":               "카페인",
  // 항히스타민·알레르기
  "loratadine":                       "로라타딘",
  "cetirizine hydrochloride":         "세티리진염산염",
  "cetirizine":                       "세티리진",
  "fexofenadine hydrochloride":       "펙소페나딘염산염",
  "fexofenadine":                     "펙소페나딘",
  "diphenhydramine hydrochloride":    "디펜히드라민염산염",
  "diphenhydramine":                  "디펜히드라민",
  "chlorpheniramine maleate":         "클로르페니라민말레산염",
  // 감기·기침
  "pseudoephedrine hydrochloride":    "슈도에페드린염산염",
  "pseudoephedrine":                  "슈도에페드린",
  "dextromethorphan hydrobromide":    "덱스트로메토르판취화수소산염",
  "dextromethorphan":                 "덱스트로메토르판",
  "guaifenesin":                      "구아이페네신",
  "bromhexine hydrochloride":         "브롬헥신염산염",
  "ambroxol hydrochloride":           "암브록솔염산염",
  // 위장
  "famotidine":                       "파모티딘",
  "omeprazole":                       "오메프라졸",
  "esomeprazole magnesium":           "에스오메프라졸마그네슘",
  "esomeprazole":                     "에스오메프라졸",
  "lansoprazole":                     "란소프라졸",
  "pantoprazole sodium":              "판토프라졸나트륨",
  "pantoprazole":                     "판토프라졸",
  "domperidone":                      "돔페리돈",
  "metoclopramide hydrochloride":     "메토클로프라미드염산염",
  "mosapride citrate":                "모사프리드구연산염",
  "loperamide hydrochloride":         "로페라미드염산염",
  // 콜레스테롤
  "simvastatin":                      "심바스타틴",
  "atorvastatin calcium":             "아토르바스타틴칼슘",
  "atorvastatin":                     "아토르바스타틴",
  "rosuvastatin calcium":             "로수바스타틴칼슘",
  "rosuvastatin":                     "로수바스타틴",
  "pitavastatin calcium":             "피타바스타틴칼슘",
  // 혈압·심장
  "amlodipine besylate":              "암로디핀베실산염",
  "amlodipine":                       "암로디핀",
  "losartan potassium":               "로사르탄칼륨",
  "losartan":                         "로사르탄",
  "valsartan":                        "발사르탄",
  "lisinopril":                       "리시노프릴",
  "enalapril maleate":                "에날라프릴말레산염",
  "metoprolol tartrate":              "메토프롤롤타르타르산염",
  "metoprolol succinate":             "메토프롤롤숙시네이트",
  "carvedilol":                       "카르베딜롤",
  // 혈당
  "metformin hydrochloride":          "메트포르민염산염",
  "metformin":                        "메트포르민",
  "glimepiride":                      "글리메피리드",
  "sitagliptin phosphate":            "시타글립틴인산염",
  "sitagliptin":                      "시타글립틴",
  // 항혈전
  "warfarin sodium":                  "와파린나트륨",
  "warfarin":                         "와파린",
  "clopidogrel bisulfate":            "클로피도그렐황산염",
  "clopidogrel":                      "클로피도그렐",
  // 항생제
  "amoxicillin trihydrate":           "아목시실린삼수화물",
  "amoxicillin":                      "아목시실린",
  "azithromycin":                     "아지스로마이신",
  "clarithromycin":                   "클래리스로마이신",
  "erythromycin":                     "에리스로마이신",
  "cephalexin":                       "세팔렉신",
  // 수면·신경
  "zolpidem tartrate":                "졸피뎀타르타르산염",
  "zolpidem":                         "졸피뎀",
  "alprazolam":                       "알프라졸람",
  "diazepam":                         "디아제팜",
  "clonazepam":                       "클로나제팜",
  // 항우울·정신
  "escitalopram oxalate":             "에스시탈로프람수산염",
  "escitalopram":                     "에스시탈로프람",
  "sertraline hydrochloride":         "설트랄린염산염",
  "sertraline":                       "설트랄린",
  "fluoxetine hydrochloride":         "플루옥세틴염산염",
  "fluoxetine":                       "플루옥세틴",
  // 기타
  "fluconazole":                      "플루코나졸",
  "metronidazole":                    "메트로니다졸",
  "acyclovir":                        "아시클로버",
  "sildenafil citrate":               "실데나필구연산염",
  "sildenafil":                       "실데나필",
  "tadalafil":                        "타달라필",
  "finasteride":                      "피나스테리드",
  "tamsulosin hydrochloride":         "탐수로신염산염",
};

// ── 성분 해석 결과 타입 ───────────────────────────────────────────
interface ResolvedIngredients {
  /** 한글 성분명 목록 — 임부금기·노인주의·효능군 등 일반 DUR 쿼리에 사용 */
  korNames: string[];
  /** 성분코드 목록 — 병용금기 쿼리에 사용.
   *  "이트라코나졸" vs "이트라코나졸제피과립" 같이 DB에 다르게 저장된
   *  동일 성분을 ingr_code (D000762 등)로 정확하게 매칭함. */
  ingrCodes: string[];
}

// ── 한글 성분명 + 성분코드 전체 해석 (다성분 약 포함) ──────────────
async function resolveIngredients(drug: SelectedDrug): Promise<ResolvedIngredients> {
  const names = new Set<string>();
  const codes = new Set<string>();

  // 1. 이미 해석된 한글 성분명
  if (drug.ingrKorName) names.add(drug.ingrKorName);

  // 2. 약품명 괄호 안 한글 성분명 (예: "타이레놀정500밀리그람(아세트아미노펜)")
  const fromName = drug.itemName.match(/\(([가-힣·\s]+)\)/)?.[1]?.trim();
  if (fromName) names.add(fromName);

  // 3. itemIngrName 영문 성분명 → 즉시 매핑 (DB 조회 없이, 수출용/영문 표기 제품 대응)
  if (drug.itemIngrName) {
    for (const parsed of parseIngredients(drug.itemIngrName)) {
      const kor = ENG_KOR_INGR[parsed];
      if (kor) names.add(kor);
    }
  }

  const isMultiIngr = drug.itemIngrName?.includes("/");
  const sb = getSupabase();

  // 4. item_seq 역조회 — 다성분 약이거나 이름을 못 찾은 경우에만
  //    ingr_kor_name 과 ingr_code 를 동시에 수집
  if (drug.itemSeq && (names.size === 0 || isMultiIngr)) {
    const [fromProhib, fromElderly, fromDosage] = await Promise.all([
      sb.from("dur_prohibition")
        .select("ingr_kor_name, ingr_code")
        .eq("item_seq", drug.itemSeq)
        .limit(200),
      sb.from("dur_elderly_caution")
        .select("ingr_name")
        .eq("item_seq", drug.itemSeq)
        .limit(20),
      sb.from("dur_dosage_caution")
        .select("ingr_name")
        .eq("item_seq", drug.itemSeq)
        .limit(20),
    ]);
    for (const r of fromProhib.data ?? []) {
      if (r.ingr_kor_name) names.add(r.ingr_kor_name as string);
      if (r.ingr_code)     codes.add(r.ingr_code as string);
    }
    for (const r of fromElderly.data ?? []) if (r.ingr_name) names.add(r.ingr_name as string);
    for (const r of fromDosage.data ?? [])  if (r.ingr_name) names.add(r.ingr_name as string);
  }

  // 5. 성분코드 보완 — 이름은 알지만 코드가 없는 경우 (단일 성분약 패스스루 등)
  //    idx_prohibition_ingr 인덱스(ingr_kor_name)로 빠르게 ingr_code 조회
  if (codes.size === 0 && names.size > 0) {
    const { data: codeRows } = await sb
      .from("dur_prohibition")
      .select("ingr_code")
      .in("ingr_kor_name", [...names])
      .not("ingr_code", "is", null)
      .limit(10);
    for (const r of codeRows ?? []) if (r.ingr_code) codes.add(r.ingr_code as string);
  }

  return { korNames: [...names], ingrCodes: [...codes] };
}

// ── DB row → TS 타입 변환 ────────────────────────────────────
function toProhibition(row: Record<string, unknown>): DurProhibition {
  return {
    id:                   row.id as number,
    durSeq:               row.dur_seq as string | undefined,
    ingrCode:             row.ingr_code as string,
    ingrKorName:          row.ingr_kor_name as string,
    ingrEngName:          row.ingr_eng_name as string | undefined,
    itemSeq:              row.item_seq as string | undefined,
    itemName:             row.item_name as string | undefined,
    entpName:             row.entp_name as string | undefined,
    mixtureIngrCode:      row.mixture_ingr_code as string | undefined,
    mixtureIngrKorName:   row.mixture_ingr_kor_name as string,
    mixtureIngrEngName:   row.mixture_ingr_eng_name as string | undefined,
    mixtureItemName:      row.mixture_item_name as string | undefined,
    prohbtContent:        cleanText(row.prohbt_content as string) ?? (row.prohbt_content as string),
    prohbtContentPlain:   toPlainText(cleanText(row.prohbt_content as string) ?? (row.prohbt_content as string)),
    notificationDate:     row.notification_date as string | undefined,
  };
}

function toPregnancy(row: Record<string, unknown>): DurPregnancy {
  const rawContent = row.prohbt_content as string;
  const content = cleanText(rawContent) ?? rawContent;
  return {
    id:                   row.id as number,
    ingrCode:             row.ingr_code as string,
    ingrKorName:          row.ingr_kor_name as string,
    itemSeq:              row.item_seq as string | undefined,
    itemName:             row.item_name as string | undefined,
    prohbtContent:        content,
    prohbtContentPlain:   toPlainText(content),
    notificationDate:     row.notification_date as string | undefined,
  };
}

// ── e약은요 API — 일반인용 복약 정보 fetch ───────────────────────
async function fetchEasyDrugInfo(drug: SelectedDrug): Promise<EasyDrugInfo | null> {
  const apiKey = process.env.DUR_API_KEY;
  if (!apiKey) return null;

  try {
    // 약품명에서 검색 키워드 추출: 숫자·괄호 이전까지 (예: "타이레놀정500밀리그람..." → "타이레놀정")
    const baseName = drug.itemName
      .replace(/\s*[\d(].*$/, "")  // 숫자나 괄호 이후 제거
      .trim();
    if (!baseName || baseName.length < 2) return null;

    const url = new URL("https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList");
    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("type", "json");
    url.searchParams.set("numOfRows", "20");
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("itemName", baseName);

    const res = await fetch(url.toString(), {
      next: { revalidate: 86400 }, // 24시간 캐시 (공공데이터는 자주 바뀌지 않음)
    });
    if (!res.ok) return null;

    const json = await res.json();
    const items = (json?.body?.items ?? []) as Record<string, string>[];
    if (!items.length) return null;

    // itemSeq가 정확히 일치하는 항목만 사용 (다른 제품 오매칭 방지)
    const match = items.find((it) => it.itemSeq === drug.itemSeq) ?? null;
    if (!match) return null;

    // cleanText로 e약은요 텍스트도 정제 (쇽→쇼크, 노인에서→노인이, 이상한 특수문자 등)
    const ct = (s: string | undefined) => cleanText(s) ?? undefined;
    return {
      itemSeq:              match.itemSeq,
      itemName:             match.itemName,
      efcyQesitm:           ct(match.efcyQesitm),
      useMethodQesitm:      ct(match.useMethodQesitm),
      atpnWarnQesitm:       ct(match.atpnWarnQesitm),
      atpnQesitm:           ct(match.atpnQesitm),
      intrcQesitm:          ct(match.intrcQesitm),
      seQesitm:             ct(match.seQesitm),
      depositMethodQesitm:  ct(match.depositMethodQesitm),
      itemImage:            match.itemImage            || undefined,
    };
  } catch {
    return null; // 오류는 조용히 무시 — 보조 정보이므로 실패해도 전체 결과에 영향 없음
  }
}

// ── 성분명 파싱 (ITEM_INGR_NAME → 정규화된 성분명 배열) ──────────
// 예: "아세트아미노펜(Acetaminophen) 500밀리그램|카페인무수물 50밀리그램"
//  → ["아세트아미노펜", "acetaminophen", "카페인무수물"]
function parseIngredients(ingrStr: string | undefined): string[] {
  if (!ingrStr) return [];
  const results = new Set<string>();

  const parts = ingrStr.split(/[|,;/]/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // 용량 제거: "500밀리그램", "50mg", "10 IU" 등
    const stripped = trimmed
      .replace(/\s*\d[\d.,]*\s*(밀리그램|마이크로그램|그램|밀리리터|리터|mg|mcg|μg|g|ml|l|iu|units?|%)[가-힣]*/gi, "")
      .trim();

    // 한글 성분명 (앞부분)
    const kor = stripped.match(/^([가-힣·\s]+)/)?.[1]?.trim();
    if (kor && kor.length > 1) results.add(kor.toLowerCase());

    // 영문 성분명 (괄호 안)
    const eng = stripped.match(/\(([A-Za-z][^)]*)\)/)?.[1]?.trim();
    if (eng && eng.length > 1) results.add(eng.toLowerCase());

    // 영문만 있는 경우 (괄호 없이)
    if (!kor && /^[A-Za-z]/.test(stripped)) {
      // 제형·투여경로 접미사 제거: "Acetaminophen Granules" → "Acetaminophen"
      const withoutForm = stripped
        .replace(/\([^)]*\)/g, "")
        .replace(/\b(granules?|tablets?|capsules?|solution|suspension|powder|syrup|injection|cream|gel|ointment|patch|drops?|spray|elixir|lotion|emulsion|anhydrate|hydrate)\b/gi, "")
        .trim();
      if (withoutForm.length > 1) results.add(withoutForm.toLowerCase());
    }
  }

  return [...results];
}

// ── 효능군 조회 (여러 성분명 → distinct sers_names) ──────────────
// 다성분 약 지원: 복수의 한글 성분명을 한 번에 조회
async function getEfficacyGroupsForNames(korNames: string[]): Promise<string[]> {
  if (!korNames.length) return [];
  const { data } = await getSupabase()
    .from("dur_efficacy_duplication")
    .select("sers_name")
    .in("ingr_name", korNames)
    .not("sers_name", "is", null);

  if (!data?.length) return [];
  return [...new Set(data.map((r) => r.sers_name as string).filter(Boolean))];
}

// ── 허가정보 NB_DOC_DATA 관련 ────────────────────────────────────────

/** NB_DOC_DATA ARTICLE 파싱 중간 결과 (로컬 전용) */
interface LabelSection {
  severity: "prohibited" | "avoid" | "consult" | "caution";
  title: string;
  text: string;
}

/** 허가정보 getDrugPrdtPrmsnDtlInq06 → NB_DOC_DATA XML (24h 캐시) */
async function fetchProductLabel(itemSeq: string): Promise<string | null> {
  const apiKey = process.env.DUR_API_KEY;
  if (!apiKey || !itemSeq) return null;

  try {
    const url = new URL(
      "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06"
    );
    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("type", "json");
    url.searchParams.set("numOfRows", "1");
    url.searchParams.set("item_seq", itemSeq);

    const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
    if (!res.ok) return null;

    const json = await res.json() as Record<string, unknown>;
    const items = (json?.body as Record<string, unknown>)?.items as
      Record<string, unknown>[] | undefined;
    return (items?.[0]?.NB_DOC_DATA as string) ?? null;
  } catch {
    return null; // 네트워크 오류 → 조용히 무시
  }
}

/** NB_DOC_DATA XML → 상호작용 관련 ARTICLE 섹션만 파싱 */
function parseLabelSections(xml: string): LabelSection[] {
  if (!xml) return [];
  const sections: LabelSection[] = [];

  // ARTICLE 태그 (title 속성 포함) 순차 추출
  const articleRe = /<ARTICLE[^>]+title="([^"]*)"[^>]*>([\s\S]*?)<\/ARTICLE>/g;
  let am: RegExpExecArray | null;

  while ((am = articleRe.exec(xml)) !== null) {
    const title = am[1].trim();
    const body  = am[2];

    // 무관 섹션 skip (이상반응·보관·중단 관련 등)
    if (/이상반응|부작용|경고문|임부|수유|과량|보관|저장|포장|즉각 중지/.test(title)) continue;

    // CDATA 내용 수집 (HTML 태그 제거 후 합치기)
    const textParts: string[] = [];
    const cdataRe = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
    let cm: RegExpExecArray | null;
    while ((cm = cdataRe.exec(body)) !== null) {
      const t = cm[1].replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
      if (t) textParts.push(t);
    }
    const text = textParts.join("\n").trim();
    if (!text) continue;

    // ARTICLE 제목 → severity 분류
    // ※ 일반의약품: "복용하지 말 것" / "복용하기 전에 의사...와 상의할 것"
    // ※ 전문의약품: "투여하지 말 것" / "신중히 투여할 것" / "상호작용"
    let severity: LabelSection["severity"] | null = null;
    if (/복용하지 말 것|투여하지 말 것/.test(title)) {
      severity = "prohibited";
    } else if (/복용하기 전에.*상의|신중히 투여/.test(title)) {
      // "복용하기 전에 의사, 치과의사, 약사와 상의할 것" 패턴 대응
      severity = "consult";
    } else if (/상호작용/.test(title)) {
      severity = /병용하지 않는 것이 바람직/.test(text) ? "avoid" : "caution";
    }
    if (!severity) continue;

    sections.push({ severity, title, text });
  }

  return sections;
}

// ── 레이블 매칭 헬퍼 ─────────────────────────────────────────────

/** 염·수화물 접미사 제거 (stem 비교용) */
function stripSalt(name: string): string {
  return name
    .replace(/(나트륨|염산염|황산염|구연산염|타르타르산염|수화물|삼수화물|무수물|인산염|말레산염|숙시네이트|칼슘|마그네슘|베실산염|브롬화물)$/, "")
    .trim();
}

/** 레이블 CDATA 텍스트에서 약물명 토큰 추출
 *
 *  핵심 패턴:
 *   "8) 다음의 약물을 복용한 환자 : 바르비탈계 약물, 삼환계 항우울제"
 *   → ":"로 먼저 분리 → ["바르비탈계 약물", "삼환계 항우울제"] 추출
 */
function extractLabelTokens(text: string): string[] {
  return text
    .split(/[,、，\n:]/)           // ":"를 구분자로 추가 — 콜론 목록 처리의 핵심
    .map((part) =>
      part
        .replace(/\([^)]*\)/g, "")                               // 괄호 제거
        .replace(/(복용|투여|사용|병용|함께|등)[가-힣\s]*/g, "")  // 동사구 제거
        .replace(/^\s*\d+[\)\.]\s*/, "")                         // "8)" / "8." 번호 제거
        .replace(/^\s*[-·•]\s*/, "")                             // 기호 제거
        .trim()
    )
    .filter((s) => s.length >= 3 && /[가-힣A-Z]/.test(s));
}

/** 약물군명 접미사를 제거해 stem 목록 생성 ("바르비탈계 약물" → ["바르비탈계", "바르비탈"]) */
function generateTokenStems(token: string): string[] {
  const stems = new Set([token]);
  // "바르비탈계 약물" → "바르비탈계"
  const noQual = token.replace(/\s*(?:약물|제제|의약품)$/, "").trim();
  if (noQual.length >= 3) stems.add(noQual);
  // "바르비탈계" → "바르비탈"
  const base = noQual.length >= 3 ? noQual : token;
  const noKye = base.replace(/계열?$/, "").trim();
  if (noKye.length >= 3 && noKye !== base) stems.add(noKye);
  return [...stems];
}

const SERS_BLOCKLIST = new Set(["기타", "없음", "일반"]);

// ── 약물군 → 상호작용 이유 룩업 (가장 흔한 케이스 커버) ──────────────
// key: 약물명·계열명의 핵심 키워드 (matchedName.includes(key)로 매칭)
const INGR_CLASS_REASON: [string, string][] = [
  ["바르비탈",       "간의 약물 분해 효소(CYP)를 강하게 자극해 독성 대사물 생성이 늘어나 간 손상 위험이 높아집니다."],
  ["삼환계 항우울",  "두 약이 중추신경계에 중복으로 작용해 졸음·진정·혼란 등 부작용이 심해질 수 있습니다."],
  ["MAO저해제",      "세로토닌 증후군(발열·떨림·혼란 등 심각한 증상) 위험이 있습니다."],
  ["와파린",         "항응고 효과가 변화해 출혈이 잘 멈추지 않을 수 있습니다."],
  ["알코올",         "간 손상 및 출혈 위험이 크게 높아집니다."],
  ["HMG-CoA",        "근육 손상(횡문근융해증) 위험이 높아집니다."],
  ["스타틴",         "근육 손상(횡문근융해증) 위험이 높아집니다."],
  ["플루클록사실린", "대사성 산증(HAGMA) 위험이 있습니다."],
  ["에르고타민",     "혈관 수축이 과도해져 혈관 경련 위험이 있습니다."],
  ["리팜피신",       "이 약의 분해가 빨라져 약효가 크게 떨어집니다."],
  ["퀴놀론",         "약물 농도가 높아져 부작용 위험이 증가합니다."],
  ["시클로스포린",   "면역억제제 농도가 변해 거부반응 또는 독성 위험이 생길 수 있습니다."],
  ["페니토인",       "간 효소를 자극해 이 약의 효과가 떨어지거나 독성이 변할 수 있습니다."],
];

/**
 * 병용 금기/주의 이유 추출
 * 1) rawText에서 설명 문장 탐색 (상호작용 섹션 등에 설명이 있는 경우)
 * 2) matchedNames 기반 룩업 테이블 폴백
 */
function findBriefReason(rawText: string, matchedNames: string[]): string | null {
  const explanationRe = /위험|독성|증가|손상|부작용|혈중농도|대사|장애|영향|저하|강화|억제/;

  // [1] rawText에서 설명적 문장 추출
  const sentences = rawText
    .split(/[。\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15 && s.length <= 160);

  for (const name of matchedNames) {
    const stem = name.replace(/계열?\s*약물?$|계열?$|\(계열\)$/, "").trim();
    for (const sentence of sentences) {
      if (
        (sentence.includes(name) || (stem && stem !== name && sentence.includes(stem))) &&
        explanationRe.test(sentence)
      ) {
        return sentence.replace(/^\d+[\)\.]\s*/, "").replace(/^[-·•]\s*/, "").trim();
      }
    }
  }

  // [2] 룩업 테이블 — matchedName 또는 korName이 키워드를 포함하는지 검사
  for (const name of matchedNames) {
    for (const [key, reason] of INGR_CLASS_REASON) {
      if (name.includes(key)) return reason;
    }
  }

  return null;
}

/**
 * 레이블 섹션 텍스트에서 Drug B의 이름이나 효능군이 언급되는지 확인
 * 1) korNames/serNames 직접 포함
 * 2) 접미사 제거 stem 포함
 * 3) 역방향: 레이블 토큰 stem → korName 안에 포함 (바르비탈계 → 페노바르비탈)
 */
function findMatchesInSection(
  sectionText: string,
  drugKorNames: string[],
  drugSerNames: string[],
): string[] {
  const matched = new Set<string>();

  // [1] korName 직접 포함
  for (const name of drugKorNames) {
    if (name.length < 2) continue;
    if (sectionText.includes(name)) { matched.add(name); continue; }
    const stem = stripSalt(name);
    if (stem.length >= 3 && stem !== name && sectionText.includes(stem)) {
      matched.add(name);
    }
  }

  // [2] sers_name (효능군명) 직접 포함
  for (const sn of drugSerNames) {
    if (sn.length < 4 || SERS_BLOCKLIST.has(sn)) continue;
    if (sectionText.includes(sn)) matched.add(sn);
  }

  // [3] 역방향: 레이블 토큰 stem → korName 안에서 찾기
  //     "바르비탈계 약물" → stem "바르비탈" → "페노바르비탈".includes("바르비탈") = true
  if (matched.size === 0) {
    for (const token of extractLabelTokens(sectionText)) {
      for (const stem of generateTokenStems(token)) {
        if (stem.length < 4) continue;
        for (const korName of drugKorNames) {
          if (korName.includes(stem)) matched.add(korName);
        }
      }
    }
  }

  return [...matched];
}

// ── 단일 약 조회 ─────────────────────────────────────────────
async function querySingle(drug: SelectedDrug): Promise<SingleDrugResult> {
  // 다성분 약 대응: 한글 성분명 배열 + 성분코드 전체 확보
  const { korNames, ingrCodes } = await resolveIngredients(drug);

  if (!korNames.length && !ingrCodes.length) {
    return {
      drug,
      prohibitions: [],
      pregnancyWarning: null,
      elderlyCautions: [],
      ageRestrictions: [],
      dosageCautions: [],
      durationCautions: [],
      tabletSplitCautions: [],
      easyDrugInfo: null,
    };
  }

  const sb = getSupabase();

  // 병용금기: 성분코드가 있으면 코드 기반 쿼리 (명칭 표기 차이 무시)
  //           없으면 한글 성분명 기반 폴백
  // ※ 코드 기반 쿼리는 idx_prohibition_ingr_code 인덱스 필요
  const useCode = ingrCodes.length > 0;

  // 모든 쿼리 + e약은요 fetch 병렬 실행
  const [
    prohibA, prohibB, pregnancyRes,
    elderlyRaw, ageRaw, dosageRaw, durationRaw, tabletRaw,
    easyDrugInfo,
  ] = await Promise.all([
    useCode
      ? sb.from("dur_prohibition").select("*").in("ingr_code", ingrCodes).limit(500)
      : sb.from("dur_prohibition").select("*").in("ingr_kor_name", korNames).limit(500),
    useCode
      ? sb.from("dur_prohibition").select("*").in("mixture_ingr_code", ingrCodes).limit(500)
      : sb.from("dur_prohibition").select("*").in("mixture_ingr_kor_name", korNames).limit(500),
    sb.from("dur_pregnancy").select("*").in("ingr_kor_name", korNames).limit(1),
    sb.from("dur_elderly_caution").select("id, ingr_name, class_name, note").in("ingr_name", korNames).limit(100),
    sb.from("dur_age_restriction").select("id, ingr_name, prohbt_content").in("ingr_name", korNames).limit(100),
    sb.from("dur_dosage_caution").select("id, ingr_name, class_name, note").in("ingr_name", korNames).limit(100),
    sb.from("dur_duration_caution").select("id, ingr_name, class_name, note").in("ingr_name", korNames).limit(100),
    sb.from("dur_tablet_split_caution").select("id, ingr_name, class_name, note").in("ingr_name", korNames).limit(100),
    fetchEasyDrugInfo(drug),
  ]);

  // 병용금기 양방향 병합 (mixture_ingr_kor_name 기준 중복 제거)
  const seenMixture = new Set<string>();
  const prohibitions: DurProhibition[] = [];

  for (const row of prohibA.data ?? []) {
    const key = row.mixture_ingr_kor_name as string;
    if (!seenMixture.has(key)) {
      seenMixture.add(key);
      prohibitions.push(toProhibition(row));
    }
  }
  for (const row of prohibB.data ?? []) {
    const key = row.ingr_kor_name as string;
    if (!seenMixture.has(key)) {
      seenMixture.add(key);
      prohibitions.push(
        toProhibition({
          ...row,
          ingr_kor_name:         row.mixture_ingr_kor_name,
          mixture_ingr_kor_name: row.ingr_kor_name,
          mixture_item_name:     row.item_name,
        })
      );
    }
  }

  // 추가 경고 중복 제거 헬퍼 (class_name 기준)
  function dedupeByClass<T extends { id: number; ingrName: string; className?: string; note?: string }>(
    rows: Record<string, unknown>[]
  ): T[] {
    const seen = new Set<string>();
    return (rows ?? [])
      .filter((r) => {
        const key = (r.class_name as string) ?? "__none__";
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => ({
        id: r.id as number,
        ingrName: r.ingr_name as string,
        className: r.class_name as string | undefined,
        note: cleanText(r.note as string | null) ?? undefined,
      })) as T[];
  }

  // 특정연령대금기 중복 제거 (prohbt_content 기준) + 더미값 제거
  const seenAge = new Set<string>();
  const ageRestrictions: DurAgeRestriction[] = (ageRaw.data ?? [])
    .filter((r) => {
      const cleaned = cleanText(r.prohbt_content as string | null);
      if (!cleaned) return false;  // "-", "_" 등 더미값 제거
      const key = cleaned;
      if (seenAge.has(key)) return false;
      seenAge.add(key);
      return true;
    })
    .map((r) => ({
      id: r.id as number,
      ingrName: r.ingr_name as string,
      prohbtContent: cleanText(r.prohbt_content as string | null) ?? undefined,
    }));

  return {
    drug: { ...drug, ingrKorName: korNames[0] ?? drug.ingrKorName },
    prohibitions,
    pregnancyWarning: (() => {
      const row = pregnancyRes.data?.[0];
      if (!row) return null;
      const p = toPregnancy(row as Record<string, unknown>);
      // "-" 같은 더미값이면 null 처리
      if (!p.prohbtContent || p.prohbtContent.trim().length < 2) return null;
      return p;
    })(),
    elderlyCautions:    dedupeByClass<DurElderlyCaution>(elderlyRaw.data ?? []),
    ageRestrictions,
    dosageCautions:     dedupeByClass<DurDosageCaution>(dosageRaw.data ?? []),
    durationCautions:   dedupeByClass<DurDurationCaution>(durationRaw.data ?? []),
    tabletSplitCautions: dedupeByClass<DurTabletSplitCaution>(tabletRaw.data ?? []),
    easyDrugInfo,
  };
}

// ── 병용 비교 (2~5개) ────────────────────────────────────────
async function queryMulti(drugs: SelectedDrug[]): Promise<MultiDrugResult> {
  // 다성분 약 대응: 약별로 한글 성분명 + 성분코드 전체 확보
  const resolvedPerDrug = await Promise.all(drugs.map(resolveIngredients));
  const allKorNamesPerDrug = resolvedPerDrug.map((r) => r.korNames);
  const allIngrCodesPerDrug = resolvedPerDrug.map((r) => r.ingrCodes);

  const drugsWithKor: SelectedDrug[] = drugs.map((d, i) => ({
    ...d,
    ingrKorName: allKorNamesPerDrug[i][0] ?? d.ingrKorName,
  }));

  // ── 효능군 + 허가정보 레이블 fetch를 최대한 일찍 시작 ────────────────
  // dangerPairs 루프와 병렬로 실행되어 총 응답 시간 단축
  const efficacyGroupsPromise = Promise.all(
    allKorNamesPerDrug.map((names) => getEfficacyGroupsForNames(names))
  );
  const labelsPromise = Promise.all(
    drugs.map((d) => fetchProductLabel(d.itemSeq))
  );

  // ── 병용금기 쌍 체크 ─────────────────────────────────────────
  // 양쪽 모두 성분코드가 있으면 코드 기반 쿼리 (명칭 표기 차이 무시)
  // 어느 한쪽이라도 코드 없으면 이름 기반 폴백
  const dangerPairs: MultiDrugResult["dangerPairs"] = [];

  for (let i = 0; i < drugsWithKor.length; i++) {
    for (let j = i + 1; j < drugsWithKor.length; j++) {
      const namesA = allKorNamesPerDrug[i];
      const namesB = allKorNamesPerDrug[j];
      const codesA = allIngrCodesPerDrug[i];
      const codesB = allIngrCodesPerDrug[j];

      const hasA = codesA.length > 0 || namesA.length > 0;
      const hasB = codesB.length > 0 || namesB.length > 0;
      if (!hasA || !hasB) continue;

      const useCode = codesA.length > 0 && codesB.length > 0;

      const sb = getSupabase();
      const [fwd, rev] = await Promise.all([
        useCode
          ? sb.from("dur_prohibition").select("*")
              .in("ingr_code", codesA).in("mixture_ingr_code", codesB).limit(1)
          : sb.from("dur_prohibition").select("*")
              .in("ingr_kor_name", namesA).in("mixture_ingr_kor_name", namesB).limit(1),
        useCode
          ? sb.from("dur_prohibition").select("*")
              .in("ingr_code", codesB).in("mixture_ingr_code", codesA).limit(1)
          : sb.from("dur_prohibition").select("*")
              .in("ingr_kor_name", namesB).in("mixture_ingr_kor_name", namesA).limit(1),
      ]);

      const found = fwd.data?.[0] ?? rev.data?.[0];
      if (found) {
        dangerPairs.push({
          drugA: drugsWithKor[i],
          drugB: drugsWithKor[j],
          prohibition: toProhibition(found as Record<string, unknown>),
        });
      }
    }
  }

  // ── 효능군중복 체크 + 허가정보 레이블 결과 수집 ─────────────────────
  // (두 Promise는 이미 dangerPairs 루프 전에 시작됨 → 대기 시간 최소화)
  const [efficacyGroupsPerDrug, labelsPerDrug] = await Promise.all([
    efficacyGroupsPromise,
    labelsPromise,
  ]);

  const efficacyDuplicates: EfficacyDuplicationPair[] = [];
  for (let i = 0; i < drugsWithKor.length; i++) {
    for (let j = i + 1; j < drugsWithKor.length; j++) {
      const groupsA = new Set(efficacyGroupsPerDrug[i]);
      const common = efficacyGroupsPerDrug[j].filter((g) => groupsA.has(g));
      if (common.length > 0) {
        efficacyDuplicates.push({
          drugA: drugsWithKor[i],
          drugB: drugsWithKor[j],
          sersNames: common,
        });
      }
    }
  }

  // ── 성분 교집합 체크 ─────────────────────────────────────────
  const ingredientOverlaps: IngredientOverlapPair[] = [];
  const parsedIngredients = drugsWithKor.map((d) => parseIngredients(d.itemIngrName));

  // 정규화된 성분명 → 한글 표시명 맵 (단일성분 약의 경우 한글 이름 사용)
  const ingrDisplayMap = new Map<string, string>();
  for (const drug of drugsWithKor) {
    const parsed = parseIngredients(drug.itemIngrName);
    if (parsed.length !== 1) continue; // 단일 성분만 매핑
    const korName = drug.ingrKorName
      ?? drug.itemName.match(/\(([가-힣·\s]+)\)/)?.[1]?.trim();
    if (korName) ingrDisplayMap.set(parsed[0], korName);
  }

  for (let i = 0; i < drugsWithKor.length; i++) {
    for (let j = i + 1; j < drugsWithKor.length; j++) {
      const setA = new Set(parsedIngredients[i]);
      const overlap = parsedIngredients[j].filter((ing) => setA.has(ing));
      const meaningful = overlap.filter((s) => s.length > 2);
      if (meaningful.length > 0) {
        // 한글 표시명이 있으면 우선 사용, 없으면 원문 유지
        const display = meaningful.map((s) => ingrDisplayMap.get(s) ?? s);
        ingredientOverlaps.push({
          drugA: drugsWithKor[i],
          drugB: drugsWithKor[j],
          overlappingIngredients: display,
        });
      }
    }
  }

  // ── 허가정보 레이블 기반 상호작용 크로스매칭 ────────────────────────
  // NB_DOC_DATA ARTICLE(복용하지 말 것 / 신중히 투여 / 상호작용)에서
  // 상대 약의 성분명 또는 효능군명을 찾아 LabelWarning 생성
  const labelSectionsPerDrug = labelsPerDrug.map((xml) =>
    xml ? parseLabelSections(xml) : []
  );

  const SEVERITY_ORDER = ["prohibited", "avoid", "consult", "caution"] as const;
  // 쌍별 가장 심각한 경고 1건만 유지 (pair key = 두 itemSeq 정렬 후 "|" 연결)
  const labelWarnMap = new Map<string, LabelWarning>();

  for (let i = 0; i < drugsWithKor.length; i++) {
    for (let j = i + 1; j < drugsWithKor.length; j++) {
      // DUR 병용금기로 이미 발견된 쌍은 skip (중복 방지)
      const alreadyInDangerPairs = dangerPairs.some(
        (p) =>
          (p.drugA.itemSeq === drugsWithKor[i].itemSeq && p.drugB.itemSeq === drugsWithKor[j].itemSeq) ||
          (p.drugA.itemSeq === drugsWithKor[j].itemSeq && p.drugB.itemSeq === drugsWithKor[i].itemSeq)
      );
      if (alreadyInDangerPairs) continue;

      const mapKey = [drugsWithKor[i].itemSeq, drugsWithKor[j].itemSeq].sort().join("|");

      // srcIdx 약의 레이블에서 tgt 약의 이름/효능군을 탐색
      const tryCross = (srcIdx: number, tgtIdx: number) => {
        const tgtNames   = allKorNamesPerDrug[tgtIdx];
        const tgtSerNames = efficacyGroupsPerDrug[tgtIdx];

        for (const sec of labelSectionsPerDrug[srcIdx]) {
          const matches = findMatchesInSection(sec.text, tgtNames, tgtSerNames);
          if (matches.length === 0) continue;

          const warn: LabelWarning = {
            severity:     sec.severity,
            articleTitle: sec.title,
            matchedNames: matches,
            briefReason:  findBriefReason(sec.text, matches),
            rawText:      sec.text.slice(0, 600),
            drugA:        drugsWithKor[srcIdx],
            drugB:        drugsWithKor[tgtIdx],
          };

          // 같은 쌍에 대해 더 심각한 경고가 있으면 교체
          const existing = labelWarnMap.get(mapKey);
          if (
            !existing ||
            SEVERITY_ORDER.indexOf(warn.severity) < SEVERITY_ORDER.indexOf(existing.severity)
          ) {
            labelWarnMap.set(mapKey, warn);
          }
          break; // 첫 번째 매칭 섹션만 사용
        }
      };

      tryCross(i, j); // A의 레이블에서 B 검색
      tryCross(j, i); // B의 레이블에서 A 검색
    }
  }

  const labelWarnings = [...labelWarnMap.values()];

  const isSafe =
    dangerPairs.length === 0 &&
    efficacyDuplicates.length === 0 &&
    ingredientOverlaps.length === 0 &&
    labelWarnings.length === 0;

  return {
    drugs: drugsWithKor,
    dangerPairs,
    efficacyDuplicates,
    ingredientOverlaps,
    labelWarnings,
    isSafe,
  };
}

// ── Route Handler ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, drugs } = body as { mode: "single" | "multi"; drugs: SelectedDrug[] };

    if (!drugs || drugs.length === 0) {
      return NextResponse.json({ error: "drugs is required" }, { status: 400 });
    }

    if (mode === "single") {
      const result = await querySingle(drugs[0]);
      return NextResponse.json(result);
    }

    if (mode === "multi") {
      if (drugs.length < 2) {
        return NextResponse.json({ error: "at least 2 drugs required" }, { status: 400 });
      }
      const result = await queryMulti(drugs);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "mode must be single or multi" }, { status: 400 });
  } catch (err) {
    console.error("[/api/interaction]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// GET는 더 이상 사용하지 않음
export async function GET() {
  return NextResponse.json({ error: "POST /api/interaction을 사용하세요" }, { status: 405 });
}
