"use client";

import { useState } from "react";
import styles from "./InteractionCard.module.css";

interface InteractionCardProps {
  /** 이 약의 성분명 */
  ingrName: string;
  /** 금기 상대 성분명 */
  mixtureIngrName: string;
  /** 상대 대표 약품명 (있으면 표시) */
  mixtureItemName?: string;
  /** Claude가 변환한 쉬운 설명 */
  plainText: string;
  /** 원문 (전문용어) */
  originalText: string;
  /** 임부금기 여부 */
  isPregnancy?: boolean;
}

export default function InteractionCard({
  ingrName,
  mixtureIngrName,
  mixtureItemName,
  plainText,
  originalText,
  isPregnancy = false,
}: InteractionCardProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div className={[styles.card, isPregnancy ? styles.pregnancy : ""].join(" ")}>
      {/* 성분 조합 헤더 */}
      <div className={styles.header}>
        <span className={styles.badge}>
          {isPregnancy ? "임부 금기" : "병용 금기"}
        </span>
        <div className={styles.pair}>
          <span className={styles.ingrName}>{ingrName}</span>
          <span className={styles.arrow}>↔</span>
          <span className={styles.ingrName}>{mixtureIngrName}</span>
        </div>
      </div>

      {/* 이유 설명 */}
      <div className={styles.body}>
        <p className={styles.plainText}>{plainText}</p>

        {mixtureItemName && (
          <span className={styles.relatedDrug}>{mixtureItemName}</span>
        )}

        {/* 원문 토글 */}
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={() => setShowOriginal((v) => !v)}
        >
          {showOriginal ? "▲ 원문 닫기" : "▼ 원문 보기 (전문 용어)"}
        </button>
        {showOriginal && (
          <p className={styles.originalText}>{originalText}</p>
        )}
      </div>
    </div>
  );
}
