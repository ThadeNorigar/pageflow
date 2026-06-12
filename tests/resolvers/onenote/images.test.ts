import { uploadRemoteImages } from '../../../src/resolvers/onenote/images';
import { AttachmentRef } from '../../../src/resolvers/onenote/converter';

jest.mock('../../../src/resolvers/onenote/auth', () => ({
  requestMicrosoftGraphBinary: jest.fn(),
}));

jest.mock('../../../src/resolvers/confluence/attachments', () => ({
  uploadAttachment: jest.fn(),
}));

import { requestMicrosoftGraphBinary } from '../../../src/resolvers/onenote/auth';
import { uploadAttachment } from '../../../src/resolvers/confluence/attachments';

const mockBinary = requestMicrosoftGraphBinary as jest.MockedFunction<typeof requestMicrosoftGraphBinary>;
const mockUpload = uploadAttachment as jest.MockedFunction<typeof uploadAttachment>;

function remoteRef(id: string): AttachmentRef {
  return {
    filename: `onenote-${id}.png`,
    data: Buffer.alloc(0),
    contentType: 'image/png',
    remoteUrl: `https://graph.microsoft.com/v1.0/me/onenote/resources/${id}/$value`,
  };
}

describe('uploadRemoteImages', () => {
  beforeEach(() => {
    mockBinary.mockReset();
    mockUpload.mockReset();
  });

  it('returns empty array when there are no remote attachments', async () => {
    const local: AttachmentRef = { filename: 'a.png', data: Buffer.from('x'), contentType: 'image/png' };
    expect(await uploadRemoteImages('p1', [local])).toEqual([]);
    expect(mockBinary).not.toHaveBeenCalled();
  });

  it('downloads and uploads each remote image', async () => {
    mockBinary.mockResolvedValue({ data: Buffer.from('img-bytes'), contentType: 'image/png' });
    mockUpload.mockResolvedValue({ attachmentId: 'att-1', filename: 'onenote-a.png' });

    const results = await uploadRemoteImages('page-1', [remoteRef('a'), remoteRef('b')]);

    expect(results).toHaveLength(2);
    expect(results.every(r => r.ok)).toBe(true);
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: 'page-1',
        filename: 'onenote-a.png',
        mimeType: 'image/png',
        fileBase64: Buffer.from('img-bytes').toString('base64'),
      })
    );
  });

  it('skips images over 5MB', async () => {
    mockBinary.mockResolvedValue({ data: Buffer.alloc(5 * 1024 * 1024 + 1), contentType: 'image/png' });

    const results = await uploadRemoteImages('page-1', [remoteRef('big')]);

    expect(results).toEqual([{ filename: 'onenote-big.png', ok: false, skipped: 'too-large' }]);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('caps at 10 images per page and marks the rest as limit-skipped', async () => {
    mockBinary.mockResolvedValue({ data: Buffer.from('x'), contentType: 'image/png' });
    mockUpload.mockResolvedValue({ attachmentId: 'att', filename: 'f' });

    const refs = Array.from({ length: 12 }, (_, i) => remoteRef(`r${i}`));
    const results = await uploadRemoteImages('page-1', refs);

    expect(results).toHaveLength(12);
    expect(results.filter(r => r.ok)).toHaveLength(10);
    expect(results.filter(r => r.skipped === 'limit')).toHaveLength(2);
    expect(mockUpload).toHaveBeenCalledTimes(10);
  });

  it('continues after individual failures', async () => {
    mockBinary
      .mockResolvedValueOnce({ data: Buffer.from('ok'), contentType: 'image/png' })
      .mockRejectedValueOnce(new Error('Graph 404'));
    mockUpload.mockResolvedValue({ attachmentId: 'att', filename: 'f' });

    const results = await uploadRemoteImages('page-1', [remoteRef('good'), remoteRef('bad')]);

    const good = results.find(r => r.filename === 'onenote-good.png');
    const bad = results.find(r => r.filename === 'onenote-bad.png');
    expect(good?.ok).toBe(true);
    expect(bad).toEqual({ filename: 'onenote-bad.png', ok: false, error: 'Graph 404' });
  });

  it('falls back to declared content type when response type is not an image', async () => {
    mockBinary.mockResolvedValue({ data: Buffer.from('x'), contentType: 'application/octet-stream' });
    mockUpload.mockResolvedValue({ attachmentId: 'att', filename: 'f' });

    await uploadRemoteImages('page-1', [remoteRef('a')]);

    expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'image/png' }));
  });
});
