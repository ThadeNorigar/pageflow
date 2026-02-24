import { getPages, getChildPages } from '../../../src/resolvers/confluence/pages';

const mockRequestConfluence = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asUser: () => ({
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

  it('should call GET /wiki/api/v2/pages with space-id and depth=root', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [], _links: {} })
    );

    await getPages('DEV', '123');

    expect(mockRequestConfluence).toHaveBeenCalledWith(
      expect.stringMatching(/\/wiki\/api\/v2\/pages\?space-id=123.*depth=root/),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should return mapped page objects with null parentId for root', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        results: [
          { id: '10', title: 'Welcome' },
        ],
        _links: {},
      })
    );

    const pages = await getPages('DEV', '123');

    expect(pages).toEqual([
      {
        id: '10',
        title: 'Welcome',
        spaceKey: 'DEV',
        parentId: null,
        hasChildren: true,
      },
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
          results: [
            { id: '10', title: 'P1' },
          ],
          _links: { next: '/wiki/api/v2/pages?space-id=123&cursor=abc' },
        })
      )
      .mockResolvedValueOnce(
        apiResponse({
          results: [
            { id: '11', title: 'P2' },
          ],
          _links: {},
        })
      );

    const pages = await getPages('DEV', '123');

    expect(mockRequestConfluence).toHaveBeenCalledTimes(2);
    expect(pages).toHaveLength(2);
  });

  it('should throw on API error', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ message: 'Not Found' }, false)
    );

    await expect(getPages('bad', '999')).rejects.toThrow();
  });

  it('should always return null parentId for root pages', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        results: [
          { id: '20', title: 'Root Page' },
        ],
        _links: {},
      })
    );

    const pages = await getPages('DEV', '123');

    expect(pages[0].parentId).toBeNull();
  });
});

describe('getChildPages', () => {
  beforeEach(() => {
    mockRequestConfluence.mockReset();
  });

  it('should call GET /wiki/api/v2/pages/{id}/children/page', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [], _links: {} })
    );

    await getChildPages('42', 'DEV');

    expect(mockRequestConfluence).toHaveBeenCalledWith(
      expect.stringContaining('/wiki/api/v2/pages/42/children/page'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should return child pages with parentId set to parent page id', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        results: [
          { id: '100', title: 'Sub Page' },
          { id: '101', title: 'Leaf Page' },
        ],
        _links: {},
      })
    );

    const children = await getChildPages('42', 'DEV');

    expect(children).toEqual([
      { id: '100', title: 'Sub Page', spaceKey: 'DEV', parentId: '42', hasChildren: true },
      { id: '101', title: 'Leaf Page', spaceKey: 'DEV', parentId: '42', hasChildren: true },
    ]);
  });

  it('should return empty array for leaf page', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [], _links: {} })
    );

    const children = await getChildPages('leaf-id', 'DEV');

    expect(children).toEqual([]);
  });

  it('should throw on API error', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ message: 'Server Error' }, false)
    );

    await expect(getChildPages('err', 'DEV')).rejects.toThrow();
  });
});

describe('SpaceSelection logic', () => {
  it('should return spaceKey for page selection', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        results: [
          { id: '10', title: 'Root' },
        ],
        _links: {},
      })
    );

    const pages = await getPages('DEV', '123');
    const selected = pages[0];

    expect(selected).toHaveProperty('id');
    expect(selected).toHaveProperty('spaceKey');
    expect(selected.spaceKey).toBe('DEV');
  });

  it('should allow null parentId for root pages', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        results: [
          { id: '10', title: 'Top' },
        ],
        _links: {},
      })
    );

    const pages = await getPages('DEV', '123');

    expect(pages[0].parentId).toBeNull();
  });
});
