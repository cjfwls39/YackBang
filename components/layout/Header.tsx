import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* 로고 + 서비스명 */}
        <a href="/" className={styles.brand}>
          <div className={styles.icon}>
            <span className={styles.iconText}>약</span>
          </div>
          <div className={styles.titles}>
            <span className={styles.name}>약방</span>
            <span className={styles.tagline}>의약품 병용금기 확인기</span>
          </div>
        </a>

      </div>
    </header>
  );
}
