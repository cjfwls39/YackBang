import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import type {
  SelectedDrug,
  SingleDrugResult,
  MultiDrugResult,
  DurProhibition,
  DurPregnancy,
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
  return content; // 매핑 없으면 원문 그대로
}

// ── 영문 성분명 → 한글 성분명 변환 ──────────────────────────────
async function resolveKorName(drug: SelectedDrug): Promise<string | null> {
  // 이미 한글명이 있으면 그대로 사용
  if (drug.ingrKorName) return drug.ingrKorName;

  // 약품명에서 괄호 안 한글 추출 시도 (예: "타이레놀정(아세트아미노펜)")
  const fromName = drug.itemName.match(/\(([가-힣·\s]+)\)/)?.[1];
  if (fromName) return fromName;

  // ingr_mapping 테이블에서 영문 → 한글 조회
  if (drug.itemIngrName) {
    const { data } = await getSupabase()
      .from("ingr_mapping")
      .select("ingr_kor_name")
      .eq("ingr_eng_name", drug.itemIngrName.toLowerCase().trim())
      .maybeSingle();
    if (data?.ingr_kor_name) return data.ingr_kor_name;
  }

  return null;
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
    prohbtContent:        row.prohbt_content as string,
    prohbtContentPlain:   toPlainText(row.prohbt_content as string),
    notificationDate:     row.notification_date as string | undefined,
  };
}

function toPregnancy(row: Record<string, unknown>): DurPregnancy {
  const content = row.prohbt_content as string;
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

// ── 단일 약 조회 ─────────────────────────────────────────────
async function querySingle(drug: SelectedDrug): Promise<SingleDrugResult> {
  const korName = await resolveKorName(drug);

  if (!korName) {
    return { drug, prohibitions: [], pregnancyWarning: null };
  }

  // 병용금기: 이 성분이 A 또는 B 어느 쪽에 있어도 조회
  // LIMIT: 각 방향 최대 200건 — 성분당 보통 수십 개의 서로 다른 mixture만 존재
  const sb = getSupabase();
  const [prohibA, prohibB, pregnancy] = await Promise.all([
    sb.from("dur_prohibition").select("*").eq("ingr_kor_name", korName).limit(200),
    sb.from("dur_prohibition").select("*").eq("mixture_ingr_kor_name", korName).limit(200),
    sb.from("dur_pregnancy").select("*").eq("ingr_kor_name", korName).maybeSingle(),
  ]);

  // A쪽 결과를 기준으로 사용, B쪽은 A/B 뒤집어서 병합 (중복 제거)
  const seenMixture = new Set<string>();
  const prohibitions: DurProhibition[] = [];

  for (const row of prohibA.data ?? []) {
    const key = row.mixture_ingr_kor_name;
    if (!seenMixture.has(key)) {
      seenMixture.add(key);
      prohibitions.push(toProhibition(row));
    }
  }
  for (const row of prohibB.data ?? []) {
    // mixture_ingr_kor_name과 ingr_kor_name을 뒤집어 추가
    const key = row.ingr_kor_name;
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

  return {
    drug: { ...drug, ingrKorName: korName },
    prohibitions,
    pregnancyWarning: pregnancy.data ? toPregnancy(pregnancy.data) : null,
  };
}

// ── 병용 비교 (2~5개) ────────────────────────────────────────
async function queryMulti(drugs: SelectedDrug[]): Promise<MultiDrugResult> {
  // 모든 약의 한글 성분명 먼저 확보
  const korNames = await Promise.all(drugs.map(resolveKorName));
  const drugsWithKor: SelectedDrug[] = drugs.map((d, i) => ({
    ...d,
    ingrKorName: korNames[i] ?? d.ingrKorName,
  }));

  const dangerPairs: MultiDrugResult["dangerPairs"] = [];

  // 모든 약 쌍 조합 확인
  for (let i = 0; i < drugsWithKor.length; i++) {
    for (let j = i + 1; j < drugsWithKor.length; j++) {
      const a = drugsWithKor[i];
      const b = drugsWithKor[j];
      if (!a.ingrKorName || !b.ingrKorName) continue;

      const { data } = await getSupabase()
        .from("dur_prohibition")
        .select("*")
        .eq("ingr_kor_name", a.ingrKorName)
        .eq("mixture_ingr_kor_name", b.ingrKorName)
        .maybeSingle();

      if (data) {
        dangerPairs.push({ drugA: a, drugB: b, prohibition: toProhibition(data) });
      } else {
        // 반대 방향도 체크
        const { data: rev } = await getSupabase()
          .from("dur_prohibition")
          .select("*")
          .eq("ingr_kor_name", b.ingrKorName)
          .eq("mixture_ingr_kor_name", a.ingrKorName)
          .maybeSingle();
        if (rev) {
          dangerPairs.push({ drugA: a, drugB: b, prohibition: toProhibition(rev) });
        }
      }
    }
  }

  return { drugs: drugsWithKor, dangerPairs, isSafe: dangerPairs.length === 0 };
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
