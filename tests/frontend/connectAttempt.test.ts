/**
 * @jest-environment jsdom
 */
import {
  markConnectAttempt,
  clearConnectAttempt,
  hasRecentConnectAttempt,
  ATTEMPT_MAX_AGE_MS,
} from '../../src/frontend/utils/connectAttempt';

const NOW = 1_787_000_000_000;

describe('connectAttempt', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearConnectAttempt();
  });

  it('meldet ohne Versuch nichts', () => {
    expect(hasRecentConnectAttempt(NOW)).toBe(false);
  });

  it('merkt sich einen Versuch', () => {
    markConnectAttempt(NOW);

    expect(hasRecentConnectAttempt(NOW)).toBe(true);
  });

  it('ueberlebt einen Neuaufbau der Komponente (Wert liegt im sessionStorage)', () => {
    markConnectAttempt(NOW);
    // Forge ersetzt die Oberflaeche: Modul-State waere weg, sessionStorage nicht
    clearConnectAttemptInMemoryOnly();

    expect(hasRecentConnectAttempt(NOW + 1000)).toBe(true);
  });

  it('vergisst den Versuch nach erfolgreicher Verbindung', () => {
    markConnectAttempt(NOW);
    clearConnectAttempt();

    expect(hasRecentConnectAttempt(NOW)).toBe(false);
  });

  it('wertet einen alten Versuch nicht mehr als aktuell', () => {
    markConnectAttempt(NOW);

    expect(hasRecentConnectAttempt(NOW + ATTEMPT_MAX_AGE_MS)).toBe(true);
    expect(hasRecentConnectAttempt(NOW + ATTEMPT_MAX_AGE_MS + 1)).toBe(false);
  });

  it('ignoriert Zeitstempel aus der Zukunft (verstellte Uhr)', () => {
    markConnectAttempt(NOW + 60_000);

    expect(hasRecentConnectAttempt(NOW)).toBe(false);
  });

  it('ignoriert unbrauchbaren Inhalt im Storage', () => {
    window.sessionStorage.setItem('pageflow.onenote.connectAttempt', 'kaputt');

    expect(hasRecentConnectAttempt(NOW)).toBe(false);
  });

  it('wirft nicht, wenn die Sandbox sessionStorage verweigert', () => {
    const original = window.sessionStorage.setItem;
    window.sessionStorage.setItem = () => {
      throw new Error('SecurityError');
    };

    expect(() => markConnectAttempt(NOW)).not.toThrow();
    // Fallback im Speicher greift weiterhin
    expect(hasRecentConnectAttempt(NOW)).toBe(true);

    window.sessionStorage.setItem = original;
  });
});

/** Simuliert den Modul-Neuaufbau: nur der In-Memory-Fallback geht verloren. */
function clearConnectAttemptInMemoryOnly(): void {
  const saved = window.sessionStorage.getItem('pageflow.onenote.connectAttempt');
  clearConnectAttempt();
  if (saved !== null) {
    window.sessionStorage.setItem('pageflow.onenote.connectAttempt', saved);
  }
}
