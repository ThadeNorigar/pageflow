const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFile(file: { name: string; type: string; size: number }): string | null {
  if (file.type !== 'application/pdf') {
    return `"${file.name}" ist keine PDF-Datei`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" ist größer als 10MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  }
  return null;
}

export function titleFromFilename(name: string): string {
  return name.replace(/\.pdf$/i, '');
}
