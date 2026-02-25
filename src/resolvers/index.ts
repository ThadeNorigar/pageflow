import Resolver from '@forge/resolver';
import { getSpaces } from './confluence/spaces';
import { getPages } from './confluence/pages';

const resolver = new Resolver();

resolver.define('getStatus', async () => {
  return { status: 'ok', version: '0.1.0' };
});

resolver.define('getSpaces', async () => {
  return getSpaces();
});

resolver.define('getPages', async ({ payload }: { payload: { spaceKey: string; spaceId: string } }) => {
  return getPages(payload.spaceKey, payload.spaceId);
});

export const handler = resolver.getDefinitions();
