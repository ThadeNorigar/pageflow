import { buildDocDefinition, mapBlocks } from '../../src/frontend/utils/docDefinition';
import { ContentBlock } from '../../src/shared/contentModel';

describe('buildDocDefinition', () => {
  it('renders the page title as first content element', () => {
    const def = buildDocDefinition([
      { id: '1', title: 'My Page', blocks: [], depth: 0 },
    ]);
    const content = def.content as unknown as Array<Record<string, unknown>>;
    expect(content[0]).toMatchObject({ text: 'My Page', bold: true, fontSize: 20 });
  });

  it('adds a page break before every page except the first', () => {
    const def = buildDocDefinition([
      { id: '1', title: 'First', blocks: [], depth: 0 },
      { id: '2', title: 'Second', blocks: [], depth: 0 },
    ]);
    const content = def.content as unknown as Array<Record<string, unknown>>;
    const titles = content.filter(c => typeof c.text === 'string' && (c.text === 'First' || c.text === 'Second'));
    expect(titles[0].pageBreak).toBeUndefined();
    expect(titles[1].pageBreak).toBe('before');
  });

  it('sanitizes the title', () => {
    const def = buildDocDefinition([
      { id: '1', title: 'Plan → Ziel 🚀', blocks: [], depth: 0 },
    ]);
    const content = def.content as unknown as Array<Record<string, unknown>>;
    expect(content[0].text).toBe('Plan -> Ziel ');
  });

  it('defines footer with page numbers', () => {
    const def = buildDocDefinition([{ id: '1', title: 'P', blocks: [], depth: 0 }]);
    const footer = (def.footer as (c: number, t: number) => { text: string })(2, 5);
    expect(footer.text).toBe('2 / 5');
  });
});

describe('mapBlocks', () => {
  it('maps headings with size by level', () => {
    const blocks: ContentBlock[] = [{ type: 'heading', level: 1, runs: [{ text: 'H' }] }];
    const [content] = mapBlocks(blocks) as unknown as Array<Record<string, unknown>>;
    expect(content).toMatchObject({ bold: true, fontSize: 18 });
  });

  it('maps paragraph runs with formatting', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'paragraph',
        runs: [
          { text: 'plain ' },
          { text: 'bold', bold: true },
          { text: 'link', link: 'https://x.de' },
        ],
      },
    ];
    const [content] = mapBlocks(blocks) as unknown as Array<{ text: Array<Record<string, unknown>> }>;
    expect(content.text[0]).toEqual({ text: 'plain ' });
    expect(content.text[1]).toMatchObject({ text: 'bold', bold: true });
    expect(content.text[2]).toMatchObject({ text: 'link', link: 'https://x.de', color: '#0052CC' });
  });

  it('maps tables with header row and pads uneven rows', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'table',
        headerRow: true,
        rows: [
          [[{ text: 'A' }], [{ text: 'B' }]],
          [[{ text: 'only one cell' }]],
        ],
      },
    ];
    const [content] = mapBlocks(blocks) as unknown as Array<{ table: { headerRows: number; body: unknown[][] } }>;
    expect(content.table.headerRows).toBe(1);
    expect(content.table.body[0]).toHaveLength(2);
    expect(content.table.body[1]).toHaveLength(2);
  });

  it('maps code blocks to monospace box', () => {
    const blocks: ContentBlock[] = [{ type: 'codeBlock', language: 'ts', text: 'const x = 1;' }];
    const [content] = mapBlocks(blocks) as unknown as Array<{ table: { body: Array<Array<{ stack: Array<Record<string, unknown>> }>> } }>;
    const cell = content.table.body[0][0];
    expect(cell.stack[0]).toMatchObject({ text: 'ts' });
    expect(cell.stack[1]).toMatchObject({ text: 'const x = 1;', font: 'RobotoMono', preserveLeadingSpaces: true });
  });

  it('maps panels with colored sidebar', () => {
    const blocks: ContentBlock[] = [
      { type: 'panel', panelType: 'warning', blocks: [{ type: 'paragraph', runs: [{ text: 'Careful' }] }] },
    ];
    const [content] = mapBlocks(blocks) as unknown as Array<{ table: { body: Array<Array<Record<string, unknown>>> } }>;
    expect(content.table.body[0][0]).toMatchObject({ fillColor: '#DE350B' });
    expect(content.table.body[0][1]).toMatchObject({ fillColor: '#FFEBE6' });
  });

  it('maps task lists with checkbox prefix', () => {
    const blocks: ContentBlock[] = [
      { type: 'taskList', items: [{ checked: true, runs: [{ text: 'Done' }] }, { checked: false, runs: [{ text: 'Open' }] }] },
    ];
    const [content] = mapBlocks(blocks) as unknown as Array<{ ul: Array<{ text: Array<Record<string, unknown>> }> }>;
    expect(content.ul[0].text[0]).toMatchObject({ text: '[x] ' });
    expect(content.ul[1].text[0]).toMatchObject({ text: '[ ] ' });
  });

  it('maps images and placeholders to muted hints', () => {
    const blocks: ContentBlock[] = [
      { type: 'image', filename: 'pic.png' },
      { type: 'placeholder', reason: 'jira' },
    ];
    const result = mapBlocks(blocks) as unknown as Array<Record<string, unknown>>;
    expect(result[0].text).toBe('[Image: pic.png]');
    expect(result[1].text).toBe('[Unsupported content: jira]');
  });

  it('maps nested lists via stacks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'list',
        ordered: false,
        items: [
          {
            runs: [{ text: 'Outer' }],
            children: [{ type: 'list', ordered: false, items: [{ runs: [{ text: 'Inner' }] }] }],
          },
        ],
      },
    ];
    const [content] = mapBlocks(blocks) as unknown as Array<{ ul: Array<{ stack: unknown[] }> }>;
    expect(content.ul[0].stack).toHaveLength(2);
  });

  it('skips empty tables', () => {
    const blocks: ContentBlock[] = [{ type: 'table', headerRow: false, rows: [] }];
    expect(mapBlocks(blocks)).toHaveLength(0);
  });
});
