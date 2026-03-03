import { convertOneNoteHtml, AttachmentRef } from './converter';

export interface ImageRef {
  localPath: string;
  filename: string;
}

export interface LocalConversionResult {
  storageFormat: string;
  imageRefs: ImageRef[];
}

export function processLocalOneNoteHtml(html: string): LocalConversionResult {
  if (!html || !html.trim()) {
    return { storageFormat: '', imageRefs: [] };
  }

  const conversion = convertOneNoteHtml(html);
  const imageRefs: ImageRef[] = conversion.attachments
    .filter((a: AttachmentRef) => !!a.localPath)
    .map((a: AttachmentRef) => ({
      localPath: a.localPath!,
      filename: a.filename,
    }));

  return {
    storageFormat: conversion.storageFormat,
    imageRefs,
  };
}
