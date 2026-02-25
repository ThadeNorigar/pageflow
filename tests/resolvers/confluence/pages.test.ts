import { getPages } from '../../../src/resolvers/confluence/pages';

const mockRequestConfluence = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({
      requestConfluence: (...args: unknown[]) => mockRequestConfluence(...args),
    }),
  },
  route: (strings: TemplateStringsArray, ...values: unknown[]) => {
    let result = '';
    strings.forEach((str, i) => {
      result += str;
      if (i < values.length) result += String(values[i]);
    });
    return result;
  },
  assumeTrustedRoute: (url: string) => url,
}));

function apiResponse(body: object, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('getPages', () => {
  beforeEach(() => {
    mockRequestConfluence.mockReset();
  });

  it('should fetch all pages for space-id', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [], _links: {} })
    );

    await getPages('CD', '123');

    expect(mockRequestConfluence).toHaveBeenCalledWith(
      expect.stringContaining('space-id=123'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should return pages with parentId from API response', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        results: [
          { id: '10', title: 'Homepage', parentId: null },
          { id: '20', title: 'Child', parentId: '10' },
        ],
        _links: {},
      })
    );

    const pages = await getPages('CD', '123');

    expect(pages).toEqual([
      { id: '10', title: 'Homepage', spaceKey: 'CD', parentId: null, hasChildren: true },
      { id: '20', title: 'Child', spaceKey: 'CD', parentId: '10', hasChildren: false },
    ]);
  });

  it('should return empty array for empty space', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [], _links: {} })
    );

    const pages = await getPages('EMPTY', '456');
    expect(pages).toEqual([]);
  });

  it('should handle pagination', async () => {
    mockRequestConfluence
      .mockResolvedValueOnce(
        apiResponse({
          results: [{ id: '10', title: 'P1' }],
          _links: { next: '/wiki/api/v2/pages?cursor=abc' },
        })
      )
      .mockResolvedValueOnce(
        apiResponse({
          results: [{ id: '11', title: 'P2' }],
          _links: {},
        })
      );

    const pages = await getPages('CD', '123');

    expect(mockRequestConfluence).toHaveBeenCalledTimes(2);
    expect(pages).toHaveLength(2);
  });

  it('should compute hasChildren from parentId relationships', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        results: [
          { id: '1', title: 'Root', parentId: null },
          { id: '2', title: 'Child of Root', parentId: '1' },
          { id: '3', title: 'Leaf', parentId: '1' },
          { id: '4', title: 'Grandchild', parentId: '2' },
        ],
        _links: {},
      })
    );

    const pages = await getPages('CD', '123');

    expect(pages.find(p => p.id === '1')!.hasChildren).toBe(true);
    expect(pages.find(p => p.id === '2')!.hasChildren).toBe(true);
    expect(pages.find(p => p.id === '3')!.hasChildren).toBe(false);
    expect(pages.find(p => p.id === '4')!.hasChildren).toBe(false);
  });

  it('should throw on API error', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ message: 'Not Found' }, false)
    );

    await expect(getPages('bad', '999')).rejects.toThrow();
  });
});
