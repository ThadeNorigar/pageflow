import { htmlToText, textToStorageFormat } from '../../../src/resolvers/onenote/htmlToText';

describe('htmlToText', () => {
  it('returns empty string for empty input', () => {
    expect(htmlToText('')).toBe('');
  });

  it('strips simple HTML tags', () => {
    expect(htmlToText('<p>Hello World</p>')).toBe('Hello World');
  });

  it('converts <br> to newlines', () => {
    expect(htmlToText('Line 1<br>Line 2<br/>Line 3')).toBe('Line 1\nLine 2\nLine 3');
  });

  it('converts closing block tags to newlines', () => {
    expect(htmlToText('<p>Para 1</p><p>Para 2</p>')).toBe('Para 1\nPara 2');
  });

  it('converts <li> to bullet points', () => {
    expect(htmlToText('<ul><li>Item 1</li><li>Item 2</li></ul>')).toBe('- Item 1\n- Item 2');
  });

  it('decodes HTML entities', () => {
    expect(htmlToText('&amp; &lt; &gt; &quot; &#39;')).toBe("& < > \" '");
    expect(htmlToText('a&nbsp;b')).toBe('a b');
  });

  it('collapses multiple newlines', () => {
    expect(htmlToText('<p>A</p><p></p><p></p><p>B</p>')).toBe('A\n\nB');
  });

  it('handles heading tags', () => {
    expect(htmlToText('<h1>Title</h1><p>Text</p>')).toBe('Title\nText');
  });

  it('strips nested tags', () => {
    expect(htmlToText('<p><strong>Bold</strong> and <em>italic</em></p>')).toBe('Bold and italic');
  });

  it('handles OneNote-style HTML with divs and spans', () => {
    const html = '<div><span style="font-size:12pt">Some text</span></div>';
    expect(htmlToText(html)).toBe('Some text');
  });

  it('strips img tags (no image import in v1)', () => {
    expect(htmlToText('<p>Before<img src="data:image/png;base64,abc"/>After</p>')).toBe('BeforeAfter');
  });

  it('handles table rows', () => {
    const html = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr><tr><td>Cell 3</td></tr></table>';
    const result = htmlToText(html);
    expect(result).toContain('Cell 1');
    expect(result).toContain('Cell 2');
    expect(result).toContain('Cell 3');
  });
});

describe('textToStorageFormat', () => {
  it('returns empty paragraph for empty input', () => {
    expect(textToStorageFormat('')).toBe('<p></p>');
  });

  it('wraps single line in <p>', () => {
    expect(textToStorageFormat('Hello')).toBe('<p>Hello</p>');
  });

  it('splits double newlines into separate paragraphs', () => {
    const result = textToStorageFormat('Para 1\n\nPara 2');
    expect(result).toBe('<p>Para 1</p>\n<p>Para 2</p>');
  });

  it('converts single newlines to <br />', () => {
    const result = textToStorageFormat('Line 1\nLine 2');
    expect(result).toBe('<p>Line 1<br />Line 2</p>');
  });

  it('escapes XML special characters', () => {
    const result = textToStorageFormat('A & B < C > D');
    expect(result).toBe('<p>A &amp; B &lt; C &gt; D</p>');
  });
});
