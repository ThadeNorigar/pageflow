import { requestMicrosoftGraphText } from './auth';
import { createPage } from '../confluence/createPage';
import { htmlToText, textToStorageFormat } from './htmlToText';

const ONENOTE_ID_PATTERN = /^[a-zA-Z0-9!-]+$/;

interface ImportOneNotePagePayload {
  pageId: string;
  title: string;
  spaceId: string;
  parentId: string | null;
}

interface ImportOneNotePageResult {
  pageId: string;
  confluencePageId: string;
  title: string;
  status: 'success' | 'error';
  error?: string;
}

export async function importOneNotePage(payload: ImportOneNotePagePayload): Promise<ImportOneNotePageResult> {
  const { pageId, title, spaceId, parentId } = payload;

  if (!pageId || !ONENOTE_ID_PATTERN.test(pageId)) {
    return { pageId, confluencePageId: '', title, status: 'error', error: 'Invalid OneNote page ID' };
  }

  try {
    // 1. Fetch OneNote page HTML content
    const html = await requestMicrosoftGraphText(`/v1.0/me/onenote/pages/${pageId}/content`);

    // 2. Convert HTML to plain text, then wrap in Storage Format
    const text = htmlToText(html);
    const body = textToStorageFormat(text);

    // 3. Create Confluence page with content
    const result = await createPage({ title, spaceId, parentId, body });

    return {
      pageId,
      confluencePageId: result.pageId,
      title: result.title,
      status: 'success',
    };
  } catch (err) {
    return {
      pageId,
      confluencePageId: '',
      title,
      status: 'error',
      error: err instanceof Error ? err.message : 'Import failed',
    };
  }
}
