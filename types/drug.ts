// ────────────────────────────────────────────
// 식약처 API 응답 기반 기본 타입
// ────────────────────────────────────────────

/** 허가정보 API + 낱알이미지 API를 합친 검색 결과 */
export interface DrugSearchResult {
  itemSeq: string;       // ITEM_SEQ — 품목일련번호
  itemName: string;      // ITEM_NAME — 의약품명
  entpName: string;      // ENTP_NAME — 제조사명
  itemIngrName: string;  // ITEM_INGR_NAME — 성분명 (영문)
  ingrKorName?: string;  // 성분명 한글 (매핑 후 추가)
  boxImageUrl?: string;  // BIG_PRDT_IMG_URL — 박스 이미지
  pillImageUrl?: string; // ITEM_IMAGE — 낱알 이미지
  spcltPblc?: string;    // SPCLTY_PBLC — "전문의약품" | "일반의약품"
  productType?: string;  // PRDUCT_TYPE — 약품 분류
}

/** 사용자가 선택한 약 (칩으로 표시) */
export interface SelectedDrug {
  itemSeq: string;
  itemName: string;
  entpName: string;
  itemIngrName?: string;  // 성분명 영문 (허가정보 API ITEM_INGR_NAME)
  ingrKorName?: string;   // 성분명 한글 (매핑 후)
  boxImageUrl?: string;
  pillImageUrl?: string;
  spcltPblc?: string;
}

// ────────────────────────────────────────────
// 병용금기 / 임부금기 — Supabase 쿼리 결과
// ────────────────────────────────────────────

/** dur_prohibition 테이블 row */
export interface DurProhibition {
  id: number;
  durSeq?: string;
  ingrCode: string;
  ingrKorName: string;
  ingrEngName?: string;
  itemSeq?: string;
  itemName?: string;
  entpName?: string;
  mixtureIngrCode?: string;
  mixtureIngrKorName: string;
  mixtureIngrEngName?: string;
  mixtureItemName?: string;
  prohbtContent: string;      // 원문 전문용어
  prohbtContentPlain?: string; // Claude Haiku 변환 결과
  notificationDate?: string;
}

/** dur_pregnancy 테이블 row */
export interface DurPregnancy {
  id: number;
  ingrCode: string;
  ingrKorName: string;
  itemSeq?: string;
  itemName?: string;
  prohbtContent: string;
  prohbtContentPlain?: string;
  notificationDate?: string;
}

// ────────────────────────────────────────────
// 결과 화면용 집계 타입
// ────────────────────────────────────────────

/** 단일 약 조회 결과 */
export interface SingleDrugResult {
  drug: SelectedDrug;
  prohibitions: DurProhibition[];  // 이 성분이 금기인 모든 쌍
  pregnancyWarning: DurPregnancy | null;
}

/** 다중 약 병용 조회 결과 (2–5개) */
export interface MultiDrugResult {
  drugs: SelectedDrug[];
  /** 위험 쌍 목록. [약A인덱스, 약B인덱스, 금기정보] */
  dangerPairs: Array<{
    drugA: SelectedDrug;
    drugB: SelectedDrug;
    prohibition: DurProhibition;
  }>;
  isSafe: boolean;
}

// ────────────────────────────────────────────
// 식약처 API 공통 응답 래퍼
// ────────────────────────────────────────────

export interface DurApiResponse<T> {
  header: {
    resultCode: string;
    resultMsg: string;
  };
  body: {
    items: T[];
    numOfRows: number;
    pageNo: number;
    totalCount: number;
  };
}

/** 허가정보 API 단건 */
export interface DrugPermitItem {
  ITEM_SEQ: string;
  ITEM_NAME: string;
  ITEM_ENG_NAME?: string;
  ITEM_INGR_NAME?: string;
  ITEM_INGR_CNT?: string;
  ENTP_NAME?: string;
  SPCLTY_PBLC?: string;
  PRDUCT_TYPE?: string;
  BIG_PRDT_IMG_URL?: string;
  CANCEL_NAME?: string;
}

/** 낱알이미지 API 단건 */
export interface DrugGrainItem {
  ITEM_SEQ: string;
  ITEM_NAME: string;
  ITEM_IMAGE?: string;
  CHART?: string;
  DRUG_SHAPE?: string;
  COLOR_CLASS1?: string;
  PRINT_FRONT?: string;
  ETC_OTC_NAME?: string;
}
