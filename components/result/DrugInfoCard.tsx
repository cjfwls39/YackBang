import type { SelectedDrug } from "@/types/drug";
import styles from "./DrugInfoCard.module.css";

interface DrugInfoCardProps {
  drug: SelectedDrug;
  label?: string; // "기준 약", "비교 약 1" 등
}

export default function DrugInfoCard({ drug, label }: DrugInfoCardProps) {
  const imgSrc = drug.pillImageUrl || drug.boxImageUrl;
  const isOtc  = drug.spcltPblc === "일반의약품";

  return (
    <div className={styles.card}>
      {/* 이미지 */}
      <div className={styles.imageWrap}>
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt={drug.itemName} className={styles.image} />
        ) : (
          <span className={styles.imageFallback}>💊</span>
        )}
      </div>

      {/* 정보 */}
      <div className={styles.info}>
        {label && <span style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--yb-text-muted)" }}>{label}</span>}
        <div className={styles.nameLine}>
          <span className={styles.name}>{drug.itemName}</span>
          {drug.spcltPblc && (
            <span className={[styles.typeBadge, isOtc ? styles.otc : ""].join(" ")}>
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
    </div>
  );
}
