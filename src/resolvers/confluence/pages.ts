import { requestConfluence, route, assumeTrustedRoute, Route } from '@forge/api';
import { ConfluenceApiResponse, ConfluencePage, RawConfluencePage } from './types';

function mapPage(raw: RawConfluencePage): ConfluencePage {
  return {
    id: raw.id,
    title: raw.title,
    spaceId: raw.spaceId,
    parentId: raw.parentId ?? null,
    hasChildren: Boolean(raw._links?.childPages),
  };
}

async function fetchPages(initialUrl: Route): Promise<ConfluencePage[]> {
  const allPages: ConfluencePage[] = [];
  let nextUrl: string | null = null;
  let isFirst = true;

  while (isFirst || nextUrl) {
    isFirst = false;
    const safeUrl = nextUrl ? assumeTrustedRoute(nextUrl) : initialUrl;
    const response = await requestConfluence(safeUrl, { method: 'GET' });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch pages: ${response.status} ${text}`);
    }

    const data: ConfluenceApiResponse<RawConfluencePage> = await response.json();

    for (const page of data.results) {
      allPages.push(mapPage(page));
    }

    nextUrl = data._links.next ?? null;
  }

  return allPages;
}

export async function getPages(spaceId: string): Promise<ConfluencePage[]> {
  return fetchPages(route`/wiki/api/v2/spaces/${spaceId}/pages?depth=0&limit=25`);
}

export async function getChildPages(pageId: string): Promise<ConfluencePage[]> {
  return fetchPages(route`/wiki/api/v2/pages/${pageId}/children?limit=25`);
}
