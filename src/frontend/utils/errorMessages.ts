// Forge erneuert den Bridge-Token regelmaessig. Bleibt ein Tab lange offen, scheitert
// der naechste invoke() mit "Token has expired: 1787330314 > 1787330251" — zwei rohe
// Unix-Zeitstempel, mit denen ein Endnutzer nichts anfangen kann. Es ist kein Defekt:
// ein Reload behebt es. Nicht zu verwechseln mit dem Microsoft-Token, den
// resolvers/onenote/authErrors.ts behandelt.

export const SESSION_EXPIRED_MESSAGE =
  'Your PageFlow session expired while this tab was open. Reload the page and try again.';

function toText(raw: unknown): string {
  if (raw instanceof Error) return raw.message;
  if (typeof raw === 'string') return raw;
  return '';
}

export function isSessionExpiredError(raw: unknown): boolean {
  const text = toText(raw);
  if (!text) return false;
  // Tolerant gegen Formulierungsaenderungen, aber beide Woerter muessen vorkommen —
  // sonst wuerde etwa ein abgelaufenes Microsoft-Secret faelschlich als Sitzungsablauf
  // gemeldet und der Nutzer laedt endlos neu.
  return /\btoken\b/i.test(text) && /\bexpired\b/i.test(text);
}

export function describeError(raw: unknown, fallback: string): string {
  if (isSessionExpiredError(raw)) return SESSION_EXPIRED_MESSAGE;
  const text = toText(raw);
  return text || fallback;
}
