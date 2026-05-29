"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { DrugSearchResult } from "@/types/drug";
import styles from "./SearchInput.module.css";

interface SearchInputProps {
  onSelect: (drug: DrugSearchResult) => void;
  selectedCount: number;
  maxCount?: number;
}

interface DropdownPos {
  top: number;
  left: number;
  width: number;
}

export default function SearchInput({
  onSelect,
  selectedCount,
  maxCount = 5,
}: SearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DrugSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos>({ top: 0, left: 0, width: 0 });

  const wrapperRef  = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFull = selectedCount >= maxCount;

  /* ── 클라이언트 마운트 확인 (portal SSR 방지) ── */
  useEffect(() => { setMounted(true); }, []);

  /* ── 드롭다운 위치 계산 ── */
  const updatePos = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }, []);

  /* ── 스크롤·리사이즈 시 위치 갱신 ── */
  useEffect(() => {
    if (!isOpen) return;
    const onScroll = () => updatePos();
    const onResize = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [isOpen, updatePos]);

  /* ── 외부 클릭 시 드롭다운 닫기 ── */
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      // wrapper 내부 클릭이면 유지
      if (wrapperRef.current?.contains(target)) return;
      // portal 드롭다운 내부 클릭이면 유지
      const dropdown = document.getElementById("drug-search-dropdown");
      if (dropdown?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  /* ── 검색 API 호출 — 결과 배열 반환 (엔터 즉시검색에서 활용) ── */
  const fetchResults = useCallback(async (q: string): Promise<DrugSearchResult[]> => {
    if (q.trim().length < 1) {
      setResults([]);
      setIsOpen(false);
      return [];
    }
    setIsLoading(true);
    updatePos();
    try {
      const res = await fetch(`/api/drugs?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) throw new Error("search failed");
      const data: DrugSearchResult[] = await res.json();
      setResults(data);
      if (data.length > 0) setIsOpen(true);
      return data;
    } catch {
      setResults([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [updatePos]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(val), 300);
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();

    // 드롭다운이 열려있고 결과가 있으면 첫 번째 항목 바로 선택
    if (isOpen && results.length > 0) {
      handleSelect(results[0]);
      return;
    }

    // 즉시 검색 후 결과 수에 따라 분기
    if (query.trim().length >= 1) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const found = await fetchResults(query);
      // 결과가 정확히 1개면 자동 선택 (검색어가 불완전해도 바로 추가)
      if (found.length === 1) {
        handleSelect(found[0]);
      }
      // 여러 개면 드롭다운 표시 (이미 state 업데이트됨)
    }
  }

  function handleSelect(drug: DrugSearchResult) {
    onSelect(drug);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  /* ── 드롭다운 (portal) ── */
  const dropdown = isOpen && mounted
    ? createPortal(
        <div
          id="drug-search-dropdown"
          className={styles.dropdown}
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 200,
          }}
          role="listbox"
        >
          {isLoading && <p className={styles.loadingMsg}>검색 중...</p>}
          {!isLoading && results.length === 0 && (
            <p className={styles.emptyMsg}>&ldquo;{query}&rdquo; 검색 결과가 없어요.</p>
          )}
          {!isLoading &&
            results.map((drug) => {
              const imgSrc = drug.pillImageUrl || drug.boxImageUrl;
              return (
                <button
                  key={drug.itemSeq}
                  type="button"
                  role="option"
                  className={styles.dropdownItem}
                  onMouseDown={(e) => {
                    e.preventDefault(); // blur 방지
                    handleSelect(drug);
                  }}
                >
                  {imgSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgSrc} alt={drug.itemName} className={styles.itemThumb} loading="lazy" />
                  ) : (
                    <div className={styles.itemThumbEmpty}>💊</div>
                  )}
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{drug.itemName}</span>
                    <span className={styles.itemSub}>
                      {drug.entpName}
                      {drug.ingrKorName ? ` · ${drug.ingrKorName}` : ""}
                    </span>
                  </div>
                  {drug.spcltPblc && (
                    <span className={[styles.typeBadge, drug.spcltPblc === "일반의약품" ? styles.otc : ""].join(" ")}>
                      {drug.spcltPblc}
                    </span>
                  )}
                </button>
              );
            })}
        </div>,
        document.body
      )
    : null;

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={styles.inputRow}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) { updatePos(); setIsOpen(true); } }}
          placeholder={
            isFull
              ? `최대 ${maxCount}개까지 추가할 수 있어요`
              : "약 이름을 입력하세요 (예: 타이레놀)"
          }
          disabled={isFull}
          autoComplete="off"
          aria-label="의약품 검색"
          aria-autocomplete="list"
          aria-expanded={isOpen}
        />
        {query && (
          <button type="button" className={styles.clearBtn} onClick={handleClear} aria-label="검색어 지우기">
            ✕
          </button>
        )}
      </div>

      {!isFull && (
        <p className={styles.hint}>
          {selectedCount === 0
            ? "약 이름을 검색해서 추가하세요."
            : `${selectedCount}개 선택됨 · 최대 ${maxCount}개`}
        </p>
      )}

      {dropdown}
    </div>
  );
}
