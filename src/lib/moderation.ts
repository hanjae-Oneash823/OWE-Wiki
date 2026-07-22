const LINK_PATTERN = /https?:\/\/|www\./gi;
const SUSPICIOUS_LINK_COUNT = 3;

export function hasSuspiciousLinkDensity(content: string): boolean {
  const matches = content.match(LINK_PATTERN);
  return (matches?.length ?? 0) >= SUSPICIOUS_LINK_COUNT;
}
