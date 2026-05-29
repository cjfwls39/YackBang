"use client";

import type { DrugSearchResult } from "@/types/drug";
import styles from "./SearchResultsPanel.module.css";

interface SearchResultsPanelProps {
  results: DrugSearchResult[];
  query: string;
  onSelect: (drug: DrugSearchResult) => void;
  onClose: () => void;
}

function DrugCard({ drug, onSelect }: { drug: DrugSearchResult; onSelect: () => void }) {
  const imgSrc = drug.pillImageUrl || drug.boxImageUrl;
  const isOtc = drug.spcltPblc === "일반의약품";

  return (
    <div className={styles.card}>
      {/* 약 이미지 */}
      <div className={styles.imgWrap}>
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt={drug.itemName} className={styles.img} loading="lazy" />
        ) : (
          <span className={styles.imgFallback}>💊</span>
        )}
      </div>

      {/* 약 정보 */}
      <div className={styles.info}>
        <div className={styles.nameLine}>
          <span className={styles.name}>{drug.itemName}</span>
          {drug.spcltPblc && (
            <span className={[styles.badge, isOtc ? styles.badgeOtc : styles.badgeRx].join(" ")}>
              {drug.spcltPblc}
            </span>
          )}
        </div>
        {drug.ingrKorName && (
          <span className={styles.ingr}>성분 · {drug.ingrKorName}</span>
        )}
        {drug.entpName && (
          <span className={styles.entp}>{drug.entpName}</span>
        )}
      </div>

      {/* 추가 버튼 */}
      <button type="button" className={styles.addBtn} onClick={onSelect}>
        + 추가
      </button>
    </div>
  );
}

export default function SearchResultsPanel({
  results,
  query,
  onSelect,
  onClose,
}: SearchResultsPanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.content}>
        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerQuery}>"{query}"</span>
            <span className={styles.headerCount}>
              {results.length > 0 ? `검색 결과 ${results.length}개` : "검색 결과 없음"}
            </span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕ 닫기
          </button>
        </div>

        {/* 결과 목록 */}
        {results.length > 0 ? (
          <div className={styles.list}>
            {results.map((drug) => (
              <DrugCard
                key={drug.itemSeq}
                drug={drug}
                onSelect={() => onSelect(drug)}
              />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🔍</span>
            <p className={styles.emptyText}>
              <strong>"{query}"</strong>에 해당하는 약을 찾지 못했어요.
              <br />
              약 이름을 다시 확인해보세요.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
