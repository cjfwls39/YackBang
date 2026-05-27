"use client";

import { useState, useCallback } from "react";
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
import styles from "./MainView.module.css";

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "single"; data: SingleDrugResult }
  | { status: "multi";  data: MultiDrugResult };

export default function MainView() {
  const [selectedDrugs, setSelectedDrugs] = useState<SelectedDrug[]>([]);
  const [resultState, setResultState] = useState<ResultState>({ status: "idle" });
  const [isQuerying, setIsQuerying] = useState(false);

  /* ── 약 추가 ── */
  const handleAdd = useCallback((drug: DrugSearchResult) => {
    setSelectedDrugs((prev) => {
      // 중복 방지
      if (prev.some((d) => d.itemSeq === drug.itemSeq)) return prev;
      // 최대 5개
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
  }, []);

  /* ── 약 제거 ── */
  const handleRemove = useCallback((itemSeq: string) => {
    setSelectedDrugs((prev) => prev.filter((d) => d.itemSeq !== itemSeq));
    // 약이 제거되면 결과 초기화
    setResultState({ status: "idle" });
  }, []);

  /* ── 조회 실행 ── */
  const handleCheck = useCallback(async () => {
    if (selectedDrugs.length === 0 || isQuerying) return;

    setIsQuerying(true);
    setResultState({ status: "loading" });

    try {
      const mode = selectedDrugs.length === 1 ? "single" : "multi";
      const res = await fetch("/api/interaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, drugs: selectedDrugs }),
      });
      if (!res.ok) throw new Error("query failed");

      if (mode === "single") {
        const data: SingleDrugResult = await res.json();
        setResultState({ status: "single", data });
      } else {
        const data: MultiDrugResult = await res.json();
        setResultState({ status: "multi", data });
      }
    } catch {
      setResultState({ status: "error", message: "조회 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." });
    } finally {
      setIsQuerying(false);
    }
  }, [selectedDrugs, isQuerying]);

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
            />
          </div>

          {/* 우측: 결과 패널 */}
          <div className={styles.rightPanel}>
            <ResultPanel state={resultState} />
          </div>
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}
