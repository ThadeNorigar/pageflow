import api, { route } from '@forge/api';

interface CreatePagePayload {
  title: string;
  spaceId: string;
  parentId: string | null;
  body?: string;
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
      value: payload.body ?? '',
    },
  };

  if (payload.parentId) {
    body.parentId = payload.parentId;
  }

  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages`, {
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

interface UpdatePageBodyPayload {
  pageId: string;
  title: string;
  body: string;
}

export async function updatePageBody(payload: UpdatePageBodyPayload): Promise<void> {
  if (!payload.pageId) {
    throw new Error('pageId must not be empty');
  }

  const getResp = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${payload.pageId}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!getResp.ok) {
    const text = await getResp.text();
    throw new Error(`Failed to get page: ${getResp.status} ${text}`);
  }

  const current = await getResp.json();
  const nextVersion = (current.version?.number ?? 1) + 1;

  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${payload.pageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: payload.pageId,
      status: 'current',
      title: payload.title,
      body: {
        representation: 'storage',
        value: payload.body,
      },
      version: {
        number: nextVersion,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update page: ${response.status} ${text}`);
  }
}
