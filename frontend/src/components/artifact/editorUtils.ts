/**
 * Утилиты для CodeEditor — маппинг расширений файлов на языки Monaco.
 */

/** Маппинг расширений файлов на языки Monaco. */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  md: 'markdown',
  markdown: 'markdown',
  json: 'json',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  css: 'css',
  html: 'html',
  py: 'python',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  txt: 'plaintext',
}

/** Определить язык Monaco по имени файла. */
export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_TO_LANGUAGE[ext] ?? 'plaintext'
}
