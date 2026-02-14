import { renderSlide, renderPresentation } from './server/pipeline/templateEngine.ts';

const data = {
  title: 'Наша стратегия роста: Как мы достигнем лидерства',
  description: 'Учитывая наши сильные стороны, слабые места и рыночные возможности, вот наша стратегия.',
  cards: [
    { title: 'Расширение продуктовой линейки', description: 'Запуск 3 новых ИИ-модулей для автоматизации документооборота и аналитики. Ожидаемый рост выручки от новых продуктов до 18%.', icon: { name: 'globe', url: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/globe.svg' } },
    { title: 'Выход на новые рынки', description: 'Экспансия в Польшу и Чехию для увеличения клиентской базы на 20-30%. Фокус на локализации и партнерствах.', icon: { name: 'globe', url: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/globe.svg' } },
    { title: 'Усиление клиентоориентированности', description: 'Внедрение омниканальной CRM-системы и запуск программы лояльности. Это повысит вовлеченность клиентов в 2.5 раза и продажи на 30%.', icon: { name: 'users', url: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/users.svg' } },
    { title: 'Цифровая трансформация операций', description: 'Инвестиции в автоматизацию внутренних процессов для повышения эффективности на 15%. Снижение операционных издержек и ускорение вывода продуктов.', icon: { name: 'zap', url: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/zap.svg' } },
  ],
  _slideNumber: 6,
  _totalSlides: 12,
  _presentationTitle: 'Презентация',
};

// Render as full presentation to get the CSS
const slides = [{ layoutId: 'card-grid', data }];

// Simple theme CSS
const themeCss = `
:root {
  --primary-accent-color: #3b82f6;
  --primary-accent-light: rgba(59, 130, 246, 0.1);
  --text-heading-color: #111827;
  --text-body-color: #4b5563;
  --card-background-color: #ffffff;
  --card-border-color: rgba(0,0,0,0.08);
  --card-shadow: 0 2px 12px rgba(0,0,0,0.06);
  --slide-background-color: #f0f4ff;
  --decorative-shape-color: rgba(59, 130, 246, 0.05);
}
`;

const html = renderPresentation(slides, themeCss, 'Презентация');
import { writeFileSync } from 'fs';
writeFileSync('/home/ubuntu/presentation-frontend/test-card-grid.html', html);
console.log('Written to test-card-grid.html');
console.log('File size:', html.length, 'bytes');
