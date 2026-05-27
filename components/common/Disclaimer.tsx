import styles from "./Disclaimer.module.css";

export default function Disclaimer() {
  return (
    <aside className={styles.disclaimer} role="note" aria-label="면책 고지">
      <div className={styles.inner}>
        <span className={styles.icon}>⚠️</span>
        <p className={styles.text}>
          <strong>이 서비스는 참고용 정보만 제공합니다.</strong>{" "}
          실제 복약 여부는 반드시 의사 또는 약사와 상담하시기 바랍니다.
        </p>
      </div>
    </aside>
  );
}
