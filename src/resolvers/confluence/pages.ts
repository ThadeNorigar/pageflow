import api, { route, assumeTrustedRoute } from '@forge/api';
import { ConfluencePage, RawPage } from './types';

interface V2PageResponse {
  results: RawPage[];
  _links: {
    next?: string;
  };
}

function mapPage(raw: RawPage, spaceKey: string, parentId: string | null): ConfluencePage {
  return {
    id: raw.id,
    title: raw.title,
    spaceKey,
    parentId,
    hasChildren: true,
  };
}

async function fetchPages(
  initialUrl: ReturnType<typeof route>,
  spaceKey: string,
  parentId: string | null
): Promise<ConfluencePage[]> {
  const allPages: ConfluencePage[] = [];
  let nextUrl: string | null = null;
  let isFirst = true;

  while (isFirst || nextUrl) {
    isFirst = false;
    const safeUrl = nextUrl ? assumeTrustedRoute(nextUrl) : initialUrl;
    const response = await api.asApp().requestConfluence(safeUrl, { method: 'GET' });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch pages: ${response.status} ${text}`);
    }

    const data: V2PageResponse = await response.json();

    for (const page of data.results) {
      allPages.push(mapPage(page, spaceKey, parentId));
    }

    nextUrl = data._links.next ?? null;
  }

  return allPages;
}

export async function getPages(spaceKey: string, spaceId: string): Promise<ConfluencePage[]> {
  return fetchPages(
    route`/wiki/api/v2/pages?space-id=${spaceId}&depth=root&status=current&limit=25`,
    spaceKey,
    null
  );
}

export async function getChildPages(pageId: string, spaceKey: string): Promise<ConfluencePage[]> {
  return fetchPages(
    route`/wiki/api/v2/pages?parent-id=${pageId}&status=current&limit=25`,
    spaceKey,
    pageId
  );
}
