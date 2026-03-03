import { buildFolderTree, flattenTree, countFiles, FolderNode } from '../../src/frontend/utils/folderTree';

function makeHtmlFile(name: string, relativePath: string, size = 2048): File {
  const file = new File(['<html></html>'], name, { type: 'text/html' });
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function makeResourceFile(name: string, relativePath: string, size = 4096): File {
  const file = new File(['binary'], name, { type: 'image/png' });
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('buildFolderTree with .htm files', () => {
  it('builds tree from .htm files', () => {
    const files = [
      makeHtmlFile('Page1.htm', 'Export/Page1.htm'),
      makeHtmlFile('Page2.htm', 'Export/Page2.htm'),
    ];
    const tree = buildFolderTree(files, '.htm');
    expect(tree).not.toBeNull();
    expect(tree!.name).toBe('Export');
    expect(tree!.files).toHaveLength(2);
  });

  it('returns null when no .htm files present', () => {
    const files = [
      makeResourceFile('image.png', 'Export/Page1_files/image.png'),
    ];
    const tree = buildFolderTree(files, '.htm');
    expect(tree).toBeNull();
  });

  it('filters out *_files/ resource directories (only .htm files)', () => {
    const files = [
      makeHtmlFile('Page1.htm', 'Export/Page1.htm'),
      makeResourceFile('image.png', 'Export/Page1_files/image.png'),
      makeResourceFile('style.css', 'Export/Page1_files/style.css'),
    ];
    const tree = buildFolderTree(files, '.htm');
    expect(tree!.files).toHaveLength(1);
    expect(tree!.files[0].name).toBe('Page1.htm');
  });

  it('handles sections as subfolders', () => {
    const files = [
      makeHtmlFile('Note1.htm', 'Notebook/Section1/Note1.htm'),
      makeHtmlFile('Note2.htm', 'Notebook/Section2/Note2.htm'),
    ];
    const tree = buildFolderTree(files, '.htm');
    expect(tree!.name).toBe('Notebook');
    expect(tree!.children).toHaveLength(2);
    expect(tree!.children[0].name).toBe('Section1');
    expect(tree!.children[0].files).toHaveLength(1);
  });

  it('handles .html extension as well', () => {
    const file = makeHtmlFile('Page.html', 'Export/Page.html');
    const tree = buildFolderTree([file], '.htm');
    expect(tree).not.toBeNull();
    expect(tree!.files).toHaveLength(1);
  });

  it('is case-insensitive for extension', () => {
    const file = makeHtmlFile('Page.HTM', 'Export/Page.HTM');
    const tree = buildFolderTree([file], '.htm');
    expect(tree).not.toBeNull();
  });
});

describe('countFiles with .htm filter', () => {
  it('counts only .htm files', () => {
    const files = [
      makeHtmlFile('A.htm', 'Root/A.htm'),
      makeHtmlFile('B.htm', 'Root/Sub/B.htm'),
    ];
    const tree = buildFolderTree(files, '.htm')!;
    expect(countFiles(tree, true)).toBe(2);
    expect(countFiles(tree, false)).toBe(1);
  });
});
