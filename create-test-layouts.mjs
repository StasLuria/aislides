/**
 * Creates a test presentation with 12 complex layouts for inline editing testing.
 * All field names match the actual Nunjucks templates exactly.
 * Run: node create-test-layouts.mjs
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const presentationId = 'TEST_LAYOUTS_' + Date.now().toString(36);

// Sample data for each complex layout — field names match templates exactly
const layouts = [
  // 1. SWOT Analysis
  {
    layoutId: 'swot-analysis',
    data: {
      title: 'SWOT-анализ компании',
      description: 'Стратегический анализ сильных и слабых сторон',
      strengths: {
        title: 'Сильные стороны',
        items: ['Сильная команда разработки', 'Уникальная технология AI', 'Лояльная клиентская база']
      },
      weaknesses: {
        title: 'Слабые стороны',
        items: ['Ограниченный бюджет', 'Малый охват рынка', 'Зависимость от ключевых клиентов']
      },
      opportunities: {
        title: 'Возможности',
        items: ['Рост рынка AI на 40%', 'Выход на международный рынок', 'Партнёрства с корпорациями']
      },
      threats: {
        title: 'Угрозы',
        items: ['Конкуренция со стороны Big Tech', 'Регуляторные изменения', 'Экономическая нестабильность']
      }
    }
  },
  // 2. Funnel — template uses stage.title, stage.value, stage.description, stage.conversion, stage.color
  {
    layoutId: 'funnel',
    data: {
      title: 'Воронка продаж',
      stages: [
        { title: 'Посетители', value: '10,000', description: 'Все визиты на сайт', color: '#4F46E5' },
        { title: 'Лиды', value: '3,500', description: 'Оставили контакт', conversion: '35%', color: '#6366F1' },
        { title: 'Квалификация', value: '1,200', description: 'Подтвердили интерес', conversion: '34%', color: '#818CF8' },
        { title: 'Предложение', value: '500', description: 'Получили КП', conversion: '42%', color: '#A5B4FC' },
        { title: 'Сделка', value: '150', description: 'Подписали договор', conversion: '30%', color: '#C7D2FE' }
      ]
    }
  },
  // 3. Roadmap — template uses milestones[].title, .date, .description, .color
  {
    layoutId: 'roadmap',
    data: {
      title: 'Дорожная карта продукта',
      description: 'Ключевые этапы развития на 2026 год',
      milestones: [
        { title: 'Запуск MVP', date: 'Q1 2026', description: 'Бета-тестирование и первые клиенты', color: '#22c55e' },
        { title: 'AI-модули', date: 'Q2 2026', description: 'Интеграция AI и масштабирование', color: '#3b82f6' },
        { title: 'Международный рынок', date: 'Q3 2026', description: 'Выход на рынки EU и US', color: '#8b5cf6' },
        { title: 'IPO подготовка', date: 'Q4 2026', description: 'Монетизация и подготовка к IPO', color: '#f59e0b' }
      ]
    }
  },
  // 4. Pyramid — template uses levels[].title, .description, .color
  {
    layoutId: 'pyramid',
    data: {
      title: 'Пирамида стратегии',
      description: 'Иерархия стратегических приоритетов',
      levels: [
        { title: 'Миссия', description: 'Трансформация бизнеса через AI', color: '#4F46E5' },
        { title: 'Стратегия', description: 'Лидерство в enterprise AI', color: '#6366F1' },
        { title: 'Тактика', description: 'Продуктовые инновации и партнёрства', color: '#818CF8' },
        { title: 'Операции', description: 'Ежедневная разработка и поддержка', color: '#A5B4FC' }
      ]
    }
  },
  // 5. Matrix-2x2 — template uses quadrants[].title, .description, .items[], axisX, axisY
  {
    layoutId: 'matrix-2x2',
    data: {
      title: 'Матрица приоритетов',
      description: 'Распределение задач по важности и срочности',
      axisX: 'Срочность',
      axisY: 'Важность',
      quadrants: [
        { title: 'Делать сейчас', description: 'Критические задачи с дедлайном', items: ['Запуск продукта', 'Исправление багов'] },
        { title: 'Планировать', description: 'Важные, но не срочные', items: ['Стратегия роста', 'Обучение команды'] },
        { title: 'Делегировать', description: 'Срочные, но не важные', items: ['Рутинные отчёты', 'Административные задачи'] },
        { title: 'Исключить', description: 'Ни важные, ни срочные', items: ['Бесполезные совещания', 'Устаревшие процессы'] }
      ]
    }
  },
  // 6. Pros-cons — template uses pros.items[] and cons.items[] as PLAIN STRINGS ({{ item }})
  {
    layoutId: 'pros-cons',
    data: {
      title: 'Плюсы и минусы облачной миграции',
      pros: {
        title: 'Преимущества',
        items: [
          'Снижение затрат на инфраструктуру на 40%',
          'Масштабируемость по требованию',
          'Автоматическое обновление и патчинг'
        ]
      },
      cons: {
        title: 'Недостатки',
        items: [
          'Зависимость от провайдера (vendor lock-in)',
          'Риски безопасности данных',
          'Необходимость переобучения команды'
        ]
      }
    }
  },
  // 7. Checklist — template uses items[].title, .description, .done, .status, .statusColor
  {
    layoutId: 'checklist',
    data: {
      title: 'Чек-лист запуска продукта',
      description: 'Ключевые шаги перед релизом',
      items: [
        { title: 'Провести нагрузочное тестирование', description: 'JMeter, 1000 RPS', done: true },
        { title: 'Подготовить документацию API', description: 'Swagger + примеры', done: true },
        { title: 'Настроить мониторинг и алерты', description: 'Grafana + PagerDuty', done: false },
        { title: 'Провести security audit', description: 'OWASP Top 10', done: false },
        { title: 'Подготовить пресс-релиз', description: 'PR + блог', done: false },
        { title: 'Обучить команду поддержки', description: 'Тренинг + FAQ', done: false }
      ]
    }
  },
  // 8. Kanban — template uses columns[].title, columns[].cards[].title, .description
  {
    layoutId: 'kanban-board',
    data: {
      title: 'Kanban-доска проекта',
      description: 'Текущий статус задач спринта',
      columns: [
        {
          title: 'To Do',
          cards: [
            { title: 'Интеграция с CRM', description: 'Подключить Salesforce API' },
            { title: 'A/B тестирование', description: 'Запустить тест новой формы' }
          ]
        },
        {
          title: 'In Progress',
          cards: [
            { title: 'Редизайн дашборда', description: 'Новые графики и метрики' },
            { title: 'Оптимизация запросов', description: 'Ускорить загрузку на 50%' }
          ]
        },
        {
          title: 'Done',
          cards: [
            { title: 'Авторизация OAuth', description: 'Google и GitHub' },
            { title: 'Email-уведомления', description: 'Шаблоны и триггеры' }
          ]
        }
      ]
    }
  },
  // 9. Vertical-timeline — template uses events[].title, .date, .description, .highlight, .badge
  {
    layoutId: 'vertical-timeline',
    data: {
      title: 'История компании',
      description: 'Ключевые вехи развития',
      events: [
        { date: '2020', title: 'Основание', description: 'Создание компании и первый прототип', highlight: true },
        { date: '2021', title: 'Seed раунд', description: 'Привлечение $2M инвестиций' },
        { date: '2023', title: 'Series A', description: 'Привлечение $15M, выход на 100 клиентов', highlight: true },
        { date: '2025', title: 'Масштабирование', description: 'Выход на международный рынок, 500+ клиентов' }
      ]
    }
  },
  // 10. Comparison-table — template uses columns[].name, features[].name, features[].values[], featureLabel
  {
    layoutId: 'comparison-table',
    data: {
      title: 'Сравнение тарифных планов',
      description: 'Выберите оптимальный план для вашего бизнеса',
      featureLabel: 'Функция',
      columns: [
        { name: 'Starter' },
        { name: 'Business', highlight: true },
        { name: 'Enterprise' }
      ],
      features: [
        { name: 'Пользователи', values: ['5', '50', 'Безлимит'] },
        { name: 'Хранилище', values: ['10 GB', '100 GB', '1 TB'] },
        { name: 'Поддержка', values: ['Email', '24/7 чат', 'Персональный менеджер'] },
        { name: 'API доступ', values: ['no', 'yes', 'yes'] }
      ]
    }
  },
  // 11. Scenario-cards — template uses scenarios[].title, .label, .value, .description, .color, .points[]
  {
    layoutId: 'scenario-cards',
    data: {
      title: 'Сценарии развития рынка',
      description: 'Три возможных сценария на 2026-2028',
      scenarios: [
        { title: 'Оптимистичный', label: 'BEST CASE', value: '+35%', description: 'Рост рынка на 35%', color: '#22c55e', points: ['Увеличение доли до 15%', 'Рост выручки x3'] },
        { title: 'Базовый', label: 'BASE CASE', value: '+15%', description: 'Стабильный рост', color: '#3b82f6', points: ['Удержание текущей доли', 'Рост выручки x1.5'] },
        { title: 'Пессимистичный', label: 'WORST CASE', value: '-5%', description: 'Стагнация рынка', color: '#ef4444', points: ['Снижение маржинальности', 'Сокращение расходов'] }
      ]
    }
  },
  // 12. Risk-matrix — template uses matrixColumns[], matrixRows[].label, .cells[].label, .color, .textColor, .value
  //     + mitigations[].title, .description, .color + mitigationTitle
  {
    layoutId: 'risk-matrix',
    data: {
      title: 'Матрица рисков проекта',
      description: 'Оценка ключевых рисков и мер минимизации',
      matrixColumns: ['Низкое влияние', 'Среднее', 'Высокое'],
      matrixRows: [
        {
          label: 'Высокая вер.',
          cells: [
            { label: '', color: '#fef9c3', textColor: '#854d0e' },
            { label: 'Отток клиентов', color: '#fed7aa', textColor: '#9a3412', value: '35%' },
            { label: 'Техн. сбои', color: '#fecaca', textColor: '#991b1b', value: '25%' }
          ]
        },
        {
          label: 'Средняя вер.',
          cells: [
            { label: '', color: '#dcfce7', textColor: '#166534' },
            { label: '', color: '#fef9c3', textColor: '#854d0e' },
            { label: 'Регуляторные', color: '#fed7aa', textColor: '#9a3412', value: '15%' }
          ]
        },
        {
          label: 'Низкая вер.',
          cells: [
            { label: '', color: '#dcfce7', textColor: '#166534' },
            { label: '', color: '#dcfce7', textColor: '#166534' },
            { label: '', color: '#fef9c3', textColor: '#854d0e' }
          ]
        }
      ],
      matrixLegend: [
        { label: 'Низкий', color: '#dcfce7' },
        { label: 'Средний', color: '#fef9c3' },
        { label: 'Высокий', color: '#fed7aa' },
        { label: 'Критический', color: '#fecaca' }
      ],
      mitigationTitle: 'Меры минимизации',
      mitigations: [
        { title: 'Резервирование', description: 'Дублирование критических систем и автоматическое переключение', color: '#ef4444' },
        { title: 'Программа лояльности', description: 'Персонализированные предложения и проактивная поддержка', color: '#f59e0b' },
        { title: 'Юридический мониторинг', description: 'Отслеживание изменений законодательства и адаптация', color: '#3b82f6' }
      ]
    }
  }
];

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // Build finalHtmlSlides array
  const finalHtmlSlides = layouts.map((l, i) => ({
    layoutId: l.layoutId,
    data: {
      ...l.data,
      _slideNumber: i + 1,
      _totalSlides: layouts.length,
      _presentationTitle: 'Тест сложных макетов',
      _slide_index: i,
    },
    html: '', // Will be rendered on-the-fly by the viewer
  }));

  const themeCss = `:root {
    --color-primary: #1e40af;
    --color-primary-light: #3b82f6;
    --color-primary-dark: #1e3a8a;
    --color-accent: #dc2626;
    --color-accent-light: #ef4444;
    --color-bg: #ffffff;
    --color-bg-alt: #f8fafc;
    --color-text: #1e293b;
    --color-text-secondary: #64748b;
    --color-border: #e2e8f0;
    --font-heading: 'Inter', sans-serif;
    --font-body: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }`;

  await conn.execute(
    `INSERT INTO presentations (presentationId, prompt, mode, status, slideCount, progressPercent, config, finalHtmlSlides, title, language, themeCss, createdAt, updatedAt)
     VALUES (?, ?, 'batch', 'completed', ?, 100, ?, ?, ?, 'ru', ?, NOW(), NOW())`,
    [
      presentationId,
      'Тестовая презентация для проверки inline-редактирования сложных макетов',
      layouts.length,
      JSON.stringify({ slide_count: layouts.length, theme_preset: 'corporate_blue' }),
      JSON.stringify(finalHtmlSlides),
      'Тест сложных макетов — inline editing v2',
      themeCss,
    ]
  );

  console.log(`✅ Created test presentation: ${presentationId}`);
  console.log(`   Slides: ${layouts.length}`);
  console.log(`   Layouts: ${layouts.map(l => l.layoutId).join(', ')}`);
  console.log(`\n   View at: /view/${presentationId}`);

  await conn.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
