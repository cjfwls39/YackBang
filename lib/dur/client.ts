/**
 * 식약처 공공데이터 API 클라이언트
 *
 * ⚠️  NOTE: 이 파일의 searchDrugs / getInteraction 함수는 레거시입니다.
 *    실제 검색은 /app/api/drugs/route.ts 에서 직접 fetch로 처리합니다.
 *    DUR 조회는 Supabase 연동 후 /app/api/interaction/route.ts에서 처리 예정.
 */

import type { DrugSearchResult, DurApiResponse, DrugPermitItem } from "@/types/drug";

const BASE_URL = "https://apis.data.go.kr/1471000";

function buildParams(extra: Record<string, string | number> = {}): string {
  const key = process.env.DUR_API_KEY ?? "";
  const base = { serviceKey: key, type: "json", numOfRows: 20, pageNo: 1 };
  const merged = { ...base, ...extra };
  return Object.entries(merged)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

/** 의약품 허가정보 API — 제품명으로 검색 */
export async function searchDrugsByName(
  query: string,
  numOfRows = 15
): Promise<DrugSearchResult[]> {
  const params = buildParams({ item_name: query, numOfRows });
  const res = await fetch(
    `${BASE_URL}/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnInq07?${params}`,
    { next: { revalidate: 60 } }
  );
  const json: DurApiResponse<DrugPermitItem> = await res.json();
  const items = json?.body?.items ?? [];

  return items
    .filter((p) => p.CANCEL_NAME === "정상" || !p.CANCEL_NAME)
    .map((p) => ({
      itemSeq:      p.ITEM_SEQ,
      itemName:     p.ITEM_NAME,
      entpName:     p.ENTP_NAME ?? "",
      itemIngrName: p.ITEM_INGR_NAME ?? "",
      boxImageUrl:  p.BIG_PRDT_IMG_URL || undefined,
      spcltPblc:    p.SPCLTY_PBLC ?? "",
      productType:  p.PRDUCT_TYPE ?? "",
    }));
}
