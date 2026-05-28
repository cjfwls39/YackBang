# YackBang — 식약처 API 실물 테스트 메모

> 실제 API 호출 테스트를 통해 확인된 내용만 기록한다.  
> 추측이나 공식 문서상 내용과 다를 수 있으므로 이 파일을 우선한다.

---

## 공통 사항

- **Base URL:** `https://apis.data.go.kr/1471000/`
- **인증:** 쿼리 파라미터 `serviceKey={인코딩된_키}`
- **응답 포맷:** `type=json` 지정 시 JSON, 기본값은 XML
- **일일 요청 한도:** 10,000건 (서비스 전체 합산)
- **numOfRows 권장값:** **500** (100으로 낮추면 호출 횟수가 5배 늘어 rate limit 위험)
- **응답 구조:**
  ```json
  {
    "header": { "resultCode": "00", "resultMsg": "NORMAL SERVICE." },
    "body": {
      "pageNo": 1,
      "totalCount": N,
      "numOfRows": N,
      "items": [...]
    }
  }
  ```

---

## 현재 아키텍처 요약

식약처 API는 **동기화 전용**으로만 사용한다. 사용자 요청 흐름에서는 호출하지 않는다.

```
[동기화 — scripts/sync-all.ts, 수동 실행]
  식약처 API (허가정보 + 낱알이미지 + DUR 8종)
      ↓ 전체 데이터 수신
  Supabase (PostgreSQL) 에 저장

[사용자 요청 — 런타임]
  검색: GET /api/drugs?q=타이레놀
      → Supabase drug_products (ilike + pg_trgm 인덱스, 50~150ms)

  조회: POST /api/interaction
      → Supabase DUR 테이블 병렬 쿼리
      → 허가정보 상세 API (NB_DOC_DATA, 캐시 24h)
```

---

## 1. 의약품 허가정보 서비스

**엔드포인트:** `DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnInq07`  
**용도:** `drug_products` 테이블 동기화 (sync-all.ts Phase 1)

### 핵심 파라미터

| 파라미터 | 설명 | 주의 |
|---|---|---|
| `item_name` | 제품명 부분 검색 | ⚠️ `itemName` 아님, 언더스코어 사용 |
| `numOfRows` | 페이지당 결과 수 | 최대 500 |
| `pageNo` | 페이지 번호 | |

### 응답 주요 필드

| 필드 | 설명 | 예시 |
|---|---|---|
| `ITEM_SEQ` | 품목일련번호 (PK) | `"202106092"` |
| `ITEM_NAME` | 제품명 | `"타이레놀정500밀리그람(아세트아미노펜)"` |
| `ITEM_INGR_NAME` | 성분명 **(영문)** | `"Acetaminophen"` |
| `ENTP_NAME` | 제조사명 | `"켄뷰코리아판매유한회사"` |
| `SPCLTY_PBLC` | 전문/일반의약품 구분 | `"일반의약품"` |
| `PRDUCT_TYPE` | 약품 분류 | `"[01140]해열.진통.소염제"` |
| `BIG_PRDT_IMG_URL` | 박스 이미지 URL | nedrug.mfds.go.kr URL 또는 `""` |
| `CANCEL_NAME` | 허가 상태 | `"정상"` |

### 주의사항

- `BIG_PRDT_IMG_URL`이 빈 문자열인 약품 다수 → `pill_image_url` fallback 처리
- `ITEM_INGR_NAME`은 영문 반환 → DB에 그대로 저장, 성분 매핑은 DUR 데이터 기반
- `CANCEL_NAME !== "정상"` 항목은 허가 취소 약품 → 필터링

---

## 2. 낱알 이미지 서비스

**엔드포인트:** `MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03`  
**용도:** `drug_products.pill_image_url` 컬럼 채우기 (sync-all.ts Phase 1, 선로드)

### 응답 주요 필드

| 필드 | 설명 | 예시 |
|---|---|---|
| `ITEM_SEQ` | 품목일련번호 (허가정보와 동일 체계) | `"202106092"` |
| `ITEM_IMAGE` | 낱알 이미지 URL | `"https://nedrug.mfds.go.kr/..."` |

### 주의사항

- 주사제·시럽 등 낱알 없는 형태는 이미지 없음
- 허가정보와 `ITEM_SEQ` 체계가 동일 → JOIN 가능

---

## 3. DUR 서비스 (8종)

**서비스:** `DURPrdlstInfoService03`  
**용도:** DUR 테이블 8개 동기화 (sync-all.ts Phase 2~9)

### ⚠️ 텍스트 필터링 불가

```
ingrKorName, itemName 등 텍스트 파라미터로 필터링이 작동하지 않는다.
파라미터를 넣어도 전체 데이터가 그대로 반환된다.
```

→ 전체 데이터를 Supabase에 적재한 뒤 SQL로 조회하는 방식으로 해결.

### 확인된 엔드포인트 목록

| 엔드포인트 | 테이블 | 건수 | 상태 |
|---|---|---|---|
| `getUsjntTabooInfoList03` | `dur_prohibition` | 811,620 | ✅ |
| `getPwnmTabooInfoList03` | `dur_pregnancy` | 16,091 | ✅ |
| `getEfcyDplctInfoList03` | `dur_efficacy_duplication` | 7,057 | ✅ |
| `getOdsnAtentInfoList03` | `dur_elderly_caution` | 2,010 | ✅ |
| `getSpcifyAgrdeTabooInfoList03` | `dur_age_restriction` | 2,670 | ✅ |
| `getCpctyAtentInfoList03` | `dur_dosage_caution` | 6,652 | ✅ |
| `getMdctnPdAtentInfoList03` | `dur_duration_caution` | 624 | ✅ |
| `getSeobangjeongPartitnAtentInfoList03` | `dur_tablet_split_caution` | 2,105 | ✅ |

> ⚠️ **엔드포인트 이름 주의**  
> 특정연령대금기: `getSpcifyAgrde...` (Agrp 아님)  
> 서방정분할주의: `getSeobangjeongPartitn...` (Particle 아님)  
> 오타로 인한 404가 발생했던 이력 있음.

### 병용금기 응답 주요 필드

| 필드 | 설명 | 예시 |
|---|---|---|
| `INGR_CODE` | 성분 코드 | `"D000762"` |
| `INGR_KOR_NAME` | 성분 한글명 | `"이트라코나졸"` |
| `MIXTURE_INGR_CODE` | 병용금기 상대 성분 코드 | `"D000027"` |
| `MIXTURE_INGR_KOR_NAME` | 병용금기 상대 성분명 | `"심바스타틴"` |
| `PROHBT_CONTENT` | 금기 이유 (전문용어, 1~2단어) | `"횡문근융해증"` |

### ⚠️ DUR ITEM_SEQ ≠ 허가정보 ITEM_SEQ

두 서비스의 `ITEM_SEQ`는 **다른 체계**다. 매칭 시 `INGR_CODE` (성분 코드) 기준으로 조회해야 한다.

---

## 4. 허가정보 상세 서비스 (NB_DOC_DATA)

**엔드포인트:** `DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06`  
**용도:** 런타임에 호출 — DUR 미등재 상호작용을 허가정보 XML에서 보완 탐지

- `ITEM_SEQ` 기준 조회
- `NB_DOC_DATA` 필드에 XML 형식의 허가정보 원문 포함
- 응답이 느릴 수 있어 `next: { revalidate: 86400 }` (24h) 캐시 적용

---

## 5. e약은요 복약 안내 서비스

**엔드포인트:** `DrbEasyDrugInfoService/getDrbEasyDrugList`  
**용도:** 런타임에 호출 — 단일/병용 조회 시 복약 안내 표시

---

## 동기화 스크립트 관련 메모

- **실행 명령:** `node --env-file=.env.local --experimental-strip-types scripts/sync-all.ts`
- **Supabase TRUNCATE:** `.delete().neq("id", 0)`는 대용량 테이블에서 statement timeout 발생 → `truncate_dur_table` RPC 함수로 대체
- **병용금기 totalCount:** API가 811,620을 보고하지만 `numOfRows=100`이면 rate limit으로 중간에 끊김 → **numOfRows=500** 필수
