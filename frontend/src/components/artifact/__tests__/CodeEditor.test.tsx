/**
 * Тесты для CodeEditor — Monaco Editor обёртка.
 *
 * Тестируем:
 * - Рендеринг с toolbar и кнопками
 * - Определение языка по расширению
 * - Dirty state
 * - Сохранение и отмена
 * - Режим readOnly
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CodeEditor } from '../CodeEditor'
import { getLanguageFromFilename } from '../editorUtils'

// Мок Monaco Editor — рендерим textarea вместо полноценного редактора
const mockGetValue = vi.fn(() => 'edited content')
const mockSetValue = vi.fn()
const mockAddCommand = vi.fn()

vi.mock('@monaco-editor/react', () => ({
  default: ({
    defaultValue,
    onChange,
    onMount,
    options,
  }: {
    defaultValue: string
    onChange?: (value: string | undefined) => void
    onMount?: (editor: unknown, monaco: unknown) => void
    options?: { readOnly?: boolean }
  }) => {
    // Вызываем onMount при рендере
    const editorInstance = {
      getValue: mockGetValue,
      setValue: mockSetValue,
      addCommand: mockAddCommand,
    }
    const monacoInstance = {
      KeyMod: { CtrlCmd: 2048 },
      KeyCode: { KeyS: 49 },
    }

    // Симулируем onMount через setTimeout(0) чтобы React успел отрендерить
    if (onMount) {
      setTimeout(() => onMount(editorInstance, monacoInstance), 0)
    }

    return (
      <textarea
        data-testid="monaco-editor-mock"
        defaultValue={defaultValue}
        readOnly={options?.readOnly}
        onChange={(e) => onChange?.(e.target.value)}
      />
    )
  },
}))

describe('getLanguageFromFilename', () => {
  it('returns markdown for .md files', () => {
    expect(getLanguageFromFilename('structure.md')).toBe('markdown')
  })

  it('returns json for .json files', () => {
    expect(getLanguageFromFilename('config.json')).toBe('json')
  })

  it('returns python for .py files', () => {
    expect(getLanguageFromFilename('script.py')).toBe('python')
  })

  it('returns css for .css files', () => {
    expect(getLanguageFromFilename('styles.css')).toBe('css')
  })

  it('returns html for .html files', () => {
    expect(getLanguageFromFilename('presentation.html')).toBe('html')
  })

  it('returns typescript for .ts files', () => {
    expect(getLanguageFromFilename('index.ts')).toBe('typescript')
  })

  it('returns plaintext for unknown extensions', () => {
    expect(getLanguageFromFilename('file.xyz')).toBe('plaintext')
  })

  it('returns plaintext for files without extension', () => {
    expect(getLanguageFromFilename('Makefile')).toBe('plaintext')
  })
})

describe('CodeEditor', () => {
  const defaultProps = {
    content: '# Hello World\n\nSome content',
    filename: 'structure.md',
    onSave: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetValue.mockReturnValue('edited content')
  })

  it('renders editor with toolbar', () => {
    render(<CodeEditor {...defaultProps} />)

    expect(screen.getByTestId('code-editor')).toBeInTheDocument()
    expect(screen.getByTestId('code-editor-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument()
  })

  it('displays filename and language in toolbar', () => {
    render(<CodeEditor {...defaultProps} />)

    expect(screen.getByText('structure.md')).toBeInTheDocument()
    expect(screen.getByText('(markdown)')).toBeInTheDocument()
  })

  it('shows save button disabled initially (no changes)', () => {
    render(<CodeEditor {...defaultProps} />)

    const saveBtn = screen.getByTestId('code-editor-save')
    expect(saveBtn).toBeDisabled()
  })

  it('shows dirty indicator when content changes', () => {
    render(<CodeEditor {...defaultProps} />)

    const editor = screen.getByTestId('monaco-editor-mock')
    fireEvent.change(editor, { target: { value: 'new content' } })

    expect(screen.getByTestId('code-editor-dirty')).toBeInTheDocument()
    expect(screen.getByText('● Изменено')).toBeInTheDocument()
  })

  it('enables save button when dirty', () => {
    render(<CodeEditor {...defaultProps} />)

    const editor = screen.getByTestId('monaco-editor-mock')
    fireEvent.change(editor, { target: { value: 'new content' } })

    const saveBtn = screen.getByTestId('code-editor-save')
    expect(saveBtn).not.toBeDisabled()
  })

  it('calls onSave with editor value when save button clicked', async () => {
    const onSave = vi.fn()
    render(<CodeEditor {...defaultProps} onSave={onSave} />)

    // Trigger onMount
    await vi.waitFor(() => {
      expect(mockAddCommand).toHaveBeenCalled()
    })

    // Make dirty
    const editor = screen.getByTestId('monaco-editor-mock')
    fireEvent.change(editor, { target: { value: 'new content' } })

    // Click save
    const saveBtn = screen.getByTestId('code-editor-save')
    fireEvent.click(saveBtn)

    expect(onSave).toHaveBeenCalledWith('edited content')
  })

  it('shows cancel button when onCancel provided', () => {
    const onCancel = vi.fn()
    render(<CodeEditor {...defaultProps} onCancel={onCancel} />)

    expect(screen.getByTestId('code-editor-cancel')).toBeInTheDocument()
  })

  it('does not show cancel button when onCancel not provided', () => {
    render(<CodeEditor {...defaultProps} />)

    expect(screen.queryByTestId('code-editor-cancel')).not.toBeInTheDocument()
  })

  it('calls onCancel and resets editor when cancel clicked', async () => {
    const onCancel = vi.fn()
    render(<CodeEditor {...defaultProps} onCancel={onCancel} />)

    // Trigger onMount
    await vi.waitFor(() => {
      expect(mockAddCommand).toHaveBeenCalled()
    })

    // Make dirty
    const editor = screen.getByTestId('monaco-editor-mock')
    fireEvent.change(editor, { target: { value: 'new content' } })

    // Click cancel
    const cancelBtn = screen.getByTestId('code-editor-cancel')
    fireEvent.click(cancelBtn)

    expect(mockSetValue).toHaveBeenCalledWith(defaultProps.content)
    expect(onCancel).toHaveBeenCalled()
  })

  it('hides toolbar in readOnly mode', () => {
    render(<CodeEditor {...defaultProps} readOnly />)

    expect(screen.queryByTestId('code-editor-toolbar')).not.toBeInTheDocument()
  })

  it('registers Ctrl+S command on mount', async () => {
    render(<CodeEditor {...defaultProps} />)

    await vi.waitFor(() => {
      expect(mockAddCommand).toHaveBeenCalledWith(
        2048 | 49, // CtrlCmd | KeyS
        expect.any(Function),
      )
    })
  })

  it('applies custom className', () => {
    render(<CodeEditor {...defaultProps} className="custom-class" />)

    const editor = screen.getByTestId('code-editor')
    expect(editor.className).toContain('custom-class')
  })

  it('clears dirty state after save', async () => {
    render(<CodeEditor {...defaultProps} />)

    // Trigger onMount
    await vi.waitFor(() => {
      expect(mockAddCommand).toHaveBeenCalled()
    })

    // Make dirty
    const editor = screen.getByTestId('monaco-editor-mock')
    fireEvent.change(editor, { target: { value: 'new content' } })
    expect(screen.getByTestId('code-editor-dirty')).toBeInTheDocument()

    // Save
    const saveBtn = screen.getByTestId('code-editor-save')
    fireEvent.click(saveBtn)

    expect(screen.queryByTestId('code-editor-dirty')).not.toBeInTheDocument()
  })

  it('does not mark dirty when value equals content', () => {
    render(<CodeEditor {...defaultProps} />)

    const editor = screen.getByTestId('monaco-editor-mock')
    fireEvent.change(editor, {
      target: { value: '# Hello World\n\nSome content' },
    })

    expect(screen.queryByTestId('code-editor-dirty')).not.toBeInTheDocument()
  })
})
