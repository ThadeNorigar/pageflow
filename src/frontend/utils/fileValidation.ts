const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFile(file: { name: string; type: string; size: number }): string | null {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return `"${file.name}" is not a PDF file`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds 10MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  }
  return null;
}

export function titleFromFilename(name: string): string {
  return name.replace(/\.pdf$/i, '');
}
