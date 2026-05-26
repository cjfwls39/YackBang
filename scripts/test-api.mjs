import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
const apiKey = env.match(/DUR_API_KEY=(.+)/)?.[1]?.trim();
const KEY = `serviceKey=${apiKey}&type=json&numOfRows=3`;

const PRDLST = "https://apis.data.go.kr/1471000/DURPrdlstInfoService03";
const IRDNT  = "https://apis.data.go.kr/1471000/DURIrdntInfoService03";

const 아세트 = encodeURIComponent("아세트아미노펜");

async function test(label, url) {
  const res = await fetch(url);
  const json = await res.json();
  const total = json?.body?.totalCount;
  const items = json?.body?.items ?? [];
  console.log(`\n[${res.status}] ${label}  →  ${total}건`);
  if (items.length) {
    const first = items[0];
    // 핵심 필드만 출력
    console.log({
      INGR_CODE:        first.INGR_CODE,
      INGR_KOR_NAME:    first.INGR_KOR_NAME,
      ITEM_NAME:        first.ITEM_NAME,
      PROHBT_CONTENT:   first.PROHBT_CONTENT,
      MIX_INGR_NAME:    first.MIXTURE_INGR_KOR_NAME,
    });
  }
}

// DURPrdlstInfoService03 — 성분 코드 필터 시도
await test("DUR병용금기 — ingrCode=D000010",     `${PRDLST}/getUsjntTabooInfoList03?${KEY}&ingrCode=D000010`);
await test("DUR병용금기 — ingrKorName=아세트",   `${PRDLST}/getUsjntTabooInfoList03?${KEY}&ingrKorName=${아세트}`);
await test("DUR임부금기 — ingrKorName=아세트",   `${PRDLST}/getPwnmTabooInfoList03?${KEY}&ingrKorName=${아세트}`);

// DURIrdntInfoService03 — 성분정보 서비스 오퍼레이션 탐색
const ops = [
  "getUsjntTabooIngredientInfoList03",
  "getDURIrdntList03",
  "getIngredientInfoList03",
  "getUsjntTabooIrdntList03",
];
for (const op of ops) {
  const url = `${IRDNT}/${op}?${KEY}&ingrKorName=${아세트}`;
  const res = await fetch(url);
  const text = await res.text();
  const status = res.status;
  const preview = text.slice(0, 80).replace(/\n/g, " ");
  console.log(`[${status}] DURIrdnt/${op} → ${preview}`);
}
