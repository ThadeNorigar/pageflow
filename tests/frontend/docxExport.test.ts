import { Paragraph, Table, Packer } from 'docx';
import { blocksToDocxChildren, buildDocx } from '../../src/frontend/utils/docxExport';
import { ContentBlock } from '../../src/shared/contentModel';
import { ExportPage } from '../../src/frontend/utils/docDefinition';

describe('blocksToDocxChildren', () => {
  it('maps headings and paragraphs to Paragraph', () => {
    const blocks: ContentBlock[] = [
      { type: 'heading', level: 1, runs: [{ text: 'Title' }] },
      { type: 'paragraph', runs: [{ text: 'Body' }] },
    ];
    const out = blocksToDocxChildren(blocks);
    expect(out).toHaveLength(2);
    expect(out[0]).toBeInstanceOf(Paragraph);
    expect(out[1]).toBeInstanceOf(Paragraph);
  });

  it('maps a table to a Table element', () => {
    const blocks: ContentBlock[] = [
      { type: 'table', headerRow: true, rows: [[[{ text: 'A' }], [{ text: 'B' }]], [[{ text: '1' }], [{ text: '2' }]]] },
    ];
    const out = blocksToDocxChildren(blocks);
    expect(out).toHaveLength(1);
    expect(out[0]).toBeInstanceOf(Table);
  });

  it('skips empty tables', () => {
    const blocks: ContentBlock[] = [{ type: 'table', headerRow: false, rows: [] }];
    expect(blocksToDocxChildren(blocks)).toHaveLength(0);
  });

  it('maps code blocks to one paragraph per line', () => {
    const blocks: ContentBlock[] = [{ type: 'codeBlock', text: 'line1\nline2\nline3' }];
    const out = blocksToDocxChildren(blocks);
    expect(out).toHaveLength(3);
    out.forEach(p => expect(p).toBeInstanceOf(Paragraph));
  });

  it('maps a list to one paragraph per item', () => {
    const blocks: ContentBlock[] = [
      { type: 'list', ordered: false, items: [{ runs: [{ text: 'a' }] }, { runs: [{ text: 'b' }] }] },
    ];
    const out = blocksToDocxChildren(blocks);
    expect(out).toHaveLength(2);
  });

  it('maps nested list children as additional paragraphs', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'list',
        ordered: false,
        items: [{ runs: [{ text: 'parent' }], children: [{ type: 'list', ordered: false, items: [{ runs: [{ text: 'child' }] }] }] }],
      },
    ];
    const out = blocksToDocxChildren(blocks);
    expect(out.length).toBeGreaterThanOrEqual(2);
  });

  it('maps panel to a Table wrapper', () => {
    const blocks: ContentBlock[] = [
      { type: 'panel', panelType: 'info', blocks: [{ type: 'paragraph', runs: [{ text: 'note' }] }] },
    ];
    const out = blocksToDocxChildren(blocks);
    expect(out[0]).toBeInstanceOf(Table);
  });

  it('maps task list and image/placeholder', () => {
    const blocks: ContentBlock[] = [
      { type: 'taskList', items: [{ checked: true, runs: [{ text: 'done' }] }] },
      { type: 'image', filename: 'pic.png' },
      { type: 'placeholder', reason: 'jira' },
    ];
    const out = blocksToDocxChildren(blocks);
    expect(out).toHaveLength(3);
    out.forEach(p => expect(p).toBeInstanceOf(Paragraph));
  });

  it('does not crash on links, bold, code runs', () => {
    const blocks: ContentBlock[] = [
      { type: 'paragraph', runs: [{ text: 'a', bold: true }, { text: 'b', link: 'https://x.de' }, { text: 'c', code: true }] },
    ];
    expect(blocksToDocxChildren(blocks)).toHaveLength(1);
  });
});

describe('buildDocx', () => {
  const pages: ExportPage[] = [
    { id: '1', title: 'First', blocks: [{ type: 'paragraph', runs: [{ text: 'Hello' }] }], depth: 0 },
    { id: '2', title: 'Second', blocks: [{ type: 'heading', level: 2, runs: [{ text: 'H' }] }], depth: 0 },
  ];

  it('returns a packable document object', async () => {
    const doc = buildDocx(pages);
    expect(doc).toBeDefined();
    await expect(Packer.toBuffer(doc)).resolves.toBeDefined();
  });

  it('packs to a non-empty buffer (valid .docx)', async () => {
    const doc = buildDocx(pages);
    const buf = await Packer.toBuffer(doc);
    expect(buf.byteLength).toBeGreaterThan(1000);
    // .docx is a zip → starts with PK
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('handles emoji and unicode without sanitizing', async () => {
    const doc = buildDocx([{ id: '1', title: 'Plan → 🚀', blocks: [{ type: 'paragraph', runs: [{ text: 'Pfeil → ✅' }] }], depth: 0 }]);
    const buf = await Packer.toBuffer(doc);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });
});
