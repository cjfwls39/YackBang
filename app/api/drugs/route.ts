import { NextRequest, NextResponse } from "next/server";
import type { DrugSearchResult, DrugPermitItem, DrugGrainItem, DurApiResponse } from "@/types/drug";

const BASE = "https://apis.data.go.kr/1471000";
const KEY  = process.env.DUR_API_KEY ?? "";

/**
 * GET /api/drugs?q={검색어}
 * 식약처 허가정보 API + 낱알이미지 API를 병렬 호출 후 ITEM_SEQ로 병합
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 1) {
    return NextResponse.json([], { status: 200 });
  }

  if (!KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const encoded = encodeURIComponent(q);
  const common  = `serviceKey=${KEY}&type=json&numOfRows=15&pageNo=1`;

  try {
    // 허가정보 + 낱알이미지 병렬 호출
    const [permitRes, grainRes] = await Promise.all([
      fetch(`${BASE}/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnInq07?${common}&item_name=${encoded}`),
      fetch(`${BASE}/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03?${common}&item_name=${encoded}`),
    ]);

    const [permitJson, grainJson] = await Promise.all([
      permitRes.json() as Promise<DurApiResponse<DrugPermitItem>>,
      grainRes.json()  as Promise<DurApiResponse<DrugGrainItem>>,
    ]);

    const permits: DrugPermitItem[] = permitJson?.body?.items ?? [];
    const grains:  DrugGrainItem[]  = grainJson?.body?.items  ?? [];

    // 낱알이미지를 ITEM_SEQ 기준으로 Map화
    const grainMap = new Map<string, DrugGrainItem>();
    for (const g of grains) grainMap.set(g.ITEM_SEQ, g);

    // 허가 취소된 약품 제외 + 병합
    const results: DrugSearchResult[] = permits
      .filter((p) => p.CANCEL_NAME === "정상" || !p.CANCEL_NAME)
      .map((p) => {
        const grain = grainMap.get(p.ITEM_SEQ);
        return {
          itemSeq:     p.ITEM_SEQ,
          itemName:    p.ITEM_NAME,
          entpName:    p.ENTP_NAME ?? "",
          itemIngrName: p.ITEM_INGR_NAME ?? "",
          // 영문 → 한글 성분명 변환은 추후 처리
          ingrKorName: undefined,
          boxImageUrl:  p.BIG_PRDT_IMG_URL || grain?.ITEM_IMAGE || undefined,
          pillImageUrl: grain?.ITEM_IMAGE || undefined,
          spcltPblc:    p.SPCLTY_PBLC ?? "",
          productType:  p.PRDUCT_TYPE ?? "",
        };
      });

    return NextResponse.json(results, {
      status: 200,
      headers: {
        // 검색 결과는 짧게 캐시 (1분)
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[/api/drugs] error:", err);
    return NextResponse.json({ error: "외부 API 호출 실패" }, { status: 502 });
  }
}
