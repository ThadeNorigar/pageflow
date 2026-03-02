import { requestMicrosoftGraphText } from './auth';
import { createPage } from '../confluence/createPage';
import { htmlToText, textToStorageFormat } from './htmlToText';
import { convertOneNoteHtml } from './converter';

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

    // 2. Convert HTML to Confluence Storage Format (with fallback to plain text)
    let body: string;
    try {
      const conversion = convertOneNoteHtml(html);
      body = conversion.storageFormat || '<p></p>';
      // TODO(developer): Upload conversion.attachments to Confluence page
      //   What: Use attachments API to upload extracted images
      //   Prio: HIGH — images will be broken until this is implemented
    } catch (convErr) {
      console.warn('Converter failed, falling back to plain text:', convErr instanceof Error ? convErr.message : convErr);
      const text = htmlToText(html);
      body = textToStorageFormat(text);
    }

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
