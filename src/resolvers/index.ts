import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('getStatus', async () => {
  return { status: 'ok', version: '0.1.0' };
});

export const handler = resolver.getDefinitions();
