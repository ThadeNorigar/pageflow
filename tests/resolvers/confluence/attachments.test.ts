import { uploadAttachment } from '../../../src/resolvers/confluence/attachments';

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

describe('uploadAttachment', () => {
  beforeEach(() => {
    mockRequestConfluence.mockReset();
  });

  it('should upload attachment and return result', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [{ id: 'att-1', title: 'test.pdf' }] })
    );

    const result = await uploadAttachment({
      pageId: 'page-1',
      filename: 'test.pdf',
      fileBase64: Buffer.from('fake-pdf-content').toString('base64'),
      mimeType: 'application/pdf',
    });

    expect(result).toEqual({ attachmentId: 'att-1', filename: 'test.pdf' });
    expect(mockRequestConfluence).toHaveBeenCalledWith(
      '/wiki/rest/api/content/page-1/child/attachment',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Atlassian-Token': 'nocheck',
        }),
      })
    );
  });

  it('should send multipart body with correct boundary', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [{ id: 'att-2', title: 'doc.pdf' }] })
    );

    await uploadAttachment({
      pageId: 'page-2',
      filename: 'doc.pdf',
      fileBase64: Buffer.from('content').toString('base64'),
      mimeType: 'application/pdf',
    });

    const call = mockRequestConfluence.mock.calls[0];
    const contentType = call[1].headers['Content-Type'] as string;
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);

    const body = call[1].body as Buffer;
    const bodyStr = body.toString('utf-8');
    expect(bodyStr).toContain('filename="doc.pdf"');
    expect(bodyStr).toContain('Content-Type: application/pdf');
  });

  it('should throw on API error', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ message: 'Not Found' }, false, 404)
    );

    await expect(
      uploadAttachment({
        pageId: 'page-1',
        filename: 'test.pdf',
        fileBase64: Buffer.from('data').toString('base64'),
        mimeType: 'application/pdf',
      })
    ).rejects.toThrow('Failed to upload attachment: 404');
  });

  it('should throw when pageId is empty', async () => {
    await expect(
      uploadAttachment({ pageId: '', filename: 'test.pdf', fileBase64: 'abc', mimeType: 'application/pdf' })
    ).rejects.toThrow('pageId must not be empty');
    expect(mockRequestConfluence).not.toHaveBeenCalled();
  });

  it('should throw when filename is empty', async () => {
    await expect(
      uploadAttachment({ pageId: 'p1', filename: '', fileBase64: 'abc', mimeType: 'application/pdf' })
    ).rejects.toThrow('filename must not be empty');
    expect(mockRequestConfluence).not.toHaveBeenCalled();
  });

  it('should throw when fileBase64 is empty', async () => {
    await expect(
      uploadAttachment({ pageId: 'p1', filename: 'test.pdf', fileBase64: '', mimeType: 'application/pdf' })
    ).rejects.toThrow('fileBase64 must not be empty');
    expect(mockRequestConfluence).not.toHaveBeenCalled();
  });

  it('should throw on disallowed mime type', async () => {
    await expect(
      uploadAttachment({ pageId: 'p1', filename: 'evil.exe', fileBase64: 'abc', mimeType: 'application/x-msdownload' })
    ).rejects.toThrow('Unsupported file type: application/x-msdownload');
    expect(mockRequestConfluence).not.toHaveBeenCalled();
  });

  it('should accept image mime types', async () => {
    mockRequestConfluence.mockResolvedValue(
      apiResponse({ results: [{ id: 'att-3', title: 'pic.png' }] })
    );
    const result = await uploadAttachment({
      pageId: 'p1',
      filename: 'pic.png',
      fileBase64: Buffer.from('png-bytes').toString('base64'),
      mimeType: 'image/png',
    });
    expect(result.attachmentId).toBe('att-3');
  });

  it('should throw when file exceeds 10MB', async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64');
    await expect(
      uploadAttachment({ pageId: 'p1', filename: 'big.pdf', fileBase64: big, mimeType: 'application/pdf' })
    ).rejects.toThrow('File exceeds 10MB limit');
    expect(mockRequestConfluence).not.toHaveBeenCalled();
  });
});
