export interface FolderNode {
  name: string;
  path: string;
  files: File[];
  children: FolderNode[];
}

export interface FlatImportItem {
  type: 'folder' | 'pdf';
  name: string;
  path: string;
  file?: File;
}

function matchesExtension(name: string, ext: string): boolean {
  const lower = name.toLowerCase();
  if (ext === '.htm') {
    return lower.endsWith('.htm') || lower.endsWith('.html');
  }
  return lower.endsWith(ext);
}

function isResourcePath(relativePath: string): boolean {
  const parts = relativePath.split('/');
  return parts.some(p => p.endsWith('_files'));
}

export function buildFolderTree(files: File[], extension = '.pdf'): FolderNode | null {
  const filtered = Array.from(files).filter(f => {
    if (!matchesExtension(f.name, extension) || f.size === 0) return false;
    const relPath = (f as { webkitRelativePath?: string }).webkitRelativePath || f.name;
    if (extension === '.htm' && isResourcePath(relPath)) return false;
    return true;
  });

  if (filtered.length === 0) return null;

  const firstPath = (filtered[0] as { webkitRelativePath?: string }).webkitRelativePath || filtered[0].name;
  const rootName = firstPath.split('/')[0] || 'Import';

  const root: FolderNode = { name: rootName, path: '', files: [], children: [] };

  for (const file of filtered) {
    const relPath = (file as { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = relPath.split('/');
    // parts[0] = root folder name, skip it
    const subParts = parts.slice(1);

    let current = root;
    for (let i = 0; i < subParts.length - 1; i++) {
      const folderName = subParts[i];
      let child = current.children.find(c => c.name === folderName);
      if (!child) {
        child = { name: folderName, path: subParts.slice(0, i + 1).join('/'), files: [], children: [] };
        current.children.push(child);
      }
      current = child;
    }
    current.files.push(file);
  }

  return root;
}

export function flattenTree(tree: FolderNode, includeSubfolders: boolean): FlatImportItem[] {
  const items: FlatImportItem[] = [];

  function walk(node: FolderNode, depth: number): void {
    if (depth > 0 && !includeSubfolders) return;

    if (depth > 0 || node.files.length > 0 || node.children.length > 0) {
      items.push({ type: 'folder', name: node.name, path: node.path });
    }

    for (const file of node.files) {
      items.push({ type: 'pdf', name: file.name, path: node.path, file });
    }

    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  walk(tree, 0);
  return items;
}

export function countFiles(tree: FolderNode, includeSubfolders: boolean): number {
  let count = tree.files.length;
  if (includeSubfolders) {
    for (const child of tree.children) {
      count += countFiles(child, true);
    }
  }
  return count;
}

export function totalSize(tree: FolderNode, includeSubfolders: boolean): number {
  let size = tree.files.reduce((sum, f) => sum + f.size, 0);
  if (includeSubfolders) {
    for (const child of tree.children) {
      size += totalSize(child, true);
    }
  }
  return size;
}
