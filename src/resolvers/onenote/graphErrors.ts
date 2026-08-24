import { toSearchableText } from './authErrors';
import type { AuthErrorOwner } from './authErrors';

export type GraphErrorKind = 'onenote-library-too-large' | 'unknown';

export interface GraphErrorInfo {
  kind: GraphErrorKind;
  code: string;
  owner: AuthErrorOwner;
  message: string;
}

/**
 * Graph verpackt seinen Fehlercode als `{"error":{"code":"10008", ...}}`. Der
 * Wert ist nicht immer numerisch — `accessDenied` und Verwandte kommen genauso
 * vor. `innerError` traegt kein `code`-Feld, der erste Treffer ist also der
 * aeussere Fehlercode.
 */
const GRAPH_CODE_PATTERN = /"code"\s*:\s*"([^"]+)"/;

const SUPPORT_HINT = 'Please contact PageFlow support.';

interface KnownGraphError {
  kind: GraphErrorKind;
  owner: AuthErrorOwner;
  message: string;
}

const KNOWN_ERRORS: Record<string, KnownGraphError> = {
  '10008': {
    kind: 'onenote-library-too-large',
    owner: 'tenant-admin',
    message:
      'Microsoft cannot list this notebook: the SharePoint document library holding it contains ' +
      'more than 5,000 OneNote items (notebooks, sections and section groups). Microsoft refuses ' +
      'to query such a library, for every application — this is not a permission problem. ' +
      'Use the "Local OneNote" tab to import an HTML export from OneNote Desktop instead, or ask ' +
      'your Microsoft 365 administrator to reduce the number of OneNote items in that library.',
  },
};

export function extractGraphErrorCode(raw: unknown): string | null {
  const match = GRAPH_CODE_PATTERN.exec(toSearchableText(raw));
  return match ? match[1] : null;
}

/**
 * Klassifiziert einen Fehler der OneNote-Endpunkte von Microsoft Graph.
 *
 * Gibt `null` zurueck, wenn kein Graph-Fehlercode enthalten ist — dann bleibt
 * die ursprueng­liche Fehlerbehandlung zustaendig.
 *
 * Die erzeugte Meldung enthaelt bewusst NIE den Originaltext von Microsoft:
 * der traegt Request-IDs und kann Konto-Bezeichner enthalten.
 */
export function classifyGraphError(raw: unknown): GraphErrorInfo | null {
  const code = extractGraphErrorCode(raw);
  if (code === null) return null;

  const known = KNOWN_ERRORS[code];
  if (known) {
    return { kind: known.kind, code, owner: known.owner, message: known.message };
  }

  return {
    kind: 'unknown',
    code,
    owner: 'unknown',
    message: `Microsoft OneNote refused the request with an unexpected error (${code}). ${SUPPORT_HINT}`,
  };
}

/**
 * Erzeugt eine stabile, maschinenlesbare Log-Zeile. Das Praefix ist der Anker
 * fuer die Forge-Alert-Regel und darf sich nicht aendern.
 */
export function formatGraphLogLine(info: GraphErrorInfo, context?: string): string {
  const suffix = context ? ` context=${context}` : '';
  return `[PageFlow][onenote-graph] kind=${info.kind} code=${info.code} owner=${info.owner}${suffix}`;
}
