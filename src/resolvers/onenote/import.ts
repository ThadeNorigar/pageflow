import { requestMicrosoftGraphText } from './auth';
import { createPage, updatePageBody } from '../confluence/createPage';
import { htmlToText, textToStorageFormat } from './htmlToText';
import { convertOneNoteHtml, escapeXml, AttachmentRef } from './converter';
import { uploadRemoteImages, ImageUploadResult } from './images';

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
  imagesTotal?: number;
  imagesUploaded?: number;
  imagesFailed?: number;
}

function imageFailureNote(result: ImageUploadResult): string {
  const reason =
    result.skipped === 'too-large' ? 'image exceeds 5 MB' :
    result.skipped === 'limit' ? 'more than 10 images per page' :
    result.error ?? 'unknown error';
  return (
    '<ac:structured-macro ac:name="info" ac:schema-version="1"><ac:rich-text-body>' +
    `<p>Image could not be imported (${escapeXml(reason)}): ${escapeXml(result.filename)}</p>` +
    '</ac:rich-text-body></ac:structured-macro>'
  );
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
    let remoteImages: AttachmentRef[] = [];
    try {
      const conversion = convertOneNoteHtml(html);
      body = conversion.storageFormat || '<p></p>';
      remoteImages = conversion.attachments.filter(a => a.remoteUrl);
    } catch {
      const text = htmlToText(html);
      body = textToStorageFormat(text);
    }

    // 3. Create Confluence page with content (ri:attachment references resolve
    //    once the attachments are uploaded in step 4)
    const result = await createPage({ title, spaceId, parentId, body });

    // 4. Download images from MS Graph and upload them as attachments
    let imagesUploaded = 0;
    let imagesFailed = 0;
    if (remoteImages.length > 0) {
      const uploadResults = await uploadRemoteImages(result.pageId, remoteImages);
      const failed = uploadResults.filter(r => !r.ok);
      imagesUploaded = uploadResults.length - failed.length;
      imagesFailed = failed.length;

      if (failed.length > 0) {
        let patched = body;
        for (const failure of failed) {
          patched = patched.replace(
            `<ac:image><ri:attachment ri:filename="${escapeXml(failure.filename)}" /></ac:image>`,
            imageFailureNote(failure)
          );
        }
        try {
          await updatePageBody({ pageId: result.pageId, title: result.title, body: patched });
        } catch {
          // Seite existiert mit kaputten Bild-Referenzen — Import bleibt Erfolg, Zahlen zeigen das Problem
        }
      }
    }

    return {
      pageId,
      confluencePageId: result.pageId,
      title: result.title,
      status: 'success',
      imagesTotal: remoteImages.length,
      imagesUploaded,
      imagesFailed,
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
