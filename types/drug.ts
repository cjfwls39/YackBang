// 의약품 기본 정보
export interface Drug {
  itemSeq: string;      // 품목일련번호
  itemName: string;     // 의약품명
  entpName: string;     // 업체명
  itemPermitDate: string;
}

// 병용금기 정보
export interface DrugInteraction {
  itemSeq: string;
  itemName: string;
  mixSeq: string;
  mixItemName: string;
  prohibitContent: string;  // 금기 사유 (원문)
  prohbtDetail: string;     // 상세 내용
  severity: "high" | "medium" | "low";  // 정규화된 위험도
}

// 검색 결과 (사용자에게 보여주는 형태)
export interface InteractionResult {
  drug1: Pick<Drug, "itemSeq" | "itemName">;
  drug2: Pick<Drug, "itemSeq" | "itemName">;
  isSafe: boolean;
  interactions: {
    severity: DrugInteraction["severity"];
    plainText: string;  // 쉬운 말로 변환된 설명
    originalText: string;
  }[];
}

// 식약처 API 공통 응답 래퍼
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
