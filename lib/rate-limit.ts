/**
 * 인메모리 Rate Limiter + 글로벌 회로 차단기 (슬라이딩 윈도우)
 *
 * ⚠️ Vercel 서버리스 특성상 인스턴스별 독립 카운트.
 *    콜드스타트 시 카운터가 리셋되므로 완전한 분산 제한은 아님.
 *    포트폴리오 규모에서는 충분히 유효하며, 트래픽이 늘면 Upstash Redis로 교체.
 *
 * 현재 한도:
 *   /api/drugs       — IP당 분당  60회 / 전체 분당 300회
 *   /api/interaction — IP당 분당   5회 / 전체 분당  50회
 *
 * 글로벌 키 규칙: "global:{endpoint}" (예: "global:drugs")
 * 전체 요청이 임계값을 초과하면 503을 반환 — 사실상 서버 셧다운 효과.
 * 비정상 트래픽(봇·스크립트 공격) 감지 시 모든 IP를 차단해 과금·장애를 방지.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// 오래된 엔트리 정리 (메모리 누수 방지 — 10분마다 실행)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 10 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

/**
 * @param key      — 식별자 (예: "drugs:1.2.3.4")
 * @param max      — 윈도우 내 최대 허용 횟수
 * @param windowMs — 윈도우 크기 (밀리초)
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetInMs: windowMs };
  }

  entry.count++;
  const remaining = Math.max(0, max - entry.count);
  return {
    allowed: entry.count <= max,
    remaining,
    resetInMs: entry.resetAt - now,
  };
}
