export interface AuthStatusLike {
  authenticated: boolean;
  error?: string;
  errorKind?: string;
  errorCode?: string;
  errorOwner?: 'vendor' | 'tenant-admin' | 'unknown';
}

export interface AuthFailureView {
  /** true = die Anmeldung ist nachweislich fehlgeschlagen, nicht nur "noch nicht erfolgt" */
  isFailure: boolean;
  /** false = die Ursache liegt beim Anbieter, ein erneuter Versuch hilft nicht */
  canRetry: boolean;
  headline: string;
}

export const HEADLINE_CONNECT = 'Connect Microsoft Account';
export const HEADLINE_UNAVAILABLE = 'OneNote is currently unavailable';

/**
 * Leitet aus dem Auth-Status ab, was der OneNote-Tab anzeigen soll.
 *
 * Ohne klassifizierten Fehler ist der Nutzer schlicht noch nicht verbunden — dann
 * gehört der Einladungstext hin. Mit klassifiziertem Fehler wäre dieselbe Einladung
 * irreführend, weil sie dem Nutzer die Schuld zuschiebt.
 */
export function deriveAuthFailureView(status: AuthStatusLike): AuthFailureView {
  const isFailure = !status.authenticated && Boolean(status.errorKind);
  return {
    isFailure,
    canRetry: !isFailure || status.errorOwner !== 'vendor',
    headline: isFailure ? HEADLINE_UNAVAILABLE : HEADLINE_CONNECT,
  };
}
