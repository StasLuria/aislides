import { renderSlide } from './server/pipeline/templateEngine.ts';

const data = {
  title: 'Наша стратегия роста: Как мы достигнем лидерства',
  description: 'Учитывая наши сильные стороны, слабые места и рыночные возможности, вот наша стратегия.',
  cards: [
    { title: 'Расширение продуктовой линейки', description: 'Запуск 3 новых ИИ-модулей для автоматизации документооборота и аналитики.', icon: { name: 'globe', url: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/globe.svg' } },
    { title: 'Выход на новые рынки', description: 'Экспансия в Польшу и Чехию для увеличения клиентской базы на 20-30%.', icon: { name: 'globe', url: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/globe.svg' } },
    { title: 'Усиление клиентоориентированности', description: 'Внедрение омниканальной CRM-системы и запуск программы лояльности.', icon: { name: 'users', url: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/users.svg' } },
    { title: 'Цифровая трансформация операций', description: 'Инвестиции в автоматизацию внутренних процессов для повышения эффективности на 15%.', icon: { name: 'zap', url: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/zap.svg' } },
  ]
};

const html = renderSlide('card-grid', data);

// Extract the grid-template-columns value
const gridMatch = html.match(/grid-template-columns:\s*repeat\((\d+)/);
console.log('Grid columns:', gridMatch ? gridMatch[1] : 'NOT FOUND');

// Check if cards are rendered
const cardCount = (html.match(/class="card"/g) || []).length;
console.log('Cards rendered:', cardCount);

// Print the grid div
const gridDivStart = html.indexOf('display: grid');
if (gridDivStart > -1) {
  const lineStart = html.lastIndexOf('<div', gridDivStart);
  const lineEnd = html.indexOf('>', gridDivStart);
  console.log('Grid div:', html.substring(lineStart, lineEnd + 1));
}

// Also check c_cols value
console.log('\n--- First 500 chars of HTML ---');
console.log(html.substring(0, 500));
