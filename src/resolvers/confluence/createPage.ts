import api, { route } from '@forge/api';

interface CreatePagePayload {
  title: string;
  spaceId: string;
  parentId: string | null;
}

interface CreatePageResult {
  pageId: string;
  title: string;
}

export async function createPage(payload: CreatePagePayload): Promise<CreatePageResult> {
  if (!payload.title || payload.title.trim() === '') {
    throw new Error('Title must not be empty');
  }
  if (!payload.spaceId || payload.spaceId.trim() === '') {
    throw new Error('SpaceId must not be empty');
  }

  const body: Record<string, unknown> = {
    spaceId: payload.spaceId,
    status: 'current',
    title: payload.title,
    body: {
      representation: 'storage',
      value: '',
    },
  };

  if (payload.parentId) {
    body.parentId = payload.parentId;
  }

  const response = await api.asApp().requestConfluence(route`/wiki/api/v2/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create page: ${response.status} ${text}`);
  }

  const data = await response.json();
  return { pageId: data.id, title: data.title };
}
