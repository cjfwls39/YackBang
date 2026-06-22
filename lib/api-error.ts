/**
 * 실패한 API 응답에서 사용자에게 보여줄 메시지를 추출.
 * 서버가 { error: string } 형태로 내려주는 메시지를 우선 사용하고,
 * 파싱 실패 시 상태코드 기반 기본 문구로 대체.
 */
export async function getApiErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
  } catch {
    // 본문이 JSON이 아닌 경우 — 상태코드 기반 기본 문구로 폴백
  }

  if (res.status === 429) return "요청이 너무 많아요. 잠시 후 다시 시도해주세요.";
  if (res.status === 503) return "지금 이용자가 많아 서비스가 잠시 멈췄어요. 1분 후 다시 시도해주세요.";
  if (res.status === 400) return "요청 내용에 문제가 있어요. 다시 시도해주세요.";
  return "오류가 발생했어요. 잠시 후 다시 시도해주세요.";
}

/** fetch 자체가 실패한 경우(오프라인, DNS 등 — Response가 없음)의 메시지 */
export const NETWORK_ERROR_MESSAGE = "인터넷 연결을 확인해주세요.";
