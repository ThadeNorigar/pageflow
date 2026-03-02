import { createPage } from '../../../src/resolvers/confluence/createPage';

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
}));

function apiResponse(body: object, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('createPage', () => {
  beforeEach(() => {
    mockRequestConfluence.mockReset();
  });

  it('should create page with correct title and spaceId', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ id: '100', title: 'Test Page' })
    );

    const result = await createPage({ title: 'Test Page', spaceId: 'sp-1', parentId: null });

    expect(result).toEqual({ pageId: '100', title: 'Test Page' });
    expect(mockRequestConfluence).toHaveBeenCalledWith(
      '/wiki/api/v2/pages',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const sentBody = JSON.parse(mockRequestConfluence.mock.calls[0][1].body);
    expect(sentBody.spaceId).toBe('sp-1');
    expect(sentBody.title).toBe('Test Page');
  });

  it('should include parentId when provided', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ id: '101', title: 'Child' })
    );

    await createPage({ title: 'Child', spaceId: 'sp-1', parentId: 'parent-42' });

    const sentBody = JSON.parse(mockRequestConfluence.mock.calls[0][1].body);
    expect(sentBody.parentId).toBe('parent-42');
  });

  it('should omit parentId for root-level page', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ id: '102', title: 'Root' })
    );

    await createPage({ title: 'Root', spaceId: 'sp-1', parentId: null });

    const sentBody = JSON.parse(mockRequestConfluence.mock.calls[0][1].body);
    expect(sentBody).not.toHaveProperty('parentId');
  });

  it('should throw on API error', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ message: 'Forbidden' }, false, 403)
    );

    await expect(
      createPage({ title: 'Fail', spaceId: 'sp-1', parentId: null })
    ).rejects.toThrow('Failed to create page: 403');
  });

  it('should throw when title is empty', async () => {
    await expect(
      createPage({ title: '', spaceId: 'sp-1', parentId: null })
    ).rejects.toThrow('Title must not be empty');

    expect(mockRequestConfluence).not.toHaveBeenCalled();
  });

  it('should throw when spaceId is empty', async () => {
    await expect(
      createPage({ title: 'Valid', spaceId: '', parentId: null })
    ).rejects.toThrow('SpaceId must not be empty');

    expect(mockRequestConfluence).not.toHaveBeenCalled();
  });
});
