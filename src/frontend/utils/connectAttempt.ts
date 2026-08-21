const STORAGE_KEY = 'pageflow.onenote.connectAttempt';

/**
 * Ein Verbindungsversuch gilt nach dieser Zeit als veraltet. Der Nutzer soll nicht
 * Tage spaeter noch einen Fehlerhinweis sehen, nur weil er einmal abgebrochen hat.
 */
export const ATTEMPT_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Fallback, falls die Forge-Sandbox sessionStorage verweigert. Ueberlebt den Reload
 * dann zwar nicht, aber der Code bleibt funktionsfaehig statt zu werfen.
 */
let inMemoryTimestamp: number | null = null;

function readStorage(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: string): boolean {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorage(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sandbox verweigert Storage — der In-Memory-Wert unten wird trotzdem geleert
  }
}

/**
 * Merkt sich, dass ein Verbindungsversuch gestartet wurde.
 *
 * Muss VOR `requestAuth` aufgerufen werden: Forge ersetzt danach die gesamte
 * Oberflaeche durch seine eigene Consent-UI, wodurch diese Komponente unmountet.
 * Kommt der Nutzer unverbunden zurueck, ist dieser Eintrag der einzige Hinweis
 * darauf, dass ueberhaupt ein Versuch stattgefunden hat.
 */
export function markConnectAttempt(now: number): void {
  inMemoryTimestamp = now;
  writeStorage(String(now));
}

export function clearConnectAttempt(): void {
  inMemoryTimestamp = null;
  removeStorage();
}

export function hasRecentConnectAttempt(now: number): boolean {
  const raw = readStorage();
  const stored = raw === null ? inMemoryTimestamp : Number(raw);

  if (stored === null || !Number.isFinite(stored)) return false;
  // Zeitstempel aus der Zukunft (verstellte Uhr) nicht als gueltig werten
  if (stored > now) return false;

  return now - stored <= ATTEMPT_MAX_AGE_MS;
}
