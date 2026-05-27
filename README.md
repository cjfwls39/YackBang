# YackBang (약방)

> 약방의 감초처럼, 꼭 필요한 순간에 찾게 되는 의약품 병용 정보 서비스

약을 함께 먹어도 되는지, **전문용어 없이 쉽게** 확인할 수 있는 서비스입니다.  
식품의약품안전처 공식 DUR 데이터(811,620건)를 기반으로 제공합니다.

---

## Features

- **약품 검색 + 자동완성** — 제품명·성분명 부분 검색, 낱알 이미지 썸네일 표시
- **단일 조회** — 약 1개 선택 시 병용금기·임부금기·노인주의·연령금기·용량주의·투여기간주의·서방정분할주의 통합 표시
- **병용 비교** — 약 2~5개 선택 시 병용금기 + 효능군중복 + 성분 교집합 자동 탐색
- **효능군중복 감지** — 같은 계열 약(예: 두 가지 스타틴) 동시 복용 경고
- **성분 교집합 감지** — 아세트아미노펜이 둘 다 들어간 경우 등 이중 복용 위험 알림
- **쉬운 언어 변환** — 전문용어("횡문근융해증" 등)를 누구나 이해할 수 있는 한국어로 자동 변환
- **원문 토글** — 필요 시 원문 의학 용어 확인 가능
- **PC / 모바일 듀얼 레이아웃** — 좌우 분할(PC) / 상하 분할(모바일) 반응형

---

## Tech Stack

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS v4 + shadcn/ui |
| DB | Supabase (PostgreSQL) — DUR 전체 데이터 저장 |
| 외부 API | 식약처 공공데이터 API (data.go.kr) |
| 배포 | Vercel |

---

## Architecture

```
[클라이언트]
    │
    ├─ GET /api/drugs?q=타이레놀
    │       ├─ 식약처 허가정보 API  → 제품명, 성분명, 박스 이미지
    │       └─ 식약처 낱알이미지 API → 낱알 사진
    │
    └─ POST /api/interaction { mode, drugs }
            ├─ 한글 성분명 추출 (괄호 파싱 or ingr_mapping 조회)
            ├─ Supabase 병렬 쿼리 (8개 DUR 테이블)
            │   ├─ [단일] 병용금기·임부금기·노인주의·연령금기·용량·기간·서방정
            │   └─ [병용] 병용금기 쌍 + 효능군중복 + 성분 교집합 알고리즘
            ├─ 전문용어 → 쉬운 한국어 변환 (규칙 기반 25패턴)
            └─ e약은요 API 병렬 fetch (상호작용·주의사항 보충, 24h 캐시)
```

---

## Data

| 테이블 | 건수 | 설명 |
|---|---|---|
| `dur_prohibition` | 811,620건 | 병용금기 (성분 쌍 × 대상 제품) |
| `dur_pregnancy` | 16,091건 | 임부금기 |
| `dur_efficacy_duplication` | 7,057건 | 효능군중복 (같은 계열 약 중복 복용) |
| `dur_elderly_caution` | 2,010건 | 노인주의 |
| `dur_age_restriction` | 2,670건 | 특정연령대금기 (소아 등) |
| `dur_dosage_caution` | 6,652건 | 용량주의 |
| `dur_duration_caution` | 624건 | 투여기간주의 |
| `dur_tablet_split_caution` | 2,105건 | 서방정분할주의 |
| `ingr_mapping` | ~수백건 | 영문↔한글 성분명 매핑 (보조) |

- 데이터 출처: 식약처 DUR API (`DURPrdlstInfoService03`) — 총 8개 엔드포인트
- 갱신 주기: `node scripts/import-dur.mjs` 실행으로 수동 갱신
- 성분 교집합: ITEM_INGR_NAME 파싱으로 실시간 계산 (DB 불필요)

---

## Getting Started

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.local` 파일을 생성하고 아래 값을 입력합니다.

```env
# 식약처 공공데이터 API 키 (https://www.data.go.kr)
DUR_API_KEY=발급받은_API_키

# Supabase (https://supabase.com > Settings > API)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=서비스_롤_키
```

### 3. DUR 데이터 임포트 (최초 1회)

Supabase에 아래 스키마를 먼저 적용한 뒤 임포트 스크립트를 실행합니다.

```bash
# supabase/schema.sql 을 Supabase SQL Editor에서 실행 후:
node scripts/import-dur.mjs
```

부분 실행도 가능합니다.

```bash
node scripts/import-dur.mjs prohibition   # 병용금기만
node scripts/import-dur.mjs pregnancy     # 임부금기만
node scripts/import-dur.mjs efficacy      # 효능군중복만
node scripts/import-dur.mjs elderly       # 노인주의만
node scripts/import-dur.mjs age           # 특정연령대금기만
node scripts/import-dur.mjs dosage        # 용량주의만
node scripts/import-dur.mjs duration      # 투여기간주의만
node scripts/import-dur.mjs tablet        # 서방정분할주의만
node scripts/import-dur.mjs cautions      # 노인/연령/용량/기간/서방정 묶음
node scripts/import-dur.mjs mapping       # 성분명 매핑만
```

### 4. 개발 서버 실행

```bash
npm run dev
```

---

## Project Structure

```
app/
  api/
    drugs/        # GET  — 약품 검색 (식약처 허가정보 + 낱알이미지)
    interaction/  # POST — 병용금기 조회 (Supabase)
  layout.tsx
  page.tsx

components/
  layout/         # Header
  common/         # Disclaimer
  search/         # SearchInput (포털 드롭다운), DrugChip, DrugPanel
  result/         # ResultPanel, DrugInfoCard, InteractionCard

views/
  MainView.tsx    # 전체 상태 관리 허브

lib/
  supabase/
    server.ts     # 서버 전용 Supabase 클라이언트 (지연 초기화)

scripts/
  import-dur.mjs  # DUR 전체 데이터 → Supabase 임포트

supabase/
  schema.sql      # 테이블 / 인덱스 / RLS 설정

types/
  drug.ts         # 공통 타입 정의
```

---

## Key Design Decisions

- **전체 데이터 선임포트** — DUR API는 텍스트 필터가 불가능해 전체 데이터를 Supabase에 저장 후 SQL로 조회
- **성분명 추출** — 약품명 괄호 `(한글성분명)` 패턴으로 추출. 예: `심바로틴정20밀리그램(심바스타틴)` → `심바스타틴`
- **양방향 조회** — 병용금기는 A→B, B→A 모두 존재할 수 있어 양방향 쿼리 후 중복 제거
- **포털 드롭다운** — `ReactDOM.createPortal`로 `document.body`에 렌더링해 `overflow: hidden` 부모에서 잘리는 문제 해결
- **용어 변환** — 규칙 기반 매핑 테이블(25개 패턴)로 전문용어를 쉬운 말로 자동 변환, 원문 토글로 확인 가능
- **효능군중복 감지** — 효능군중복 테이블에서 두 약의 `sers_name` 교집합을 구해 같은 계열 경고
- **성분 교집합 감지** — `ITEM_INGR_NAME` 파싱으로 한글·영문 성분명 모두 추출, 두 약의 성분 Set 교집합으로 이중 복용 탐지
- **e약은요 보충** — DUR 전문용어와 별도로, 소비자 눈높이 한국어로 쓰인 상호작용·주의사항을 e약은요 API에서 `itemSeq` 정확 매칭으로 가져옴 (24h 캐시)

---

## Disclaimer

이 서비스는 **정보 제공 목적**이며, 실제 복약 전에는 반드시 의사 또는 약사와 상담하세요.  
YackBang은 의료 서비스가 아니며, 제공된 정보에 대한 의학적 책임을 지지 않습니다.
