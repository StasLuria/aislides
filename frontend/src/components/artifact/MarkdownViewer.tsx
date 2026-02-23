/**
 * MarkdownViewer — просмотр Markdown-артефактов (structure.md и др.).
 *
 * По roadmap 7.2: «Реализовать MarkdownViewer (просмотр structure.md)
 * с подсветкой синтаксиса».
 *
 * Использует react-markdown + remark-gfm + rehype-highlight
 * для рендеринга GFM Markdown с подсветкой кода.
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

export interface MarkdownViewerProps {
  /** Markdown-контент для отображения. */
  content: string
  /** Дополнительные CSS-классы. */
  className?: string
}

export function MarkdownViewer({ content, className = '' }: MarkdownViewerProps) {
  if (!content.trim()) {
    return (
      <div
        data-testid="markdown-viewer-empty"
        className="flex items-center justify-center h-full text-gray-400 text-sm p-4"
      >
        Нет содержимого для отображения
      </div>
    )
  }

  return (
    <div
      data-testid="markdown-viewer"
      className={`prose prose-sm max-w-none p-4 overflow-y-auto ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
