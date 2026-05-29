"use client";

import styles from "./MobileTabBar.module.css";

type ResultStatus = "idle" | "loading" | "error" | "single" | "multi";

interface MobileTabBarProps {
  activeTab: "search" | "result";
  onChange: (tab: "search" | "result") => void;
  /** 검색 탭 뱃지: 선택된 약 개수 */
  selectedDrugCount: number;
  /** 결과 탭 인디케이터 계산용 */
  resultStatus: ResultStatus;
  hasDanger: boolean;
}

/** 결과 탭 우상단 상태 도트 */
function ResultDot({ status, hasDanger }: { status: ResultStatus; hasDanger: boolean }) {
  if (status === "idle" || status === "error") return null;

  if (status === "loading") {
    return <span className={[styles.dot, styles.dotLoading].join(" ")} aria-hidden="true" />;
  }

  // single | multi
  return (
    <span
      className={[styles.dot, hasDanger ? styles.dotDanger : styles.dotSafe].join(" ")}
      aria-hidden="true"
    />
  );
}

export default function MobileTabBar({
  activeTab,
  onChange,
  selectedDrugCount,
  resultStatus,
  hasDanger,
}: MobileTabBarProps) {
  return (
    <nav className={styles.tabBar} aria-label="탭 내비게이션">

      {/* ── 검색 탭 ── */}
      <button
        type="button"
        className={[styles.tab, activeTab === "search" ? styles.active : ""].join(" ")}
        onClick={() => onChange("search")}
        aria-current={activeTab === "search" ? "page" : undefined}
      >
        <span className={styles.iconWrap}>
          <span className={styles.tabIcon}>🔍</span>
          {selectedDrugCount > 0 && (
            <span className={styles.badge} aria-label={`${selectedDrugCount}개 선택됨`}>
              {selectedDrugCount}
            </span>
          )}
        </span>
        <span className={styles.tabLabel}>검색</span>
      </button>

      {/* ── 결과 탭 ── */}
      <button
        type="button"
        className={[styles.tab, activeTab === "result" ? styles.active : ""].join(" ")}
        onClick={() => onChange("result")}
        aria-current={activeTab === "result" ? "page" : undefined}
      >
        <span className={styles.iconWrap}>
          <span className={styles.tabIcon}>📋</span>
          <ResultDot status={resultStatus} hasDanger={hasDanger} />
        </span>
        <span className={styles.tabLabel}>결과</span>
      </button>

    </nav>
  );
}
