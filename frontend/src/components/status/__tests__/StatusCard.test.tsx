import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusCard } from '../StatusCard'
import { createInitialSteps } from '../utils'
import type { GenerationStep } from '../../../types'

const allPendingSteps = createInitialSteps()

const mixedSteps: GenerationStep[] = [
  { name: 'S0: Планирование', status: 'completed' },
  { name: 'S1: Анализ контекста', status: 'completed' },
  { name: 'S2: Разработка нарратива', status: 'in_progress', message: 'Генерирую структуру...' },
  { name: 'S3: Разработка дизайна', status: 'pending' },
  { name: 'S4: Генерация контента', status: 'pending' },
  { name: 'S5: Валидация', status: 'pending' },
]

const allCompletedSteps: GenerationStep[] = createInitialSteps().map((s) => ({
  ...s,
  status: 'completed',
}))

const errorSteps: GenerationStep[] = [
  { name: 'S0: Планирование', status: 'completed' },
  { name: 'S1: Анализ контекста', status: 'error', message: 'API timeout' },
  { name: 'S2: Разработка нарратива', status: 'pending' },
  { name: 'S3: Разработка дизайна', status: 'pending' },
  { name: 'S4: Генерация контента', status: 'pending' },
  { name: 'S5: Валидация', status: 'pending' },
]

describe('StatusCard', () => {
  it('renders with data-testid', () => {
    render(<StatusCard steps={allPendingSteps} />)
    expect(screen.getByTestId('status-card')).toBeInTheDocument()
  })

  it('shows title', () => {
    render(<StatusCard steps={allPendingSteps} />)
    expect(screen.getByText('Генерация презентации')).toBeInTheDocument()
  })

  it('renders all 6 steps', () => {
    render(<StatusCard steps={allPendingSteps} />)
    const steps = screen.getAllByTestId('status-step')
    expect(steps).toHaveLength(6)
  })

  it('shows step names', () => {
    render(<StatusCard steps={allPendingSteps} />)
    expect(screen.getByText('S0: Планирование')).toBeInTheDocument()
    expect(screen.getByText('S5: Валидация')).toBeInTheDocument()
  })

  it('shows progress 0/6 (0%) when all pending', () => {
    render(<StatusCard steps={allPendingSteps} />)
    expect(screen.getByText('0/6 (0%)')).toBeInTheDocument()
  })

  it('shows progress 2/6 (33%) for mixed steps', () => {
    render(<StatusCard steps={mixedSteps} />)
    expect(screen.getByText('2/6 (33%)')).toBeInTheDocument()
  })

  it('shows progress 6/6 (100%) when all completed', () => {
    render(<StatusCard steps={allCompletedSteps} />)
    expect(screen.getByText('6/6 (100%)')).toBeInTheDocument()
  })

  it('renders progress bar with correct width', () => {
    render(<StatusCard steps={mixedSteps} />)
    const bar = screen.getByTestId('progress-bar')
    expect(bar).toHaveStyle({ width: '33%' })
  })

  it('sets data-status attribute on steps', () => {
    render(<StatusCard steps={mixedSteps} />)
    const steps = screen.getAllByTestId('status-step')
    expect(steps[0]).toHaveAttribute('data-status', 'completed')
    expect(steps[2]).toHaveAttribute('data-status', 'in_progress')
    expect(steps[3]).toHaveAttribute('data-status', 'pending')
  })

  it('shows step message when provided', () => {
    render(<StatusCard steps={mixedSteps} />)
    expect(screen.getByText('Генерирую структуру...')).toBeInTheDocument()
  })

  it('shows error status correctly', () => {
    render(<StatusCard steps={errorSteps} />)
    const steps = screen.getAllByTestId('status-step')
    expect(steps[1]).toHaveAttribute('data-status', 'error')
    expect(screen.getByText('API timeout')).toBeInTheDocument()
  })
})

describe('createInitialSteps', () => {
  it('creates 6 steps all with pending status', () => {
    const steps = createInitialSteps()
    expect(steps).toHaveLength(6)
    steps.forEach((step) => {
      expect(step.status).toBe('pending')
    })
  })

  it('includes all S0-S5 step names', () => {
    const steps = createInitialSteps()
    const names = steps.map((s) => s.name)
    expect(names).toContain('S0: Планирование')
    expect(names).toContain('S1: Анализ контекста')
    expect(names).toContain('S2: Разработка нарратива')
    expect(names).toContain('S3: Разработка дизайна')
    expect(names).toContain('S4: Генерация контента')
    expect(names).toContain('S5: Валидация')
  })
})
