export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: 'global' | 'personal';
}

export interface ConfluencePage {
  id: string;
  title: string;
  spaceKey: string;
  parentId: string | null;
  hasChildren: boolean;
  isFolder?: boolean;
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

export interface RawSpace {
  id: string;
  key: string;
  name: string;
  type: string;
}

export interface RawPage {
  id: string;
  title: string;
  parentId?: string;
  parentType?: string;
}
