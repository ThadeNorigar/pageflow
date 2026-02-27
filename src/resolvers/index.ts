import Resolver from '@forge/resolver';
import { getSpaces } from './confluence/spaces';
import { getPages } from './confluence/pages';
import { createPage } from './confluence/createPage';
import { checkAuthStatus, requestMicrosoftGraph } from './onenote/auth';
import { getNotebooks, getSections, getPages as getOneNotePages } from './onenote/notebooks';

const resolver = new Resolver();

resolver.define('getStatus', async () => {
  return { status: 'ok', version: '0.1.0' };
});

resolver.define('checkAuthStatus', async () => {
  return checkAuthStatus();
});

resolver.define('getMsGraphProfile', async () => {
  return requestMicrosoftGraph<{ id: string; displayName: string; mail: string }>('/v1.0/me');
});

resolver.define('getSpaces', async () => {
  return getSpaces();
});

resolver.define('getPages', async ({ payload }: { payload: { spaceKey: string; spaceId: string } }) => {
  return getPages(payload.spaceKey, payload.spaceId);
});

resolver.define('createPage', async ({ payload }: { payload: { title: string; spaceId: string; parentId: string | null } }) => {
  return createPage(payload);
});

resolver.define('getNotebooks', async () => {
  return getNotebooks();
});

resolver.define('getNotebookSections', async ({ payload }: { payload: { notebookId: string } }) => {
  return getSections(payload.notebookId);
});

resolver.define('getSectionPages', async ({ payload }: { payload: { sectionId: string } }) => {
  return getOneNotePages(payload.sectionId);
});

export const handler = resolver.getDefinitions();
