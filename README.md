# YackBang (약방)

> 약방의 감초처럼, 꼭 필요한 순간에 찾게 되는 의약품 병용 정보 서비스

약을 함께 먹어도 되는지, **전문용어 없이 쉽게** 확인할 수 있는 서비스입니다.  
식품의약품안전처 공식 DUR 데이터(811,620건)를 기반으로 제공합니다.

---

## Features

- **약품 검색 + 자동완성** — 제품명·성분명 부분 검색, 낱알 이미지 썸네일 표시
- **단일 조회** — 약 1개 선택 시 해당 성분의 전체 병용금기 목록 및 임부금기 여부 표시
- **병용 비교** — 약 2~5개 선택 시 모든 조합의 금기 쌍 자동 탐색
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
            ├─ 약품명 괄호에서 한글 성분명 추출
            │   예: "심바로틴정20밀리그램(심바스타틴)" → "심바스타틴"
            ├─ Supabase 쿼리
            │   SELECT * FROM dur_prohibition WHERE ingr_kor_name = '심바스타틴'
            └─ 전문용어 → 쉬운 한국어 변환 (규칙 기반 매핑)
```

---

## Data

| 테이블 | 건수 | 설명 |
|---|---|---|
| `dur_prohibition` | 811,620건 | 병용금기 (성분 쌍 × 대상 제품) |
| `dur_pregnancy` | 16,091건 | 임부금기 |
| `ingr_mapping` | 3건 | 영문↔한글 성분명 매핑 (보조) |

- 데이터 출처: 식약처 DUR API (`DURPrdlstInfoService03`)
- 갱신 주기: `node scripts/import-dur.mjs` 실행으로 수동 갱신

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

- **전체 데이터 선임포트** — DUR API는 텍스트 필터가 불가능해 전체 811,620건을 Supabase에 저장 후 SQL로 조회
- **성분명 추출** — 약품명 괄호 `(한글성분명)` 패턴으로 추출. 예: `심바로틴정20밀리그램(심바스타틴)` → `심바스타틴`
- **양방향 조회** — 병용금기는 A→B, B→A 모두 존재할 수 있어 양방향 쿼리 후 중복 제거
- **포털 드롭다운** — `ReactDOM.createPortal`로 `document.body`에 렌더링해 `overflow: hidden` 부모에서 잘리는 문제 해결
- **용어 변환** — 규칙 기반 매핑 테이블(25개 패턴)로 전문용어를 쉬운 말로 자동 변환, 원문 토글로 확인 가능

---

## Disclaimer

이 서비스는 **정보 제공 목적**이며, 실제 복약 전에는 반드시 의사 또는 약사와 상담하세요.  
YackBang은 의료 서비스가 아니며, 제공된 정보에 대한 의학적 책임을 지지 않습니다.
