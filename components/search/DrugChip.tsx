"use client";

import type { SelectedDrug } from "@/types/drug";
import styles from "./DrugChip.module.css";

type ChipStatus = "default" | "reference" | "safe" | "warning" | "danger";

interface DrugChipProps {
  drug: SelectedDrug;
  status?: ChipStatus;
  isReference?: boolean;
  onRemove: (itemSeq: string) => void;
}

const STATUS_LABELS: Record<ChipStatus, string> = {
  default:   "선택됨",
  reference: "기준",
  safe:      "안전",
  warning:   "주의",
  danger:    "위험",
};

export default function DrugChip({
  drug,
  status = "default",
  isReference = false,
  onRemove,
}: DrugChipProps) {
  const effectiveStatus: ChipStatus = isReference ? "reference" : status;

  return (
    <div
      className={[styles.chip, styles[effectiveStatus]].join(" ")}
      title={drug.itemName}
    >
      <span className={styles.badge}>{STATUS_LABELS[effectiveStatus]}</span>
      <span className={styles.name}>{drug.itemName}</span>
      <button
        type="button"
        className={styles.removeBtn}
        onClick={() => onRemove(drug.itemSeq)}
        aria-label={`${drug.itemName} 제거`}
      >
        ✕
      </button>
    </div>
  );
}
