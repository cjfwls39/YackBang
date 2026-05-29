import type { SelectedDrug } from "@/types/drug";

// URL에 저장할 최소 필드만 압축 (이미지 URL 등 무거운 필드 제외)
type CompactDrug = {
  s: string; // itemSeq
  n: string; // itemName
  e: string; // entpName
  i: string; // itemIngrName
  k: string; // ingrKorName
  p: string; // spcltPblc
};

/**
 * 약 목록 → URL-safe base64 문자열 (UTF-8 완전 지원)
 * ?q= 파라미터로 사용.
 * TextEncoder 기반이라 한글·특수문자도 안전하게 인코딩됨.
 */
export function encodeDrugsForUrl(drugs: SelectedDrug[]): string {
  const compact: CompactDrug[] = drugs.map((d) => ({
    s: d.itemSeq,
    n: d.itemName,
    e: d.entpName ?? "",
    i: d.itemIngrName ?? "",
    k: d.ingrKorName ?? "",
    p: d.spcltPblc ?? "",
  }));

  const json = JSON.stringify(compact);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));

  // URL-safe base64 (+→-, /→_, 패딩 = 제거)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * URL-safe base64 → 약 목록
 * 복호화 실패(변조·만료·잘못된 형식) 시 null 반환.
 */
export function decodeDrugsFromUrl(encoded: string): SelectedDrug[] | null {
  try {
    // URL-safe → standard base64
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const json = new TextDecoder().decode(bytes);
    const compact: CompactDrug[] = JSON.parse(json);

    // 기본 검증: 배열, 1~5개
    if (!Array.isArray(compact) || compact.length === 0 || compact.length > 5) return null;

    return compact.map((d) => ({
      itemSeq:      d.s,
      itemName:     d.n,
      entpName:     d.e || "",
      itemIngrName: d.i || undefined,
      ingrKorName:  d.k || undefined,
      spcltPblc:    d.p || undefined,
    }));
  } catch {
    return null;
  }
}
