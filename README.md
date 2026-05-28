# 약방 (YackBang)

> 의약품 병용금기 정보를 일반 사용자에게 쉬운 말로 전달하는 서비스

약을 두 가지 이상 복용할 때 "같이 먹어도 되나?" 라는 의문을 빠르게 해결합니다.  
식품의약품안전처 공식 DUR 데이터를 기반으로, 전문용어 없이 누구나 이해할 수 있는 결과를 제공합니다.

---

## 주요 기능

### 단일 약 조회
- 병용금기 목록 — 해당 약과 함께 복용하면 안 되는 약 전체
- 임부금기 / 노인주의 / 연령대금기 / 용량주의 / 투여기간주의 / 서방정분할주의
- e약은요 복약 안내 (효능·용법·부작용·상호작용)

### 병용 비교 조회 (2~5개)
4단계 경고 체계로 빠짐없이 탐지:

| 단계 | 설명 | 데이터 소스 |
|---|---|---|
| 🚫 DUR 병용금기 | 식약처가 공식 지정한 병용 불가 쌍 | Supabase `dur_prohibition` |
| 🔄 효능군 중복 | 같은 계열 약 중복 복용 경고 | Supabase `dur_efficacy_duplication` |
| ⚠️ 성분 교집합 | 두 약에 동일 성분이 포함된 경우 | 성분명 실시간 파싱 |
| 📋 허가정보 레이블 | DUR 미등재 상호작용을 허가정보 원문(NB_DOC_DATA)에서 탐지 | 식약처 허가정보 API |

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router) + TypeScript |
| 스타일 | Tailwind CSS v4 + shadcn/ui |
| 데이터베이스 | Supabase (PostgreSQL) + pg_trgm |
| 외부 API | 식약처 공공데이터 API (data.go.kr) |
| 배포 | Vercel |

---

## 아키텍처

```
[클라이언트]
    │
    ├─ 약품 검색 (타이핑)
    │    └─ GET /api/drugs?q=타이레놀
    │         └─ Supabase drug_products
    │              └─ ilike + pg_trgm 인덱스 → 50~150ms
    │
    └─ 병용 조회 (버튼 클릭)
         └─ POST /api/interaction { mode, drugs[] }
              ├─ resolveIngredients() — 한글 성분명·성분코드 확보
              │   (괄호 추출 → 인라인 영문매핑 → DB 역조회 순)
              ├─ Supabase 병렬 쿼리 (DUR 테이블 최대 8개)
              ├─ 효능군중복 / 성분교집합 계산
              └─ 허가정보 NB_DOC_DATA 파싱 (DUR 미등재 보완)
                   ├─ ARTICLE 제목 → 심각도 분류 (prohibited/avoid/consult/caution)
                   ├─ 3단계 매칭 (직접 포함 → 효능군 → 역방향 stem)
                   └─ briefReason 자동 추출 (원문 탐색 → 룩업 테이블 폴백)
```

---

## DB 스키마

총 10개 테이블 (Supabase PostgreSQL)

| 테이블 | 용도 | 동기화 방식 |
|---|---|---|
| `drug_products` | 약품 기본정보 + 이미지 (검색용) | upsert |
| `dur_prohibition` | 병용금기 | truncate → insert |
| `dur_pregnancy` | 임부금기 | truncate → insert |
| `ingr_mapping` | 영문↔한글 성분명 매핑 | 수동 |
| `dur_efficacy_duplication` | 효능군중복 | truncate → insert |
| `dur_elderly_caution` | 노인주의 | truncate → insert |
| `dur_age_restriction` | 특정연령대금기 | truncate → insert |
| `dur_dosage_caution` | 용량주의 | truncate → insert |
| `dur_duration_caution` | 투여기간주의 | truncate → insert |
| `dur_tablet_split_caution` | 서방정분할주의 | truncate → insert |

전체 DDL: [`supabase/schema.sql`](./supabase/schema.sql)

---

## 파일 구조

```
yack_bang/
├── app/
│   ├── api/
│   │   ├── drugs/route.ts          # 약품 검색 API (Supabase drug_products)
│   │   └── interaction/route.ts    # 병용금기 조회 API (Supabase + 허가정보 API)
│   ├── globals.css                 # CSS 변수 (디자인 토큰)
│   └── page.tsx                    # 메인 페이지
├── components/
│   ├── search/
│   │   ├── SearchInput.tsx         # 검색창 + 드롭다운 (portal)
│   │   ├── DrugChip.tsx            # 선택 약 칩
│   │   └── DrugPanel.tsx           # 검색 패널 전체
│   ├── result/
│   │   ├── ResultPanel.tsx         # 결과 표시 (단일/병용 모드)
│   │   ├── DrugInfoCard.tsx        # 약품 기본정보 카드
│   │   └── InteractionCard.tsx     # 병용금기 카드
│   ├── layout/Header.tsx
│   └── common/Disclaimer.tsx
├── lib/
│   └── supabase/server.ts          # Supabase 클라이언트 (지연 초기화)
├── scripts/
│   ├── sync-all.ts                 # 전체 DB 동기화 (9개 테이블 일괄)
│   └── sync-drugs.ts               # drug_products 단독 동기화
├── supabase/
│   └── schema.sql                  # 전체 테이블 DDL + 인덱스
├── types/
│   └── drug.ts                     # TypeScript 타입 정의 전체
└── docs/
    ├── PRD.md                      # 기획 문서
    └── API.md                      # 식약처 API 실물 테스트 메모
```

---

## 환경변수

`.env.local` 파일 생성 후 입력:

```env
# 식약처 공공데이터 API 키 (https://www.data.go.kr 발급)
DUR_API_KEY=your_api_key_here

# Supabase (프로젝트 > Settings > API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

---

## 시작하기

### 1. 의존성 설치
```bash
npm install
```

### 2. Supabase 테이블 생성
Supabase 대시보드 → SQL Editor에서 [`supabase/schema.sql`](./supabase/schema.sql) 전체 실행

### 3. 초기 데이터 동기화 (최초 1회, 약 10~20분)
```bash
node --env-file=.env.local --experimental-strip-types scripts/sync-all.ts
```

### 4. 개발 서버 실행
```bash
npm run dev
```

---

## 데이터 동기화

식약처 데이터는 주기적으로 최신화가 필요합니다.

```bash
node --env-file=.env.local --experimental-strip-types scripts/sync-all.ts
```

| 대상 | 권장 주기 | 비고 |
|---|---|---|
| `drug_products` | 월 1회 | 신규 허가 약 반영 |
| DUR 8개 테이블 | 분기 1회 | DUR 고시 개정 반영 |

---

## 주요 설계 결정

**약품 검색 속도**
- 기존: 식약처 외부 API 2개 실시간 호출 → 500ms~1.5s
- 현재: Supabase `drug_products` + pg_trgm 인덱스 → 50~150ms
- `sync-all.ts`로 정기 동기화해 외부 API 의존성 제거

**성분 해석 파이프라인**
약품명 괄호 추출 → 인라인 영문↔한글 매핑(130개) → DB 역조회 순으로 한글 성분명 확보.  
성분코드 기반 병용금기 조회로 "이트라코나졸" vs "이트라코나졸제피과립" 같은 표기 차이 해결.

**허가정보 레이블 탐지**
DUR DB에 없는 상호작용을 허가정보 NB_DOC_DATA XML에서 보완 탐지.  
3단계 매칭(직접 포함 → 효능군 → 역방향 stem)으로 "바르비탈계 약물" → "페노바르비탈" 매칭.

**병렬 처리**
효능군 조회와 허가정보 레이블 fetch를 병용금기 루프와 동시 시작해 응답 시간 단축.  
식약처 API 응답은 `next: { revalidate: 86400 }` (24h) Next.js 캐시 적용.

---

## 데이터 출처

모든 데이터는 [식품의약품안전처 공공데이터포털](https://www.data.go.kr)에서 제공합니다.

| API 서비스 | 엔드포인트 | 용도 |
|---|---|---|
| `DrugPrdtPrmsnInfoService07` | `getDrugPrdtPrmsnInq07` | 약품 허가정보 검색 |
| `DrugPrdtPrmsnInfoService07` | `getDrugPrdtPrmsnDtlInq06` | 허가정보 상세 (NB_DOC_DATA) |
| `MdcinGrnIdntfcInfoService03` | `getMdcinGrnIdntfcInfoList03` | 낱알 이미지 |
| `DURPrdlstInfoService03` | `getUsjntTabooInfoList03` | 병용금기 |
| `DURPrdlstInfoService03` | `getPwnmTabooInfoList03` | 임부금기 |
| `DURPrdlstInfoService03` | `getEfcyDplctInfoList03` | 효능군중복 |
| `DURPrdlstInfoService03` | `getOdsnAtentInfoList03` | 노인주의 |
| `DURPrdlstInfoService03` | `getSpcifyAgrdeTabooInfoList03` | 특정연령대금기 |
| `DURPrdlstInfoService03` | `getCpctyAtentInfoList03` | 용량주의 |
| `DURPrdlstInfoService03` | `getMdctnPdAtentInfoList03` | 투여기간주의 |
| `DURPrdlstInfoService03` | `getSeobangjeongPartitnAtentInfoList03` | 서방정분할주의 |
| `DrbEasyDrugInfoService` | `getDrbEasyDrugList` | e약은요 복약 안내 |

---

## 면책조항

이 서비스는 **참고용 정보 제공**이 목적이며, 실제 복약 전에는 반드시 의사 또는 약사와 상담하세요.  
YackBang은 의료 서비스가 아니며, 제공된 정보에 대한 의학적 책임을 지지 않습니다.
