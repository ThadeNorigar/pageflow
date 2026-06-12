import { Parser } from 'htmlparser2';
import { ContentBlock, InlineRun, ListItem, PanelType, TaskItem } from '../../shared/contentModel';

export { ContentBlock, InlineRun } from '../../shared/contentModel';

const PANEL_MACROS: Record<string, PanelType> = {
  info: 'info',
  note: 'note',
  warning: 'warning',
  tip: 'tip',
  panel: 'panel',
};

const CODE_MACROS = new Set(['code', 'noformat']);

// Macros whose rich-text body is rendered as regular content
const TRANSPARENT_MACROS = new Set(['excerpt', 'expand', 'section', 'column', 'details']);

const SAFE_HREF_PATTERN = /^(https?:|mailto:)/i;

const HEADING_PATTERN = /^h([1-6])$/;

// Elements that interrupt an implicit (bare-text) paragraph
const TRANSPARENT_TAGS = new Set([
  'div', 'span', 'section', 'article', 'center', 'font', 'main', 'header', 'footer',
  'thead', 'tbody', 'tfoot', 'colgroup', 'col', 'caption',
  'ac:layout', 'ac:layout-section', 'ac:layout-cell',
  'ac:inline-comment-marker',
]);

const MARK_TAGS: Record<string, keyof Marks> = {
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  s: 'strike',
  del: 'strike',
  strike: 'strike',
  code: 'code',
  tt: 'code',
};

interface Marks {
  bold: number;
  italic: number;
  strike: number;
  code: number;
}

interface Frame {
  tag: string;
  kind: string;
  startsSuppress?: boolean;
  runs?: InlineRun[];
  blocks?: ContentBlock[];
  mark?: keyof Marks;
  // table
  tableBlock?: { type: 'table'; headerRow: boolean; rows: InlineRun[][][] };
  rowCells?: InlineRun[][];
  rowAllTh?: boolean;
  // list
  listBlock?: { type: 'list'; ordered: boolean; items: ListItem[] };
  item?: ListItem;
  // macro
  macroName?: string;
  macroParams?: Record<string, string>;
  macroPlainText?: string;
  macroEmitted?: boolean;
  paramName?: string;
  // image / link
  image?: { type: 'image'; filename?: string; url?: string };
  linkTitle?: string;
  linkText?: string;
  // code block from <pre>
  codeBlock?: { type: 'codeBlock'; language?: string; text: string };
  // task list
  taskListBlock?: { type: 'taskList'; items: TaskItem[] };
  task?: TaskItem;
  statusText?: string;
}

function trimRuns(runs: InlineRun[]): InlineRun[] {
  const result = runs.filter(r => r.text.length > 0);
  if (result.length > 0) {
    result[0] = { ...result[0], text: result[0].text.replace(/^\s+/, '') };
    const last = result.length - 1;
    result[last] = { ...result[last], text: result[last].text.replace(/\s+$/, '') };
  }
  return result.filter(r => r.text.length > 0);
}

export function parseStorageFormat(xhtml: string): ContentBlock[] {
  const root: ContentBlock[] = [];
  if (!xhtml || !xhtml.trim()) return root;

  const stack: Frame[] = [];
  const marks: Marks = { bold: 0, italic: 0, strike: 0, code: 0 };
  const linkStack: string[] = [];
  let suppress = 0;
  let inCdata = false;
  let implicitPara: { owner: ContentBlock[]; runs: InlineRun[] } | null = null;

  function currentBlocks(): ContentBlock[] {
    for (let i = stack.length - 1; i >= 0; i--) {
      const f = stack[i];
      if (f.blocks) return f.blocks;
      if (f.kind === 'item' && f.item) {
        if (!f.item.children) f.item.children = [];
        return f.item.children;
      }
    }
    return root;
  }

  function currentRuns(): InlineRun[] | null {
    for (let i = stack.length - 1; i >= 0; i--) {
      const f = stack[i];
      if (f.runs) return f.runs;
      if (f.blocks || f.tableBlock || f.listBlock || f.taskListBlock) return null;
    }
    return null;
  }

  function appendRun(target: InlineRun[], text: string): void {
    if (!text) return;
    const run: InlineRun = { text };
    if (marks.bold > 0) run.bold = true;
    if (marks.italic > 0) run.italic = true;
    if (marks.strike > 0) run.strike = true;
    if (marks.code > 0) run.code = true;
    const link = linkStack.length > 0 ? linkStack[linkStack.length - 1] : '';
    if (link) run.link = link;

    const last = target[target.length - 1];
    if (
      last &&
      !!last.bold === !!run.bold && !!last.italic === !!run.italic &&
      !!last.strike === !!run.strike && !!last.code === !!run.code &&
      (last.link ?? '') === (run.link ?? '')
    ) {
      last.text += text;
    } else {
      target.push(run);
    }
  }

  function emitInline(text: string): void {
    const target = currentRuns();
    if (target) {
      appendRun(target, text);
      return;
    }
    // Bare text at block level → implicit paragraph
    if (!text.trim()) return;
    const owner = currentBlocks();
    if (!implicitPara || implicitPara.owner !== owner) {
      const para: ContentBlock = { type: 'paragraph', runs: [] };
      owner.push(para);
      implicitPara = { owner, runs: para.runs };
    }
    appendRun(implicitPara.runs, text);
  }

  function nearestFrame(kind: string): Frame | null {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].kind === kind) return stack[i];
    }
    return null;
  }

  function pushFrame(frame: Frame): void {
    stack.push(frame);
  }

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const tag = name.toLowerCase();

        if (suppress > 0) {
          pushFrame({ tag, kind: 'skip' });
          return;
        }

        // --- Inline marks ---
        const mark = MARK_TAGS[tag];
        if (mark) {
          marks[mark]++;
          pushFrame({ tag, kind: 'mark', mark });
          return;
        }
        if (tag === 'a') {
          const href = attribs.href && SAFE_HREF_PATTERN.test(attribs.href) ? attribs.href : '';
          linkStack.push(href);
          pushFrame({ tag, kind: 'link' });
          return;
        }
        if (tag === 'br') {
          const target = currentRuns() ?? (implicitPara ? implicitPara.runs : null);
          if (target) appendRun(target, '\n');
          pushFrame({ tag, kind: 'void' });
          return;
        }
        if (tag === 'time') {
          emitInline(attribs.datetime ?? '');
          pushFrame({ tag, kind: 'transparent' });
          return;
        }
        if (tag === 'ac:emoticon') {
          const fallback =
            attribs['ac:emoji-fallback'] ?? attribs['ac:fallback'] ??
            (attribs['ac:name'] ? `(${attribs['ac:name']})` : '');
          emitInline(fallback);
          pushFrame({ tag, kind: 'transparent' });
          return;
        }

        // --- Block-level: implicit paragraph ends here ---
        implicitPara = null;

        const headingMatch = HEADING_PATTERN.exec(tag);
        if (headingMatch) {
          const block: ContentBlock = { type: 'heading', level: parseInt(headingMatch[1], 10), runs: [] };
          currentBlocks().push(block);
          pushFrame({ tag, kind: 'heading', runs: block.runs });
          return;
        }

        if (tag === 'p') {
          const inline = currentRuns();
          if (inline) {
            // <p> inside li/td: separator, no new block
            if (inline.length > 0) appendRun(inline, '\n');
            pushFrame({ tag, kind: 'transparent' });
            return;
          }
          const block: ContentBlock = { type: 'paragraph', runs: [] };
          currentBlocks().push(block);
          pushFrame({ tag, kind: 'paragraph', runs: block.runs });
          return;
        }

        if (tag === 'ul' || tag === 'ol') {
          const block = { type: 'list' as const, ordered: tag === 'ol', items: [] as ListItem[] };
          currentBlocks().push(block);
          pushFrame({ tag, kind: 'list', listBlock: block });
          return;
        }
        if (tag === 'li') {
          const list = nearestFrame('list');
          const item: ListItem = { runs: [] };
          if (list?.listBlock) list.listBlock.items.push(item);
          pushFrame({ tag, kind: 'item', item, runs: item.runs });
          return;
        }

        if (tag === 'table') {
          const block = { type: 'table' as const, headerRow: false, rows: [] as InlineRun[][][] };
          currentBlocks().push(block);
          pushFrame({ tag, kind: 'table', tableBlock: block });
          return;
        }
        if (tag === 'tr') {
          pushFrame({ tag, kind: 'row', rowCells: [], rowAllTh: true });
          return;
        }
        if (tag === 'td' || tag === 'th') {
          const row = nearestFrame('row');
          if (row && tag === 'td') row.rowAllTh = false;
          pushFrame({ tag, kind: 'cell', runs: [] });
          return;
        }

        if (tag === 'blockquote') {
          const block: ContentBlock = { type: 'quote', blocks: [] };
          currentBlocks().push(block);
          pushFrame({ tag, kind: 'quote', blocks: block.blocks });
          return;
        }
        if (tag === 'pre') {
          const block = { type: 'codeBlock' as const, text: '' };
          currentBlocks().push(block);
          pushFrame({ tag, kind: 'pre', codeBlock: block });
          return;
        }
        if (tag === 'hr') {
          currentBlocks().push({ type: 'hr' });
          pushFrame({ tag, kind: 'void' });
          return;
        }

        // --- Confluence macros & resources ---
        if (tag === 'ac:structured-macro' || tag === 'ac:macro') {
          const macroName = (attribs['ac:name'] ?? '').toLowerCase();
          const frame: Frame = { tag, kind: 'macro', macroName, macroParams: {}, macroPlainText: '' };
          const known =
            macroName in PANEL_MACROS || CODE_MACROS.has(macroName) ||
            TRANSPARENT_MACROS.has(macroName) || macroName === 'status' || macroName === 'view-file';
          if (!known) {
            currentBlocks().push({ type: 'placeholder', reason: macroName || 'macro' });
            frame.startsSuppress = true;
            suppress++;
          }
          pushFrame(frame);
          return;
        }
        if (tag === 'ac:parameter') {
          pushFrame({ tag, kind: 'param', paramName: attribs['ac:name'] ?? '' });
          return;
        }
        if (tag === 'ac:plain-text-body') {
          pushFrame({ tag, kind: 'plainbody' });
          return;
        }
        if (tag === 'ac:rich-text-body') {
          const macro = nearestFrame('macro');
          const macroName = macro?.macroName ?? '';
          if (macro && macroName in PANEL_MACROS) {
            const block: ContentBlock = { type: 'panel', panelType: PANEL_MACROS[macroName], blocks: [] };
            currentBlocks().push(block);
            macro.macroEmitted = true;
            pushFrame({ tag, kind: 'richbody', blocks: block.blocks });
            return;
          }
          if (macro) macro.macroEmitted = true;
          pushFrame({ tag, kind: 'richbody' });
          return;
        }

        if (tag === 'ac:image') {
          const image = { type: 'image' as const, filename: undefined as string | undefined, url: undefined as string | undefined };
          pushFrame({ tag, kind: 'image', image });
          return;
        }
        if (tag === 'ri:attachment') {
          const imageFrame = nearestFrame('image');
          if (imageFrame?.image) imageFrame.image.filename = attribs['ri:filename'];
          const linkFrame = nearestFrame('aclink');
          if (linkFrame && !linkFrame.linkTitle) linkFrame.linkTitle = attribs['ri:filename'];
          pushFrame({ tag, kind: 'void' });
          return;
        }
        if (tag === 'ri:url') {
          const imageFrame = nearestFrame('image');
          if (imageFrame?.image) imageFrame.image.url = attribs['ri:value'];
          pushFrame({ tag, kind: 'void' });
          return;
        }
        if (tag === 'ri:page') {
          const linkFrame = nearestFrame('aclink');
          if (linkFrame) linkFrame.linkTitle = attribs['ri:content-title'];
          pushFrame({ tag, kind: 'void' });
          return;
        }

        if (tag === 'ac:link' || tag === 'ac:link-body' || tag === 'ac:plain-text-link-body') {
          if (tag === 'ac:link') {
            pushFrame({ tag, kind: 'aclink', linkText: '' });
          } else {
            pushFrame({ tag, kind: tag === 'ac:plain-text-link-body' ? 'linkbody' : 'transparent' });
          }
          return;
        }

        if (tag === 'ac:task-list') {
          const block = { type: 'taskList' as const, items: [] as TaskItem[] };
          currentBlocks().push(block);
          pushFrame({ tag, kind: 'tasklist', taskListBlock: block });
          return;
        }
        if (tag === 'ac:task') {
          const listFrame = nearestFrame('tasklist');
          const task: TaskItem = { checked: false, runs: [] };
          if (listFrame?.taskListBlock) listFrame.taskListBlock.items.push(task);
          pushFrame({ tag, kind: 'task', task });
          return;
        }
        if (tag === 'ac:task-status') {
          pushFrame({ tag, kind: 'taskstatus', statusText: '' });
          return;
        }
        if (tag === 'ac:task-body') {
          const taskFrame = nearestFrame('task');
          pushFrame({ tag, kind: 'taskbody', runs: taskFrame?.task?.runs ?? [] });
          return;
        }
        if (tag === 'ac:task-id') {
          pushFrame({ tag, kind: 'skipcontent', startsSuppress: true });
          suppress++;
          return;
        }

        if (tag === 'ac:placeholder' || tag === 'ac:adf-extension') {
          if (tag === 'ac:adf-extension') {
            currentBlocks().push({ type: 'placeholder', reason: 'adf-extension' });
          }
          pushFrame({ tag, kind: 'skipcontent', startsSuppress: true });
          suppress++;
          return;
        }

        // Transparent containers (layouts, divs, …) and any unknown element: pass through
        pushFrame({ tag, kind: TRANSPARENT_TAGS.has(tag) ? 'transparent' : 'unknown' });
      },

      ontext(text) {
        if (suppress > 0) return;

        // Capture targets first (raw text, no whitespace collapsing)
        for (let i = stack.length - 1; i >= 0; i--) {
          const f = stack[i];
          if (f.kind === 'param') {
            const macro = nearestFrame('macro');
            if (macro?.macroParams && f.paramName !== undefined) {
              macro.macroParams[f.paramName] = (macro.macroParams[f.paramName] ?? '') + text;
            }
            return;
          }
          if (f.kind === 'plainbody') {
            const macro = nearestFrame('macro');
            if (macro) macro.macroPlainText = (macro.macroPlainText ?? '') + text;
            return;
          }
          if (f.kind === 'pre' && f.codeBlock) {
            f.codeBlock.text += text;
            return;
          }
          if (f.kind === 'taskstatus') {
            f.statusText = (f.statusText ?? '') + text;
            return;
          }
          if (f.kind === 'linkbody') {
            const linkFrame = nearestFrame('aclink');
            if (linkFrame) linkFrame.linkText = (linkFrame.linkText ?? '') + text;
            return;
          }
          if (f.kind === 'macro' || f.kind === 'image') return; // stray whitespace inside macro/image wrappers
          if (f.runs || f.blocks || f.kind === 'mark' || f.kind === 'link' || f.kind === 'transparent' || f.kind === 'unknown' || f.kind === 'aclink' || f.kind === 'richbody' || f.kind === 'item') break;
          if (f.kind === 'table' || f.kind === 'row' || f.kind === 'tasklist' || f.kind === 'list') return; // whitespace between rows/items
        }

        const normalized = inCdata ? text : text.replace(/\s+/g, ' ');
        const linkFrame = nearestFrame('aclink');
        if (linkFrame && stack[stack.length - 1]?.kind !== 'linkbody') {
          // direct text inside ac:link (rare) — collect as link text
          linkFrame.linkText = (linkFrame.linkText ?? '') + normalized;
          return;
        }
        emitInline(normalized);
      },

      onclosetag() {
        const frame = stack.pop();
        if (!frame) return;

        if (frame.startsSuppress) {
          suppress = Math.max(0, suppress - 1);
          return;
        }
        if (suppress > 0) return;

        switch (frame.kind) {
          case 'mark':
            if (frame.mark) marks[frame.mark] = Math.max(0, marks[frame.mark] - 1);
            break;
          case 'link':
            linkStack.pop();
            break;
          case 'cell': {
            const row = nearestFrame('row');
            if (row?.rowCells && frame.runs) row.rowCells.push(trimRuns(frame.runs));
            break;
          }
          case 'row': {
            const table = nearestFrame('table');
            if (table?.tableBlock && frame.rowCells && frame.rowCells.length > 0) {
              if (table.tableBlock.rows.length === 0 && frame.rowAllTh) {
                table.tableBlock.headerRow = true;
              }
              table.tableBlock.rows.push(frame.rowCells);
            }
            break;
          }
          case 'taskstatus': {
            const task = nearestFrame('task');
            if (task?.task) task.task.checked = (frame.statusText ?? '').trim() === 'complete';
            break;
          }
          case 'aclink': {
            const text = (frame.linkText ?? '').trim() || (frame.linkTitle ?? '').trim();
            if (text) emitInline(text);
            break;
          }
          case 'image':
            if (frame.image) {
              implicitPara = null;
              currentBlocks().push(frame.image);
            }
            break;
          case 'pre':
            if (frame.codeBlock) frame.codeBlock.text = frame.codeBlock.text.replace(/^\n/, '').replace(/\n$/, '');
            break;
          case 'macro': {
            if (frame.macroEmitted) break;
            const name = frame.macroName ?? '';
            const params = frame.macroParams ?? {};
            if (CODE_MACROS.has(name)) {
              const block: ContentBlock = { type: 'codeBlock', text: (frame.macroPlainText ?? '').replace(/^\n/, '').replace(/\n$/, '') };
              if (params.language) block.language = params.language;
              implicitPara = null;
              currentBlocks().push(block);
            } else if (name === 'status') {
              emitInline(`[${(params.title ?? '').trim()}]`);
            } else if (name === 'view-file') {
              implicitPara = null;
              currentBlocks().push({ type: 'image', filename: params.name });
            } else if (TRANSPARENT_MACROS.has(name)) {
              // body-less transparent macro: nothing to emit
            }
            break;
          }
          default:
            break;
        }

        // Any closing block element ends an implicit paragraph
        if (frame.kind !== 'mark' && frame.kind !== 'link' && frame.kind !== 'void' && frame.kind !== 'aclink') {
          if (frame.kind !== 'transparent' && frame.kind !== 'unknown') implicitPara = null;
        }
      },

      oncdatastart() {
        inCdata = true;
      },

      oncdataend() {
        inCdata = false;
      },
    },
    { decodeEntities: true, recognizeSelfClosing: true, recognizeCDATA: true }
  );

  parser.write(xhtml);
  parser.end();

  return normalize(root);
}

function normalize(blocks: ContentBlock[]): ContentBlock[] {
  const result: ContentBlock[] = [];
  for (const block of blocks) {
    if (block.type === 'paragraph' || block.type === 'heading') {
      const runs = trimRuns(block.runs);
      if (runs.length === 0) continue;
      result.push({ ...block, runs });
    } else if (block.type === 'panel' || block.type === 'quote') {
      result.push({ ...block, blocks: normalize(block.blocks) });
    } else if (block.type === 'list') {
      const items: ListItem[] = [];
      for (const item of block.items) {
        const runs = trimRuns(item.runs);
        const children = item.children ? normalize(item.children) : undefined;
        if (runs.length === 0 && (!children || children.length === 0)) continue;
        const cleaned: ListItem = { runs };
        if (children && children.length > 0) cleaned.children = children;
        items.push(cleaned);
      }
      if (items.length === 0) continue;
      result.push({ ...block, items });
    } else if (block.type === 'taskList') {
      const items = block.items
        .map(item => ({ ...item, runs: trimRuns(item.runs) }))
        .filter(item => item.runs.length > 0);
      if (items.length === 0) continue;
      result.push({ ...block, items });
    } else {
      result.push(block);
    }
  }
  return result;
}
