import { buildFolderTree, flattenTree, countFiles, totalSize, FolderNode } from '../../src/frontend/utils/folderTree';

function makeFile(name: string, relativePath: string, size = 1024): File {
  const file = new File(['x'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('buildFolderTree', () => {
  it('returns null for empty file list', () => {
    expect(buildFolderTree([])).toBeNull();
  });

  it('returns null when no PDFs in list', () => {
    const file = new File(['x'], 'image.png', { type: 'image/png' });
    Object.defineProperty(file, 'webkitRelativePath', { value: 'Folder/image.png' });
    expect(buildFolderTree([file])).toBeNull();
  });

  it('builds tree from flat folder with PDFs', () => {
    const files = [
      makeFile('doc1.pdf', 'MyFolder/doc1.pdf'),
      makeFile('doc2.pdf', 'MyFolder/doc2.pdf'),
    ];
    const tree = buildFolderTree(files);
    expect(tree).not.toBeNull();
    expect(tree!.name).toBe('MyFolder');
    expect(tree!.files).toHaveLength(2);
    expect(tree!.children).toHaveLength(0);
  });

  it('builds tree with subfolders', () => {
    const files = [
      makeFile('a.pdf', 'Root/Sub1/a.pdf'),
      makeFile('b.pdf', 'Root/Sub2/b.pdf'),
      makeFile('c.pdf', 'Root/c.pdf'),
    ];
    const tree = buildFolderTree(files);
    expect(tree!.name).toBe('Root');
    expect(tree!.files).toHaveLength(1);
    expect(tree!.files[0].name).toBe('c.pdf');
    expect(tree!.children).toHaveLength(2);
    expect(tree!.children[0].name).toBe('Sub1');
    expect(tree!.children[0].files).toHaveLength(1);
    expect(tree!.children[1].name).toBe('Sub2');
  });

  it('builds nested subfolders', () => {
    const files = [
      makeFile('deep.pdf', 'Root/A/B/deep.pdf'),
    ];
    const tree = buildFolderTree(files);
    expect(tree!.name).toBe('Root');
    expect(tree!.children[0].name).toBe('A');
    expect(tree!.children[0].children[0].name).toBe('B');
    expect(tree!.children[0].children[0].files[0].name).toBe('deep.pdf');
  });

  it('filters out non-PDF files', () => {
    const pdf = makeFile('doc.pdf', 'Folder/doc.pdf');
    const txt = new File(['x'], 'notes.txt', { type: 'text/plain' });
    Object.defineProperty(txt, 'webkitRelativePath', { value: 'Folder/notes.txt' });
    const tree = buildFolderTree([pdf, txt]);
    expect(tree!.files).toHaveLength(1);
    expect(tree!.files[0].name).toBe('doc.pdf');
  });

  it('filters out zero-size files', () => {
    const file = makeFile('empty.pdf', 'Folder/empty.pdf', 0);
    expect(buildFolderTree([file])).toBeNull();
  });

  it('falls back to file.name when webkitRelativePath is missing', () => {
    const file = new File(['x'], 'standalone.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });
    const tree = buildFolderTree([file]);
    expect(tree).not.toBeNull();
    expect(tree!.name).toBe('standalone.pdf');
    expect(tree!.files).toHaveLength(1);
  });

  it('groups multiple files into the same subfolder', () => {
    const files = [
      makeFile('a.pdf', 'Root/Shared/a.pdf'),
      makeFile('b.pdf', 'Root/Shared/b.pdf'),
    ];
    const tree = buildFolderTree(files);
    expect(tree!.children).toHaveLength(1);
    expect(tree!.children[0].name).toBe('Shared');
    expect(tree!.children[0].files).toHaveLength(2);
  });

  it('handles case-insensitive .PDF extension', () => {
    const file = makeFile('DOC.PDF', 'Folder/DOC.PDF');
    const tree = buildFolderTree([file]);
    expect(tree).not.toBeNull();
    expect(tree!.files[0].name).toBe('DOC.PDF');
  });
});

describe('flattenTree', () => {
  const tree: FolderNode = {
    name: 'Root',
    path: '',
    files: [makeFile('root.pdf', 'Root/root.pdf')],
    children: [
      {
        name: 'Sub1',
        path: 'Sub1',
        files: [makeFile('a.pdf', 'Root/Sub1/a.pdf'), makeFile('b.pdf', 'Root/Sub1/b.pdf')],
        children: [],
      },
      {
        name: 'Sub2',
        path: 'Sub2',
        files: [makeFile('c.pdf', 'Root/Sub2/c.pdf')],
        children: [],
      },
    ],
  };

  it('flattens with subfolders included', () => {
    const items = flattenTree(tree, true);
    const folders = items.filter(i => i.type === 'folder');
    const pdfs = items.filter(i => i.type === 'pdf');
    expect(folders).toHaveLength(3); // Root, Sub1, Sub2
    expect(pdfs).toHaveLength(4); // root.pdf, a.pdf, b.pdf, c.pdf
  });

  it('flattens without subfolders (only root files)', () => {
    const items = flattenTree(tree, false);
    const folders = items.filter(i => i.type === 'folder');
    const pdfs = items.filter(i => i.type === 'pdf');
    expect(folders).toHaveLength(1); // Root only
    expect(pdfs).toHaveLength(1); // root.pdf only
  });

  it('returns empty array for tree with no files and no children', () => {
    const emptyTree: FolderNode = { name: 'Empty', path: '', files: [], children: [] };
    const items = flattenTree(emptyTree, true);
    expect(items).toHaveLength(0);
  });

  it('items have correct order (folder before its files)', () => {
    const items = flattenTree(tree, true);
    expect(items[0]).toMatchObject({ type: 'folder', name: 'Root' });
    expect(items[1]).toMatchObject({ type: 'pdf', name: 'root.pdf' });
    expect(items[2]).toMatchObject({ type: 'folder', name: 'Sub1' });
  });
});

describe('countFiles', () => {
  const tree: FolderNode = {
    name: 'Root',
    path: '',
    files: [makeFile('a.pdf', 'Root/a.pdf')],
    children: [
      { name: 'Sub', path: 'Sub', files: [makeFile('b.pdf', 'Root/Sub/b.pdf'), makeFile('c.pdf', 'Root/Sub/c.pdf')], children: [] },
    ],
  };

  it('counts only root files without subfolders', () => {
    expect(countFiles(tree, false)).toBe(1);
  });

  it('counts all files with subfolders', () => {
    expect(countFiles(tree, true)).toBe(3);
  });

  it('returns 0 for empty tree', () => {
    const empty: FolderNode = { name: 'E', path: '', files: [], children: [] };
    expect(countFiles(empty, true)).toBe(0);
    expect(countFiles(empty, false)).toBe(0);
  });
});

describe('totalSize', () => {
  const tree: FolderNode = {
    name: 'Root',
    path: '',
    files: [makeFile('a.pdf', 'Root/a.pdf', 1000)],
    children: [
      { name: 'Sub', path: 'Sub', files: [makeFile('b.pdf', 'Root/Sub/b.pdf', 2000)], children: [] },
    ],
  };

  it('sums only root file sizes without subfolders', () => {
    expect(totalSize(tree, false)).toBe(1000);
  });

  it('sums all file sizes with subfolders', () => {
    expect(totalSize(tree, true)).toBe(3000);
  });

  it('returns 0 for empty tree', () => {
    const empty: FolderNode = { name: 'E', path: '', files: [], children: [] };
    expect(totalSize(empty, true)).toBe(0);
    expect(totalSize(empty, false)).toBe(0);
  });
});
