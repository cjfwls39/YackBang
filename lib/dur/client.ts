import axios from "axios";
import type { Drug, DrugInteraction, DurApiResponse } from "@/types/drug";

const BASE_URL = "https://apis.data.go.kr/1471000";
const API_KEY = process.env.DUR_API_KEY ?? "";

const api = axios.create({
  baseURL: BASE_URL,
  params: {
    serviceKey: API_KEY,
    type: "json",
    numOfRows: 20,
  },
});

// 의약품 이름으로 검색 (자동완성용)
export async function searchDrugs(query: string): Promise<Drug[]> {
  const { data } = await api.get<DurApiResponse<Drug>>(
    "/DURPrdlstInfoService03/getDURPrdlstInfoList03",
    { params: { itemName: query } }
  );
  return data.body?.items ?? [];
}

// 두 약품의 병용금기 여부 조회
export async function getInteraction(
  itemSeq1: string,
  itemSeq2: string
): Promise<DrugInteraction[]> {
  const { data } = await api.get<DurApiResponse<DrugInteraction>>(
    "/DURPrdlstInfoService03/getUsjntTabooInfoList03",
    { params: { itemSeq: itemSeq1 } }
  );

  const items = data.body?.items ?? [];
  // 두 번째 약품과의 금기만 필터
  return items.filter(
    (item) => item.mixSeq === itemSeq2 || item.mixItemName
  );
}
