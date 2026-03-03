import { processLocalOneNoteHtml } from '../../../src/resolvers/onenote/localImport';

jest.mock('../../../src/resolvers/confluence/createPage', () => ({
  createPage: jest.fn().mockResolvedValue({ id: 'page-123', title: 'Test Page' }),
  updatePageBody: jest.fn().mockResolvedValue({ id: 'page-123' }),
}));

jest.mock('../../../src/resolvers/confluence/attachments', () => ({
  uploadAttachment: jest.fn().mockResolvedValue({ id: 'att-1' }),
}));

describe('processLocalOneNoteHtml', () => {
  it('converts HTML and returns storageFormat + imageRefs', () => {
    const html = '<p>Hello World</p>';
    const result = processLocalOneNoteHtml(html);
    expect(result.storageFormat).toContain('Hello World');
    expect(result.imageRefs).toEqual([]);
  });

  it('extracts local image references from HTML', () => {
    const html = '<img src="Page_files/image001.png" /><p>Text</p>';
    const result = processLocalOneNoteHtml(html);
    expect(result.imageRefs).toHaveLength(1);
    expect(result.imageRefs[0]).toMatchObject({
      localPath: 'Page_files/image001.png',
      filename: 'image001.png',
    });
    expect(result.storageFormat).toContain('ri:filename');
  });

  it('returns empty result for empty HTML', () => {
    const result = processLocalOneNoteHtml('');
    expect(result.storageFormat).toBe('');
    expect(result.imageRefs).toEqual([]);
  });

  it('handles HTML with data-URI images (no localPath)', () => {
    const html = '<img src="data:image/png;base64,AAAA" />';
    const result = processLocalOneNoteHtml(html);
    expect(result.imageRefs).toHaveLength(0);
    expect(result.storageFormat).toContain('ac:image');
  });

  it('handles malformed HTML gracefully', () => {
    const html = '<p>Unclosed paragraph<div>Nested wrong</p></div>';
    const result = processLocalOneNoteHtml(html);
    expect(result.storageFormat).toContain('Unclosed paragraph');
  });
});
