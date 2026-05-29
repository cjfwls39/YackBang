/**
 * 실생활 위험 약 조합 가이드
 * — 그룹별로 구분해 GuidePanel에서 섹션 헤더와 함께 렌더링
 */

export type Severity = "danger" | "warning";

export interface GuideCombination {
  id: string;
  /** 왼쪽 약 표시명 */
  drugA: string;
  /** 왼쪽 약 성분/부연 */
  drugANote: string;
  /** 오른쪽 약/물질 표시명 */
  drugB: string;
  /** 오른쪽 약 성분/부연 */
  drugBNote: string;
  severity: Severity;
  /** 위험 요약 */
  riskTitle: string;
  /** 일반인용 쉬운 설명 */
  description: string;
  /** 카테고리 태그 */
  category: string;
}

export interface GuideGroup {
  id: string;
  /** 섹션 제목 */
  title: string;
  /** 섹션 부제 (선택) */
  subtitle?: string;
  combinations: GuideCombination[];
}

// ── 그룹 1: 일반 병용금기 ──────────────────────────────────────
const GENERAL_COMBINATIONS: GuideCombination[] = [
  {
    id: "acetaminophen-cold",
    drugA: "타이레놀",
    drugANote: "아세트아미노펜",
    drugB: "종합감기약",
    drugBNote: "판콜·판피린·화이투벤",
    severity: "danger",
    riskTitle: "아세트아미노펜 과용량 → 간 손상",
    description:
      "종합감기약 안에도 타이레놀과 같은 아세트아미노펜이 들어 있어요. 함께 먹으면 간이 처리할 수 있는 양을 초과해 심각한 간 손상이 생길 수 있어요.",
    category: "진통제",
  },
  {
    id: "acetaminophen-alcohol",
    drugA: "타이레놀",
    drugANote: "아세트아미노펜",
    drugB: "술·알코올",
    drugBNote: "음주 후 복용 포함",
    severity: "danger",
    riskTitle: "간 독성",
    description:
      "술을 마신 날 두통·숙취에 타이레놀을 먹는 경우가 많아요. 알코올과 아세트아미노펜이 함께 간에 무리를 줘 소량으로도 심각한 간 손상이 생길 수 있어요.",
    category: "음주",
  },
  {
    id: "antihistamine-sleep",
    drugA: "감기약",
    drugANote: "판콜·판피린 (항히스타민 포함)",
    drugB: "수면유도제",
    drugBNote: "아론·자미솔 (디펜히드라민)",
    severity: "danger",
    riskTitle: "과도한 졸음·호흡 억제",
    description:
      "감기약과 수면유도제 모두 디펜히드라민이라는 졸음 유발 성분이 들어 있어요. 함께 먹으면 졸음이 배로 강해지고 심한 경우 호흡이 억제될 수 있어요.",
    category: "감기약",
  },
  {
    id: "cold-motion-sickness",
    drugA: "감기약",
    drugANote: "항히스타민 계열",
    drugB: "멀미약",
    drugBNote: "보나링·키미테 (디멘히드리네이트)",
    severity: "warning",
    riskTitle: "항히스타민 중복 → 심한 졸음",
    description:
      "감기약과 멀미약 모두 졸음을 유발하는 항히스타민 계열이에요. 함께 복용하면 심한 졸음과 어지럼증이 생겨 낙상·사고 위험이 높아져요.",
    category: "감기약",
  },
  {
    id: "ibuprofen-aspirin",
    drugA: "이부프로펜",
    drugANote: "탁센·이지엔6·애드빌",
    drugB: "아스피린",
    drugBNote: "일반용 아스피린",
    severity: "danger",
    riskTitle: "위장 출혈",
    description:
      "두 약 모두 같은 방식(COX 억제)으로 통증을 줄여요. 함께 먹으면 효과가 겹쳐 위장 출혈 위험이 크게 높아지고, 신장에도 무리를 줄 수 있어요.",
    category: "진통제",
  },
  {
    id: "ibuprofen-low-aspirin",
    drugA: "이부프로펜",
    drugANote: "탁센·이지엔6 등",
    drugB: "저용량 아스피린",
    drugBNote: "심혈관 예방용 100mg",
    severity: "warning",
    riskTitle: "아스피린 심혈관 보호 효과 소멸",
    description:
      "심혈관 질환 예방을 위해 매일 아스피린을 드신다면 주의하세요. 이부프로펜이 아스피린의 혈소판 억제 효과를 막아 심혈관 보호가 사라져요.",
    category: "진통제",
  },
  {
    id: "statin-clarithromycin",
    drugA: "콜레스테롤약",
    drugANote: "스타틴 (심바스타틴·아토르바스타틴)",
    drugB: "클래리스로마이신",
    drugBNote: "항생제 (클래리시드 등)",
    severity: "danger",
    riskTitle: "근육 손상 (횡문근융해증)",
    description:
      "항생제가 콜레스테롤약의 분해를 막아 혈중 농도가 위험하게 높아져요. 근육이 녹는 횡문근융해증이 생길 수 있고, 심하면 신부전으로 이어져요.",
    category: "처방약",
  },
  {
    id: "warfarin-aspirin",
    drugA: "와파린",
    drugANote: "혈액희석제 (쿠마딘 등)",
    drugB: "아스피린",
    drugBNote: "일반·저용량 아스피린",
    severity: "danger",
    riskTitle: "과도한 출혈",
    description:
      "두 약 모두 혈액이 굳는 것을 막아요. 함께 복용하면 작은 상처에도 출혈이 멈추지 않고, 뇌출혈·위장 출혈 같은 심각한 내출혈 위험이 급격히 높아져요.",
    category: "처방약",
  },
];

// ── 그룹 2: 다이어트 주사 관련 ────────────────────────────────
const GLP1_COMBINATIONS: GuideCombination[] = [
  {
    id: "glp1-insulin",
    drugA: "위고비·마운자로",
    drugANote: "세마글루타이드·티르제파타이드",
    drugB: "인슐린",
    drugBNote: "노보라피드·란투스·인슐린 글라진 등",
    severity: "danger",
    riskTitle: "저혈당 쇼크",
    description:
      "GLP-1 주사제는 인슐린 분비를 촉진해요. 인슐린을 추가로 주사하면 혈당이 위험 수준까지 떨어질 수 있어요. 반드시 의사와 인슐린 용량 조절을 먼저 상의하세요.",
    category: "다이어트 주사",
  },
  {
    id: "glp1-sulfonylurea",
    drugA: "위고비·마운자로",
    drugANote: "세마글루타이드·티르제파타이드",
    drugB: "설포닐우레아 계열",
    drugBNote: "글리메피리드·다이아미크롱·글리클라지드",
    severity: "danger",
    riskTitle: "저혈당",
    description:
      "설포닐우레아 계열 당뇨약도 인슐린 분비를 자극해요. GLP-1 주사제와 함께 쓰면 저혈당 위험이 크게 높아져요. 당뇨 치료 중 체중 감량 주사를 고려한다면 반드시 담당의와 상담하세요.",
    category: "다이어트 주사",
  },
  {
    id: "glp1-glp1",
    drugA: "위고비",
    drugANote: "세마글루타이드 (GLP-1)",
    drugB: "마운자로",
    drugBNote: "티르제파타이드 (GLP-1·GIP)",
    severity: "danger",
    riskTitle: "GLP-1 과자극 → 췌장염·구역",
    description:
      "두 약 모두 GLP-1 수용체를 자극해요. 효과가 배가될 것 같지만 오히려 극심한 구역·구토, 췌장염 위험이 높아져요. 동시에 처방받는 것 자체가 금기예요.",
    category: "다이어트 주사",
  },
  {
    id: "glp1-pill",
    drugA: "위고비·마운자로",
    drugANote: "세마글루타이드·티르제파타이드",
    drugB: "경구 피임약",
    drugBNote: "야즈·머시론·미뉴렛 등",
    severity: "warning",
    riskTitle: "피임 효과 감소",
    description:
      "GLP-1 주사제는 위 배출 속도를 늦춰 먹는 약의 흡수를 줄여요. 투약 초기 4주간 특히 피임약 흡수가 감소할 수 있어요. 이 기간엔 추가 피임법을 병행하세요.",
    category: "다이어트 주사",
  },
];

// ── 그룹 정의 ──────────────────────────────────────────────────
export const GUIDE_GROUPS: GuideGroup[] = [
  {
    id: "general",
    title: "일반 병용금기",
    combinations: GENERAL_COMBINATIONS,
  },
  {
    id: "glp1",
    title: "다이어트 주사 관련",
    subtitle: "위고비·마운자로 (GLP-1 계열) 주의 조합",
    combinations: GLP1_COMBINATIONS,
  },
];

/** 전체 조합 (flat) — 기존 코드 호환용 */
export const GUIDE_COMBINATIONS: GuideCombination[] = GUIDE_GROUPS.flatMap(
  (g) => g.combinations
);
