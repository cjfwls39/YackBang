"use client";

import { useCallback } from "react";
import type { HistoryEntry } from "@/lib/history";
import { removeFromHistory } from "@/lib/history";
import type { SelectedDrug } from "@/types/drug";
import styles from "./RecentHistory.module.css";

interface RecentHistoryProps {
  entries: HistoryEntry[];
  onRestore: (drugs: SelectedDrug[]) => void;
  onEntriesChange: () => void;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

/** 약품명에서 괄호(성분명) 부분 제거해 짧게 표시 */
function shortName(itemName: string): string {
  return itemName.replace(/\(.*?\)/, "").trim();
}

export default function RecentHistory({
  entries,
  onRestore,
  onEntriesChange,
}: RecentHistoryProps) {
  const handleRemove = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      removeFromHistory(id);
      onEntriesChange();
    },
    [onEntriesChange]
  );

  if (entries.length === 0) return null;

  return (
    <div className={styles.container}>
      <p className={styles.label}>최근 조회</p>
      <div className={styles.list}>
        {entries.map((entry) => (
          <div key={entry.id} className={styles.row}>
            {/* 복원 버튼 — 클릭 시 해당 약 조합 바로 조회 */}
            <button
              type="button"
              className={styles.restoreBtn}
              onClick={() => onRestore(entry.drugs)}
            >
              <span className={styles.drugNames}>
                {entry.drugs.map((d) => shortName(d.itemName)).join(" + ")}
              </span>
              <span className={styles.time}>{relativeTime(entry.savedAt)}</span>
            </button>

            {/* 삭제 버튼 */}
            <button
              type="button"
              className={styles.removeBtn}
              onClick={(e) => handleRemove(entry.id, e)}
              aria-label="기록 삭제"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
