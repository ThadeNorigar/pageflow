import { getSpaces } from '../../../src/resolvers/confluence/spaces';

const mockRequestConfluence = jest.fn();
jest.mock('@forge/api', () => ({
  requestConfluence: (...args: unknown[]) => mockRequestConfluence(...args),
}));

function apiResponse(body: object, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('getSpaces', () => {
  beforeEach(() => {
    mockRequestConfluence.mockReset();
  });

  it('should call GET /wiki/api/v2/spaces', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [], _links: {} })
    );

    await getSpaces();

    expect(mockRequestConfluence).toHaveBeenCalledWith(
      expect.stringContaining('/wiki/api/v2/spaces'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should return mapped space objects', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        results: [
          { id: '1', key: 'DEV', name: 'Development', type: 'global' },
          { id: '2', key: 'HR', name: 'Human Resources', type: 'personal' },
        ],
        _links: {},
      })
    );

    const spaces = await getSpaces();

    expect(spaces).toEqual([
      { id: '1', key: 'DEV', name: 'Development', type: 'global' },
      { id: '2', key: 'HR', name: 'Human Resources', type: 'personal' },
    ]);
  });

  it('should return empty array for empty response', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [], _links: {} })
    );

    const spaces = await getSpaces();

    expect(spaces).toEqual([]);
  });

  it('should handle cursor-based pagination', async () => {
    mockRequestConfluence
      .mockResolvedValueOnce(
        apiResponse({
          results: [{ id: '1', key: 'A', name: 'Alpha', type: 'global' }],
          _links: { next: '/wiki/api/v2/spaces?cursor=abc123' },
        })
      )
      .mockResolvedValueOnce(
        apiResponse({
          results: [{ id: '2', key: 'B', name: 'Beta', type: 'global' }],
          _links: {},
        })
      );

    const spaces = await getSpaces();

    expect(mockRequestConfluence).toHaveBeenCalledTimes(2);
    expect(spaces).toHaveLength(2);
    expect(spaces[0].key).toBe('A');
    expect(spaces[1].key).toBe('B');
  });

  it('should throw on API error', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ message: 'Forbidden' }, false)
    );

    await expect(getSpaces()).rejects.toThrow();
  });
});
