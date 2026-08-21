export interface AuthStatusLike {
  authenticated: boolean;
  error?: string;
  errorKind?: string;
  errorCode?: string;
  errorOwner?: 'vendor' | 'tenant-admin' | 'unknown';
}

/**
 * Was der OneNote-Tab anzeigen soll, wenn keine Verbindung besteht.
 *
 * - `invite`          — noch nie versucht, normale Einladung
 * - `attempt-failed`  — es gab einen Verbindungsversuch, der nicht angekommen ist.
 *                       Forge hat den Fehler in seiner eigenen UI abgefangen, wir
 *                       kennen die Ursache nicht.
 * - `classified`      — der Resolver hat einen AADSTS-Fehler klassifiziert
 */
export type AuthViewState = 'invite' | 'attempt-failed' | 'classified';

export interface AuthFailureView {
  state: AuthViewState;
  /** true = die Anmeldung ist nachweislich fehlgeschlagen, nicht nur "noch nicht erfolgt" */
  isFailure: boolean;
  /** false = die Ursache liegt beim Anbieter, ein erneuter Versuch hilft nicht */
  canRetry: boolean;
  headline: string;
}

export const HEADLINE_CONNECT = 'Connect Microsoft Account';
export const HEADLINE_UNAVAILABLE = 'OneNote is currently unavailable';
export const HEADLINE_ATTEMPT_FAILED = 'Connection was not completed';

/**
 * Leitet aus dem Auth-Status ab, was der OneNote-Tab anzeigen soll.
 *
 * Ohne klassifizierten Fehler ist der Nutzer schlicht noch nicht verbunden — dann
 * gehört der Einladungstext hin. Mit klassifiziertem Fehler wäre dieselbe Einladung
 * irreführend, weil sie dem Nutzer die Schuld zuschiebt.
 *
 * `attemptFailed` deckt den Fall ab, den wir NICHT klassifizieren können: Forge fängt
 * den Fehler bei der Erstverbindung in seiner eigenen Oberfläche ab und gibt uns
 * weder Code noch Meldung. Ohne dieses Signal landet der Nutzer wieder bei derselben
 * Einladung und versucht es endlos erneut.
 */
export function deriveAuthFailureView(
  status: AuthStatusLike,
  attemptFailed = false
): AuthFailureView {
  const classified = !status.authenticated && Boolean(status.errorKind);
  if (classified) {
    return {
      state: 'classified',
      isFailure: true,
      canRetry: status.errorOwner !== 'vendor',
      headline: HEADLINE_UNAVAILABLE,
    };
  }

  if (!status.authenticated && attemptFailed) {
    return {
      state: 'attempt-failed',
      isFailure: true,
      // Die Ursache ist unbekannt — den Nutzer nicht aussperren
      canRetry: true,
      headline: HEADLINE_ATTEMPT_FAILED,
    };
  }

  return {
    state: 'invite',
    isFailure: false,
    canRetry: true,
    headline: HEADLINE_CONNECT,
  };
}
