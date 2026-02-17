# AI Presentation Generator

Веб-приложение для автоматической генерации профессиональных HTML-презентаций с помощью мультиагентного AI-пайплайна. Пользователь вводит тему — система создаёт готовую презентацию с контентом, дизайном, графиками и заметками спикера за ~100 секунд.

---

## Содержание

1. [Обзор проекта](#обзор-проекта)
2. [Архитектура](#архитектура)
3. [Мультиагентный пайплайн](#мультиагентный-пайплайн)
4. [Шаблоны слайдов](#шаблоны-слайдов)
5. [Темы оформления](#темы-оформления)
6. [Режимы генерации](#режимы-генерации)
7. [Чат-интерфейс](#чат-интерфейс)
8. [Функциональность](#функциональность)
9. [Технологический стек](#технологический-стек)
10. [Структура проекта](#структура-проекта)
11. [База данных](#база-данных)
12. [API](#api)
13. [SSE-протокол](#sse-протокол)
14. [Разработка](#разработка)

---

## Обзор проекта

AI Presentation Generator — это full-stack веб-приложение, которое превращает текстовое описание темы в полноценную HTML-презентацию. Система использует **19-этапный мультиагентный пайплайн** (18 AI-агентов + финальная сборка), работающих последовательно и параллельно, для создания структуры, контента, дизайна и визуализации данных.

| Параметр | Значение |
|---|---|
| Время генерации | ~100 секунд (5–20 слайдов) |
| AI-агенты | 19 этапов пайплайна (18 агентов + Assembly) |
| Шаблоны слайдов | 45 HTML-макетов |
| Темы оформления | 13 цветовых тем + авто-подбор |
| Типы графиков | 6 типов SVG-диаграмм |
| Форматы экспорта | HTML, PPTX, PDF |
| Режимы генерации | Быстрый (batch) и пошаговый (step-by-step) |
| REST API endpoints | 67 |
| Кодовая база | ~72 500 строк / 207 файлов |
| Тесты | 1 628 тестов / 63 файла |

---

## Архитектура

Приложение построено на монолитной full-stack архитектуре с чётким разделением на клиент, сервер и пайплайн генерации.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (React 19)                     │
│  ChatPage ← → Generate ← → Viewer ← → SharedViewer          │
│  Interactive ← → History ← → Analytics                       │
│         ↕ axios (api.ts) ↕ SSE streaming                     │
├─────────────────────────────────────────────────────────────┤
│                    SERVER (Express + tRPC)                    │
│  chatRoutes │ presentationRoutes │ slideEditRoutes            │
│  interactiveRoutes │ templateRoutes │ analyticsRoutes         │
│         ↕                                                    │
├─────────────────────────────────────────────────────────────┤
│               GENERATION PIPELINE (19 stages)                │
│  Research → Analysis → Planner → Outline → OutlineCritic →   │
│  Writer → Storytelling → Evaluator → ThemeSelector →         │
│  LayoutMapper → ImageGen → SpeakerCoach → DataViz →         │
│  Composer → QA → DesignCritic → VisualReviewer →            │
│  FinalReview → Assembly                                     │
├─────────────────────────────────────────────────────────────┤
│               CHAT ORCHESTRATOR (step-by-step)               │
│  idle → topic_received → mode_selection →                    │
│  [quick: generating → completed]                             │
│  [step: step_structure → step_slide_content ↔                │
│         step_slide_design → ... → completed]                 │
├─────────────────────────────────────────────────────────────┤
│                     DATA LAYER                               │
│  MySQL (TiDB) via Drizzle ORM │ S3 Storage │ OpenAI API      │
└─────────────────────────────────────────────────────────────┘
```

Клиент взаимодействует с сервером через REST API (axios) для CRUD-операций и SSE (Server-Sent Events) для стриминга прогресса генерации в реальном времени. Сервер использует Express для маршрутизации и tRPC для аутентификации. Пайплайн генерации вызывает OpenAI API через встроенный LLM-хелпер. Chat Orchestrator управляет состоянием чат-сессий и координирует пошаговый режим генерации.

---

## Мультиагентный пайплайн

Генерация презентации проходит через последовательность специализированных AI-агентов. Каждый агент отвечает за конкретный аспект качества.

### Последовательность агентов

| # | Агент | nodeName | Прогресс | Описание |
|---|---|---|---|---|
| 1 | **Research Agent** | `research` | 3% | Собирает факты, статистику и данные через веб-поиск до планирования структуры |
| 2 | **Analysis Agent** | `analysis` | 5% | Кластеризует исследования, выделяет якорные инсайты, строит нарративную дугу |
| 3 | **Planner** | `planner` | 8% | Анализирует тему с учётом анализа, определяет язык, генерирует заголовок и branding-контекст |
| 4 | **Outline Agent** | `outline` | 22% | Создаёт структуру на основе реальных данных: заголовки, content_shape, ключевые тезисы |
| 5 | **Outline Critic** | `outline_critic` | 26% | Оценивает структуру + покрытие исследовательских данных по 10-балльной шкале |
| 6 | **Writer** (параллельный) | `writer` | 30% | Генерирует контент с учётом research + analysis highlights |
| 7 | **Storytelling Agent** | `storytelling` | 40% | Улучшает нарратив с учётом нарративной дуги из анализа |
| 8 | **Content Evaluator** | `evaluator` | 43% | Оценка качества контента по 5-балльной шкале, rewrite слабых слайдов |
| 9 | **Theme Selector** | `theme` | 48% | AI-подбор визуальной темы на основе анализа промпта (тональность, отрасль, аудитория) |
| 10 | **Layout Mapper** | `layout` | 55% | Маппинг content_shape → HTML-макет с учётом разнообразия и плотности контента |
| 11 | **Image Generator** | `image` | 60% | Выбирает слайды для иллюстраций и генерирует AI-изображения |
| 12 | **Speaker Coach** | `speaker_coach` | 71% | Генерирует заметки спикера для каждого слайда с таймингами |
| 13 | **Data Viz Agent** | `data_viz` | 72% | Анализирует данные и генерирует SVG-графики (bar, line, pie, donut, radar, horizontal-bar) |
| 14 | **HTML Composer** (LLM) | `composer` | 75% | Маппит контент Writer → данные для HTML-шаблонов через LLM |
| 15 | **QA Agent** | (внутри composer) | 85% | Структурная валидация: required fields, типы данных, иконки, лимиты. Auto-fix (`fixSlideStructure`) |
| 16 | **Design Critic** | `design_critic` | 92% | Визуальная валидация: контраст, плотность, overflow, баланс. Auto-fix (`fixSlideDensity`) |
| 17 | **Visual Reviewer** | `visual_reviewer` | 95% | Визуальная проверка отрендеренных слайдов, оценка качества |
| 18 | **Final Review** | `final_review` | 97% | Финальная оценка всей презентации по 10-балльной шкале |
| 19 | **Assembly** | `assembler` | 99% | Финальная сборка: рендеринг HTML через Template Engine, инъекция CSS-темы, нумерация слайдов |

### Content Shapes (форматы контента)

Outline Agent назначает каждому слайду `content_shape` — формат, определяющий структуру данных, которую Writer должен сгенерировать. Layout Mapper затем преобразует shape в конкретный HTML-макет.

| Content Shape | Описание | Маппинг на макеты |
|---|---|---|
| `stat_cards` | 3–4 ключевых метрики | icons-numbers, highlight-stats, hero-stat |
| `bullet_points` | Тезисы с описаниями | text-with-callout, text-slide |
| `comparison_two_sides` | Сравнение двух сторон | comparison-table, pros-cons, two-column |
| `table_data` | Табличные данные | comparison-table, table-slide |
| `process_steps` | Пошаговый процесс | numbered-steps-v2, kanban-board, process-steps |
| `card_grid` | Карточки с иконками | card-grid, kanban-board, icons-numbers, checklist |
| `timeline_events` | Хронология событий | vertical-timeline, timeline-horizontal, roadmap |
| `financial_formula` | Финансовые формулы | financial-formula, hero-stat, highlight-stats |
| `analysis_with_verdict` | Анализ с вердиктом | verdict-analysis, pros-cons, risk-matrix, swot-analysis |
| `single_concept` | Одна ключевая мысль | big-statement, text-with-callout |
| `chart_with_context` | Данные для графика | stats-chart, chart-text |
| `quote_highlight` | Цитата | quote-highlight, quote-slide |
| `checklist_items` | Чеклист | checklist, card-grid |
| `swot_quadrants` | SWOT-анализ | swot-analysis |
| `kanban_board` | Канбан-доска | kanban-board |
| `org_structure` | Организационная структура | org-chart |

### Системы качества

Пайплайн включает **пять уровней** контроля качества:

**Content Evaluator** (`evaluator`) — оценка качества контента по 5-балльной шкале после Writer + Storytelling. Слайды с оценкой ниже порога автоматически переписываются с учётом фидбэка.

**fixSlideStructure** (QA Agent) — структурная нормализация данных после HTML Composer. Конвертирует строковые bullets в объекты `{title, description}`, нормализует иконки в `{name, url}`, добавляет обязательные поля (column titles, step numbers), фиксит цвета verdict, операторы формул, статусы чеклиста.

**fixSlideDensity** (Design Critic) — контроль плотности контента перед визуальной оценкой. Smart truncation по границам предложений (не по символам), лимиты количества элементов (bullets: 6–8, metrics: 6, steps: 7, events: 8), rebalancing двух колонок и SWOT-квадрантов, ограничения для org-chart (9 members, 5 departments) и kanban (4 cards/column).

**Design Critic** (LLM + локальные валидаторы) — 10 валидаторов визуального качества: контраст текста, overflow, баланс, размеры шрифтов, whitespace, цветовая гармония, consistency, density, diversity, conciseness. Генерирует CSS-фиксы и оценку по 10-балльной шкале.

**Visual Reviewer** (`visual_reviewer`) — проверяет отрендеренные HTML-слайды на визуальное качество после Design Critic.

**Final Review** (`final_review`) — финальная оценка всей презентации по 10-балльной шкале с учётом контента, дизайна и визуального качества.

---

## Шаблоны слайдов

Template Engine содержит **45 HTML-макетов**, каждый с поддержкой трёх уровней плотности (normal, compact, dense) через систему Adaptive Sizing.

### Полный список макетов

| Категория | Макеты |
|---|---|
| **Структурные** | title-slide, section-header, final-slide, agenda-table-of-contents |
| **Текстовые** | text-slide, text-with-callout, big-statement, quote-slide, quote-highlight |
| **Колонки и сравнения** | two-column, comparison, comparison-table, pros-cons |
| **Данные и метрики** | icons-numbers, highlight-stats, hero-stat, stats-chart, chart-text |
| **Графики** | chart-slide, dual-chart, waterfall-chart |
| **Процессы** | process-steps, numbered-steps-v2, timeline, timeline-horizontal, vertical-timeline, roadmap, funnel, pyramid |
| **Карточки и сетки** | card-grid, checklist, kanban-board, scenario-cards, logo-grid |
| **Аналитические** | swot-analysis, matrix-2x2, risk-matrix, verdict-analysis, financial-formula |
| **Медиа** | image-text, image-fullscreen, video-embed |
| **Специальные** | team-profiles, org-chart, table-slide |

### Adaptive Sizing

Система автоматически определяет плотность контента каждого слайда (normal / compact / dense) и применяет соответствующие CSS-классы для шрифтов, отступов и gap. Это предотвращает overflow и обеспечивает читаемость при любом объёме контента.

### Inline Field Injector

После рендеринга HTML каждый текстовый элемент получает атрибут `data-field`, позволяющий фронтенду реализовать inline-редактирование (contentEditable) без перегенерации слайда.

---

## Темы оформления

Система включает **13 предустановленных тем** с автоматическим AI-подбором на основе анализа промпта.

| ID | Тема | Категория | Описание |
|---|---|---|---|
| `bspb_corporate` | БСПБ Corporate | Business | Корпоративная тема Банка Санкт-Петербург |
| `corporate_blue` | Corporate Blue | Business | Классическая корпоративная тема |
| `modern_purple` | Modern Purple | Creative | Современный фиолетовый градиент |
| `ocean_deep` | Ocean Deep | Business | Глубокий океанический синий |
| `sunset_warm` | Sunset Warm | Creative | Тёплые закатные тона |
| `forest_green` | Forest Green | Nature | Природный зелёный |
| `cosmic_dark` | Cosmic Dark | Dark | Тёмная космическая тема |
| `rose_gold` | Rose Gold | Creative | Розовое золото |
| `arctic_frost` | Arctic Frost | Nature | Арктический холодный |
| `midnight_noir` | Midnight Noir | Dark | Полночный чёрный |
| `citrus_energy` | Citrus Energy | Nature | Энергичный цитрусовый |
| `executive_navy_red` | Executive Navy Red | Business | Деловой тёмно-синий с красным акцентом |
| `data_navy_blue` | Data Navy Blue | Business | Аналитический тёмно-синий |

Каждая тема содержит полный набор CSS-переменных: цвета фона, текста, акцентов, градиенты, шрифты (через Google Fonts CDN), тени и скругления. Theme Selector анализирует тональность промпта (формальный/креативный), отрасль и аудиторию для оптимального выбора.

Также поддерживаются **пользовательские шаблоны** — загрузка PPTX/PDF с автоматическим извлечением цветовой палитры и стилей.

---

## Режимы генерации

### Быстрый (Batch)

Полная генерация без остановок. Пользователь вводит тему, выбирает параметры (количество слайдов, тема дизайна) и получает готовую презентацию. Прогресс отображается в реальном времени через SSE с показом превью каждого слайда по мере готовности.

### Пошаговый (Step-by-Step)

Пошаговая генерация с утверждением на каждом этапе. Управляется через Chat Orchestrator с конечным автоматом фаз:

```
idle → topic_received → mode_selection → step_structure
  → [для каждого слайда: step_slide_content ↔ step_slide_design]
  → completed
```

**Фаза 1: Структура** (`step_structure`) — AI генерирует outline (заголовки, content_shape, ключевые тезисы для каждого слайда). Пользователь может утвердить структуру, запросить пересоздание или отправить текстовый фидбэк для корректировки.

**Фаза 2: Контент слайда** (`step_slide_content`) — для каждого слайда AI генерирует контент (заголовок, ключевое сообщение, текст, буллеты, заметки спикера). Пользователь может:
- **Утвердить** контент и перейти к генерации дизайна
- **Редактировать** контент inline (заголовок, ключевое сообщение, текст, заметки) через компонент `SlideContentEditor`
- **Отправить фидбэк** текстом для корректировки AI

**Фаза 3: Дизайн слайда** (`step_slide_design`) — AI выбирает HTML-макет, генерирует данные для шаблона и рендерит слайд. Пользователь видит превью и может утвердить или запросить пересоздание.

После утверждения последнего слайда происходит финализация: сборка всех слайдов в единую HTML-презентацию с CSS-темой и нумерацией.

### Интерактивный (Legacy)

Альтернативный пошаговый режим через отдельный интерфейс (`/interactive/:id`):

1. **Структура** — пользователь видит outline и может редактировать заголовки, менять порядок слайдов (drag-and-drop), добавлять/удалять слайды
2. **Контент** — пользователь видит превью каждого слайда и может регенерировать отдельные слайды, загружать изображения
3. **Финализация** — готовая презентация с возможностью inline-редактирования

---

## Чат-интерфейс

Основной интерфейс приложения — чат с AI-ассистентом. Реализован через `ChatPage` + `useSSEChat` hook.

### Возможности чата

- Принимает тему презентации текстом
- Поддерживает загрузку файлов (PDF, DOCX, PPTX, изображения) как контекст для генерации
- Предлагает выбор режима (быстрый / пошаговый) через action-кнопки
- Показывает прогресс генерации в реальном времени (процент + текстовое описание этапа)
- Отображает превью слайдов прямо в чате по мере генерации
- Показывает карточку завершения с кнопкой "Открыть презентацию"
- Хранит историю сессий с возможностью переименования и удаления (боковая панель)

### Комментарии и аннотации

- **Комментарии к сообщениям** — пользователь может добавлять комментарии к любому сообщению ассистента
- **Комментарии к слайдам** — комментарии привязаны к конкретному слайду в превью
- **Аннотации** — выделение текста в сообщении с добавлением заметки (selectedText + note + offset)

### Polling-страховка

Для надёжности доставки событий реализован периодический polling каждые 10 секунд во время всех фаз генерации (как быстрого, так и пошагового режима). Если SSE-соединение обрывается, polling автоматически подхватывает состояние сессии и восстанавливает UI. Polling обрабатывает следующие фазы: `generating`, `step_structure`, `step_slide_content`, `step_slide_design`, `completed`.

### Восстановление состояния

При загрузке страницы `recoverSessionState` проверяет текущую фазу сессии и восстанавливает UI:
- `generating` → показывает прогресс-бар и запускает polling
- `step_structure` / `step_slide_content` / `step_slide_design` → восстанавливает action-кнопки
- `completed` → показывает карточку с презентацией

---

## Функциональность

### Генерация презентаций

- Мультиагентный AI-пайплайн с 19 этапами (18 агентов + Assembly)
- 45 HTML-макетов с адаптивной типографикой
- 13 тем оформления с AI-подбором
- AI-генерация изображений для слайдов
- SVG-графики (bar, line, pie, donut, radar, horizontal-bar)
- Заметки спикера с таймингами
- Обогащение фактами через Research Agent
- Нарратив в McKinsey-стиле через Storytelling Agent
- Пятиуровневый контроль качества (Evaluator + QA + Design Critic + Visual Reviewer + Final Review)

### Пошаговый режим

- Утверждение структуры перед генерацией контента
- Inline-редактирование контента каждого слайда (заголовок, ключевое сообщение, текст, заметки спикера)
- Превью дизайна каждого слайда перед утверждением
- Текстовый фидбэк на любом этапе для корректировки AI
- Пересоздание структуры / контента / дизайна
- Автоматическая финализация после утверждения последнего слайда

### Редактирование

- **Inline-редактирование** — клик по тексту на слайде для прямого редактирования (contentEditable)
- **Inline-редактирование изображений** — замена изображений через AI-генерацию или загрузку
- **Drag-and-drop** — переупорядочивание слайдов перетаскиванием
- **Регенерация слайда** — повторная генерация отдельного слайда без пересоздания всей презентации
- **Смена темы** — изменение темы оформления всей презентации с превью
- **Auto-save** — автоматическое сохранение изменений
- **Version History** — история версий с возможностью отката

### Экспорт и шаринг

- **HTML** — нативный формат, открывается в любом браузере
- **PPTX** — экспорт в PowerPoint через pptxgenjs
- **PDF** — экспорт в PDF
- **Share by Link** — публичная ссылка для просмотра без авторизации

### Пользовательские шаблоны

- Загрузка PPTX/PDF как шаблон
- Автоматическое извлечение цветовой палитры, шрифтов и стилей
- Применение пользовательского шаблона при генерации
- Галерея шаблонов

### Аналитика

- Экспорт данных в CSV, PDF, JSON
- Статистика использования

### Интерфейс

- Чат-интерфейс с историей сессий и боковой панелью
- SSE-стриминг прогресса генерации в реальном времени
- Превью слайдов в чате с переходом в Viewer по клику
- Полноэкранный просмотр с клавиатурной навигацией (←↑→↓, Home/End, F, E, Escape)
- Загрузка файлов (drag-and-drop, paste-to-attach)
- Комментарии к сообщениям и слайдам
- Аннотации (выделение текста + заметка)
- Тёмная тема интерфейса
- Адаптивный дизайн

---

## Технологический стек

### Frontend

| Технология | Назначение |
|---|---|
| React 19 | UI-фреймворк |
| TypeScript | Типизация |
| Tailwind CSS 4 | Стилизация |
| shadcn/ui (42 компонента) | UI-компоненты |
| Wouter | Маршрутизация |
| Axios | HTTP-клиент |
| tRPC React Query | Аутентификация |
| Sonner | Toast-уведомления |
| Lucide React | Иконки |

### Backend

| Технология | Назначение |
|---|---|
| Express 4 | HTTP-сервер и маршрутизация |
| tRPC 11 | Типизированный RPC (аутентификация) |
| Drizzle ORM | Работа с базой данных |
| Multer | Загрузка файлов |
| pptxgenjs | Генерация PPTX |
| Кастомный Jinja2-рендерер | Шаблонизация HTML-слайдов (без внешних зависимостей) |
| Jose | JWT-токены |

### Инфраструктура

| Технология | Назначение |
|---|---|
| MySQL (TiDB) | База данных |
| S3 | Хранение файлов и изображений |
| OpenAI API | LLM для всех AI-агентов |
| Manus OAuth | Аутентификация пользователей |
| Vite | Сборка и dev-сервер |
| Vitest | Тестирование (1 628 тестов, 63 файла) |

---

## Структура проекта

```
presentation-frontend/
├── client/                          # Frontend (React)
│   ├── src/
│   │   ├── pages/                   # 9 страниц
│   │   │   ├── ChatPage.tsx         # Чат-интерфейс (основной UI)
│   │   │   ├── Home.tsx             # Главная страница с формой создания
│   │   │   ├── Generate.tsx         # Страница batch-генерации
│   │   │   ├── Interactive.tsx      # Интерактивный режим (legacy)
│   │   │   ├── Viewer.tsx           # Просмотр презентации
│   │   │   ├── SharedViewer.tsx     # Публичный просмотр по ссылке
│   │   │   ├── History.tsx          # История презентаций
│   │   │   ├── Analytics.tsx        # Аналитика
│   │   │   └── NotFound.tsx         # 404
│   │   ├── components/              # 11 кастомных + 42 shadcn/ui
│   │   │   ├── AppLayout.tsx        # Общий layout с навигацией
│   │   │   ├── ChatSidebar.tsx      # Боковая панель чата
│   │   │   ├── SlideEditor.tsx      # Редактор слайдов
│   │   │   ├── SlidePreview.tsx     # Превью слайда
│   │   │   ├── SlideContentEditor.tsx # Inline-редактирование контента (step-by-step)
│   │   │   ├── InlineEditableSlide.tsx # Inline-редактирование в Viewer
│   │   │   ├── FileUploadButton.tsx # Загрузка файлов
│   │   │   ├── ErrorBoundary.tsx    # Обработка ошибок React
│   │   │   └── ui/                  # shadcn/ui компоненты (42 шт.)
│   │   ├── hooks/                   # 4 хука
│   │   │   ├── useSSEChat.ts        # SSE-чат с polling-страховкой
│   │   │   ├── useComposition.ts    # Обработка IME-ввода
│   │   │   ├── useMobile.tsx        # Определение мобильного устройства
│   │   │   └── usePersistFn.ts      # Стабильные ссылки на функции
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx      # Контекст темы (dark/light)
│   │   └── lib/
│   │       ├── api.ts               # API-клиент (axios)
│   │       ├── trpc.ts              # tRPC-клиент
│   │       ├── constants.ts         # Константы (импорт из shared)
│   │       └── utils.ts             # Утилиты (cn, etc.)
│   └── public/                      # Статические файлы
│
├── server/                          # Backend (Express)
│   ├── pipeline/                    # Мультиагентный пайплайн (27 файлов)
│   │   ├── generator.ts             # Оркестратор пайплайна
│   │   ├── prompts.ts               # Системные промпты всех агентов
│   │   ├── templateEngine.ts        # 45 HTML-макетов + Jinja2-рендеринг
│   │   ├── themes.ts                # Темы оформления (CSS-переменные)
│   │   ├── researchAgent.ts         # Research Agent (факты и статистика)
│   │   ├── analysisAgent.ts         # Analysis Agent (кластеризация, инсайты)
│   │   ├── outlineCritic.ts         # Outline Critic (проверка структуры)
│   │   ├── storytellingAgent.ts     # Storytelling Agent (нарратив)
│   │   ├── contentEvaluator.ts      # Content Evaluator (оценка качества)
│   │   ├── themeSelector.ts         # AI-подбор темы
│   │   ├── layoutVoting.ts          # Layout Mapper (content_shape → макет)
│   │   ├── designCriticAgent.ts     # Design Critic (визуальное качество)
│   │   ├── qaAgent.ts               # QA Agent (структурная валидация)
│   │   ├── dataVizAgent.ts          # Data Visualization (SVG-графики)
│   │   ├── svgChartEngine.ts        # SVG Chart Engine (6 типов)
│   │   ├── speakerCoachAgent.ts     # Speaker Coach (заметки спикера)
│   │   ├── visualReviewer.ts        # Visual Reviewer (проверка рендера)
│   │   ├── finalReview.ts           # Final Review (финальная оценка)
│   │   ├── adaptiveSizing.ts        # Адаптивная типографика
│   │   ├── autoDensity.ts           # Auto-density fallback
│   │   ├── contentDensityValidator.ts # Валидация плотности контента
│   │   ├── inlineFieldInjector.ts   # data-field атрибуты для редактирования
│   │   ├── markdownInline.ts        # Inline markdown → HTML
│   │   ├── intentExtractor.ts       # Извлечение намерения пользователя
│   │   ├── presentationTypeClassifier.ts # Классификация типа презентации
│   │   ├── factChecker.ts           # Проверка фактов
│   │   └── referenceLibrary.ts      # Библиотека ссылок
│   │
│   ├── chatOrchestrator.ts          # Оркестратор чат-сессий (step-by-step FSM)
│   ├── chatRoutes.ts                # API чата (SSE, сообщения, файлы, комментарии)
│   ├── chatDb.ts                    # DB-хелперы для чат-сессий
│   ├── presentationRoutes.ts        # API презентаций (CRUD, экспорт, шаринг)
│   ├── presentationDb.ts            # DB-хелперы для презентаций
│   ├── slideEditRoutes.ts           # API редактирования слайдов (17 endpoints)
│   ├── interactiveRoutes.ts         # API интерактивного режима (legacy)
│   ├── templateRoutes.ts            # API пользовательских шаблонов
│   ├── templateDb.ts                # DB-хелперы для шаблонов
│   ├── templateParser.ts            # Парсинг пользовательских шаблонов
│   ├── analyticsRoutes.ts           # API аналитики (экспорт CSV/PDF/JSON)
│   ├── analyticsDb.ts               # DB-хелперы для аналитики
│   ├── analyticsExport.ts           # Генерация экспортных файлов
│   ├── pptxExport.ts                # Генерация PPTX
│   ├── pdfExport.ts                 # Генерация PDF
│   ├── fileExtractor.ts             # Извлечение текста из файлов
│   ├── versionDb.ts                 # DB-хелперы для версий слайдов
│   ├── routers.ts                   # tRPC-роутеры (аутентификация)
│   ├── storage.ts                   # S3-хелперы
│   ├── swagger.ts                   # Swagger/OpenAPI документация
│   ├── wsManager.ts                 # WebSocket менеджер
│   └── _core/                       # Фреймворк (OAuth, context, Vite bridge)
│
├── shared/                          # Общий код (клиент + сервер)
│   ├── themes.ts                    # THEME_PRESETS (единый источник)
│   ├── types.ts                     # Общие типы
│   └── const.ts                     # Общие константы
│
├── drizzle/                         # Схема базы данных
│   ├── schema.ts                    # 7 таблиц (Drizzle ORM)
│   └── relations.ts                 # Связи между таблицами
│
└── server/**/*.test.ts              # Тесты (1 628 тестов, 63 файла)
```

### Размер кодовой базы

| Категория | Строк кода | Файлов |
|---|---|---|
| Pipeline (агенты) | ~19 500 | 27 |
| Routes (API) | ~11 700 | 24 |
| Server (оркестратор, DB, экспорт) | ~7 300 | 16 |
| Server _core (фреймворк) | ~2 200 | 18 |
| Client (страницы) | ~8 200 | 10 |
| Client (компоненты) | ~7 600 | 53 |
| Client (UI/shadcn) | ~4 500 | 42 |
| Client (хуки) | ~1 000 | 4 |
| Client (lib) | ~1 200 | 4 |
| Shared | ~100 | 4 |
| Drizzle (схема) | ~280 | 2 |
| Тесты | ~22 100 | 64 |
| **Итого** | **~69 200** | **182** |

---

## База данных

Приложение использует MySQL (TiDB) через Drizzle ORM. Схема включает 7 таблиц:

| Таблица | Описание |
|---|---|
| `users` | Пользователи (Manus OAuth), роли (admin/user) |
| `presentations` | Презентации: HTML, слайды (JSON), тема, метаданные, share-токен |
| `chatSessions` | Чат-сессии: тема, фаза, настройки, метаданные (proposedContent, currentSlideIndex, etc.) |
| `chatFiles` | Загруженные файлы в чат-сессиях |
| `customTemplates` | Пользовательские шаблоны (загруженные PPTX/PDF) |
| `slideVersions` | История версий слайдов для отката изменений |
| `exportEvents` | Логирование экспортов (формат, размер, время) |

---

## API

Приложение использует **64 REST API endpoints** через Express + 2 tRPC-процедуры для аутентификации. Основные группы:

### Презентации (`/api/v1/presentations`) — 16 endpoints

| Метод | Endpoint | Описание |
|---|---|---|
| POST | `/` | Создать презентацию (batch-генерация) |
| GET | `/` | Список презентаций пользователя |
| GET | `/:id` | Получить презентацию по ID |
| DELETE | `/:id` | Удалить презентацию |
| GET | `/:id/export/pptx` | Экспорт в PPTX |
| GET | `/:id/export/pdf` | Экспорт в PDF |
| POST | `/:id/share` | Создать ссылку для шаринга |
| GET | `/:id/share` | Получить информацию о шаринге |
| GET | `/:id/html` | Получить полный HTML презентации |
| POST | `/:id/retry` | Повторить неудавшуюся генерацию |

### Чат (`/api/v1/chat`) — 16 endpoints

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/sessions` | Список чат-сессий |
| POST | `/sessions` | Создать сессию |
| GET | `/sessions/:id` | Получить сессию с сообщениями |
| DELETE | `/sessions/:id` | Удалить сессию |
| POST | `/sessions/:id/message` | Отправить сообщение (SSE-ответ) |
| POST | `/sessions/:id/action` | Выполнить действие (SSE-ответ) |
| POST | `/sessions/:id/upload` | Загрузить файлы |
| GET | `/sessions/:id/files` | Список файлов сессии |
| PATCH | `/sessions/:id/title` | Переименовать сессию |
| PATCH | `/sessions/:id/metadata` | Обновить метаданные сессии |
| POST | `/sessions/:id/messages/:msgIndex/comments` | Добавить комментарий к сообщению |
| DELETE | `/sessions/:id/messages/:msgIndex/comments/:commentId` | Удалить комментарий |
| POST | `/sessions/:id/messages/:msgIndex/slides/:slideNumber/comments` | Комментарий к слайду |
| DELETE | `/sessions/:id/messages/:msgIndex/slides/:slideNumber/comments/:commentId` | Удалить комментарий к слайду |
| POST | `/sessions/:id/messages/:msgIndex/annotations` | Добавить аннотацию |
| DELETE | `/sessions/:id/messages/:msgIndex/annotations/:annotationId` | Удалить аннотацию |

### Редактирование слайдов (`/api/v1/presentations/:id/slides`) — 17 endpoints

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/:id/slides` | Список слайдов презентации |
| GET | `/:id/slides/:index` | Получить слайд по индексу |
| PUT | `/:id/slides/:index` | Полное обновление слайда |
| PATCH | `/:id/slides/:index` | Частичное обновление слайда |
| POST | `/:id/slides/:index/image` | Загрузить изображение для слайда |
| DELETE | `/:id/slides/:index/image` | Удалить изображение слайда |
| GET | `/:id/slides/:index/editable` | Получить редактируемые данные |
| POST | `/:id/slides/:index/layout` | Сменить макет слайда |
| POST | `/:id/reorder` | Переупорядочить слайды |
| POST | `/:id/slides/:index/reorder-items` | Переупорядочить элементы внутри слайда |
| POST | `/:id/reassemble` | Пересобрать HTML презентации |
| GET | `/:id/slides/:index/versions` | История версий слайда |
| GET | `/:id/slides/:index/versions/:versionId` | Получить конкретную версию |
| POST | `/:id/slides/:index/versions/:versionId/restore` | Восстановить версию |
| POST | `/:id/change-theme` | Сменить тему оформления |
| GET | `/themes` | Список доступных тем |
| POST | `/:id/preview-theme` | Превью темы |

### Интерактивный режим (`/api/v1/interactive`) — 11 endpoints

| Метод | Endpoint | Описание |
|---|---|---|
| POST | `/start` | Запустить интерактивную генерацию |
| POST | `/:id/approve-outline` | Утвердить структуру |
| GET | `/:id/content` | Получить контент слайдов |
| POST | `/:id/update-slide` | Обновить слайд |
| POST | `/:id/regenerate-slide` | Регенерировать слайд |
| POST | `/:id/generate-image` | Сгенерировать изображение |
| POST | `/:id/suggest-image-prompt` | Предложить промпт для изображения |
| POST | `/:id/remove-image` | Удалить изображение |
| POST | `/:id/upload-image` | Загрузить изображение |
| POST | `/:id/assemble` | Собрать презентацию |
| POST | `/:id/preview-slide` | Превью слайда |

### Пользовательские шаблоны (`/api/v1/templates`) — 4 endpoints

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/` | Список шаблонов |
| POST | `/upload` | Загрузить шаблон (PPTX/PDF) |
| GET | `/:id` | Получить шаблон |
| DELETE | `/:id` | Удалить шаблон |

### Публичный доступ (`/api/v1/shared`) — внутри presentationRoutes

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/:token` | Получить презентацию по share-токену |
| GET | `/:token/slides` | Получить слайды по share-токену |
| GET | `/:token/html` | Получить HTML по share-токену |
| GET | `/:token/export/pptx` | Экспорт в PPTX по share-токену |
| GET | `/:token/export/pdf` | Экспорт в PDF по share-токену |

### Аналитика (`/api/v1/analytics`) — 3 endpoints

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/export/csv` | Экспорт аналитики в CSV |
| GET | `/export/pdf` | Экспорт аналитики в PDF |
| GET | `/export/json` | Экспорт аналитики в JSON |

---

## SSE-протокол

Чат использует Server-Sent Events для стриминга данных от сервера к клиенту. Типы событий:

| Тип события | Описание | Данные |
|---|---|---|
| `token` | Токен текста сообщения | `{ content: string }` |
| `actions` | Кнопки действий для пользователя | `ChatAction[]` |
| `slide_preview` | Превью слайда (HTML) | `SlidePreview` |
| `progress` | Прогресс генерации | `{ percent: number, message: string }` |
| `slide_progress` | Прогресс по слайдам | `{ currentSlide: number, totalSlides: number }` |
| `presentation_link` | Ссылка на готовую презентацию | `{ presentationId: string, title: string, slideCount: number }` |
| `title_update` | Обновление заголовка сессии | `{ title: string }` |
| `done` | Завершение стрима | `{}` |
| `error` | Ошибка | `{ message: string }` |

### Action-кнопки

| Action ID | Фаза | Описание |
|---|---|---|
| `mode_quick` | mode_selection | Выбор быстрого режима |
| `mode_step` | mode_selection | Выбор пошагового режима |
| `approve_structure` | step_structure | Утвердить структуру |
| `regenerate_structure` | step_structure | Пересоздать структуру |
| `approve_slide_content` | step_slide_content | Утвердить контент слайда |
| `approve_slide_design` | step_slide_design | Утвердить дизайн слайда |
| `view_presentation` | completed | Открыть готовую презентацию |
| `new_presentation` | completed | Создать новую презентацию |
| `retry_quick` | error | Повторить быстрый режим |
| `retry_step` | error | Повторить пошаговый режим |

---

## Разработка

### Запуск

```bash
pnpm install
pnpm dev
```

### Тестирование

```bash
pnpm test              # Запуск всех тестов (1 628 тестов)
pnpm test -- --watch   # Watch-режим
```

### Миграции базы данных

```bash
pnpm db:push           # Генерация и применение миграций
```

### Сборка

```bash
pnpm build             # Production build (Vite + esbuild)
```

### Архитектурные решения

**REST vs tRPC.** Приложение использует Express REST API для основной функциональности (SSE streaming, бинарные экспорты, file uploads, публичные endpoints) и tRPC для аутентификации. Решение обосновано тем, что большинство из 64 endpoints требуют Express-специфичные возможности (SSE, multipart uploads, бинарные ответы). Новые endpoints рекомендуется добавлять через tRPC.

**Chat Orchestrator (FSM).** Пошаговый режим управляется конечным автоматом с фазами: `idle → topic_received → mode_selection → step_structure → [step_slide_content ↔ step_slide_design] × N → completed`. Каждая фаза определяет допустимые действия и переходы. Метаданные сессии хранят текущее состояние (proposedContent, currentSlideIndex, outline, completedSlides).

**Polling-страховка.** SSE-соединения могут обрываться (мобильный интернет, прокси, таймауты). Периодический polling каждые 10 секунд проверяет состояние сессии и восстанавливает UI при потере SSE-событий.

**Два уровня auto-fix.** `fixSlideStructure` (QA Agent) нормализует структуру данных после HTML Composer, `fixSlideDensity` (Design Critic) контролирует плотность контента перед визуальной оценкой. Функции работают последовательно на разных этапах пайплайна и не дублируют друг друга.

**THEME_PRESETS.** Единый источник в `shared/themes.ts`. Клиент использует базовые поля (id, name, color, gradient) для UI-селектора, сервер расширяет их CSS-переменными и шрифтами для генерации.

**Inline-редактирование контента (step-by-step).** В пошаговом режиме пользователь может редактировать контент слайда перед утверждением через компонент `SlideContentEditor`. Отредактированные данные сохраняются через PATCH `/api/v1/chat/sessions/:id/metadata` и используются для генерации дизайна вместо оригинального AI-предложения.
