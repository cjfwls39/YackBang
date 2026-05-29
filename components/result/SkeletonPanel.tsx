/**
 * SkeletonPanel — ResultPanel 로딩 상태 대체
 *
 * 실제 결과 레이아웃(배너 → 약 정보 카드 → 금기 카드 2개)을
 * 동일한 크기의 회색 블록으로 재현해 체감 로딩 시간을 단축.
 */
import styles from "./SkeletonPanel.module.css";

/** 개별 shimmer 블록 */
function Skel({
  width = "100%",
  height = "1rem",
  radius,
}: {
  width?: string;
  height?: string;
  radius?: string;
}) {
  return (
    <div
      className={styles.skel}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/** 약 정보 카드 스켈레톤 (DrugInfoCard 동일 레이아웃) */
function DrugCardSkel() {
  return (
    <div className={styles.drugCard}>
      {/* 이미지 영역 */}
      <Skel width="52px" height="52px" radius="8px" />
      {/* 텍스트 영역 */}
      <div className={styles.drugInfo}>
        <Skel width="65%" height="0.9rem" />
        <Skel width="40%" height="0.75rem" />
        <Skel width="50%" height="0.75rem" />
      </div>
    </div>
  );
}

/** 병용금기 카드 스켈레톤 (InteractionCard 동일 레이아웃) */
function InteractionCardSkel() {
  return (
    <div className={styles.interactionCard}>
      {/* 헤더: 뱃지 + 성분 쌍 */}
      <div className={styles.cardHeader}>
        <Skel width="72px" height="1.25rem" radius="999px" />
        <Skel width="55%" height="0.875rem" />
      </div>
      {/* 바디: 설명 텍스트 2줄 */}
      <div className={styles.cardBody}>
        <Skel width="100%" height="0.875rem" />
        <Skel width="78%" height="0.875rem" />
      </div>
    </div>
  );
}

export default function SkeletonPanel() {
  return (
    <section className={styles.panel} aria-busy="true" aria-label="결과 불러오는 중">
      <div className={styles.content}>

        {/* ── 요약 배너 스켈레톤 ── */}
        <div className={styles.bannerSkel}>
          <Skel width="2rem" height="2rem" radius="50%" />
          <div className={styles.bannerTexts}>
            <Skel width="55%" height="1rem" />
            <Skel width="72%" height="0.75rem" />
          </div>
        </div>

        {/* ── 약 정보 섹션 ── */}
        <div className={styles.section}>
          <Skel width="60px" height="0.6875rem" />
          <DrugCardSkel />
        </div>

        {/* ── 병용금기 목록 섹션 ── */}
        <div className={styles.section}>
          <Skel width="100px" height="0.6875rem" />
          <InteractionCardSkel />
          <InteractionCardSkel />
        </div>

      </div>
    </section>
  );
}
