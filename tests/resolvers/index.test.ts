jest.mock('@forge/resolver', () => {
  const definitions: Record<string, Function> = {};
  return {
    __esModule: true,
    default: class MockResolver {
      define(key: string, fn: Function) { definitions[key] = fn; }
      getDefinitions() { return definitions; }
    },
    _getDefinitions: () => definitions,
  };
});
jest.mock('@forge/api', () => ({
  __esModule: true,
  requestConfluence: jest.fn(),
  authorize: jest.fn(),
  Provider: jest.fn(),
  asUser: jest.fn(() => ({ withProvider: jest.fn(() => ({ fetch: jest.fn(), requestCredentials: jest.fn() })) })),
  asApp: jest.fn(() => ({ requestConfluence: jest.fn() })),
}));

import { handler } from '../../src/resolvers/index';

describe('Resolver registration', () => {
  const resolvers = handler as unknown as Record<string, Function>;

  it('registers all expected resolver keys', () => {
    const expectedKeys = [
      'getStatus', 'checkAuthStatus', 'requestAuth', 'getMsGraphProfile',
      'getSpaces', 'getPages', 'createPage', 'uploadAttachment', 'updatePageBody',
      'getNotebooks', 'getNotebookSections', 'getSectionPages',
      'importOneNotePage', 'getPageBody', 'convertLocalOneNote',
    ];
    for (const key of expectedKeys) {
      expect(resolvers).toHaveProperty(key);
    }
  });

  it('convertLocalOneNote is a function', () => {
    expect(typeof resolvers['convertLocalOneNote']).toBe('function');
  });
});
