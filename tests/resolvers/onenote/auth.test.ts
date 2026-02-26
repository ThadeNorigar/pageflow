import { checkAuthStatus, requestMicrosoftGraph, MsGraphError } from '../../../src/resolvers/onenote/auth';

const mockHasCredentials = jest.fn();
const mockRequestCredentials = jest.fn();
const mockFetch = jest.fn();

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asUser: () => ({
      withProvider: () => ({
        hasCredentials: () => mockHasCredentials(),
        requestCredentials: () => mockRequestCredentials(),
        fetch: (...args: unknown[]) => mockFetch(...args),
      }),
    }),
  },
}));

function graphResponse(body: object, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('checkAuthStatus', () => {
  beforeEach(() => {
    mockHasCredentials.mockReset();
    mockFetch.mockReset();
  });

  it('should return authenticated with user when credentials exist and /me succeeds', async () => {
    mockHasCredentials.mockResolvedValue(true);
    mockFetch.mockResolvedValue(
      graphResponse({ displayName: 'John Doe', mail: 'john@example.com' })
    );

    const result = await checkAuthStatus();

    expect(result).toEqual({
      authenticated: true,
      user: { displayName: 'John Doe', mail: 'john@example.com' },
    });
    expect(mockFetch).toHaveBeenCalledWith('/v1.0/me');
  });

  it('should return not authenticated when no credentials', async () => {
    mockHasCredentials.mockResolvedValue(false);

    const result = await checkAuthStatus();

    expect(result).toEqual({ authenticated: false });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return not authenticated with error on non-OK response', async () => {
    mockHasCredentials.mockResolvedValue(true);
    mockFetch.mockResolvedValue(
      graphResponse({ error: 'Unauthorized' }, false, 401)
    );

    const result = await checkAuthStatus();

    expect(result).toEqual({
      authenticated: false,
      error: 'Graph API error: 401',
    });
  });

  it('should return not authenticated with error on fetch exception', async () => {
    mockHasCredentials.mockResolvedValue(true);
    mockFetch.mockRejectedValue(new Error('Network failure'));

    const result = await checkAuthStatus();

    expect(result).toEqual({
      authenticated: false,
      error: 'Network failure',
    });
  });
});

describe('requestMicrosoftGraph', () => {
  beforeEach(() => {
    mockHasCredentials.mockReset();
    mockFetch.mockReset();
  });

  it('should fetch and return JSON for valid path', async () => {
    mockHasCredentials.mockResolvedValue(true);
    mockFetch.mockResolvedValue(
      graphResponse({ value: [{ id: '1', name: 'Notebook A' }] })
    );

    const result = await requestMicrosoftGraph<{ value: { id: string; name: string }[] }>(
      '/v1.0/me/onenote/notebooks'
    );

    expect(result).toEqual({ value: [{ id: '1', name: 'Notebook A' }] });
    expect(mockFetch).toHaveBeenCalledWith('/v1.0/me/onenote/notebooks');
  });

  it('should throw MsGraphError on non-OK response', async () => {
    mockHasCredentials.mockResolvedValue(true);
    mockFetch.mockResolvedValue(
      graphResponse({ error: { code: 'Forbidden', message: 'Access denied' } }, false, 403)
    );

    await expect(
      requestMicrosoftGraph('/v1.0/me/onenote/notebooks')
    ).rejects.toThrow(MsGraphError);

    try {
      await requestMicrosoftGraph('/v1.0/me/onenote/notebooks');
    } catch (err) {
      const msErr = err as MsGraphError;
      expect(msErr.status).toBe(403);
      expect(msErr.message).toContain('403');
      expect(msErr.body).toContain('Forbidden');
    }
  });

  it('should throw Error when no credentials available', async () => {
    mockHasCredentials.mockResolvedValue(false);

    await expect(
      requestMicrosoftGraph('/v1.0/me/onenote/notebooks')
    ).rejects.toThrow('No Microsoft credentials available. Please authenticate first.');

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
