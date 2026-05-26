# YackBang (약방)

> 약방의 감초처럼, 꼭 필요한 순간에 찾게 되는 의약품 병용 정보 서비스

약을 함께 먹어도 되는지, 전문용어 없이 쉽게 확인할 수 있는 서비스입니다.  
식품의약품안전처 공식 DUR 데이터를 기반으로 제공합니다.

## Features

- 약품 이름(제품명/성분명) 검색 + 자동완성
- 단일 약품 조회 — 기본 정보 및 병용 금기 목록
- 병용 확인 (최대 5개) — 기준 약 기준 1:1 비교
- 결과를 전문용어 없이 쉬운 한국어로 표시
- 약품 이미지 (포장 / 낱알) 함께 표시
- PC / 모바일 듀얼 레이아웃

## Tech Stack

- **Framework** — Next.js 16 (App Router)
- **Language** — TypeScript
- **Styling** — Tailwind CSS v4 + shadcn/ui
- **Data** — 식약처 DUR API + 의약품 안전나라 크롤링
- **AI** — Claude Haiku (전문용어 → 쉬운 말 변환)
- **Deploy** — Vercel

## Getting Started

```bash
npm install
npm run dev
```

`.env.local` 파일에 API 키를 설정해야 합니다.

```env
DUR_API_KEY=발급받은_API_키
```

API 키는 [공공데이터포털](https://www.data.go.kr)에서 발급받을 수 있습니다.

## Disclaimer

이 서비스는 정보 제공 목적이며, 실제 복약 전에는 반드시 의사 또는 약사와 상담하세요.  
YackBang은 의료 서비스가 아니며, 제공된 정보에 대한 의학적 책임을 지지 않습니다.
