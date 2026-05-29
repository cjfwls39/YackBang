"use client";

import { useState } from "react";
import type {
  SingleDrugResult,
  MultiDrugResult,
  DurElderlyCaution,
  DurAgeRestriction,
  DurDosageCaution,
  DurDurationCaution,
  DurTabletSplitCaution,
  EasyDrugInfo,
  LabelWarning,
} from "@/types/drug";
import DrugInfoCard from "./DrugInfoCard";
import InteractionCard from "./InteractionCard";
import SkeletonPanel from "./SkeletonPanel";
import GuidePanel from "./GuidePanel";
import styles from "./ResultPanel.module.css";

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "single"; data: SingleDrugResult }
  | { status: "multi"; data: MultiDrugResult };

interface ResultPanelProps {
  state: ResultState;
  shareUrl?: string | null;
}

// ── 링크 복사 버튼 ─────────────────────────────────────────────
function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API 미지원 환경 → 조용히 무시
    }
  };

  return (
    <button
      type="button"
      className={[styles.shareBtn, copied ? styles.shareBtnCopied : ""].join(" ")}
      onClick={handleCopy}
      title="이 결과 링크를 클립보드에 복사"
    >
      {copied ? "✓ 복사됨" : "🔗 링크 복사"}
    </button>
  );
}

// ── 개별 주의 항목 ────────────────────────────────────────────
function CautionItem({ icon, label, content }: { icon: string; label: string; content: string }) {
  return (
    <div className={styles.cautionItem}>
      <span className={styles.cautionIcon}>{icon}</span>
      <div className={styles.cautionBody}>
        {label && <span className={styles.cautionLabel}>{label}</span>}
        <p className={styles.cautionText}>{content}</p>
      </div>
    </div>
  );
}

// ── 단일 약 추가 주의사항 섹션 ────────────────────────────────
function SingleCautionSections({
  elderlyCautions,
  ageRestrictions,
  dosageCautions,
  durationCautions,
  tabletSplitCautions,
}: {
  elderlyCautions: DurElderlyCaution[];
  ageRestrictions: DurAgeRestriction[];
  dosageCautions: DurDosageCaution[];
  durationCautions: DurDurationCaution[];
  tabletSplitCautions: DurTabletSplitCaution[];
}) {
  const hasAny =
    elderlyCautions.length > 0 ||
    ageRestrictions.length > 0 ||
    dosageCautions.length > 0 ||
    durationCautions.length > 0 ||
    tabletSplitCautions.length > 0;

  if (!hasAny) return null;

  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>추가 주의사항</p>
      <div className={styles.cautionGroup}>
        {elderlyCautions.map((c) => (
          <CautionItem
            key={c.id}
            icon="👴"
            label={c.className ?? "노인 주의"}
            content={c.note ?? "고령 환자는 복용 전 의사·약사와 상담하세요."}
          />
        ))}
        {ageRestrictions.map((c) => (
          <CautionItem
            key={c.id}
            icon="🚫"
            label="특정 연령대 금기"
            content={c.prohbtContent ?? "특정 연령대 사용 금기 — 복용 전 반드시 확인하세요."}
          />
        ))}
        {dosageCautions.map((c) => (
          <CautionItem
            key={c.id}
            icon="⚖️"
            label={c.className ?? "용량 주의"}
            content={c.note ?? "용량 조절이 필요할 수 있어요. 의사·약사와 상담하세요."}
          />
        ))}
        {durationCautions.map((c) => (
          <CautionItem
            key={c.id}
            icon="⏱️"
            label={c.className ?? "투여기간 주의"}
            content={c.note ?? "장기 복용 시 주의가 필요해요. 임의로 기간을 늘리지 마세요."}
          />
        ))}
        {tabletSplitCautions.map((c) => (
          <CautionItem
            key={c.id}
            icon="💊"
            label={c.className ?? "서방정 분할 금지"}
            content={c.note ?? "이 약은 분할하거나 씹어 복용하면 안 돼요. 통째로 삼키세요."}
          />
        ))}
      </div>
    </div>
  );
}

// ── 심각도 설정 ─────────────────────────────────────────────
const LABEL_SEVERITY_CFG = {
  prohibited: {
    icon: "🚫", label: "복용 금지",
    cardCls: "",            headerCls: "",
    badgeCls: "",
    desc: "의 허가정보에서 복용 금지 약물로 명시되어 있어요.",
  },
  avoid: {
    icon: "⚠️", label: "병용 피할 것",
    cardCls: styles.warningCardOrange, headerCls: styles.labelHeaderOrange,
    badgeCls: styles.warningBadgeOrange,
    desc: "의 허가정보에서 병용을 피하도록 권고하고 있어요.",
  },
  consult: {
    icon: "💬", label: "복용 전 상의",
    cardCls: styles.labelWarnCardYellow, headerCls: styles.labelHeaderYellow,
    badgeCls: styles.labelWarnBadgeYellow,
    desc: "의 허가정보에서 복용 전 의사·약사와 상담하도록 명시되어 있어요.",
  },
  caution: {
    icon: "ℹ️", label: "주의 필요",
    cardCls: styles.labelWarnCardBlue, headerCls: styles.labelHeaderBlue,
    badgeCls: styles.labelWarnBadgeBlue,
    desc: "의 허가정보에서 함께 복용 시 주의가 필요하다고 명시되어 있어요.",
  },
} as const;

// ── 허가정보 레이블 경고 카드 ──────────────────────────────────
function LabelWarningCard({ warning }: { warning: LabelWarning }) {
  const [showText, setShowText] = useState(false);
  const cfg = LABEL_SEVERITY_CFG[warning.severity];

  return (
    <div className={[styles.warningCard, cfg.cardCls].join(" ")}>
      <div className={[styles.warningCardHeader, cfg.headerCls].join(" ")}>
        <span className={[styles.warningBadge, cfg.badgeCls].join(" ")}>
          {cfg.icon} {cfg.label}
        </span>
        <div className={styles.warningPair}>
          <span className={styles.warnIngrName}>
            {warning.drugA.ingrKorName ?? warning.drugA.itemName}
          </span>
          <span className={styles.warnArrow}>↔</span>
          <span className={styles.warnIngrName}>
            {warning.drugB.ingrKorName ?? warning.drugB.itemName}
          </span>
        </div>
      </div>
      <div className={styles.warningCardBody}>
        <p className={styles.warningText}>
          <strong>{warning.drugA.ingrKorName ?? warning.drugA.itemName}</strong>
          {cfg.desc}
          <br />
          <span className={styles.labelMatchedNames}>
            언급된 약물·계열: {warning.matchedNames.join(", ")}
          </span>
        </p>
        {warning.briefReason && (
          <p className={styles.labelBriefReason}>{warning.briefReason}</p>
        )}
        <p className={styles.labelSource}>
          출처: 식약처 허가정보 · {warning.articleTitle}
        </p>
        <button
          type="button"
          className={styles.labelToggleBtn}
          onClick={() => setShowText((v) => !v)}
        >
          {showText ? "▲ 원문 닫기" : "▼ 원문 보기"}
        </button>
        {showText && (
          <p className={styles.labelOriginalText}>{warning.rawText}</p>
        )}
      </div>
    </div>
  );
}

// ── e약은요 복약 안내 섹션 ────────────────────────────────────
function EasyDrugInfoSection({ info }: { info: EasyDrugInfo }) {
  const [open, setOpen] = useState(false);

  const sections: Array<{ label: string; icon: string; text: string }> = [
    info.atpnWarnQesitm ? { label: "경고", icon: "🚨", text: info.atpnWarnQesitm } : null,
    info.intrcQesitm    ? { label: "다른 약과 함께 복용 시", icon: "🔗", text: info.intrcQesitm } : null,
    info.atpnQesitm     ? { label: "주의사항", icon: "⚠️", text: info.atpnQesitm } : null,
    info.seQesitm       ? { label: "이상반응(부작용)", icon: "📋", text: info.seQesitm } : null,
  ].filter(Boolean) as Array<{ label: string; icon: string; text: string }>;

  if (!sections.length) return null;

  return (
    <div className={styles.easySection}>
      <button
        className={styles.easyToggle}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className={styles.easyToggleLeft}>
          <span className={styles.easyIcon}>💬</span>
          <span className={styles.easyTitle}>복약 안내 (e약은요)</span>
          <span className={styles.easyBadge}>{sections.length}개 항목</span>
        </span>
        <span className={styles.easyChevron}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className={styles.easyBody}>
          {sections.map(({ label, icon, text }) => (
            <div key={label} className={styles.easyItem}>
              <div className={styles.easyItemHeader}>
                <span>{icon}</span>
                <span className={styles.easyItemLabel}>{label}</span>
              </div>
              <p className={styles.easyItemText}>
                {text.split("\n").map((line, i) =>
                  line.trim() ? <span key={i}>{line}<br /></span> : null
                )}
              </p>
            </div>
          ))}
          <p className={styles.easySource}>
            출처: 식약처 e약은요 서비스 — 정보 제공 목적이며 복약 전 반드시 약사·의사와 상담하세요.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ResultPanel({ state, shareUrl }: ResultPanelProps) {
  /* ── idle: 위험 조합 가이드 ── */
  if (state.status === "idle") {
    return (
      <section className={styles.panel}>
        {/* 검색 안내 (작게) */}
        <div className={styles.idleHint}>
          <span className={styles.idleHintIcon}>💊</span>
          <span className={styles.idleHintText}>
            왼쪽에서 약을 검색해 추가하고 <strong>조회</strong>하면 결과를 보여드려요.
          </span>
        </div>

        {/* 위험 조합 가이드 (데스크탑 전용 — 모바일은 DrugPanel에 표시) */}
        <div className={styles.desktopOnly}>
          <GuidePanel />
        </div>
      </section>
    );
  }

  /* ── loading → 스켈레톤 UI ── */
  if (state.status === "loading") {
    return <SkeletonPanel />;
  }

  /* ── 오류 ── */
  if (state.status === "error") {
    return (
      <section className={styles.panel}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>⚠️</span>
          <h2 className={styles.emptyTitle}>오류가 발생했어요</h2>
          <p className={styles.emptyDesc}>{state.message}</p>
        </div>
      </section>
    );
  }

  /* ── 단일 조회 결과 ── */
  if (state.status === "single") {
    const { data } = state;
    const hasProhibitions = data.prohibitions.length > 0;

    return (
      <section className={styles.panel}>
        <div className={styles.content}>
          {/* 요약 배너 */}
          <div className={[styles.summary, hasProhibitions ? styles.danger : styles.safe].join(" ")}>
            <span className={styles.summaryIcon}>{hasProhibitions ? "⚠️" : "✅"}</span>
            <div className={styles.summaryTexts}>
              <p className={styles.summaryTitle}>
                {hasProhibitions
                  ? `${data.prohibitions.length}가지 병용금기가 있어요`
                  : "알려진 병용금기가 없어요"}
              </p>
              <p className={styles.summarySub}>
                {hasProhibitions
                  ? "아래 성분과 함께 복용하면 위험할 수 있어요."
                  : "현재 데이터베이스 기준으로는 금기 성분이 확인되지 않았어요."}
              </p>
            </div>
            {shareUrl && <ShareButton url={shareUrl} />}
          </div>

          {/* 약 정보 */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>약 정보</p>
            <DrugInfoCard drug={data.drug} />
          </div>

          {/* 임부금기 */}
          {data.pregnancyWarning && (
            <div className={styles.pregnancyBanner}>
              <span className={styles.pregnancyIcon}>🤰</span>
              <p className={styles.pregnancyText}>
                임산부 복용 주의 — {data.pregnancyWarning.prohbtContentPlain ?? data.pregnancyWarning.prohbtContent}
              </p>
            </div>
          )}

          {/* 병용금기 목록 */}
          {hasProhibitions && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>
                병용금기 목록 ({data.prohibitions.length}건)
              </p>
              {data.prohibitions.map((p) => (
                <InteractionCard
                  key={p.id}
                  ingrName={p.ingrKorName}
                  mixtureIngrName={p.mixtureIngrKorName}
                  mixtureItemName={p.mixtureItemName}
                  plainText={p.prohbtContentPlain ?? p.prohbtContent}
                  originalText={p.prohbtContent}
                />
              ))}
            </div>
          )}

          {/* 추가 주의사항 (노인/연령/용량/기간/서방정) */}
          <SingleCautionSections
            elderlyCautions={data.elderlyCautions}
            ageRestrictions={data.ageRestrictions}
            dosageCautions={data.dosageCautions}
            durationCautions={data.durationCautions}
            tabletSplitCautions={data.tabletSplitCautions}
          />

          {/* e약은요 복약 안내 */}
          {data.easyDrugInfo && (
            <EasyDrugInfoSection info={data.easyDrugInfo} />
          )}

          {!hasProhibitions && (
            <div className={styles.safeBadge}>
              ✅ 현재 등록된 병용금기 성분이 없습니다.
            </div>
          )}
        </div>
      </section>
    );
  }

  /* ── 병용 비교 결과 ── */
  if (state.status === "multi") {
    const { data } = state;
    const totalWarnings =
      data.dangerPairs.length +
      data.efficacyDuplicates.length +
      data.ingredientOverlaps.length +
      (data.labelWarnings?.length ?? 0);

    return (
      <section className={styles.panel}>
        <div className={styles.content}>
          {/* 요약 배너 */}
          <div className={[styles.summary, data.isSafe ? styles.safe : styles.danger].join(" ")}>
            <span className={styles.summaryIcon}>{data.isSafe ? "✅" : "⚠️"}</span>
            <div className={styles.summaryTexts}>
              <p className={styles.summaryTitle}>
                {data.isSafe
                  ? "위험한 조합이 없어요"
                  : `${totalWarnings}가지 주의사항이 있어요`}
              </p>
              <p className={styles.summarySub}>
                {data.isSafe
                  ? `선택한 ${data.drugs.length}개 약 사이에 알려진 금기가 없어요.`
                  : "아래 내용을 확인하고 반드시 약사·의사에게 상담하세요."}
              </p>
            </div>
            {shareUrl && <ShareButton url={shareUrl} />}
          </div>

          {/* 선택한 약 목록 */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>비교한 약 ({data.drugs.length}개)</p>
            {data.drugs.map((drug, i) => (
              <DrugInfoCard
                key={drug.itemSeq}
                drug={drug}
                label={i === 0 ? "기준 약" : `비교 약 ${i}`}
              />
            ))}
          </div>

          {/* 병용금기 쌍 */}
          {data.dangerPairs.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>
                🚫 병용금기 ({data.dangerPairs.length}건)
              </p>
              {data.dangerPairs.map((pair, i) => (
                <InteractionCard
                  key={i}
                  ingrName={pair.drugA.ingrKorName ?? pair.drugA.itemName}
                  mixtureIngrName={pair.drugB.ingrKorName ?? pair.drugB.itemName}
                  mixtureItemName={pair.prohibition.mixtureItemName}
                  plainText={pair.prohibition.prohbtContentPlain ?? pair.prohibition.prohbtContent}
                  originalText={pair.prohibition.prohbtContent}
                />
              ))}
            </div>
          )}

          {/* 효능군중복 */}
          {data.efficacyDuplicates.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>
                🔄 효능 중복 ({data.efficacyDuplicates.length}건)
              </p>
              {data.efficacyDuplicates.map((pair, i) => (
                <div key={i} className={styles.warningCard}>
                  <div className={styles.warningCardHeader}>
                    <span className={styles.warningBadge}>효능 중복</span>
                    <div className={styles.warningPair}>
                      <span className={styles.warnIngrName}>{pair.drugA.ingrKorName ?? pair.drugA.itemName}</span>
                      <span className={styles.warnArrow}>↔</span>
                      <span className={styles.warnIngrName}>{pair.drugB.ingrKorName ?? pair.drugB.itemName}</span>
                    </div>
                  </div>
                  <div className={styles.warningCardBody}>
                    <p className={styles.warningText}>
                      두 약이 같은 계열(
                      <strong>{pair.sersNames.join(", ")}</strong>
                      )이에요. 함께 복용하면 효과가 과도해지거나 부작용 위험이 높아질 수 있어요.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 성분 교집합 */}
          {data.ingredientOverlaps.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>
                ⚠️ 성분 중복 ({data.ingredientOverlaps.length}건)
              </p>
              {data.ingredientOverlaps.map((pair, i) => (
                <div key={i} className={[styles.warningCard, styles.warningCardOrange].join(" ")}>
                  <div className={styles.warningCardHeader}>
                    <span className={[styles.warningBadge, styles.warningBadgeOrange].join(" ")}>성분 중복</span>
                    <div className={styles.warningPair}>
                      <span className={styles.warnIngrName}>{pair.drugA.itemName}</span>
                      <span className={styles.warnArrow}>↔</span>
                      <span className={styles.warnIngrName}>{pair.drugB.itemName}</span>
                    </div>
                  </div>
                  <div className={styles.warningCardBody}>
                    <p className={styles.warningText}>
                      두 약에 모두{" "}
                      <strong>{pair.overlappingIngredients.join(", ")}</strong>
                      이(가) 들어 있어요. 같은 성분을 이중으로 복용하면 과용량이 될 수 있어요.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 허가정보 레이블 기반 상호작용 주의 */}
          {(data.labelWarnings?.length ?? 0) > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>
                📋 허가정보 기반 상호작용 주의 ({data.labelWarnings.length}건)
              </p>
              {data.labelWarnings.map((warn, i) => (
                <LabelWarningCard
                  key={`${warn.drugA.itemSeq}-${warn.drugB.itemSeq}-${i}`}
                  warning={warn}
                />
              ))}
            </div>
          )}

          {data.isSafe && (
            <div className={styles.safeBadge}>
              ✅ 선택한 약들 사이에 알려진 금기 및 상호작용이 없습니다.
            </div>
          )}
        </div>
      </section>
    );
  }

  return null;
}
