/**
 * Тесты для useArtifactEditor — хук редактирования артефактов.
 *
 * Тестируем:
 * - Начальное состояние (view mode)
 * - Переключение в edit mode
 * - Отмена редактирования
 * - Сохранение с отправкой artifact_updated
 * - Пропуск отправки при неизменённом контенте
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useArtifactEditor } from '../useArtifactEditor'

describe('useArtifactEditor', () => {
  const defaultOptions = {
    artifactId: 'art-1',
    originalContent: '# Original content',
    sendMessage: vi.fn(),
  }

  it('starts in view mode', () => {
    const { result } = renderHook(() => useArtifactEditor(defaultOptions))

    expect(result.current.mode).toBe('view')
    expect(result.current.isSaving).toBe(false)
  })

  it('switches to edit mode on startEditing', () => {
    const { result } = renderHook(() => useArtifactEditor(defaultOptions))

    act(() => {
      result.current.startEditing()
    })

    expect(result.current.mode).toBe('edit')
  })

  it('switches back to view mode on cancelEditing', () => {
    const { result } = renderHook(() => useArtifactEditor(defaultOptions))

    act(() => {
      result.current.startEditing()
    })
    expect(result.current.mode).toBe('edit')

    act(() => {
      result.current.cancelEditing()
    })
    expect(result.current.mode).toBe('view')
  })

  it('sends artifact_updated and switches to view on saveChanges', () => {
    const sendMessage = vi.fn()
    const { result } = renderHook(() =>
      useArtifactEditor({ ...defaultOptions, sendMessage }),
    )

    act(() => {
      result.current.startEditing()
    })

    act(() => {
      result.current.saveChanges('# Updated content')
    })

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'artifact_updated',
      payload: {
        artifact_id: 'art-1',
        new_content: '# Updated content',
      },
    })
    expect(result.current.mode).toBe('view')
  })

  it('does not send message when content unchanged', () => {
    const sendMessage = vi.fn()
    const { result } = renderHook(() =>
      useArtifactEditor({ ...defaultOptions, sendMessage }),
    )

    act(() => {
      result.current.startEditing()
    })

    act(() => {
      result.current.saveChanges('# Original content')
    })

    expect(sendMessage).not.toHaveBeenCalled()
    expect(result.current.mode).toBe('view')
  })

  it('returns isSaving as false after save completes', () => {
    const { result } = renderHook(() => useArtifactEditor(defaultOptions))

    act(() => {
      result.current.startEditing()
    })

    act(() => {
      result.current.saveChanges('# New content')
    })

    expect(result.current.isSaving).toBe(false)
  })
})
