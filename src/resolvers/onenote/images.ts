import { requestMicrosoftGraphBinary } from './auth';
import { uploadAttachment } from '../confluence/attachments';
import { AttachmentRef } from './converter';

export interface ImageUploadResult {
  filename: string;
  ok: boolean;
  skipped?: 'too-large' | 'limit';
  error?: string;
}

const MAX_IMAGES_PER_PAGE = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const CONCURRENCY = 3;
const IMAGE_MIME_PATTERN = /^image\/(png|jpeg|gif|webp|bmp|svg\+xml)$/;

export async function uploadRemoteImages(
  confluencePageId: string,
  attachments: AttachmentRef[]
): Promise<ImageUploadResult[]> {
  const remote = attachments.filter(a => a.remoteUrl);
  if (remote.length === 0) return [];

  const queue = remote.slice(0, MAX_IMAGES_PER_PAGE);
  const overLimit: ImageUploadResult[] = remote
    .slice(MAX_IMAGES_PER_PAGE)
    .map(a => ({ filename: a.filename, ok: false, skipped: 'limit' as const }));

  const results: ImageUploadResult[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      const attachment = queue[cursor++];
      try {
        const { data, contentType } = await requestMicrosoftGraphBinary(attachment.remoteUrl as string);
        if (data.byteLength > MAX_IMAGE_BYTES) {
          results.push({ filename: attachment.filename, ok: false, skipped: 'too-large' });
          continue;
        }
        const responseType = contentType.split(';')[0].trim().toLowerCase();
        const mimeType = IMAGE_MIME_PATTERN.test(responseType) ? responseType : attachment.contentType;
        await uploadAttachment({
          pageId: confluencePageId,
          filename: attachment.filename,
          fileBase64: data.toString('base64'),
          mimeType,
        });
        results.push({ filename: attachment.filename, ok: true });
      } catch (err) {
        results.push({
          filename: attachment.filename,
          ok: false,
          error: err instanceof Error ? err.message : 'Image upload failed',
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()));

  return [...results, ...overLimit];
}
