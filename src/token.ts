export interface TokenStatus {
  expiresAt: Date | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  remainingMs: number | null;
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const json = Buffer.from(payload, "base64").toString("utf-8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getTokenStatus(token: string): TokenStatus {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") {
    return { expiresAt: null, isExpired: false, isExpiringSoon: false, remainingMs: null };
  }

  const expiresAt = new Date(payload.exp * 1000);
  const now = Date.now();
  const remainingMs = expiresAt.getTime() - now;
  const fiveMinutes = 5 * 60 * 1000;

  return {
    expiresAt,
    isExpired: remainingMs <= 0,
    isExpiringSoon: remainingMs > 0 && remainingMs <= fiveMinutes,
    remainingMs,
  };
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "expired";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0 && days === 0) parts.push(`${minutes % 60}m`);
  if (parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}
