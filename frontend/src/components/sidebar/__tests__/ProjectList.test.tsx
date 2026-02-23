import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ProjectList } from '../ProjectList'
import type { Project } from '../ProjectList'

const mockProjects: Project[] = [
  { id: 'p1', title: 'Квартальный отчёт', updatedAt: new Date().toISOString() },
  { id: 'p2', title: 'Стратегия 2026', updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'p3', title: 'Обзор рынка', updatedAt: new Date(Date.now() - 172800000).toISOString() },
]

describe('ProjectList', () => {
  it('renders with data-testid', () => {
    render(
      <ProjectList
        projects={mockProjects}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />
    )
    expect(screen.getByTestId('project-list')).toBeInTheDocument()
  })

  it('shows title "Проекты"', () => {
    render(
      <ProjectList
        projects={mockProjects}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />
    )
    expect(screen.getByText('Проекты')).toBeInTheDocument()
  })

  it('renders all projects', () => {
    render(
      <ProjectList
        projects={mockProjects}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />
    )
    const items = screen.getAllByTestId('project-item')
    expect(items).toHaveLength(3)
  })

  it('shows project titles', () => {
    render(
      <ProjectList
        projects={mockProjects}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />
    )
    expect(screen.getByText('Квартальный отчёт')).toBeInTheDocument()
    expect(screen.getByText('Стратегия 2026')).toBeInTheDocument()
    expect(screen.getByText('Обзор рынка')).toBeInTheDocument()
  })

  it('highlights active project', () => {
    render(
      <ProjectList
        projects={mockProjects}
        activeProjectId="p2"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />
    )
    const items = screen.getAllByTestId('project-item')
    expect(items[1]).toHaveAttribute('data-active', 'true')
    expect(items[0]).toHaveAttribute('data-active', 'false')
  })

  it('calls onSelect when project is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <ProjectList
        projects={mockProjects}
        onSelect={onSelect}
        onCreate={vi.fn()}
      />
    )

    await user.click(screen.getByText('Стратегия 2026'))
    expect(onSelect).toHaveBeenCalledWith('p2')
  })

  it('calls onCreate when "Новый проект" button is clicked', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(
      <ProjectList
        projects={mockProjects}
        onSelect={vi.fn()}
        onCreate={onCreate}
      />
    )

    await user.click(screen.getByLabelText('Новый проект'))
    expect(onCreate).toHaveBeenCalledOnce()
  })

  it('shows empty state when no projects', () => {
    render(
      <ProjectList
        projects={[]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />
    )
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText('Нет проектов')).toBeInTheDocument()
  })

  it('shows "Создать первый проект" link in empty state', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(
      <ProjectList
        projects={[]}
        onSelect={vi.fn()}
        onCreate={onCreate}
      />
    )

    const link = screen.getByText('Создать первый проект')
    expect(link).toBeInTheDocument()
    await user.click(link)
    expect(onCreate).toHaveBeenCalledOnce()
  })

  it('shows relative dates', () => {
    render(
      <ProjectList
        projects={mockProjects}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />
    )
    expect(screen.getByText('Сегодня')).toBeInTheDocument()
    expect(screen.getByText('Вчера')).toBeInTheDocument()
    expect(screen.getByText('2 дн. назад')).toBeInTheDocument()
  })
})
