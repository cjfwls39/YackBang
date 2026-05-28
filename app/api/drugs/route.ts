import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import type { DrugSearchResult } from "@/types/drug";

/**
 * GET /api/drugs?q={검색어}
 * Supabase drug_products 테이블에서 직접 검색 (식약처 외부 API 미사용)
 * pg_trgm 인덱스 덕에 ilike '%검색어%' 도 50~150ms 수준으로 응답
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 2) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const { data, error } = await getSupabase()
      .from("drug_products")
      .select(
        "item_seq, item_name, entp_name, item_ingr_name, spclty_pblc, prduct_type, box_image_url, pill_image_url"
      )
      .ilike("item_name", `%${q}%`)
      .or("cancel_name.eq.정상,cancel_name.is.null")
      .order("item_name")
      .limit(15);

    if (error) throw error;

    const results: DrugSearchResult[] = (data ?? []).map((row) => ({
      itemSeq:      row.item_seq,
      itemName:     row.item_name,
      entpName:     row.entp_name      ?? "",
      itemIngrName: row.item_ingr_name ?? "",
      boxImageUrl:  row.box_image_url  ?? undefined,
      pillImageUrl: row.pill_image_url ?? undefined,
      spcltPblc:    row.spclty_pblc   ?? "",
      productType:  row.prduct_type    ?? "",
    }));

    return NextResponse.json(results, {
      headers: {
        // DB 조회라 캐시를 길게 잡아도 무방 (sync 주기보다 짧게)
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[/api/drugs] error:", err);
    return NextResponse.json({ error: "검색 실패" }, { status: 500 });
  }
}
