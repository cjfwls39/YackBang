# YackBang API 명세 (실물 테스트 기반)

> 실제 API 호출 테스트를 통해 확인된 내용만 기록한다.  
> 추측이나 문서상 내용과 다를 수 있으므로 이 파일을 우선한다.

---

## 공통 사항

- **Base URL:** `https://apis.data.go.kr/1471000/`
- **인증:** 쿼리 파라미터 `serviceKey={인코딩_키}`
- **응답 포맷:** `type=json` 지정 시 JSON, 기본값은 XML
- **일일 요청 한도:** 10,000건 (모든 API 공통)
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

## 1. 의약품 허가정보 서비스

**엔드포인트:** `DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnInq07`

### 역할

제품명으로 약품을 검색해 `ITEM_SEQ`와 성분명, 박스 이미지를 가져온다.  
사용자가 "타이레놀" 입력 시 **이 API를 가장 먼저 호출**한다.

### 핵심 파라미터

| 파라미터 | 타입 | 설명 | 주의 |
|---|---|---|---|
| `item_name` | string | 제품명 부분 검색 | ⚠️ `itemName` 아님, 언더스코어 사용 |
| `numOfRows` | number | 페이지당 결과 수 | 자동완성은 10~20 권장 |
| `pageNo` | number | 페이지 번호 | |

### 응답 주요 필드

| 필드 | 설명 | 예시 |
|---|---|---|
| `ITEM_SEQ` | 품목일련번호 (핵심 ID) | `"202106092"` |
| `ITEM_NAME` | 제품명 (박스에 적힌 이름) | `"타이레놀정500밀리그람(아세트아미노펜)"` |
| `ITEM_ENG_NAME` | 영문 제품명 | `"Tylenol Tablet 500mg"` |
| `ITEM_INGR_NAME` | 성분명 (영문) | `"Acetaminophen"` |
| `ITEM_INGR_CNT` | 성분 수 | `"1"` |
| `ENTP_NAME` | 제조사명 | `"켄뷰코리아판매유한회사"` |
| `SPCLTY_PBLC` | 전문/일반의약품 구분 | `"일반의약품"` |
| `PRDUCT_TYPE` | 약품 분류 | `"[01140]해열.진통.소염제"` |
| `BIG_PRDT_IMG_URL` | 박스 이미지 URL | nedrug.mfds.go.kr URL or `""` |
| `CANCEL_NAME` | 허가 상태 | `"정상"` (취소된 약품 필터링용) |

### 주의사항

- `BIG_PRDT_IMG_URL`이 빈 문자열(`""`)인 약품 다수 존재 → fallback 처리 필수
- `ITEM_INGR_NAME`은 **영문**으로 반환됨 → DUR 조회 시 한글 성분명으로 변환 필요
- `CANCEL_NAME !== "정상"` 인 항목은 허가 취소된 약품이므로 제외

### 호출 예시

```
GET /DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnInq07
  ?serviceKey={KEY}&type=json&numOfRows=10&item_name=타이레놀
```

---

## 2. 낱알 이미지 서비스

**엔드포인트:** `MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03`

### 역할

알약(낱알) 실물 이미지 URL과 약 모양 정보를 가져온다.  
허가정보에서 `BIG_PRDT_IMG_URL`이 없을 때 보조 이미지로 사용.

### 핵심 파라미터

| 파라미터 | 타입 | 설명 | 주의 |
|---|---|---|---|
| `item_name` | string | 제품명 부분 검색 | ⚠️ 허가정보와 동일하게 언더스코어 |
| `itemSeq` | string | 품목일련번호로 정확히 조회 | |

### 응답 주요 필드

| 필드 | 설명 | 예시 |
|---|---|---|
| `ITEM_SEQ` | 품목일련번호 (허가정보와 동일) | `"202106092"` |
| `ITEM_NAME` | 제품명 | `"타이레놀정500밀리그람(아세트아미노펜)"` |
| `ITEM_IMAGE` | 낱알 이미지 URL | `"https://nedrug.mfds.go.kr/pbp/cmn/..."` |
| `CHART` | 약 모양 텍스트 설명 | `"흰색의 장방형 필름코팅정제"` |
| `DRUG_SHAPE` | 모양 코드 | `"장방형"`, `"원형"`, `"타원형"` |
| `COLOR_CLASS1` | 색상 | `"하양"`, `"노랑"` |
| `PRINT_FRONT` | 전면 각인 | `"TYLENOL"` |
| `PRINT_BACK` | 후면 각인 | `"500"` |
| `ETC_OTC_NAME` | 전문/일반 구분 | `"일반의약품"` |

### 주의사항

- 모든 약품에 이미지가 있지 않음 (주사제, 시럽 등 낱알 없는 형태 제외)
- `ITEM_SEQ`가 허가정보와 동일해서 두 API 결과를 ITEM_SEQ로 JOIN 가능

---

## 3. DUR 병용금기 서비스

**엔드포인트:** `DURPrdlstInfoService03/getUsjntTabooInfoList03`

### 역할

두 약품의 병용금기 여부와 금기 이유를 가져온다.  
**총 811,620건** 데이터 보유.

### ⚠️ 필터링 불가 — 중요

```
텍스트 파라미터(itemName, ingrKorName 등)로 필터링이 작동하지 않는다.
파라미터를 넣어도 전체 811,620건이 그대로 반환된다.
```

→ **해결책: DUR 전체 데이터를 파일로 다운로드 후 DuckDB에 로드, 로컬 쿼리로 처리**

### 응답 주요 필드

| 필드 | 설명 | 예시 |
|---|---|---|
| `INGR_CODE` | 성분 코드 | `"D000762"` |
| `INGR_KOR_NAME` | 성분 한글명 | `"이트라코나졸"` |
| `INGR_ENG_NAME` | 성분 영문명 | `"Itraconazole"` |
| `ITEM_SEQ` | 약품 품목번호 (DUR 내부) | `"200000913"` |
| `ITEM_NAME` | 약품명 | `"코니트라캡슐(이트라코나졸)"` |
| `MIXTURE_INGR_CODE` | 병용금기 상대 성분 코드 | `"D000027"` |
| `MIXTURE_INGR_KOR_NAME` | 병용금기 상대 성분명 | `"심바스타틴"` |
| `MIXTURE_ITEM_NAME` | 병용금기 상대 약품명 | `"심바스틴정20밀리그램"` |
| `PROHBT_CONTENT` | 금기 이유 (전문용어) | `"횡문근융해증"` |
| `NOTIFICATION_DATE` | 고시일자 | `"20090303"` |

### ⚠️ ITEM_SEQ 체계 불일치

DUR 서비스의 `ITEM_SEQ`와 허가정보 서비스의 `ITEM_SEQ`는 **다른 체계**다.

- 허가정보 타이레놀정500mg: `ITEM_SEQ = 202106092`
- DUR에서 같은 약의 ITEM_SEQ: 다른 값 (직접 조회 불가)

→ **ITEM_SEQ가 아닌 INGR_CODE(성분 코드)로 매칭해야 한다**

### PROHBT_CONTENT 형태

실물 데이터 확인 결과 매우 짧고 전문적인 단어 1~2개로만 구성:

```
"횡문근융해증"
"QT 연장"
```

→ AI 변환 없이는 사용자에게 표시 불가. Claude Haiku 연동 필수.

---

## 4. DUR 임부금기 서비스

**엔드포인트:** `DURPrdlstInfoService03/getPwnmTabooInfoList03`

### 역할

특정 약품의 임부(임산부) 금기 정보를 가져온다.  
**총 16,093건** 데이터 보유.

### ⚠️ 필터링 불가

병용금기와 동일하게 텍스트 필터링 작동 안 함 → DuckDB 로컬 처리 필요.

### 응답 주요 필드

| 필드 | 설명 | 예시 |
|---|---|---|
| `INGR_CODE` | 성분 코드 | `"D000145"` |
| `INGR_NAME` | 성분 한글명 | `"아미노필린"` |
| `ITEM_SEQ` | 약품 품목번호 | `"197000102"` |
| `ITEM_NAME` | 약품명 | `"대원아미노필린정"` |
| `PROHBT_CONTENT` | 금기 이유 | `"동물실험에서 기형발생 보고 및 신생아 구토, 신경과민 가능(테오필린)."` |
| `NOTIFICATION_DATE` | 고시일자 | `"20130712"` |

### 참고

임부금기의 `PROHBT_CONTENT`는 병용금기보다 상대적으로 문장이 길고 읽기 쉬운 편.  
그래도 AI 변환을 거치는 것이 일관성 유지에 좋음.

---

## 5. 미확인 서비스

| 서비스 | 엔드포인트 | 상태 |
|---|---|---|
| DUR 성분정보 | `DURIrdntInfoService03` | 오퍼레이션명 미확인, 404 반환 |
| DUR 고령자 주의 | `DURPrdlstInfoService03/getSeniorTabooInfoList03` | 404, 미신청으로 추정 |

---

## 전체 데이터 플로우

```
사용자 입력: "타이레놀"
        ↓
[1] 허가정보 API (item_name="타이레놀")
    → ITEM_SEQ, ITEM_NAME, ITEM_INGR_NAME(영문), BIG_PRDT_IMG_URL
        ↓
[2] 낱알이미지 API (item_name="타이레놀")
    → ITEM_IMAGE (낱알 사진 URL)
        ↓
    영문 성분명 → 한글 성분명 변환
    (예: "Acetaminophen" → "아세트아미노펜")
        ↓
[3] DuckDB (로컬 DUR 전체 데이터)
    WHERE INGR_KOR_NAME = '아세트아미노펜'
    → 병용금기 목록, 임부금기 여부
        ↓
[4] Claude Haiku
    PROHBT_CONTENT 전문용어 → 쉬운 한국어 변환
        ↓
사용자에게 결과 반환
```

---

## DUR 데이터 처리 — Supabase 확정

API 실물 테스트 결과, DUR 서비스는 텍스트 필터링이 불가능하다.  
전체 데이터(811,620건)를 **Supabase(PostgreSQL)에 임포트하여 SQL로 처리**하는 방식으로 확정.

### 선택 이유

- DuckDB 파일을 Vercel 서버리스에 올리면 cold start + 용량 문제 발생
- Supabase 무료 플랜(500MB)으로 충분히 수용 가능
- PostgreSQL이므로 `LIKE`, `=` 등 텍스트 검색 인덱스 활용 가능
- Vercel과 궁합이 좋음

### 테이블 스키마

**`dur_prohibition` (병용금기)**

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `dur_seq` | TEXT | DUR 일련번호 |
| `ingr_code` | TEXT | 성분 코드 |
| `ingr_kor_name` | TEXT | 성분 한글명 ← **검색 기준** |
| `ingr_eng_name` | TEXT | 성분 영문명 |
| `item_seq` | TEXT | 약품 품목번호 |
| `item_name` | TEXT | 약품명 |
| `entp_name` | TEXT | 제조사명 |
| `mixture_ingr_code` | TEXT | 금기 상대 성분 코드 |
| `mixture_ingr_kor_name` | TEXT | 금기 상대 성분 한글명 |
| `mixture_ingr_eng_name` | TEXT | 금기 상대 성분 영문명 |
| `mixture_item_name` | TEXT | 금기 상대 약품명 |
| `prohbt_content` | TEXT | 금기 이유 (원문, 전문용어) |
| `notification_date` | TEXT | 고시일자 |

**`dur_pregnancy` (임부금기)**

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `ingr_code` | TEXT | 성분 코드 |
| `ingr_kor_name` | TEXT | 성분 한글명 ← **검색 기준** |
| `item_seq` | TEXT | 약품 품목번호 |
| `item_name` | TEXT | 약품명 |
| `prohbt_content` | TEXT | 금기 이유 (원문) |
| `notification_date` | TEXT | 고시일자 |

### 인덱스

```sql
CREATE INDEX idx_prohibition_ingr ON dur_prohibition(ingr_kor_name);
CREATE INDEX idx_pregnancy_ingr   ON dur_pregnancy(ingr_kor_name);
```

### 데이터 임포트

- 출처: data.go.kr "의약품안전사용서비스(DUR) 의약품 목록" 파일데이터
- 갱신 주기: 월 1회 수동 업데이트
