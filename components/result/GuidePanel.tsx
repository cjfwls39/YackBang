"use client";

import { useState } from "react";
import { GUIDE_GROUPS } from "@/data/guide-combinations";
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
interface GuidePanelProps {
  /**
   * true → 접기/펼치기 토글 제공 (모바일 DrugPanel용)
   * false(기본) → 항상 펼침 (데스크탑 ResultPanel용)
   */
  collapsible?: boolean;
  /** collapsible=true 일 때 초기 펼침 여부 */
  defaultOpen?: boolean;
}

export default function GuidePanel({
  collapsible = false,
  defaultOpen = true,
}: GuidePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={styles.panel}>
      {/* ── 헤더 ── */}
      {collapsible ? (
        /* 접기/펼치기 토글 버튼 (모바일) */
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className={styles.headerLabel}>알아두면 좋은 위험 조합</span>
          <span className={styles.collapseChevron}>{open ? "▲" : "▼"}</span>
        </button>
      ) : (
        /* 항상 표시 헤더 (데스크탑) */
        <div className={styles.header}>
          <p className={styles.headerLabel}>알아두면 좋은 위험 조합</p>
          <p className={styles.headerDesc}>
            약국에서 많이 팔리는 약들 중 함께 먹으면 위험한 조합이에요.
            <br />
            해당하는 약을 복용 중이라면 반드시 약사·의사와 상담하세요.
          </p>
        </div>
      )}

      {/* ── 카드 그리드 + 출처 (접힘 제어) ── */}
      {(!collapsible || open) && (
        <>
          {/* 접힌 상태에서 펼쳤을 때 설명 표시 */}
          {collapsible && (
            <p className={styles.headerDescCollapsed}>
              약국에서 많이 팔리는 약들 중 함께 먹으면 위험한 조합이에요.
              해당하는 약을 복용 중이라면 반드시 약사·의사와 상담하세요.
            </p>
          )}

          {/* 그룹별 섹션 */}
          {GUIDE_GROUPS.map((group, idx) => (
            <div key={group.id} className={styles.group}>
              {/* 두 번째 그룹부터 구분선 + 섹션 헤더 */}
              {idx > 0 && <div className={styles.groupDivider} />}
              <div className={styles.groupHeader}>
                <span className={styles.groupTitle}>{group.title}</span>
                {group.subtitle && (
                  <span className={styles.groupSubtitle}>{group.subtitle}</span>
                )}
              </div>

              <div className={styles.grid}>
                {group.combinations.map((combo) => (
                  <GuideCard key={combo.id} combo={combo} />
                ))}
              </div>
            </div>
          ))}

          <p className={styles.source}>
            출처: 식약처 의약품안전나라 · 서울대 국민건강지식센터 · GoodRx Drug Interactions
          </p>
        </>
      )}
    </div>
  );
}
