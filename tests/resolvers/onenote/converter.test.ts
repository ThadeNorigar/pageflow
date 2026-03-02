import { convertOneNoteHtml } from '../../../src/resolvers/onenote/converter';

describe('convertOneNoteHtml', () => {
  it('returns empty result for empty input', () => {
    const result = convertOneNoteHtml('');
    expect(result).toEqual({ storageFormat: '', attachments: [] });
  });

  it('extracts only body content from full HTML', () => {
    const html = '<html><head><style>h1{color:red}</style></head><body><p>Hello</p></body></html>';
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toBe('<p>Hello</p>');
    expect(result.attachments).toEqual([]);
  });

  it('passes through h1-h6 headings', () => {
    for (let i = 1; i <= 6; i++) {
      const tag = `h${i}`;
      const html = `<${tag}>Title</${tag}>`;
      const result = convertOneNoteHtml(html);
      expect(result.storageFormat).toBe(`<${tag}>Title</${tag}>`);
    }
  });

  it('passes through paragraphs', () => {
    const result = convertOneNoteHtml('<p>Text</p>');
    expect(result.storageFormat).toBe('<p>Text</p>');
  });

  it('passes through unordered lists', () => {
    const html = '<ul><li>A</li><li>B</li></ul>';
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toBe('<ul><li>A</li><li>B</li></ul>');
  });

  it('passes through ordered lists', () => {
    const html = '<ol><li>1</li><li>2</li></ol>';
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toBe('<ol><li>1</li><li>2</li></ol>');
  });

  it('passes through nested lists', () => {
    const html = '<ul><li>A<ul><li>B</li></ul></li></ul>';
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toBe('<ul><li>A<ul><li>B</li></ul></li></ul>');
  });

  it('passes through tables', () => {
    const html = '<table><tr><td>X</td></tr></table>';
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toBe('<table><tr><td>X</td></tr></table>');
  });

  it('passes through links', () => {
    const html = '<a href="https://example.com">Link</a>';
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toBe('<a href="https://example.com">Link</a>');
  });

  it('maps <b> to <strong>', () => {
    const result = convertOneNoteHtml('<b>text</b>');
    expect(result.storageFormat).toBe('<strong>text</strong>');
  });

  it('maps <i> to <em>', () => {
    const result = convertOneNoteHtml('<i>text</i>');
    expect(result.storageFormat).toBe('<em>text</em>');
  });

  it('maps font-weight:bold style to <strong>', () => {
    const html = '<span style="font-weight:bold">text</span>';
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toBe('<strong>text</strong>');
  });

  it('maps font-style:italic style to <em>', () => {
    const html = '<span style="font-style:italic">text</span>';
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toBe('<em>text</em>');
  });

  it('converts data-URI images to ac:image with attachment', () => {
    const base64 = 'AAAA';
    const html = `<img src="data:image/png;base64,${base64}" />`;
    const result = convertOneNoteHtml(html);

    expect(result.storageFormat).toContain('<ac:image');
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].contentType).toBe('image/png');
    expect(result.attachments[0].filename).toBeTruthy();
    expect(Buffer.isBuffer(result.attachments[0].data)).toBe(true);
    expect(result.attachments[0].data.toString('base64')).toBe(base64);
  });

  it('converts remote images to ac:image with URL attachment', () => {
    const url = 'https://graph.microsoft.com/v1.0/me/onenote/resources/123/$value';
    const html = `<img src="${url}" />`;
    const result = convertOneNoteHtml(html);

    expect(result.storageFormat).toContain('<ac:image');
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].filename).toBeTruthy();
  });

  it('strips unknown tags but keeps text content', () => {
    const html = '<div><span>Text</span></div>';
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toBe('Text');
  });

  it('removes data-* attributes from allowed tags', () => {
    const html = '<p data-id="abc">Text</p>';
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toBe('<p>Text</p>');
    expect(result.storageFormat).not.toContain('data-');
  });

  it('escapes XML special characters in text content', () => {
    const html = '<p>A &amp; B &lt; C</p>';
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toBe('<p>A &amp; B &lt; C</p>');
  });

  it('converts <br> to self-closing <br />', () => {
    const html = '<p>Line1<br>Line2</p>';
    const result = convertOneNoteHtml(html);
    expect(result.storageFormat).toBe('<p>Line1<br />Line2</p>');
  });

  it('handles mixed OneNote HTML with multiple elements', () => {
    const html = `
      <html>
        <head><style>body{font-family:Calibri}</style></head>
        <body data-absolute-enabled="true">
          <h1 data-id="h1">Title</h1>
          <p>A paragraph with <b>bold</b> and <i>italic</i>.</p>
          <ul><li>Item 1</li><li>Item 2</li></ul>
          <img src="data:image/png;base64,AAAA" />
        </body>
      </html>
    `;
    const result = convertOneNoteHtml(html);

    expect(result.storageFormat).toContain('<h1>Title</h1>');
    expect(result.storageFormat).toContain('<strong>bold</strong>');
    expect(result.storageFormat).toContain('<em>italic</em>');
    expect(result.storageFormat).toContain('<ul><li>Item 1</li><li>Item 2</li></ul>');
    expect(result.storageFormat).toContain('<ac:image');
    expect(result.storageFormat).not.toContain('data-');
    expect(result.storageFormat).not.toContain('<head>');
    expect(result.storageFormat).not.toContain('<style>');
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].contentType).toBe('image/png');
  });
});
