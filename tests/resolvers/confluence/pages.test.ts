import { getPages, getChildPages } from '../../../src/resolvers/confluence/pages';

const mockRequestConfluence = jest.fn();
jest.mock('@forge/api', () => ({
  requestConfluence: (...args: unknown[]) => mockRequestConfluence(...args),
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

  it('should call GET /wiki/api/v2/spaces/{id}/pages with depth=0', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [], _links: {} })
    );

    await getPages('123');

    expect(mockRequestConfluence).toHaveBeenCalledWith(
      expect.stringMatching(/\/wiki\/api\/v2\/spaces\/123\/pages.*depth=0/),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should return mapped page objects', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        results: [
          {
            id: '10',
            title: 'Welcome',
            spaceId: '1',
            parentId: null,
            childPosition: 0,
            _links: { childPages: '/wiki/api/v2/pages/10/children' },
          },
        ],
        _links: {},
      })
    );

    const pages = await getPages('1');

    expect(pages).toEqual([
      {
        id: '10',
        title: 'Welcome',
        spaceId: '1',
        parentId: null,
        hasChildren: true,
      },
    ]);
  });

  it('should return empty array for empty space', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [], _links: {} })
    );

    const pages = await getPages('999');

    expect(pages).toEqual([]);
  });

  it('should handle pagination', async () => {
    mockRequestConfluence
      .mockResolvedValueOnce(
        apiResponse({
          results: [
            { id: '10', title: 'P1', spaceId: '1', parentId: null, _links: {} },
          ],
          _links: { next: '/wiki/api/v2/spaces/1/pages?cursor=xyz' },
        })
      )
      .mockResolvedValueOnce(
        apiResponse({
          results: [
            { id: '11', title: 'P2', spaceId: '1', parentId: null, _links: {} },
          ],
          _links: {},
        })
      );

    const pages = await getPages('1');

    expect(mockRequestConfluence).toHaveBeenCalledTimes(2);
    expect(pages).toHaveLength(2);
  });

  it('should throw on API error', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ message: 'Not Found' }, false)
    );

    await expect(getPages('bad')).rejects.toThrow();
  });
});

describe('getChildPages', () => {
  beforeEach(() => {
    mockRequestConfluence.mockReset();
  });

  it('should call GET /wiki/api/v2/pages/{id}/children', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [], _links: {} })
    );

    await getChildPages('42');

    expect(mockRequestConfluence).toHaveBeenCalledWith(
      expect.stringContaining('/wiki/api/v2/pages/42/children'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should return child pages with hasChildren flag', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        results: [
          {
            id: '100',
            title: 'Sub Page',
            spaceId: '1',
            parentId: '42',
            _links: { childPages: '/wiki/api/v2/pages/100/children' },
          },
          {
            id: '101',
            title: 'Leaf Page',
            spaceId: '1',
            parentId: '42',
            _links: {},
          },
        ],
        _links: {},
      })
    );

    const children = await getChildPages('42');

    expect(children).toEqual([
      { id: '100', title: 'Sub Page', spaceId: '1', parentId: '42', hasChildren: true },
      { id: '101', title: 'Leaf Page', spaceId: '1', parentId: '42', hasChildren: false },
    ]);
  });

  it('should return empty array for leaf page', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [], _links: {} })
    );

    const children = await getChildPages('leaf-id');

    expect(children).toEqual([]);
  });

  it('should throw on API error', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ message: 'Server Error' }, false)
    );

    await expect(getChildPages('err')).rejects.toThrow();
  });
});

describe('SpaceSelection logic', () => {
  it('should return spaceKey and pageId for page selection', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        results: [
          { id: '10', title: 'Root', spaceId: '1', parentId: null, _links: {} },
        ],
        _links: {},
      })
    );

    const pages = await getPages('1');
    const selected = pages[0];

    expect(selected).toHaveProperty('id');
    expect(selected).toHaveProperty('spaceId');
  });

  it('should allow null parentId for space root selection', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        results: [
          { id: '10', title: 'Top', spaceId: '1', parentId: null, _links: {} },
        ],
        _links: {},
      })
    );

    const pages = await getPages('1');

    expect(pages[0].parentId).toBeNull();
  });
});
