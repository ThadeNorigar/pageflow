import api, { route, assumeTrustedRoute } from '@forge/api';
import { ConfluencePage, RawPage } from './types';

interface V2PageResponse {
  results: RawPage[];
  _links: {
    next?: string;
  };
}

interface RawFolder {
  id: string;
  title: string;
  parentId: string | null;
  parentType: string | null;
}

async function fetchFolderById(folderId: string): Promise<RawFolder | null> {
  const safeUrl = route`/wiki/api/v2/folders/${folderId}`;
  const response = await api.asApp().requestConfluence(safeUrl, { method: 'GET' });
  if (!response.ok) {
    await response.text();
    return null;
  }
  return response.json();
}

export async function getPages(spaceKey: string, spaceId: string): Promise<ConfluencePage[]> {
  const allRaw: RawPage[] = [];
  let nextUrl: string | null = null;
  let isFirst = true;

  while (isFirst || nextUrl) {
    isFirst = false;
    const safeUrl = nextUrl
      ? assumeTrustedRoute(nextUrl)
      : route`/wiki/api/v2/pages?space-id=${spaceId}&status=current&limit=250`;

    const response = await api.asApp().requestConfluence(safeUrl, { method: 'GET' });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch pages: ${response.status} ${text}`);
    }

    const data: V2PageResponse = await response.json();
    allRaw.push(...data.results);
    nextUrl = data._links.next ?? null;
  }

  // Collect folder IDs referenced by pages
  const pageIds = new Set(allRaw.map(p => p.id));
  const folderIdsToFetch = new Set<string>();
  for (const raw of allRaw) {
    if (raw.parentId && raw.parentType === 'folder' && !pageIds.has(raw.parentId)) {
      folderIdsToFetch.add(raw.parentId);
    }
  }

  // Fetch folders and their parent chain
  const folders = new Map<string, RawFolder>();
  const queue = [...folderIdsToFetch];
  while (queue.length > 0) {
    const batch = queue.splice(0, 10);
    const results = await Promise.all(batch.map(id => fetchFolderById(id)));
    for (const folder of results) {
      if (!folder || folders.has(folder.id)) continue;
      folders.set(folder.id, folder);
      if (folder.parentId && folder.parentType === 'folder' && !folders.has(folder.parentId) && !pageIds.has(folder.parentId)) {
        queue.push(folder.parentId);
      }
    }
  }

  // Build combined node list
  const allIds = new Set([...pageIds, ...folders.keys()]);
  const childOf = new Map<string, boolean>();
  for (const raw of allRaw) {
    if (raw.parentId && allIds.has(raw.parentId)) childOf.set(raw.parentId, true);
  }
  for (const folder of folders.values()) {
    if (folder.parentId && allIds.has(folder.parentId)) childOf.set(folder.parentId, true);
  }

  const pages: ConfluencePage[] = allRaw.map(raw => ({
    id: raw.id,
    title: raw.title,
    spaceKey,
    parentId: raw.parentId ?? null,
    hasChildren: childOf.has(raw.id),
  }));

  for (const folder of folders.values()) {
    pages.push({
      id: folder.id,
      title: folder.title,
      spaceKey,
      parentId: folder.parentId ?? null,
      hasChildren: childOf.has(folder.id),
      isFolder: true,
    });
  }

  return pages;
}
