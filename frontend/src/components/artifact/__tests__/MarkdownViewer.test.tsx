import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarkdownViewer } from '../MarkdownViewer'

describe('MarkdownViewer', () => {
  it('renders with data-testid', () => {
    render(<MarkdownViewer content="# Hello" />)
    expect(screen.getByTestId('markdown-viewer')).toBeInTheDocument()
  })

  it('renders heading', () => {
    render(<MarkdownViewer content="# Заголовок" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Заголовок')
  })

  it('renders paragraph text', () => {
    render(<MarkdownViewer content="Простой текст параграфа." />)
    expect(screen.getByText('Простой текст параграфа.')).toBeInTheDocument()
  })

  it('renders bold text', () => {
    render(<MarkdownViewer content="Это **жирный** текст." />)
    const strong = screen.getByText('жирный')
    expect(strong.tagName).toBe('STRONG')
  })

  it('renders unordered list', () => {
    render(<MarkdownViewer content={'- Пункт 1\n- Пункт 2\n- Пункт 3'} />)
    const list = screen.getByRole('list')
    expect(list).toBeInTheDocument()
    expect(list.querySelectorAll('li').length).toBeGreaterThanOrEqual(1)
  })

  it('renders GFM table', () => {
    const table = `| Колонка A | Колонка B |
| --- | --- |
| Ячейка 1 | Ячейка 2 |`
    render(<MarkdownViewer content={table} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Колонка A')).toBeInTheDocument()
    expect(screen.getByText('Ячейка 1')).toBeInTheDocument()
  })

  it('renders code block with pre element', () => {
    const code = '```python\nprint("hello")\n```'
    render(<MarkdownViewer content={code} />)
    const viewer = screen.getByTestId('markdown-viewer')
    const pre = viewer.querySelector('pre')
    expect(pre).toBeInTheDocument()
  })

  it('renders inline code', () => {
    render(<MarkdownViewer content="Используйте `npm install`." />)
    const code = screen.getByText('npm install')
    expect(code.tagName).toBe('CODE')
  })

  it('renders link', () => {
    render(<MarkdownViewer content="[Google](https://google.com)" />)
    const link = screen.getByRole('link', { name: 'Google' })
    expect(link).toHaveAttribute('href', 'https://google.com')
  })

  it('shows empty state when content is empty', () => {
    render(<MarkdownViewer content="" />)
    expect(screen.getByTestId('markdown-viewer-empty')).toBeInTheDocument()
    expect(screen.getByText('Нет содержимого для отображения')).toBeInTheDocument()
  })

  it('shows empty state when content is whitespace only', () => {
    render(<MarkdownViewer content="   " />)
    expect(screen.getByTestId('markdown-viewer-empty')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<MarkdownViewer content="# Test" className="custom-class" />)
    expect(screen.getByTestId('markdown-viewer')).toHaveClass('custom-class')
  })

  it('renders multiple headings', () => {
    render(<MarkdownViewer content={'## H2 Title\n\nSome text\n\n### H3 Title'} />)
    expect(screen.getByText('H2 Title')).toBeInTheDocument()
    expect(screen.getByText('H3 Title')).toBeInTheDocument()
  })
})
