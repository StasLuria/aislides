/**
 * Тесты для EditableArtifact — переключение view/edit.
 *
 * Тестируем:
 * - Рендеринг в режиме просмотра (MarkdownViewer для .md)
 * - Рендеринг в режиме просмотра (CodeEditor readOnly для .json)
 * - Переключение в режим редактирования
 * - Отображение имени файла в toolbar
 * - Кнопка «Просмотр» в режиме редактирования
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EditableArtifact } from '../EditableArtifact'

// Мок Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: ({
    defaultValue,
    options,
  }: {
    defaultValue: string
    options?: { readOnly?: boolean }
  }) => (
    <textarea
      data-testid="monaco-editor-mock"
      defaultValue={defaultValue}
      readOnly={options?.readOnly}
    />
  ),
}))

describe('EditableArtifact', () => {
  const defaultProps = {
    artifactId: 'art-1',
    filename: 'structure.md',
    content: '# Presentation Structure\n\n## Slide 1\n\nIntroduction',
    fileType: 'md',
    sendMessage: vi.fn(),
  }

  it('renders in view mode with MarkdownViewer for .md files', () => {
    render(<EditableArtifact {...defaultProps} />)

    expect(screen.getByTestId('editable-artifact')).toBeInTheDocument()
    expect(screen.getByTestId('editable-artifact-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('markdown-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('editable-artifact-edit-btn')).toBeInTheDocument()
  })

  it('displays filename in toolbar', () => {
    render(<EditableArtifact {...defaultProps} />)

    expect(screen.getByText('structure.md')).toBeInTheDocument()
  })

  it('renders CodeEditor readOnly for non-markdown files in view mode', () => {
    render(
      <EditableArtifact
        {...defaultProps}
        filename="config.json"
        fileType="json"
        content='{"key": "value"}'
      />,
    )

    expect(screen.getByTestId('code-editor')).toBeInTheDocument()
    const editor = screen.getByTestId('monaco-editor-mock')
    expect(editor).toHaveAttribute('readonly')
  })

  it('switches to edit mode when edit button clicked', () => {
    render(<EditableArtifact {...defaultProps} />)

    const editBtn = screen.getByTestId('editable-artifact-edit-btn')
    fireEvent.click(editBtn)

    // Should now show CodeEditor (not readOnly) and view button
    expect(screen.getByTestId('code-editor')).toBeInTheDocument()
    expect(screen.getByTestId('editable-artifact-view-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('markdown-viewer')).not.toBeInTheDocument()
  })

  it('switches back to view mode when view button clicked', () => {
    render(<EditableArtifact {...defaultProps} />)

    // Enter edit mode
    fireEvent.click(screen.getByTestId('editable-artifact-edit-btn'))
    expect(screen.getByTestId('editable-artifact-view-btn')).toBeInTheDocument()

    // Click view button
    fireEvent.click(screen.getByTestId('editable-artifact-view-btn'))

    // Should be back in view mode
    expect(screen.getByTestId('markdown-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('editable-artifact-edit-btn')).toBeInTheDocument()
  })

  it('shows edit button text as "Редактировать"', () => {
    render(<EditableArtifact {...defaultProps} />)

    expect(screen.getByText('Редактировать')).toBeInTheDocument()
  })

  it('shows view button text as "Просмотр" in edit mode', () => {
    render(<EditableArtifact {...defaultProps} />)

    fireEvent.click(screen.getByTestId('editable-artifact-edit-btn'))

    expect(screen.getByText('Просмотр')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<EditableArtifact {...defaultProps} className="custom-class" />)

    const container = screen.getByTestId('editable-artifact')
    expect(container.className).toContain('custom-class')
  })
})
