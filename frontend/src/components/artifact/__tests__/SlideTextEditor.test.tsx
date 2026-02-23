/**
 * Тесты для SlideTextEditor — WYSIWYG-редактирование текста на слайдах.
 *
 * Тестируем:
 * - Рендеринг HTML-контента
 * - Toolbar с кнопками
 * - Dirty state при вводе
 * - Сохранение и отмена
 * - Кнопка Save disabled без изменений
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SlideTextEditor } from '../SlideTextEditor'

describe('SlideTextEditor', () => {
  const sampleHtml = '<h1>Title</h1><p>Paragraph text</p><ul><li>Item 1</li></ul>'

  const defaultProps = {
    htmlContent: sampleHtml,
    onSave: vi.fn(),
  }

  it('renders editor with toolbar', () => {
    render(<SlideTextEditor {...defaultProps} />)

    expect(screen.getByTestId('slide-text-editor')).toBeInTheDocument()
    expect(screen.getByTestId('slide-editor-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('slide-editor-content')).toBeInTheDocument()
  })

  it('renders HTML content inside container', () => {
    render(<SlideTextEditor {...defaultProps} />)

    const content = screen.getByTestId('slide-editor-content')
    expect(content.innerHTML).toContain('Title')
    expect(content.innerHTML).toContain('Paragraph text')
    expect(content.innerHTML).toContain('Item 1')
  })

  it('shows save button disabled initially', () => {
    render(<SlideTextEditor {...defaultProps} />)

    const saveBtn = screen.getByTestId('slide-editor-save')
    expect(saveBtn).toBeDisabled()
  })

  it('shows dirty indicator after input event', () => {
    render(<SlideTextEditor {...defaultProps} />)

    const content = screen.getByTestId('slide-editor-content')
    fireEvent.input(content)

    expect(screen.getByTestId('slide-editor-dirty')).toBeInTheDocument()
    expect(screen.getByText('● Изменено')).toBeInTheDocument()
  })

  it('enables save button when dirty', () => {
    render(<SlideTextEditor {...defaultProps} />)

    const content = screen.getByTestId('slide-editor-content')
    fireEvent.input(content)

    const saveBtn = screen.getByTestId('slide-editor-save')
    expect(saveBtn).not.toBeDisabled()
  })

  it('calls onSave with innerHTML when save clicked', () => {
    const onSave = vi.fn()
    render(<SlideTextEditor {...defaultProps} onSave={onSave} />)

    // Make dirty
    const content = screen.getByTestId('slide-editor-content')
    fireEvent.input(content)

    // Save
    const saveBtn = screen.getByTestId('slide-editor-save')
    fireEvent.click(saveBtn)

    expect(onSave).toHaveBeenCalledWith(expect.any(String))
  })

  it('shows cancel button when onCancel provided', () => {
    const onCancel = vi.fn()
    render(<SlideTextEditor {...defaultProps} onCancel={onCancel} />)

    expect(screen.getByTestId('slide-editor-cancel')).toBeInTheDocument()
  })

  it('does not show cancel button when onCancel not provided', () => {
    render(<SlideTextEditor {...defaultProps} />)

    expect(screen.queryByTestId('slide-editor-cancel')).not.toBeInTheDocument()
  })

  it('calls onCancel and resets content on cancel', () => {
    const onCancel = vi.fn()
    render(<SlideTextEditor {...defaultProps} onCancel={onCancel} />)

    // Make dirty
    const content = screen.getByTestId('slide-editor-content')
    fireEvent.input(content)

    // Cancel
    const cancelBtn = screen.getByTestId('slide-editor-cancel')
    fireEvent.click(cancelBtn)

    expect(onCancel).toHaveBeenCalled()
    // Content should be reset
    expect(content.innerHTML).toContain('Title')
  })

  it('clears dirty state after save', () => {
    render(<SlideTextEditor {...defaultProps} />)

    // Make dirty
    const content = screen.getByTestId('slide-editor-content')
    fireEvent.input(content)
    expect(screen.getByTestId('slide-editor-dirty')).toBeInTheDocument()

    // Save
    const saveBtn = screen.getByTestId('slide-editor-save')
    fireEvent.click(saveBtn)

    expect(screen.queryByTestId('slide-editor-dirty')).not.toBeInTheDocument()
  })

  it('displays WYSIWYG label in toolbar', () => {
    render(<SlideTextEditor {...defaultProps} />)

    expect(screen.getByText('WYSIWYG-редактор слайда')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<SlideTextEditor {...defaultProps} className="custom-class" />)

    const editor = screen.getByTestId('slide-text-editor')
    expect(editor.className).toContain('custom-class')
  })

  it('has accessible role and label on content area', () => {
    render(<SlideTextEditor {...defaultProps} />)

    const content = screen.getByTestId('slide-editor-content')
    expect(content).toHaveAttribute('role', 'textbox')
    expect(content).toHaveAttribute('aria-label', 'Редактор слайда')
  })

  it('makes text elements editable on click', () => {
    render(<SlideTextEditor {...defaultProps} />)

    const content = screen.getByTestId('slide-editor-content')
    const heading = content.querySelector('h1')
    expect(heading).toBeTruthy()

    // Click on heading
    fireEvent.click(heading!)

    expect(heading!.contentEditable).toBe('true')
  })
})
