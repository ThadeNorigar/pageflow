import api, { route } from '@forge/api';
import { parseStorageFormat, ContentBlock } from './storageParser';

export interface PageBody {
  id: string;
  title: string;
  blocks: ContentBlock[];
}

const VALID_PAGE_ID = /^[a-zA-Z0-9\-]+$/;

export async function getPageBody(pageId: string): Promise<PageBody> {
  if (!pageId || !VALID_PAGE_ID.test(pageId)) {
    throw new Error('Invalid page ID');
  }

  const safeUrl = route`/wiki/api/v2/pages/${pageId}?body-format=storage`;
  const response = await api.asApp().requestConfluence(safeUrl, { method: 'GET' });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch page: ${response.status} ${text}`);
  }

  const data = await response.json();
  const storageValue: string = data.body?.storage?.value ?? '';
  const blocks = parseStorageFormat(storageValue);

  return {
    id: data.id,
    title: data.title,
    blocks,
  };
}
