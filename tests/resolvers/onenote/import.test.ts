import { importOneNotePage } from '../../../src/resolvers/onenote/import';

jest.mock('../../../src/resolvers/onenote/auth', () => ({
  requestMicrosoftGraphText: jest.fn(),
}));

jest.mock('../../../src/resolvers/confluence/createPage', () => ({
  createPage: jest.fn(),
  updatePageBody: jest.fn(),
}));

jest.mock('../../../src/resolvers/onenote/converter', () => ({
  convertOneNoteHtml: jest.fn(),
  escapeXml: jest.requireActual('../../../src/resolvers/onenote/converter').escapeXml,
}));

jest.mock('../../../src/resolvers/onenote/images', () => ({
  uploadRemoteImages: jest.fn(),
}));

import { requestMicrosoftGraphText } from '../../../src/resolvers/onenote/auth';
import { createPage, updatePageBody } from '../../../src/resolvers/confluence/createPage';
import { convertOneNoteHtml } from '../../../src/resolvers/onenote/converter';
import { uploadRemoteImages } from '../../../src/resolvers/onenote/images';

const mockGraphText = requestMicrosoftGraphText as jest.MockedFunction<typeof requestMicrosoftGraphText>;
const mockCreatePage = createPage as jest.MockedFunction<typeof createPage>;
const mockUpdatePageBody = updatePageBody as jest.MockedFunction<typeof updatePageBody>;
const mockConvert = convertOneNoteHtml as jest.MockedFunction<typeof convertOneNoteHtml>;
const mockUploadImages = uploadRemoteImages as jest.MockedFunction<typeof uploadRemoteImages>;

const validPayload = {
  pageId: 'abc123',
  title: 'My OneNote Page',
  spaceId: 'SPACE1',
  parentId: null,
};

describe('importOneNotePage', () => {
  beforeEach(() => {
    mockGraphText.mockReset();
    mockCreatePage.mockReset();
    mockUpdatePageBody.mockReset();
    mockUploadImages.mockReset();
    mockConvert.mockReset();
    mockConvert.mockImplementation(jest.requireActual('../../../src/resolvers/onenote/converter').convertOneNoteHtml);
  });

  it('happy path: fetches HTML, converts, creates page', async () => {
    mockGraphText.mockResolvedValue('<html><body><p>Hello World</p></body></html>');
    mockCreatePage.mockResolvedValue({ pageId: 'conf-123', title: 'My OneNote Page' });

    const result = await importOneNotePage(validPayload);

    expect(result).toEqual({
      pageId: 'abc123',
      confluencePageId: 'conf-123',
      title: 'My OneNote Page',
      status: 'success',
      imagesTotal: 0,
      imagesUploaded: 0,
      imagesFailed: 0,
    });
    expect(mockUploadImages).not.toHaveBeenCalled();
    expect(mockGraphText).toHaveBeenCalledWith('/v1.0/me/onenote/pages/abc123/content');
    expect(mockCreatePage).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'My OneNote Page',
        spaceId: 'SPACE1',
        parentId: null,
      })
    );
  });

  it('returns error for empty pageId', async () => {
    const result = await importOneNotePage({ ...validPayload, pageId: '' });

    expect(result.status).toBe('error');
    expect(result.error).toBe('Invalid OneNote page ID');
    expect(mockGraphText).not.toHaveBeenCalled();
  });

  it('returns error for pageId with invalid characters', async () => {
    const result = await importOneNotePage({ ...validPayload, pageId: 'abc 123<script>' });

    expect(result.status).toBe('error');
    expect(result.error).toBe('Invalid OneNote page ID');
    expect(mockGraphText).not.toHaveBeenCalled();
  });

  it('returns error when Graph API fails', async () => {
    mockGraphText.mockRejectedValue(new Error('Microsoft Graph request failed: 403'));

    const result = await importOneNotePage(validPayload);

    expect(result).toEqual({
      pageId: 'abc123',
      confluencePageId: '',
      title: 'My OneNote Page',
      status: 'error',
      error: 'Microsoft Graph request failed: 403',
    });
  });

  it('returns error when createPage fails', async () => {
    mockGraphText.mockResolvedValue('<html><body><p>Content</p></body></html>');
    mockCreatePage.mockRejectedValue(new Error('Failed to create page: 500'));

    const result = await importOneNotePage(validPayload);

    expect(result).toEqual({
      pageId: 'abc123',
      confluencePageId: '',
      title: 'My OneNote Page',
      status: 'error',
      error: 'Failed to create page: 500',
    });
  });

  it('handles non-Error throws gracefully', async () => {
    mockGraphText.mockRejectedValue('raw string error');

    const result = await importOneNotePage(validPayload);

    expect(result.status).toBe('error');
    expect(result.error).toBe('Import failed');
  });

  it('passes parentId when provided', async () => {
    mockGraphText.mockResolvedValue('<html><body><p>Child page</p></body></html>');
    mockCreatePage.mockResolvedValue({ pageId: 'conf-456', title: 'My OneNote Page' });

    await importOneNotePage({ ...validPayload, parentId: 'parent-99' });

    expect(mockCreatePage).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 'parent-99' })
    );
  });

  it('falls back to plain text when converter throws', async () => {
    mockGraphText.mockResolvedValue('<html><body><p>Some content</p></body></html>');
    mockConvert.mockImplementation(() => { throw new Error('parse error'); });
    mockCreatePage.mockResolvedValue({ pageId: 'conf-789', title: 'My OneNote Page' });

    const result = await importOneNotePage(validPayload);

    expect(result.status).toBe('success');
    expect(mockCreatePage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('Some content') })
    );
  });

  const htmlWithImage =
    '<html><body><p>Text</p>' +
    '<img src="https://graph.microsoft.com/v1.0/me/onenote/resources/res1/$value" data-src-type="image/png" />' +
    '</body></html>';

  it('uploads remote images after page creation', async () => {
    mockGraphText.mockResolvedValue(htmlWithImage);
    mockCreatePage.mockResolvedValue({ pageId: 'conf-img', title: 'My OneNote Page' });
    mockUploadImages.mockResolvedValue([{ filename: 'onenote-res1.png', ok: true }]);

    const result = await importOneNotePage(validPayload);

    expect(result.status).toBe('success');
    expect(result.imagesTotal).toBe(1);
    expect(result.imagesUploaded).toBe(1);
    expect(result.imagesFailed).toBe(0);
    expect(mockUploadImages).toHaveBeenCalledWith('conf-img', [
      expect.objectContaining({ filename: 'onenote-res1.png', remoteUrl: expect.stringContaining('res1') }),
    ]);
    expect(mockUpdatePageBody).not.toHaveBeenCalled();
  });

  it('replaces failed images with info panel via updatePageBody', async () => {
    mockGraphText.mockResolvedValue(htmlWithImage);
    mockCreatePage.mockResolvedValue({ pageId: 'conf-img', title: 'My OneNote Page' });
    mockUploadImages.mockResolvedValue([
      { filename: 'onenote-res1.png', ok: false, error: 'Graph 404' },
    ]);

    const result = await importOneNotePage(validPayload);

    expect(result.status).toBe('success');
    expect(result.imagesFailed).toBe(1);
    expect(mockUpdatePageBody).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: 'conf-img',
        body: expect.stringContaining('Image could not be imported'),
      })
    );
    const patchedBody = mockUpdatePageBody.mock.calls[0][0].body;
    expect(patchedBody).not.toContain('<ac:image>');
  });

  it('import stays successful when updatePageBody fails', async () => {
    mockGraphText.mockResolvedValue(htmlWithImage);
    mockCreatePage.mockResolvedValue({ pageId: 'conf-img', title: 'My OneNote Page' });
    mockUploadImages.mockResolvedValue([
      { filename: 'onenote-res1.png', ok: false, skipped: 'too-large' },
    ]);
    mockUpdatePageBody.mockRejectedValue(new Error('409 conflict'));

    const result = await importOneNotePage(validPayload);

    expect(result.status).toBe('success');
    expect(result.imagesFailed).toBe(1);
  });
});
