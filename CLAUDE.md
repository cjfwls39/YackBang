@AGENTS.md

# YackBang (약방)

의약품 병용금기 정보를 일반 사용자에게 쉬운 말로 전달하는 서비스.  
기획 문서: `docs/PRD.md`

## 핵심 원칙

- 결과 표시는 항상 **전문용어 없이 쉬운 한국어**로
- 의학적 책임 없음 문구를 결과 화면에 반드시 포함
- 모바일 우선 설계

## 기술 스택

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- DuckDB (인메모리, 요청 후 폐기)
- 식약처 공공데이터 DUR API

## 환경변수

- `DUR_API_KEY` — 식약처 API 키 (data.go.kr 발급)

## 주요 경로

| 경로 | 역할 |
|---|---|
| `app/api/drugs/` | 약품 검색 API Route |
| `app/api/interaction/` | 병용금기 조회 API Route |
| `lib/dur/client.ts` | 식약처 API 클라이언트 |
| `types/drug.ts` | 타입 정의 |
| `docs/PRD.md` | 상세 기획 문서 |
