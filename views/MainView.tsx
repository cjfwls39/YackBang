"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Header from "@/components/layout/Header";
import Disclaimer from "@/components/common/Disclaimer";
import DrugPanel from "@/components/search/DrugPanel";
import ResultPanel from "@/components/result/ResultPanel";
import type {
  SelectedDrug,
  DrugSearchResult,
  SingleDrugResult,
  MultiDrugResult,
} from "@/types/drug";
import { encodeDrugsForUrl, decodeDrugsFromUrl } from "@/lib/url-state";
import { addToHistory, getHistory } from "@/lib/history";
import type { HistoryEntry } from "@/lib/history";
import styles from "./MainView.module.css";

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "single"; data: SingleDrugResult }
  | { status: "multi"; data: MultiDrugResult };

export default function MainView() {
  const [selectedDrugs, setSelectedDrugs] = useState<SelectedDrug[]>([]);
  const [resultState, setResultState] = useState<ResultState>({ status: "idle" });
  const [isQuerying, setIsQuerying] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  /* ── localStorage 기록 갱신 ── */
  const refreshHistory = useCallback(() => {
    setHistory(getHistory());
  }, []);

  /* ── 핵심: API 호출 + URL 업데이트 + 기록 저장 ──────────────────
   *  handleCheck / handleRestoreHistory / 초기 URL 파싱 세 곳에서 공유 */
  const performQuery = useCallback(async (drugs: SelectedDrug[]) => {
    if (drugs.length === 0) return;

    setIsQuerying(true);
    setResultState({ status: "loading" });

    try {
      const mode = drugs.length === 1 ? "single" : "multi";
      const res = await fetch("/api/interaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, drugs }),
      });
      if (!res.ok) throw new Error("query failed");

      if (mode === "single") {
        const data: SingleDrugResult = await res.json();
        setResultState({ status: "single", data });
      } else {
        const data: MultiDrugResult = await res.json();
        setResultState({ status: "multi", data });
      }

      // URL 파라미터 업데이트 (브라우저 히스토리 교체)
      const encoded = encodeDrugsForUrl(drugs);
      const path = `${window.location.pathname}?q=${encoded}`;
      window.history.replaceState({}, "", path);
      setShareUrl(`${window.location.origin}${path}`);

      // localStorage 기록 저장
      addToHistory(drugs);
      setHistory(getHistory());
    } catch {
      setResultState({
        status: "error",
        message: "조회 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
      });
    } finally {
      setIsQuerying(false);
    }
  }, []);

  /* ── 초기 마운트: 기록 로드 + URL 파싱 자동 조회 ─────────────────
   *  performQuery는 마운트 후 안정적이므로 ref로 참조해 deps 경고 방지 */
  const performQueryRef = useRef(performQuery);
  performQueryRef.current = performQuery;

  useEffect(() => {
    // localStorage 기록 로드
    setHistory(getHistory());

    // URL ?q= 파라미터 파싱
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (!q) return;

    const drugs = decodeDrugsFromUrl(q);
    if (!drugs) return;

    // 약 목록 복원 + 자동 조회
    setSelectedDrugs(drugs);
    performQueryRef.current(drugs);
  }, []); // 마운트 1회만 실행

  /* ── URL/결과 초기화 헬퍼 ── */
  const clearResult = useCallback(() => {
    setResultState({ status: "idle" });
    setShareUrl(null);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  /* ── 약 추가 ── */
  const handleAdd = useCallback(
    (drug: DrugSearchResult) => {
      setSelectedDrugs((prev) => {
        if (prev.some((d) => d.itemSeq === drug.itemSeq)) return prev;
        if (prev.length >= 5) return prev;
        const selected: SelectedDrug = {
          itemSeq:      drug.itemSeq,
          itemName:     drug.itemName,
          entpName:     drug.entpName,
          itemIngrName: drug.itemIngrName,
          ingrKorName:  drug.ingrKorName,
          boxImageUrl:  drug.boxImageUrl,
          pillImageUrl: drug.pillImageUrl,
          spcltPblc:    drug.spcltPblc,
        };
        return [...prev, selected];
      });
      clearResult(); // 새 약 추가 시 이전 결과·URL 초기화
    },
    [clearResult]
  );

  /* ── 약 제거 ── */
  const handleRemove = useCallback(
    (itemSeq: string) => {
      setSelectedDrugs((prev) => prev.filter((d) => d.itemSeq !== itemSeq));
      clearResult();
    },
    [clearResult]
  );

  /* ── 조회 버튼 클릭 ── */
  const handleCheck = useCallback(() => {
    if (selectedDrugs.length === 0 || isQuerying) return;
    performQuery(selectedDrugs);
  }, [selectedDrugs, isQuerying, performQuery]);

  /* ── 최근 기록 복원 → 바로 조회 ── */
  const handleRestoreHistory = useCallback(
    (drugs: SelectedDrug[]) => {
      setSelectedDrugs(drugs);
      clearResult();
      performQuery(drugs);
    },
    [clearResult, performQuery]
  );

  return (
    <div className={styles.root}>
      <Header />

      <div className={styles.content}>
        <div className={styles.panels}>
          {/* 좌측: 검색 패널 */}
          <div className={styles.leftPanel}>
            <DrugPanel
              selectedDrugs={selectedDrugs}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onCheck={handleCheck}
              isLoading={isQuerying}
              history={history}
              onRestoreHistory={handleRestoreHistory}
              onHistoryChange={refreshHistory}
            />
          </div>

          {/* 우측: 결과 패널 */}
          <div className={styles.rightPanel}>
            <ResultPanel state={resultState} shareUrl={shareUrl} />
          </div>
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}
