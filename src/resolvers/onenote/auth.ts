import api from '@forge/api';
import {
  AuthErrorInfo,
  AuthErrorKind,
  AuthErrorOwner,
  classifyAuthError,
  formatAuthLogLine,
} from './authErrors';
import { GraphErrorInfo, classifyGraphError, formatGraphLogLine } from './graphErrors';

const PROVIDER_KEY = 'microsoft-graph';
const REMOTE_KEY = 'microsoft-graph-api';

export class MsGraphError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
    public authError?: AuthErrorInfo,
    public graphError?: GraphErrorInfo
  ) {
    super(message);
    this.name = 'MsGraphError';
  }
}

export interface AuthStatus {
  authenticated: boolean;
  user?: { displayName: string; mail: string };
  error?: string;
  errorKind?: AuthErrorKind;
  errorCode?: string;
  errorOwner?: AuthErrorOwner;
}

/**
 * Ohne Argument meldet hasCredentials() jeden gespeicherten Token als gueltig — auch
 * einen, der vor der Scope-Erweiterung ausgestellt wurde und nur Notes.Read traegt.
 * Der Nutzer saehe "Connected" und bekaeme beim Oeffnen eines geteilten Notizbuchs
 * weiterhin 403. Mit dem Scope als Argument gilt eine zu schmale Verbindung als
 * nicht vorhanden, und der normale Connect-Flow holt die breitere Zustimmung.
 */
const REQUIRED_SCOPES = ['Notes.Read.All'];

function getProvider() {
  return api.asUser().withProvider(PROVIDER_KEY, REMOTE_KEY);
}

/**
 * Forge sammelt console-Ausgaben der Resolver in den App-Logs; darauf greift die
 * Alert-Regel in der Developer Console zu. Nur klassifizierte Anmeldefehler landen
 * hier — kein Debug-Logging, keine Rohantwort von Microsoft.
 */
function logAuthError(info: AuthErrorInfo, context: string): void {
  console.error(formatAuthLogLine(info, context));
}

function toAuthStatusError(raw: unknown, context: string, fallback: string): AuthStatus {
  const info = classifyAuthError(raw);
  if (!info) {
    return { authenticated: false, error: fallback };
  }
  logAuthError(info, context);
  return {
    authenticated: false,
    error: info.message,
    errorKind: info.kind,
    errorCode: `AADSTS${info.code}`,
    errorOwner: info.owner,
  };
}

function buildGraphError(status: number, body: string): MsGraphError {
  const authInfo = classifyAuthError(body);
  if (authInfo) {
    logAuthError(authInfo, 'graph-request');
    return new MsGraphError(`${authInfo.message} (AADSTS${authInfo.code})`, status, body, authInfo);
  }

  // Kein Anmeldefehler: Graph meldet fachliche Fehler wie 10008 mit eigenem Code im Body.
  // Ohne diese Klassifizierung saehe der Nutzer nur den nackten HTTP-Status.
  const graphInfo = classifyGraphError(body);
  if (graphInfo) {
    console.error(formatGraphLogLine(graphInfo, 'graph-request'));
    return new MsGraphError(`${graphInfo.message} (HTTP ${status})`, status, body, undefined, graphInfo);
  }

  return new MsGraphError(`Microsoft Graph request failed: ${status}`, status, body);
}

export async function checkAuthStatus(): Promise<AuthStatus> {
  const provider = getProvider();

  if (!(await provider.hasCredentials(REQUIRED_SCOPES))) {
    return { authenticated: false };
  }

  try {
    const response = await provider.fetch('/v1.0/me');
    if (!response.ok) {
      const body = await response.text();
      return toAuthStatusError(body, 'auth-status', `Graph API error: ${response.status}`);
    }
    const user = await response.json();
    return {
      authenticated: true,
      user: { displayName: user.displayName, mail: user.mail },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toAuthStatusError(err, 'auth-status', message);
  }
}

export async function requestAuth(): Promise<void> {
  const provider = getProvider();
  await provider.requestCredentials(REQUIRED_SCOPES);
}

export async function requestMicrosoftGraph<T>(path: string): Promise<T> {
  const provider = getProvider();

  if (!(await provider.hasCredentials(REQUIRED_SCOPES))) {
    throw new Error('No Microsoft credentials available. Please authenticate first.');
  }

  const response = await provider.fetch(path);
  if (!response.ok) {
    const body = await response.text();
    throw buildGraphError(response.status, body);
  }

  return (await response.json()) as T;
}

export async function requestMicrosoftGraphBinary(
  path: string
): Promise<{ data: Buffer; contentType: string }> {
  const provider = getProvider();

  if (!(await provider.hasCredentials(REQUIRED_SCOPES))) {
    throw new Error('No Microsoft credentials available. Please authenticate first.');
  }

  // remoteUrl aus OneNote-HTML ist absolut; provider.fetch erwartet den Pfad relativ zur Remote-baseUrl
  const relativePath = path.replace(/^https:\/\/graph\.microsoft\.com/i, '');

  const response = await provider.fetch(relativePath);
  if (!response.ok) {
    const body = await response.text();
    throw buildGraphError(response.status, body);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    data: Buffer.from(arrayBuffer),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
  };
}

export async function requestMicrosoftGraphText(path: string): Promise<string> {
  const provider = getProvider();

  if (!(await provider.hasCredentials(REQUIRED_SCOPES))) {
    throw new Error('No Microsoft credentials available. Please authenticate first.');
  }

  const response = await provider.fetch(path);
  if (!response.ok) {
    const body = await response.text();
    throw buildGraphError(response.status, body);
  }

  return response.text();
}
