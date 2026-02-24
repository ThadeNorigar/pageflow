import { requestConfluence, route, assumeTrustedRoute } from '@forge/api';
import { ConfluenceApiResponse, ConfluenceSpace } from './types';

export async function getSpaces(): Promise<ConfluenceSpace[]> {
  const allSpaces: ConfluenceSpace[] = [];
  let nextUrl: string | null = null;
  let isFirst = true;

  while (isFirst || nextUrl) {
    isFirst = false;
    const safeUrl = nextUrl
      ? assumeTrustedRoute(nextUrl)
      : route`/wiki/api/v2/spaces?limit=25`;

    const response = await requestConfluence(safeUrl, { method: 'GET' });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch spaces: ${response.status} ${text}`);
    }

    const data: ConfluenceApiResponse<ConfluenceSpace> = await response.json();

    for (const space of data.results) {
      allSpaces.push({
        id: space.id,
        key: space.key,
        name: space.name,
        type: space.type,
      });
    }

    nextUrl = data._links.next ?? null;
  }

  return allSpaces;
}
