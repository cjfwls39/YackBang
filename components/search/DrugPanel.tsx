"use client";

import type { SelectedDrug, DrugSearchResult } from "@/types/drug";
import SearchInput from "./SearchInput";
import DrugChip from "./DrugChip";
import styles from "./DrugPanel.module.css";

interface DrugPanelProps {
  selectedDrugs: SelectedDrug[];
  onAdd: (drug: DrugSearchResult) => void;
  onRemove: (itemSeq: string) => void;
  onCheck: () => void;
  isLoading?: boolean;
}

export default function DrugPanel({
  selectedDrugs,
  onAdd,
  onRemove,
  onCheck,
  isLoading = false,
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
      />

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
