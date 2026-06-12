declare module '*.ttf' {
  const base64Content: string;
  export default base64Content;
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfs: Record<string, string>;
  export = vfs;
}
