import { parseStorageFormat, ContentBlock } from '../../../src/resolvers/export/storageParser';

describe('parseStorageFormat', () => {
  it('should return empty array for empty input', () => {
    expect(parseStorageFormat('')).toEqual([]);
  });

  it('should return empty array for whitespace-only input', () => {
    expect(parseStorageFormat('   \n  ')).toEqual([]);
  });

  it('should parse h1 as heading with level 1', () => {
    const blocks = parseStorageFormat('<h1>Title</h1>');

    expect(blocks).toEqual([
      { type: 'heading', text: 'Title', level: 1 },
    ]);
  });

  it('should parse h2-h6 with correct levels', () => {
    const xhtml = '<h2>Sub</h2><h3>SubSub</h3><h6>Deep</h6>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: 'heading', text: 'Sub', level: 2 });
    expect(blocks[1]).toEqual({ type: 'heading', text: 'SubSub', level: 3 });
    expect(blocks[2]).toEqual({ type: 'heading', text: 'Deep', level: 6 });
  });

  it('should parse paragraph with plain text', () => {
    const blocks = parseStorageFormat('<p>Hello World</p>');

    expect(blocks).toEqual([
      { type: 'paragraph', text: 'Hello World' },
    ]);
  });

  it('should strip inline formatting from paragraph text', () => {
    const xhtml = '<p>This is <strong>bold</strong> and <em>italic</em> text</p>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      { type: 'paragraph', text: 'This is bold and italic text' },
    ]);
  });

  it('should strip links but keep link text', () => {
    const xhtml = '<p>Click <a href="https://example.com">here</a> now</p>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      { type: 'paragraph', text: 'Click here now' },
    ]);
  });

  it('should parse unordered list into list block with items', () => {
    const xhtml = '<ul><li>Alpha</li><li>Beta</li><li>Gamma</li></ul>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      { type: 'list', items: ['Alpha', 'Beta', 'Gamma'] },
    ]);
  });

  it('should parse ordered list into list block with items', () => {
    const xhtml = '<ol><li>First</li><li>Second</li></ol>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      { type: 'list', items: ['First', 'Second'] },
    ]);
  });

  it('should strip inline formatting from list items', () => {
    const xhtml = '<ul><li><strong>Bold item</strong></li><li>Plain item</li></ul>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks[0]).toEqual({
      type: 'list',
      items: ['Bold item', 'Plain item'],
    });
  });

  it('should parse table into table block with rows', () => {
    const xhtml = `
      <table>
        <tbody>
          <tr><th>Name</th><th>Age</th></tr>
          <tr><td>Alice</td><td>30</td></tr>
          <tr><td>Bob</td><td>25</td></tr>
        </tbody>
      </table>`;
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      {
        type: 'table',
        rows: [
          ['Name', 'Age'],
          ['Alice', '30'],
          ['Bob', '25'],
        ],
      },
    ]);
  });

  it('should handle table without tbody wrapper', () => {
    const xhtml = '<table><tr><td>A</td><td>B</td></tr></table>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      { type: 'table', rows: [['A', 'B']] },
    ]);
  });

  it('should map Confluence macros to placeholder', () => {
    const xhtml = '<ac:structured-macro ac:name="code"><ac:plain-text-body>x=1</ac:plain-text-body></ac:structured-macro>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      { type: 'placeholder' },
    ]);
  });

  it('should map unknown elements to placeholder', () => {
    const xhtml = '<div class="custom"><span>Unknown</span></div>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      { type: 'placeholder' },
    ]);
  });

  it('should parse mixed content in order', () => {
    const xhtml = '<h1>Title</h1><p>Intro text</p><ul><li>A</li><li>B</li></ul>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('heading');
    expect(blocks[1].type).toBe('paragraph');
    expect(blocks[2].type).toBe('list');
  });

  it('should handle multiple paragraphs', () => {
    const xhtml = '<p>First paragraph</p><p>Second paragraph</p>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      { type: 'paragraph', text: 'First paragraph' },
      { type: 'paragraph', text: 'Second paragraph' },
    ]);
  });

  it('should decode HTML entities in paragraph text', () => {
    const xhtml = '<p>&bdquo;Gr&uuml;&szlig;e&ldquo; &ndash; ein &Uuml;berblick</p>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      { type: 'paragraph', text: '\u201EGrüße\u201C \u2013 ein Überblick' },
    ]);
  });

  it('should decode numeric and hex entities', () => {
    const xhtml = '<p>&#169; 2026 &#x2014; PageFlow</p>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      { type: 'paragraph', text: '© 2026 \u2014 PageFlow' },
    ]);
  });

  it('should decode entities in list items', () => {
    const xhtml = '<ul><li>F&uuml;r &amp; Wider</li><li>&bdquo;Zitat&ldquo;</li></ul>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      { type: 'list', items: ['Für & Wider', '\u201EZitat\u201C'] },
    ]);
  });

  it('should decode entities in table cells', () => {
    const xhtml = '<table><tr><td>Stra&szlig;e</td><td>Gr&ouml;&szlig;e</td></tr></table>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      { type: 'table', rows: [['Straße', 'Größe']] },
    ]);
  });

  it('should decode entities in headings', () => {
    const xhtml = '<h1>&Uuml;bersicht &amp; Zusammenfassung</h1>';
    const blocks = parseStorageFormat(xhtml);

    expect(blocks).toEqual([
      { type: 'heading', text: 'Übersicht & Zusammenfassung', level: 1 },
    ]);
  });
});
