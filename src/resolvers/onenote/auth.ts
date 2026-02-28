import api from '@forge/api';

const PROVIDER_KEY = 'microsoft-graph';
const REMOTE_KEY = 'microsoft-graph-api';

export class MsGraphError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string
  ) {
    super(message);
    this.name = 'MsGraphError';
  }
}

function getProvider() {
  return api.asUser().withProvider(PROVIDER_KEY, REMOTE_KEY);
}

export async function checkAuthStatus(): Promise<{
  authenticated: boolean;
  user?: { displayName: string; mail: string };
  error?: string;
}> {
  const provider = getProvider();

  if (!(await provider.hasCredentials())) {
    return { authenticated: false };
  }

  try {
    const response = await provider.fetch('/v1.0/me');
    if (!response.ok) {
      return { authenticated: false, error: `Graph API error: ${response.status}` };
    }
    const user = await response.json();
    return {
      authenticated: true,
      user: { displayName: user.displayName, mail: user.mail },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { authenticated: false, error: message };
  }
}

export async function requestAuth(): Promise<void> {
  const provider = getProvider();
  if (!(await provider.hasCredentials())) {
    await provider.requestCredentials();
  }
}

export async function requestMicrosoftGraph<T>(path: string): Promise<T> {
  const provider = getProvider();

  if (!(await provider.hasCredentials())) {
    throw new Error('No Microsoft credentials available. Please authenticate first.');
  }

  const response = await provider.fetch(path);
  if (!response.ok) {
    const body = await response.text();
    throw new MsGraphError(`Microsoft Graph request failed: ${response.status}`, response.status, body);
  }

  return (await response.json()) as T;
}
