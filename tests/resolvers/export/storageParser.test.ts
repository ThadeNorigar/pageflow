import { parseStorageFormat } from '../../../src/resolvers/export/storageParser';

describe('parseStorageFormat', () => {
  it('should return empty array for empty input', () => {
    expect(parseStorageFormat('')).toEqual([]);
  });

  it('should return empty array for whitespace-only input', () => {
    expect(parseStorageFormat('   \n  ')).toEqual([]);
  });

  it('should parse h1 as heading with level 1', () => {
    expect(parseStorageFormat('<h1>Title</h1>')).toEqual([
      { type: 'heading', level: 1, runs: [{ text: 'Title' }] },
    ]);
  });

  it('should parse h2-h6 with correct levels', () => {
    const blocks = parseStorageFormat('<h2>Sub</h2><h3>SubSub</h3><h6>Deep</h6>');
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: 'heading', level: 2, runs: [{ text: 'Sub' }] });
    expect(blocks[1]).toEqual({ type: 'heading', level: 3, runs: [{ text: 'SubSub' }] });
    expect(blocks[2]).toEqual({ type: 'heading', level: 6, runs: [{ text: 'Deep' }] });
  });

  it('should parse paragraph with plain text', () => {
    expect(parseStorageFormat('<p>Hello World</p>')).toEqual([
      { type: 'paragraph', runs: [{ text: 'Hello World' }] },
    ]);
  });

  it('should keep inline formatting as styled runs', () => {
    const blocks = parseStorageFormat('<p>This is <strong>bold</strong> and <em>italic</em> text</p>');
    expect(blocks).toEqual([
      {
        type: 'paragraph',
        runs: [
          { text: 'This is ' },
          { text: 'bold', bold: true },
          { text: ' and ' },
          { text: 'italic', italic: true },
          { text: ' text' },
        ],
      },
    ]);
  });

  it('should keep links with href', () => {
    const blocks = parseStorageFormat('<p>Click <a href="https://example.com">here</a> now</p>');
    expect(blocks).toEqual([
      {
        type: 'paragraph',
        runs: [
          { text: 'Click ' },
          { text: 'here', link: 'https://example.com' },
          { text: ' now' },
        ],
      },
    ]);
  });

  it('should parse unordered list into items', () => {
    const blocks = parseStorageFormat('<ul><li>Alpha</li><li>Beta</li><li>Gamma</li></ul>');
    expect(blocks).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          { runs: [{ text: 'Alpha' }] },
          { runs: [{ text: 'Beta' }] },
          { runs: [{ text: 'Gamma' }] },
        ],
      },
    ]);
  });

  it('should parse ordered list', () => {
    const blocks = parseStorageFormat('<ol><li>First</li><li>Second</li></ol>');
    expect(blocks).toEqual([
      {
        type: 'list',
        ordered: true,
        items: [{ runs: [{ text: 'First' }] }, { runs: [{ text: 'Second' }] }],
      },
    ]);
  });

  it('should keep bold formatting in list items', () => {
    const blocks = parseStorageFormat('<ul><li><strong>Bold item</strong></li><li>Plain item</li></ul>');
    expect(blocks[0]).toEqual({
      type: 'list',
      ordered: false,
      items: [
        { runs: [{ text: 'Bold item', bold: true }] },
        { runs: [{ text: 'Plain item' }] },
      ],
    });
  });

  it('should parse nested lists into item children', () => {
    const blocks = parseStorageFormat('<ul><li>Outer<ul><li>Inner</li></ul></li></ul>');
    expect(blocks).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          {
            runs: [{ text: 'Outer' }],
            children: [
              { type: 'list', ordered: false, items: [{ runs: [{ text: 'Inner' }] }] },
            ],
          },
        ],
      },
    ]);
  });

  it('should parse table with header row detection', () => {
    const xhtml = `
      <table>
        <tbody>
          <tr><th>Name</th><th>Age</th></tr>
          <tr><td>Alice</td><td>30</td></tr>
          <tr><td>Bob</td><td>25</td></tr>
        </tbody>
      </table>`;
    expect(parseStorageFormat(xhtml)).toEqual([
      {
        type: 'table',
        headerRow: true,
        rows: [
          [[{ text: 'Name' }], [{ text: 'Age' }]],
          [[{ text: 'Alice' }], [{ text: '30' }]],
          [[{ text: 'Bob' }], [{ text: '25' }]],
        ],
      },
    ]);
  });

  it('should handle table without tbody and without header', () => {
    expect(parseStorageFormat('<table><tr><td>A</td><td>B</td></tr></table>')).toEqual([
      { type: 'table', headerRow: false, rows: [[[{ text: 'A' }], [{ text: 'B' }]]] },
    ]);
  });

  it('should parse paragraphs inside table cells with separator', () => {
    const blocks = parseStorageFormat('<table><tr><td><p>One</p><p>Two</p></td></tr></table>');
    expect(blocks).toEqual([
      { type: 'table', headerRow: false, rows: [[[{ text: 'One\nTwo' }]]] },
    ]);
  });

  it('should parse code macro with language and CDATA body', () => {
    const xhtml =
      '<ac:structured-macro ac:name="code" ac:schema-version="1">' +
      '<ac:parameter ac:name="language">typescript</ac:parameter>' +
      '<ac:plain-text-body><![CDATA[const x = 1;\nif (x < 2) { run(); }]]></ac:plain-text-body>' +
      '</ac:structured-macro>';
    expect(parseStorageFormat(xhtml)).toEqual([
      { type: 'codeBlock', language: 'typescript', text: 'const x = 1;\nif (x < 2) { run(); }' },
    ]);
  });

  it('should parse info macro as panel with content', () => {
    const xhtml =
      '<ac:structured-macro ac:name="info">' +
      '<ac:rich-text-body><p>Important note</p></ac:rich-text-body>' +
      '</ac:structured-macro>';
    expect(parseStorageFormat(xhtml)).toEqual([
      {
        type: 'panel',
        panelType: 'info',
        blocks: [{ type: 'paragraph', runs: [{ text: 'Important note' }] }],
      },
    ]);
  });

  it('should pass through layout containers instead of swallowing them', () => {
    const xhtml =
      '<ac:layout><ac:layout-section ac:type="single"><ac:layout-cell>' +
      '<h1>Inside Layout</h1><p>Body text</p>' +
      '</ac:layout-cell></ac:layout-section></ac:layout>';
    expect(parseStorageFormat(xhtml)).toEqual([
      { type: 'heading', level: 1, runs: [{ text: 'Inside Layout' }] },
      { type: 'paragraph', runs: [{ text: 'Body text' }] },
    ]);
  });

  it('should pass through div content', () => {
    expect(parseStorageFormat('<div class="custom"><p>Inside div</p></div>')).toEqual([
      { type: 'paragraph', runs: [{ text: 'Inside div' }] },
    ]);
  });

  it('should turn bare text inside containers into a paragraph', () => {
    expect(parseStorageFormat('<div><span>Unknown</span></div>')).toEqual([
      { type: 'paragraph', runs: [{ text: 'Unknown' }] },
    ]);
  });

  it('should map unknown macros to placeholder with reason and skip their content', () => {
    const xhtml =
      '<ac:structured-macro ac:name="jira"><ac:parameter ac:name="key">PF-1</ac:parameter></ac:structured-macro>' +
      '<p>After</p>';
    expect(parseStorageFormat(xhtml)).toEqual([
      { type: 'placeholder', reason: 'jira' },
      { type: 'paragraph', runs: [{ text: 'After' }] },
    ]);
  });

  it('should render expand macro body transparently', () => {
    const xhtml =
      '<ac:structured-macro ac:name="expand">' +
      '<ac:parameter ac:name="title">More</ac:parameter>' +
      '<ac:rich-text-body><p>Hidden detail</p></ac:rich-text-body>' +
      '</ac:structured-macro>';
    expect(parseStorageFormat(xhtml)).toEqual([
      { type: 'paragraph', runs: [{ text: 'Hidden detail' }] },
    ]);
  });

  it('should render status macro as inline tag', () => {
    const xhtml =
      '<p>State: <ac:structured-macro ac:name="status">' +
      '<ac:parameter ac:name="title">DONE</ac:parameter>' +
      '</ac:structured-macro></p>';
    expect(parseStorageFormat(xhtml)).toEqual([
      { type: 'paragraph', runs: [{ text: 'State: [DONE]' }] },
    ]);
  });

  it('should parse ac:image with attachment filename', () => {
    const xhtml = '<ac:image><ri:attachment ri:filename="diagram.png" /></ac:image>';
    expect(parseStorageFormat(xhtml)).toEqual([
      { type: 'image', filename: 'diagram.png', url: undefined },
    ]);
  });

  it('should parse task lists with status', () => {
    const xhtml =
      '<ac:task-list>' +
      '<ac:task><ac:task-id>1</ac:task-id><ac:task-status>complete</ac:task-status><ac:task-body>Done thing</ac:task-body></ac:task>' +
      '<ac:task><ac:task-id>2</ac:task-id><ac:task-status>incomplete</ac:task-status><ac:task-body>Open thing</ac:task-body></ac:task>' +
      '</ac:task-list>';
    expect(parseStorageFormat(xhtml)).toEqual([
      {
        type: 'taskList',
        items: [
          { checked: true, runs: [{ text: 'Done thing' }] },
          { checked: false, runs: [{ text: 'Open thing' }] },
        ],
      },
    ]);
  });

  it('should render ac:link page references as text', () => {
    const xhtml = '<p>See <ac:link><ri:page ri:content-title="Other Page" /></ac:link> for details</p>';
    expect(parseStorageFormat(xhtml)).toEqual([
      { type: 'paragraph', runs: [{ text: 'See Other Page for details' }] },
    ]);
  });

  it('should parse blockquote and hr', () => {
    const blocks = parseStorageFormat('<blockquote><p>Quoted</p></blockquote><hr />');
    expect(blocks).toEqual([
      { type: 'quote', blocks: [{ type: 'paragraph', runs: [{ text: 'Quoted' }] }] },
      { type: 'hr' },
    ]);
  });

  it('should parse mixed content in order', () => {
    const blocks = parseStorageFormat('<h1>Title</h1><p>Intro text</p><ul><li>A</li><li>B</li></ul>');
    expect(blocks.map(b => b.type)).toEqual(['heading', 'paragraph', 'list']);
  });

  it('should handle multiple paragraphs', () => {
    expect(parseStorageFormat('<p>First paragraph</p><p>Second paragraph</p>')).toEqual([
      { type: 'paragraph', runs: [{ text: 'First paragraph' }] },
      { type: 'paragraph', runs: [{ text: 'Second paragraph' }] },
    ]);
  });

  it('should decode HTML entities including German quotes', () => {
    const blocks = parseStorageFormat('<p>&bdquo;Gr&uuml;&szlig;e&ldquo; &ndash; ein &Uuml;berblick</p>');
    expect(blocks).toEqual([
      { type: 'paragraph', runs: [{ text: '„Grüße“ – ein Überblick' }] },
    ]);
  });

  it('should decode extended entities like rarr and eacute', () => {
    const blocks = parseStorageFormat('<p>Text &rarr; Bild im Caf&eacute;</p>');
    expect(blocks).toEqual([
      { type: 'paragraph', runs: [{ text: 'Text → Bild im Café' }] },
    ]);
  });

  it('should decode numeric and hex entities including astral plane', () => {
    const blocks = parseStorageFormat('<p>&#169; 2026 &#x2014; PageFlow &#128640;</p>');
    expect(blocks).toEqual([
      { type: 'paragraph', runs: [{ text: '© 2026 — PageFlow \u{1F680}' }] },
    ]);
  });

  it('should decode entities in table cells', () => {
    expect(parseStorageFormat('<table><tr><td>Stra&szlig;e</td><td>Gr&ouml;&szlig;e</td></tr></table>')).toEqual([
      { type: 'table', headerRow: false, rows: [[[{ text: 'Straße' }], [{ text: 'Größe' }]]] },
    ]);
  });

  it('should decode entities in headings', () => {
    expect(parseStorageFormat('<h1>&Uuml;bersicht &amp; Zusammenfassung</h1>')).toEqual([
      { type: 'heading', level: 1, runs: [{ text: 'Übersicht & Zusammenfassung' }] },
    ]);
  });

  it('should handle emoticons via fallback text', () => {
    const blocks = parseStorageFormat('<p>Nice <ac:emoticon ac:name="smile" ac:emoji-fallback="\u{1F642}" /> day</p>');
    expect(blocks).toEqual([
      { type: 'paragraph', runs: [{ text: 'Nice \u{1F642} day' }] },
    ]);
  });

  it('should handle nested divs without losing content after them', () => {
    const xhtml = '<div><div><p>Deep</p></div></div><p>After divs</p>';
    expect(parseStorageFormat(xhtml)).toEqual([
      { type: 'paragraph', runs: [{ text: 'Deep' }] },
      { type: 'paragraph', runs: [{ text: 'After divs' }] },
    ]);
  });

  it('should convert br to newline within a paragraph', () => {
    expect(parseStorageFormat('<p>Line one<br />Line two</p>')).toEqual([
      { type: 'paragraph', runs: [{ text: 'Line one\nLine two' }] },
    ]);
  });
});
