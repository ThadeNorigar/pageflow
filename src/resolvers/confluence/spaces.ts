import api, { route, assumeTrustedRoute } from '@forge/api';
import { ConfluenceSpace, RawSpace } from './types';

interface V2SpaceResponse {
  results: RawSpace[];
  _links: {
    next?: string;
  };
}

function mapSpace(raw: RawSpace): ConfluenceSpace {
  return {
    id: String(raw.id),
    key: raw.key,
    name: raw.name,
    type: raw.type === 'global' || raw.type === 'personal' ? raw.type : 'global',
  };
}

export async function getSpaces(): Promise<ConfluenceSpace[]> {
  const allSpaces: ConfluenceSpace[] = [];
  let nextUrl: string | null = null;
  let isFirst = true;

  while (isFirst || nextUrl) {
    isFirst = false;
    const safeUrl = nextUrl
      ? assumeTrustedRoute(nextUrl)
      : route`/wiki/api/v2/spaces?limit=25`;

    const response = await api.asApp().requestConfluence(safeUrl, { method: 'GET' });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch spaces: ${response.status} ${text}`);
    }

    const data: V2SpaceResponse = await response.json();

    for (const space of data.results) {
      allSpaces.push(mapSpace(space));
    }

    nextUrl = data._links.next ?? null;
  }

  return allSpaces;
}
