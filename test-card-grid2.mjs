import { renderSlide } from './server/pipeline/templateEngine.ts';

const data = {
  title: 'Наша стратегия роста: Как мы достигнем лидерства',
  description: 'Учитывая наши сильные стороны, слабые места и рыночные возможности, вот наша стратегия.',
  cards: [
    { title: 'Расширение продуктовой линейки', description: 'Запуск 3 новых ИИ-модулей для автоматизации документооборота и аналитики. Ожидаемый рост выручки от новых продуктов до 18%.', icon: { name: 'globe', url: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/globe.svg' } },
    { title: 'Выход на новые рынки', description: 'Экспансия в Польшу и Чехию для увеличения клиентской базы на 20-30%. Фокус на локализации и партнерствах.', icon: { name: 'globe', url: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/globe.svg' } },
    { title: 'Усиление клиентоориентированности', description: 'Внедрение омниканальной CRM-системы и запуск программы лояльности. Это повысит вовлеченность клиентов в 2.5 раза и продажи на 30%.', icon: { name: 'users', url: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/users.svg' } },
    { title: 'Цифровая трансформация операций', description: 'Инвестиции в автоматизацию внутренних процессов для повышения эффективности на 15%. Снижение операционных издержек и ускорение вывода продуктов.', icon: { name: 'zap', url: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/zap.svg' } },
  ]
};

const html = renderSlide('card-grid', data);
console.log('=== FULL HTML ===');
console.log(html);
