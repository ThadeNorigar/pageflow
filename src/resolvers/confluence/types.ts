export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: 'global' | 'personal';
}

export interface ConfluencePage {
  id: string;
  title: string;
  spaceId: string;
  parentId: string | null;
  hasChildren: boolean;
}

export interface SpaceSelection {
  spaceKey: string;
  pageId: string | null;
}

export interface ConfluenceApiResponse<T> {
  results: T[];
  _links: {
    next?: string;
  };
}

export interface RawConfluencePage {
  id: string;
  title: string;
  spaceId: string;
  parentId: string | null;
  _links: {
    childPages?: string;
  };
}
