import { getPageBody } from '../../../src/resolvers/export/pageContent';

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

jest.mock('../../../src/resolvers/export/storageParser', () => ({
  parseStorageFormat: jest.fn(),
}));

import { parseStorageFormat } from '../../../src/resolvers/export/storageParser';

const mockParse = parseStorageFormat as jest.MockedFunction<typeof parseStorageFormat>;

function apiResponse(body: object, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('getPageBody', () => {
  beforeEach(() => {
    mockRequestConfluence.mockReset();
    mockParse.mockReset();
  });

  it('happy path: fetches page and returns parsed blocks', async () => {
    const storageValue = '<p>Hello</p>';
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        id: '12345',
        title: 'Test Page',
        body: { storage: { value: storageValue } },
      })
    );
    mockParse.mockReturnValue([{ type: 'paragraph', text: 'Hello' }]);

    const result = await getPageBody('12345');

    expect(result).toEqual({
      id: '12345',
      title: 'Test Page',
      blocks: [{ type: 'paragraph', text: 'Hello' }],
    });
    expect(mockRequestConfluence).toHaveBeenCalledWith(
      expect.stringContaining('/wiki/api/v2/pages/12345'),
      expect.objectContaining({ method: 'GET' })
    );
    expect(mockParse).toHaveBeenCalledWith(storageValue);
  });

  it('should pass body-format=storage in the request URL', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        id: '1',
        title: 'T',
        body: { storage: { value: '' } },
      })
    );
    mockParse.mockReturnValue([]);

    await getPageBody('1');

    const url = mockRequestConfluence.mock.calls[0][0] as string;
    expect(url).toContain('body-format=storage');
  });

  it('should throw on 404 response', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ message: 'Not Found' }, false, 404)
    );

    await expect(getPageBody('99999')).rejects.toThrow();
  });

  it('should throw on 500 response', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ message: 'Internal Server Error' }, false, 500)
    );

    await expect(getPageBody('12345')).rejects.toThrow();
  });

  it('should throw for empty pageId', async () => {
    await expect(getPageBody('')).rejects.toThrow();
    expect(mockRequestConfluence).not.toHaveBeenCalled();
  });

  it('should throw for pageId with special characters', async () => {
    await expect(getPageBody('123<script>')).rejects.toThrow();
    expect(mockRequestConfluence).not.toHaveBeenCalled();
  });

  it('should throw for pageId with spaces', async () => {
    await expect(getPageBody('123 456')).rejects.toThrow();
    expect(mockRequestConfluence).not.toHaveBeenCalled();
  });

  it('should accept numeric string pageId', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({
        id: '42',
        title: 'Numeric',
        body: { storage: { value: '<p>OK</p>' } },
      })
    );
    mockParse.mockReturnValue([{ type: 'paragraph', text: 'OK' }]);

    const result = await getPageBody('42');

    expect(result.id).toBe('42');
  });

  it('should include error details from API response in thrown error', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ message: 'Page not found' }, false, 404)
    );

    await expect(getPageBody('99999')).rejects.toThrow(/404|not found/i);
  });
});
