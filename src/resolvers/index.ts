import Resolver from '@forge/resolver';
import { getSpaces } from './confluence/spaces';
import { getPages } from './confluence/pages';
import { createPage } from './confluence/createPage';
import { uploadAttachment } from './confluence/attachments';
import { checkAuthStatus, requestAuth, requestMicrosoftGraph } from './onenote/auth';
import { getNotebooks, getSections, getPages as getOneNotePages } from './onenote/notebooks';
import { importOneNotePage } from './onenote/import';
import { getPageBody } from './export/pageContent';

const resolver = new Resolver();

resolver.define('getStatus', async () => {
  return { status: 'ok', version: '0.1.0' };
});

resolver.define('checkAuthStatus', async () => {
  return checkAuthStatus();
});

resolver.define('requestAuth', async () => {
  return requestAuth();
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

resolver.define('createPage', async ({ payload }: { payload: { title: string; spaceId: string; parentId: string | null; body?: string } }) => {
  return createPage(payload);
});

resolver.define('uploadAttachment', async ({ payload }: { payload: { pageId: string; filename: string; fileBase64: string; mimeType: string } }) => {
  return uploadAttachment(payload);
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

resolver.define('importOneNotePage', async ({ payload }: { payload: { pageId: string; title: string; spaceId: string; parentId: string | null } }) => {
  return importOneNotePage(payload);
});

resolver.define('getPageBody', async ({ payload }: { payload: { pageId: string } }) => {
  return getPageBody(payload.pageId);
});

export const handler = resolver.getDefinitions();
