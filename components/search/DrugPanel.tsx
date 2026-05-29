"use client";

import type { SelectedDrug, DrugSearchResult } from "@/types/drug";
import type { HistoryEntry } from "@/lib/history";
import SearchInput from "./SearchInput";
import DrugChip from "./DrugChip";
import RecentHistory from "./RecentHistory";
import GuidePanel from "@/components/result/GuidePanel";
import styles from "./DrugPanel.module.css";

interface DrugPanelProps {
  selectedDrugs: SelectedDrug[];
  onAdd: (drug: DrugSearchResult) => void;
  onRemove: (itemSeq: string) => void;
  onCheck: () => void;
  isLoading?: boolean;
  history?: HistoryEntry[];
  onRestoreHistory?: (drugs: SelectedDrug[]) => void;
  onHistoryChange?: () => void;
  onEnterSearch?: (results: DrugSearchResult[], query: string) => void;
}

export default function DrugPanel({
  selectedDrugs,
  onAdd,
  onRemove,
  onCheck,
  isLoading = false,
  history = [],
  onRestoreHistory,
  onHistoryChange,
  onEnterSearch,
}: DrugPanelProps) {
  const isMulti = selectedDrugs.length >= 2;
  const canCheck = selectedDrugs.length >= 1 && !isLoading;

  return (
    <aside className={styles.panel}>
      {/* ── 검색 입력 ── */}
      <SearchInput
        onSelect={onAdd}
        selectedCount={selectedDrugs.length}
        maxCount={5}
        onEnterSearch={onEnterSearch}
      />

      {/* ── 최근 기록 (약이 선택되지 않은 상태에서만 표시) ── */}
      {selectedDrugs.length === 0 && onRestoreHistory && history.length > 0 && (
        <>
          <div className={styles.divider} />
          <RecentHistory
            entries={history}
            onRestore={onRestoreHistory}
            onEntriesChange={onHistoryChange ?? (() => {})}
          />
        </>
      )}

      {/* ── 모바일 전용: 위험 조합 가이드 (접힘 상태로 표시) ── */}
      {selectedDrugs.length === 0 && (
        <div className={styles.mobileGuide}>
          <div className={styles.divider} />
          <GuidePanel collapsible defaultOpen={false} />
        </div>
      )}

      {/* ── 선택된 약 칩 + 조회 버튼 ── */}
      {selectedDrugs.length > 0 && (
        <>
          <div className={styles.divider} />

          <div>
            <p className={styles.sectionTitle}>
              선택된 약 ({selectedDrugs.length}
              {isMulti ? " · 병용 비교" : " · 단일 조회"})
            </p>
            <div className={styles.chipList}>
              {selectedDrugs.map((drug, index) => (
                <DrugChip
                  key={drug.itemSeq}
                  drug={drug}
                  isReference={index === 0 && isMulti}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            className={styles.checkBtn}
            onClick={onCheck}
            disabled={!canCheck}
          >
            {isLoading
              ? "조회 중..."
              : isMulti
              ? `🔍 ${selectedDrugs.length}개 약 병용 확인`
              : "🔍 병용금기 목록 보기"}
          </button>
        </>
      )}
    </aside>
  );
}
