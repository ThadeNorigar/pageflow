import { requestMicrosoftGraph } from './auth';

export interface Notebook {
  id: string;
  displayName: string;
  lastModifiedDateTime: string;
}

export interface Section {
  id: string;
  displayName: string;
}

export interface OneNotePage {
  id: string;
  title: string;
  lastModifiedDateTime: string;
}

const ONENOTE_ID_PATTERN = /^[a-f0-9!-]+$/i;

function validateId(id: string, label: string): void {
  if (!id || !ONENOTE_ID_PATTERN.test(id)) {
    throw new Error(`Invalid ${label}: must match GUID format`);
  }
}

export async function getNotebooks(): Promise<{ notebooks: Notebook[] }> {
  const data = await requestMicrosoftGraph<{ value: Notebook[] }>(
    '/v1.0/me/onenote/notebooks'
  );
  return { notebooks: data.value ?? [] };
}

export async function getSections(notebookId: string): Promise<{ sections: Section[] }> {
  validateId(notebookId, 'notebookId');
  const data = await requestMicrosoftGraph<{ value: Section[] }>(
    `/v1.0/me/onenote/notebooks/${notebookId}/sections`
  );
  return { sections: data.value ?? [] };
}

export async function getPages(sectionId: string): Promise<{ pages: OneNotePage[] }> {
  validateId(sectionId, 'sectionId');
  const data = await requestMicrosoftGraph<{ value: OneNotePage[] }>(
    `/v1.0/me/onenote/sections/${sectionId}/pages`
  );
  return { pages: data.value ?? [] };
}
