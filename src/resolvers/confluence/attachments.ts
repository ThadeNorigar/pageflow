import api, { route } from '@forge/api';

interface UploadAttachmentPayload {
  pageId: string;
  filename: string;
  fileBase64: string;
  mimeType: string;
}

interface UploadAttachmentResult {
  attachmentId: string;
  filename: string;
}

export async function uploadAttachment(payload: UploadAttachmentPayload): Promise<UploadAttachmentResult> {
  if (!payload.pageId) {
    throw new Error('pageId must not be empty');
  }
  if (!payload.filename) {
    throw new Error('filename must not be empty');
  }
  if (!payload.fileBase64) {
    throw new Error('fileBase64 must not be empty');
  }

  const fileBuffer = Buffer.from(payload.fileBase64, 'base64');
  const boundary = `----ForgeAttachment${Date.now()}`;
  const crlf = '\r\n';

  const safeFilename = payload.filename.replace(/[\r\n"]/g, '');
  const safeMimeType = (payload.mimeType || 'application/octet-stream').replace(/[\r\n]/g, '');
  const header = `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${safeFilename}"${crlf}Content-Type: ${safeMimeType}${crlf}${crlf}`;
  const footer = `${crlf}--${boundary}--${crlf}`;

  const headerBuf = Buffer.from(header, 'utf-8');
  const footerBuf = Buffer.from(footer, 'utf-8');
  const body = Buffer.concat([headerBuf, fileBuffer, footerBuf]);

  const response = await api.asUser().requestConfluence(
    route`/wiki/rest/api/content/${payload.pageId}/child/attachment`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'X-Atlassian-Token': 'nocheck',
      },
      body,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to upload attachment: ${response.status} ${text}`);
  }

  const data = await response.json();
  const attachment = data.results?.[0] ?? data;
  return {
    attachmentId: attachment.id ?? '',
    filename: attachment.title ?? payload.filename,
  };
}
