import type { SelectedDrug } from "@/types/drug";

const HISTORY_KEY = "yackbang_history_v1";
const MAX_ENTRIES = 5;

export interface HistoryEntry {
  id: string;
  drugs: SelectedDrug[];
  savedAt: number; // Unix ms
}

/** localStorage에서 최근 기록 전체 반환 */
export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * 조회 성공 시 기록 추가.
 * 같은 itemSeq 조합은 중복 제거 후 맨 앞에 최신 기록으로 덮어씀.
 */
export function addToHistory(drugs: SelectedDrug[]): void {
  if (typeof window === "undefined" || drugs.length === 0) return;
  try {
    const key = drugs
      .map((d) => d.itemSeq)
      .sort()
      .join(",");

    const prev = getHistory().filter(
      (e) =>
        e.drugs
          .map((d) => d.itemSeq)
          .sort()
          .join(",") !== key
    );

    const entry: HistoryEntry = {
      id: String(Date.now()),
      drugs,
      savedAt: Date.now(),
    };

    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([entry, ...prev].slice(0, MAX_ENTRIES))
    );
  } catch {
    // localStorage 용량 초과 등 → 조용히 무시
  }
}

/** id로 개별 기록 삭제 */
export function removeFromHistory(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const updated = getHistory().filter((e) => e.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {}
}
