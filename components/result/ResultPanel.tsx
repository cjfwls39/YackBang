"use client";

import { useState } from "react";
import type { SingleDrugResult, MultiDrugResult } from "@/types/drug";
import DrugInfoCard from "./DrugInfoCard";
import InteractionCard from "./InteractionCard";
import styles from "./ResultPanel.module.css";

// ─────────────────────────────────────
// 목업 데이터 (Supabase 연동 전 UI 확인용)
// ─────────────────────────────────────
const MOCK_SINGLE: SingleDrugResult = {
  drug: {
    itemSeq: "200300639",
    itemName: "심바로틴정20밀리그램(심바스타틴)",
    entpName: "알리코제약(주)",
    ingrKorName: "심바스타틴",
    spcltPblc: "전문의약품",
  },
  prohibitions: [
    {
      id: 1,
      ingrCode: "D000027",
      ingrKorName: "심바스타틴",
      mixtureIngrKorName: "이트라코나졸",
      mixtureItemName: "코니트라캡슐(이트라코나졸)",
      prohbtContent: "근병증, 횡문근융해의 위험증가",
      prohbtContentPlain:
        "근육이 심하게 손상되어 신장에 부담을 줄 수 있어요. (횡문근융해증)",
    },
    {
      id: 2,
      ingrCode: "D000027",
      ingrKorName: "심바스타틴",
      mixtureIngrKorName: "이트라코나졸고체분산체",
      mixtureItemName: "스포라녹스캡슐(이트라코나졸고체분산체)",
      prohbtContent: "근병증, 횡문근융해의 위험증가",
      prohbtContentPlain:
        "근육이 심하게 손상되어 신장에 부담을 줄 수 있어요. (횡문근융해증)",
    },
  ],
  pregnancyWarning: null,
};

const MOCK_MULTI: MultiDrugResult = {
  drugs: [
    {
      itemSeq: "200300639",
      itemName: "심바로틴정20밀리그램(심바스타틴)",
      entpName: "알리코제약(주)",
      ingrKorName: "심바스타틴",
      spcltPblc: "전문의약품",
    },
    {
      itemSeq: "200000913",
      itemName: "코니트라캡슐(이트라코나졸)(수출용)",
      entpName: "코오롱제약(주)",
      ingrKorName: "이트라코나졸",
      spcltPblc: "전문의약품",
    },
  ],
  dangerPairs: [
    {
      drugA: {
        itemSeq: "200300639",
        itemName: "심바로틴정20밀리그램(심바스타틴)",
        entpName: "알리코제약(주)",
        ingrKorName: "심바스타틴",
        spcltPblc: "전문의약품",
      },
      drugB: {
        itemSeq: "200000913",
        itemName: "코니트라캡슐(이트라코나졸)(수출용)",
        entpName: "코오롱제약(주)",
        ingrKorName: "이트라코나졸",
        spcltPblc: "전문의약품",
      },
      prohibition: {
        id: 1,
        ingrCode: "D000027",
        ingrKorName: "심바스타틴",
        mixtureIngrKorName: "이트라코나졸",
        mixtureItemName: "코니트라캡슐(이트라코나졸)",
        prohbtContent: "근병증, 횡문근융해의 위험증가",
        prohbtContentPlain:
          "근육이 심하게 손상되어 신장에 부담을 줄 수 있어요. (횡문근융해증)",
      },
    },
  ],
  isSafe: false,
};

// ─────────────────────────────────────

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "single"; data: SingleDrugResult }
  | { status: "multi"; data: MultiDrugResult };

interface ResultPanelProps {
  state: ResultState;
}

export default function ResultPanel({ state }: ResultPanelProps) {
  const [demoMode, setDemoMode] = useState<"single" | "multi" | null>(null);

  // 데모 모드 오버라이드
  const effective: ResultState =
    demoMode === "single"
      ? { status: "single", data: MOCK_SINGLE }
      : demoMode === "multi"
      ? { status: "multi", data: MOCK_MULTI }
      : state;

  /* ── idle ── */
  if (effective.status === "idle") {
    return (
      <section className={styles.panel}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>💊</span>
          <h2 className={styles.emptyTitle}>약을 검색해보세요</h2>
          <p className={styles.emptyDesc}>
            왼쪽에서 약을 추가하고
            <br />
            <strong>조회 버튼</strong>을 누르면
            <br />
            결과를 여기에 보여드려요.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.5rem" }}>
            <button className={styles.demoBtn} onClick={() => setDemoMode("single")}>
              단일 조회 미리보기
            </button>
            <button className={styles.demoBtn} onClick={() => setDemoMode("multi")}>
              병용 비교 미리보기
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ── loading ── */
  if (effective.status === "loading") {
    return (
      <section className={styles.panel}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>정보를 불러오는 중...</p>
        </div>
      </section>
    );
  }

  /* ── 오류 ── */
  if (effective.status === "error") {
    return (
      <section className={styles.panel}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>⚠️</span>
          <h2 className={styles.emptyTitle}>오류가 발생했어요</h2>
          <p className={styles.emptyDesc}>{effective.message}</p>
        </div>
      </section>
    );
  }

  /* ── 단일 조회 결과 ── */
  if (effective.status === "single") {
    const { data } = effective;
    const hasProhibitions = data.prohibitions.length > 0;

    return (
      <section className={styles.panel}>
        <div className={styles.content}>
          {demoMode && (
            <button className={styles.demoBtn} onClick={() => setDemoMode(null)} style={{ alignSelf: "flex-start" }}>
              ← 미리보기 닫기
            </button>
          )}

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
  if (effective.status === "multi") {
    const { data } = effective;

    return (
      <section className={styles.panel}>
        <div className={styles.content}>
          {demoMode && (
            <button className={styles.demoBtn} onClick={() => setDemoMode(null)} style={{ alignSelf: "flex-start" }}>
              ← 미리보기 닫기
            </button>
          )}

          {/* 요약 배너 */}
          <div className={[styles.summary, data.isSafe ? styles.safe : styles.danger].join(" ")}>
            <span className={styles.summaryIcon}>{data.isSafe ? "✅" : "⚠️"}</span>
            <div className={styles.summaryTexts}>
              <p className={styles.summaryTitle}>
                {data.isSafe
                  ? "위험한 조합이 없어요"
                  : `${data.dangerPairs.length}가지 위험한 조합이 있어요`}
              </p>
              <p className={styles.summarySub}>
                {data.isSafe
                  ? `선택한 ${data.drugs.length}개 약 사이에 알려진 병용금기가 없어요.`
                  : "함께 복용하면 안 되는 조합이 발견됐어요."}
              </p>
            </div>
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

          {/* 위험 조합 */}
          {data.dangerPairs.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>
                위험한 조합 ({data.dangerPairs.length}건)
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

          {data.isSafe && (
            <div className={styles.safeBadge}>
              ✅ 선택한 약들 사이에 알려진 병용금기가 없습니다.
            </div>
          )}
        </div>
      </section>
    );
  }

  return null;
}
