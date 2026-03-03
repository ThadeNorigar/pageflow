import { convertOneNoteHtml } from '../../../src/resolvers/onenote/converter';

describe('convertOneNoteHtml — local file references', () => {
  it('converts local img src to ac:image with localPath attachment', () => {
    const html = '<img src="PageTitle_files/image001.png" />';
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toContain('<ac:image');
    expect(result.storageFormat).toContain('ri:filename');
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].filename).toBe('image001.png');
    expect(result.attachments[0].localPath).toBe('PageTitle_files/image001.png');
  });

  it('handles multiple local images', () => {
    const html = `
      <img src="Page_files/img1.png" />
      <p>Text</p>
      <img src="Page_files/img2.jpg" />
    `;
    const result = convertOneNoteHtml(html);
    expect(result.attachments).toHaveLength(2);
    expect(result.attachments[0].localPath).toBe('Page_files/img1.png');
    expect(result.attachments[1].localPath).toBe('Page_files/img2.jpg');
  });

  it('mixes local and data-URI images', () => {
    const html = `
      <img src="Files/pic.png" />
      <img src="data:image/png;base64,AAAA" />
    `;
    const result = convertOneNoteHtml(html);
    expect(result.attachments).toHaveLength(2);
    expect(result.attachments[0].localPath).toBe('Files/pic.png');
    expect(result.attachments[1].localPath).toBeUndefined();
    expect(result.attachments[1].data.length).toBeGreaterThan(0);
  });

  it('uses original filename from local path for attachment', () => {
    const html = '<img src="Notebook_files/screenshot.jpeg" />';
    const result = convertOneNoteHtml(html);
    expect(result.attachments[0].filename).toBe('screenshot.jpeg');
  });

  it('ignores absolute URLs that are not graph.microsoft.com', () => {
    const html = '<img src="https://example.com/image.png" />';
    const result = convertOneNoteHtml(html);
    expect(result.attachments).toHaveLength(0);
    expect(result.storageFormat).toBe('');
  });

  it('handles OneNote Desktop proprietary tags gracefully', () => {
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office">
      <body>
        <o:p></o:p>
        <p>Visible content</p>
        <v:shape>invisible</v:shape>
      </body>
      </html>
    `;
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toContain('Visible content');
    expect(result.storageFormat).not.toContain('v:shape');
    expect(result.storageFormat).not.toContain('o:p');
  });

  it('handles URL-encoded local image paths', () => {
    const html = '<img src="Page_files/Bild%20mit%20Leerzeichen.png" />';
    const result = convertOneNoteHtml(html);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].filename).toBe('Bild mit Leerzeichen.png');
    expect(result.attachments[0].localPath).toBe('Page_files/Bild%20mit%20Leerzeichen.png');
  });

  it('handles local image with unknown extension', () => {
    const html = '<img src="files/diagram.tiff" />';
    const result = convertOneNoteHtml(html);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].contentType).toBe('image/png');
    expect(result.attachments[0].filename).toBe('diagram.tiff');
  });

  it('handles local image with no extension', () => {
    const html = '<img src="files/noext" />';
    const result = convertOneNoteHtml(html);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].filename).toBe('noext');
  });

  it('handles bare filename without directory', () => {
    const html = '<img src="image.jpg" />';
    const result = convertOneNoteHtml(html);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].filename).toBe('image.jpg');
    expect(result.attachments[0].contentType).toBe('image/jpeg');
    expect(result.attachments[0].localPath).toBe('image.jpg');
  });

  it('skips img with empty src', () => {
    const html = '<img src="" />';
    const result = convertOneNoteHtml(html);
    expect(result.attachments).toHaveLength(0);
  });
});
