/**
 * Утилиты для StatusCard.
 */

import type { GenerationStep } from '../../types'

/**
 * Создаёт начальное состояние шагов генерации.
 * Используется при старте новой генерации.
 */
export function createInitialSteps(): GenerationStep[] {
  return [
    { name: 'S0: Планирование', status: 'pending' },
    { name: 'S1: Анализ контекста', status: 'pending' },
    { name: 'S2: Разработка нарратива', status: 'pending' },
    { name: 'S3: Разработка дизайна', status: 'pending' },
    { name: 'S4: Генерация контента', status: 'pending' },
    { name: 'S5: Валидация', status: 'pending' },
  ]
}
