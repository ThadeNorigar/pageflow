export type AuthErrorKind =
  | 'invalid-client-secret'
  | 'expired-client-secret'
  | 'app-not-found'
  | 'account-type-not-supported'
  | 'admin-consent-required'
  | 'redirect-uri-mismatch'
  | 'unknown';

export type AuthErrorOwner = 'vendor' | 'tenant-admin' | 'unknown';

export interface AuthErrorInfo {
  kind: AuthErrorKind;
  code: string;
  owner: AuthErrorOwner;
  message: string;
}

// Codes sind unterschiedlich lang (z. B. 50011, 700016, 7000215) — nicht auf feste Länge festlegen
const AADSTS_PATTERN = /AADSTS(\d+)/i;

const SUPPORT_HINT = 'Please contact PageFlow support.';
const ADMIN_HINT = 'Please contact your Microsoft 365 administrator.';

interface KnownError {
  kind: AuthErrorKind;
  owner: AuthErrorOwner;
  message: string;
}

const KNOWN_ERRORS: Record<string, KnownError> = {
  '7000215': {
    kind: 'invalid-client-secret',
    owner: 'vendor',
    message: `PageFlow's Microsoft connection is misconfigured. The cause is on the app vendor's side, not with your Microsoft account. ${SUPPORT_HINT}`,
  },
  '7000222': {
    kind: 'expired-client-secret',
    owner: 'vendor',
    message: `The access key for PageFlow's Microsoft connection has expired and must be renewed by the app vendor. ${SUPPORT_HINT}`,
  },
  '700016': {
    kind: 'app-not-found',
    owner: 'vendor',
    message: `PageFlow's Microsoft application could not be found. The cause is on the app vendor's side. ${SUPPORT_HINT}`,
  },
  '50020': {
    kind: 'account-type-not-supported',
    owner: 'vendor',
    message: `Your Microsoft account is currently not accepted by the PageFlow application. The cause is a configuration issue on the app vendor's side. ${SUPPORT_HINT}`,
  },
  '65001': {
    kind: 'admin-consent-required',
    owner: 'tenant-admin',
    message: `Access to OneNote must be approved once by an administrator in your organisation. ${ADMIN_HINT}`,
  },
  '50011': {
    kind: 'redirect-uri-mismatch',
    owner: 'vendor',
    message: `The redirect address of PageFlow's Microsoft connection does not match the registered configuration. The cause is on the app vendor's side. ${SUPPORT_HINT}`,
  },
};

function hasStringProperty(value: object, key: string): boolean {
  return key in value && typeof (value as Record<string, unknown>)[key] === 'string';
}

function readStringProperty(value: object, key: string): string {
  return (value as Record<string, unknown>)[key] as string;
}

/**
 * Führt Message und Body eines Fehlers zu einem durchsuchbaren Text zusammen.
 * Der AADSTS-Code steckt je nach Fehlerpfad mal in der Message, mal im Response-Body.
 */
function toSearchableText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') return raw;

  if (typeof raw === 'object') {
    const parts: string[] = [];
    if (raw instanceof Error) {
      parts.push(raw.message);
    } else if (hasStringProperty(raw, 'message')) {
      parts.push(readStringProperty(raw, 'message'));
    }
    if (hasStringProperty(raw, 'body')) {
      parts.push(readStringProperty(raw, 'body'));
    }
    if (parts.length > 0) return parts.join(' ');
  }

  return String(raw);
}

export function extractAadstsCode(raw: unknown): string | null {
  const match = AADSTS_PATTERN.exec(toSearchableText(raw));
  return match ? match[1] : null;
}

/**
 * Klassifiziert einen Microsoft-Anmeldefehler.
 *
 * Gibt `null` zurück, wenn der Fehler kein AADSTS-Code ist — dann bleibt die
 * ursprüngliche Fehlerbehandlung zuständig (Netzwerkfehler, Graph-Fehler o. ä.).
 *
 * Die erzeugte Meldung enthält bewusst NIE den Originaltext von Microsoft:
 * der kann Tokens, Header oder Konto-Bezeichner enthalten.
 */
export function classifyAuthError(raw: unknown): AuthErrorInfo | null {
  const code = extractAadstsCode(raw);
  if (code === null) return null;

  const known = KNOWN_ERRORS[code];
  if (known) {
    return { kind: known.kind, code, owner: known.owner, message: known.message };
  }

  return {
    kind: 'unknown',
    code,
    owner: 'unknown',
    message: `Microsoft rejected the sign-in with an unexpected error (AADSTS${code}). ${SUPPORT_HINT}`,
  };
}

/**
 * Erzeugt eine stabile, maschinenlesbare Log-Zeile.
 * Das Präfix ist der Anker für die Forge-Alert-Regel und darf sich nicht ändern.
 */
export function formatAuthLogLine(info: AuthErrorInfo, context?: string): string {
  const suffix = context ? ` context=${context}` : '';
  return `[PageFlow][onenote-auth] kind=${info.kind} code=AADSTS${info.code} owner=${info.owner}${suffix}`;
}
