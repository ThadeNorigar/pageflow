import Resolver from '@forge/resolver';
import { getSpaces } from './confluence/spaces';
import { getPages, getChildPages } from './confluence/pages';

const resolver = new Resolver();

resolver.define('getStatus', async () => {
  return { status: 'ok', version: '0.1.0' };
});

resolver.define('getSpaces', async () => {
  return getSpaces();
});

resolver.define('getPages', async ({ payload }: { payload: { spaceId: string } }) => {
  return getPages(payload.spaceId);
});

resolver.define('getChildPages', async ({ payload }: { payload: { pageId: string } }) => {
  return getChildPages(payload.pageId);
});

export const handler = resolver.getDefinitions();
