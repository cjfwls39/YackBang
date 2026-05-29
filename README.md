# 약방 (YackBang) 💊

> **복용 중인 약이 함께 먹어도 되는지, 전문 용어 없이 쉽게 확인하세요.**

식약처 DUR(의약품 사용 재검토) 데이터를 기반으로 의약품 병용금기 정보를 일반인도 이해할 수 있는 언어로 제공하는 서비스입니다.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)

---

## 주요 기능

### 🔍 의약품 검색 & 병용금기 조회
- 약품명 자동완성 검색 (Supabase `pg_trgm` 인덱스, 50~150ms 응답)
- **단일 약 조회**: 병용금기 성분 목록, 임부금기, 노인 주의, 용량/기간 주의, 서방정 분할 금지
- **병용 비교 (2~5개)**: 병용금기 쌍, 효능군 중복, 성분 중복, 허가정보 기반 상호작용 경고

### 🔗 URL 공유 & 최근 기록
- 조회 결과를 URL로 공유 — 링크 하나로 동일한 조합 자동 조회
- 최근 조회 기록 5건 자동 저장 (localStorage), 클릭 한 번으로 재조회

### ⚠️ 실생활 위험 조합 가이드
- 한국 약국 판매량 상위 약품 기준 8가지 위험 조합 (타이레놀+음주, 감기약+수면유도제 등)
- 최근 인기 GLP-1 계열 다이어트 주사 (위고비·마운자로) 관련 4가지 주의 조합

### 📱 모바일 최적화 & PWA
- 모바일 하단 탭 내비게이션 (검색 ↔ 결과 탭 전환)
- 조회 시작 시 결과 탭 자동 전환 + 스켈레톤 로딩 UI
- PWA 지원 — 홈 화면에 추가, 앱처럼 실행 (standalone 모드)

---

## 기술 스택

| 구분 | 기술 |
|---|---|
| **프레임워크** | Next.js 16 (App Router) + React 19 + TypeScript |
| **스타일** | Tailwind CSS v4 + CSS Modules |
| **데이터베이스** | Supabase (PostgreSQL + pg_trgm 인덱스) |
| **외부 API** | 식약처 공공데이터 DUR API, e약은요 API |
| **배포** | Vercel |
| **폰트** | Noto Sans KR (Google Fonts) |

---

## 보안 아키텍처

```
요청 진입
  ↓
글로벌 회로 차단기 (분당 전체 50회 초과 → 503)
  ↓
IP별 Rate Limiting (분당 5회 초과 → 429)
  ↓
입력 검증 (배열 크기 1~5, 필드 길이 제한)
  ↓
Supabase SDK 파라미터 쿼리 (SQL 인젝션 방지)
  ↓
외부 API fetch 타임아웃 5초 + maxDuration 10초
```

- **XSS**: React 자동 이스케이프 + Content Security Policy 헤더
- **클릭재킹**: `X-Frame-Options: DENY`
- **MIME 스니핑**: `X-Content-Type-Options: nosniff`
- **레퍼러 노출**: `Referrer-Policy: strict-origin-when-cross-origin`

---

## 환경변수

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
DUR_API_KEY=your_dur_api_key   # data.go.kr 식약처 DUR API 키
```

---

## 로컬 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
# → http://localhost:3000

# 프로덕션 빌드
npm run build && npm start
```

---

## 데이터베이스 구조

Supabase에 식약처 DUR 데이터를 수집·정제해 저장합니다.

| 테이블 | 내용 |
|---|---|
| `drug_products` | 의약품 기본 정보 (품목명, 성분, 제조사, 이미지 URL) |
| `dur_prohibition` | 병용금기 성분 쌍 |
| `dur_pregnancy` | 임부금기 |
| `dur_elderly_caution` | 노인 주의 |
| `dur_age_restriction` | 특정 연령대 금기 |
| `dur_dosage_caution` | 용량 주의 |
| `dur_duration_caution` | 투여기간 주의 |
| `dur_tablet_split_caution` | 서방정 분할 금지 |
| `dur_efficacy_duplication` | 효능군 중복 |

---

## 추후 개발 예정

- [ ] **약봉투 스캔 (OCR)** — 약봉투 사진을 업로드하면 AI가 약품명을 자동 인식해 병용 체크까지 한 번에 처리 (Claude Vision API 활용 예정)
- [ ] **나의 약 보관함** — 만성질환자를 위한 상시 복용 약 저장 기능. 새 약 추가 시 "보관함과 비교" 버튼으로 즉시 병용 체크
- [ ] **Upstash Redis 분산 Rate Limiting** — 현재 인메모리 방식을 Redis 기반으로 교체해 Vercel 멀티 인스턴스 환경에서도 정확한 트래픽 제어

---

## 면책 고지

이 서비스는 **참고용 정보만 제공**합니다.
실제 복약 여부는 반드시 의사 또는 약사와 상담하시기 바랍니다.
식약처 데이터 기준이며, 최신 정보와 다를 수 있습니다.
