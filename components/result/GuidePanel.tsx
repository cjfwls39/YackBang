import { GUIDE_COMBINATIONS } from "@/data/guide-combinations";
import type { GuideCombination } from "@/data/guide-combinations";
import styles from "./GuidePanel.module.css";

// ── 개별 카드 ──────────────────────────────────────────────────
function GuideCard({ combo }: { combo: GuideCombination }) {
  const isDanger = combo.severity === "danger";

  return (
    <div className={[styles.card, isDanger ? styles.cardDanger : styles.cardWarning].join(" ")}>
      {/* 헤더: 심각도 뱃지 */}
      <div className={[styles.cardHeader, isDanger ? styles.headerDanger : styles.headerWarning].join(" ")}>
        <span className={[styles.badge, isDanger ? styles.badgeDanger : styles.badgeWarning].join(" ")}>
          {isDanger ? "🚫 병용 금지" : "⚠️ 주의 필요"}
        </span>
        <span className={styles.category}>{combo.category}</span>
      </div>

      {/* 약 조합 표시 */}
      <div className={styles.pair}>
        <div className={styles.drug}>
          <span className={styles.drugName}>{combo.drugA}</span>
          <span className={styles.drugNote}>{combo.drugANote}</span>
        </div>

        <span className={styles.plus}>+</span>

        <div className={styles.drug}>
          <span className={styles.drugName}>{combo.drugB}</span>
          <span className={styles.drugNote}>{combo.drugBNote}</span>
        </div>
      </div>

      {/* 위험 내용 */}
      <div className={styles.risk}>
        <p className={styles.riskTitle}>{combo.riskTitle}</p>
        <p className={styles.description}>{combo.description}</p>
      </div>
    </div>
  );
}

// ── 전체 패널 ──────────────────────────────────────────────────
export default function GuidePanel() {
  return (
    <div className={styles.panel}>
      {/* 섹션 헤더 */}
      <div className={styles.header}>
        <p className={styles.headerLabel}>알아두면 좋은 위험 조합</p>
        <p className={styles.headerDesc}>
          약국에서 많이 팔리는 약들 중 함께 먹으면 위험한 조합이에요.
          <br />
          해당하는 약을 복용 중이라면 반드시 약사·의사와 상담하세요.
        </p>
      </div>

      {/* 카드 그리드 */}
      <div className={styles.grid}>
        {GUIDE_COMBINATIONS.map((combo) => (
          <GuideCard key={combo.id} combo={combo} />
        ))}
      </div>

      {/* 출처 */}
      <p className={styles.source}>
        출처: 식약처 의약품안전나라 병용금기 정보 · 서울대 국민건강지식센터
      </p>
    </div>
  );
}
