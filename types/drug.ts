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
// 추가 DUR 카테고리 타입 (단일 약 기준 경고)
// ────────────────────────────────────────────

// ────────────────────────────────────────────
// e약은요 API (DrbEasyDrugInfoService) — 일반인용 복약 정보
// ────────────────────────────────────────────

/**
 * e약은요 API 응답 — 소비자 눈높이 복약 정보 (4,752건, 주로 일반의약품)
 * 처방의약품은 포함되지 않을 수 있음
 */
export interface EasyDrugInfo {
  itemSeq: string;
  itemName: string;
  efcyQesitm?: string;          // 이 약은 어떤 때 쓰나요? (효능)
  useMethodQesitm?: string;     // 이 약을 어떻게 쓰나요? (용법)
  atpnWarnQesitm?: string;      // 이 약을 쓰기 전에 반드시 알아야 할 내용 (경고)
  atpnQesitm?: string;          // 이 약을 쓰는 동안 주의할 사항 (주의)
  intrcQesitm?: string;         // 다른 약과 함께 쓰면 안 되는 경우 (상호작용) ← 핵심
  seQesitm?: string;            // 이 약을 쓰면 어떤 부작용이 생길 수 있나요?
  depositMethodQesitm?: string; // 이 약은 어떻게 보관하나요?
  itemImage?: string;           // 약 이미지 URL
}

/** dur_efficacy_duplication 조회용 (효능군 정보) */
export interface DurEfficacyGroup {
  ingrName: string;
  sersName: string;  // 효능군명
}

/** dur_elderly_caution 테이블 row */
export interface DurElderlyCaution {
  id: number;
  ingrName: string;
  className?: string;   // 주의 분류명
  note?: string;        // 주의 내용
}

/** dur_age_restriction 테이블 row */
export interface DurAgeRestriction {
  id: number;
  ingrName: string;
  prohbtContent?: string;  // 금기 내용 ("3세 미만 소아 사용 금지")
}

/** dur_dosage_caution 테이블 row */
export interface DurDosageCaution {
  id: number;
  ingrName: string;
  className?: string;
  note?: string;
}

/** dur_duration_caution 테이블 row */
export interface DurDurationCaution {
  id: number;
  ingrName: string;
  className?: string;
  note?: string;
}

/** dur_tablet_split_caution 테이블 row */
export interface DurTabletSplitCaution {
  id: number;
  ingrName: string;
  className?: string;
  note?: string;
}

/** 효능군중복 경고 — 두 약이 같은 효능군에 속함 */
export interface EfficacyDuplicationPair {
  drugA: SelectedDrug;
  drugB: SelectedDrug;
  sersNames: string[];  // 겹치는 효능군명 목록
}

/** 성분 교집합 경고 — 두 약에 같은 성분이 들어 있음 */
export interface IngredientOverlapPair {
  drugA: SelectedDrug;
  drugB: SelectedDrug;
  overlappingIngredients: string[];  // 겹치는 성분명 (정규화된 소문자)
}

// ────────────────────────────────────────────
// 결과 화면용 집계 타입
// ────────────────────────────────────────────

/** 단일 약 조회 결과 */
export interface SingleDrugResult {
  drug: SelectedDrug;
  prohibitions: DurProhibition[];      // 병용금기
  pregnancyWarning: DurPregnancy | null;
  elderlyCautions: DurElderlyCaution[];      // 노인주의
  ageRestrictions: DurAgeRestriction[];      // 특정연령대금기
  dosageCautions: DurDosageCaution[];        // 용량주의
  durationCautions: DurDurationCaution[];    // 투여기간주의
  tabletSplitCautions: DurTabletSplitCaution[]; // 서방정분할주의
  easyDrugInfo: EasyDrugInfo | null;         // e약은요 복약 안내 (있으면)
}

/** 다중 약 병용 조회 결과 (2–5개) */
export interface MultiDrugResult {
  drugs: SelectedDrug[];
  /** 병용금기 쌍 목록 */
  dangerPairs: Array<{
    drugA: SelectedDrug;
    drugB: SelectedDrug;
    prohibition: DurProhibition;
  }>;
  /** 효능군중복 쌍 목록 */
  efficacyDuplicates: EfficacyDuplicationPair[];
  /** 성분 교집합 쌍 목록 */
  ingredientOverlaps: IngredientOverlapPair[];
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
