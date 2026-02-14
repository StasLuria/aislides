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
7. [Функциональность](#функциональность)
8. [Технологический стек](#технологический-стек)
9. [Структура проекта](#структура-проекта)
10. [База данных](#база-данных)
11. [API](#api)
12. [Разработка](#разработка)

---

## Обзор проекта

AI Presentation Generator — это full-stack веб-приложение, которое превращает текстовое описание темы в полноценную HTML-презентацию. Система использует **15-этапный мультиагентный пайплайн** (14 AI-агентов + финальная сборка), работающих последовательно и параллельно, для создания структуры, контента, дизайна и визуализации данных.

Ключевые характеристики:

| Параметр | Значение |
|---|---|
| Время генерации | ~100 секунд (5–20 слайдов) |
| AI-агенты | 15 этапов пайплайна (14 агентов + Assembly) |
| Шаблоны слайдов | 45 HTML-макетов |
| Темы оформления | 12 цветовых тем + авто-подбор |
| Типы графиков | 6 типов SVG-диаграмм |
| Форматы экспорта | HTML, PPTX, PDF |
| Режимы генерации | Автоматический (batch) и интерактивный |

---

## Архитектура

Приложение построено на монолитной full-stack архитектуре с чётким разделением на клиент, сервер и пайплайн генерации.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (React 19)                     │
│  ChatPage ← → Generate ← → Viewer ← → SharedViewer          │
│  Interactive ← → History                                     │
│         ↕ axios (api.ts) ↕ SSE streaming                     │
├─────────────────────────────────────────────────────────────┤
│                    SERVER (Express + tRPC)                    │
│  chatRoutes │ presentationRoutes │ slideEditRoutes            │
│  interactiveRoutes │ templateRoutes                           │
│         ↕                                                    │
├─────────────────────────────────────────────────────────────┤
│               GENERATION PIPELINE (15 stages)                │
│  Planner → Outline → OutlineCritic → Research → Writer →     │
│  Storytelling → ThemeSelector → LayoutMapper → ImageGen →    │
│  SpeakerCoach → DataViz → Composer → QA → DesignCritic →    │
│  Assembly                                                    │
├─────────────────────────────────────────────────────────────┤
│                     DATA LAYER                               │
│  MySQL (TiDB) via Drizzle ORM │ S3 Storage │ OpenAI API      │
└─────────────────────────────────────────────────────────────┘
```

Клиент взаимодействует с сервером через REST API (axios) для CRUD-операций и SSE (Server-Sent Events) для стриминга прогресса генерации в реальном времени. Сервер использует Express для маршрутизации и tRPC для аутентификации. Пайплайн генерации вызывает OpenAI API через встроенный LLM-хелпер.

---

## Мультиагентный пайплайн

Генерация презентации проходит через последовательность специализированных AI-агентов. Каждый агент отвечает за конкретный аспект качества.

### Последовательность агентов

| # | Агент | Прогресс | Описание |
|---|---|---|---|
| 1 | **Planner** | 5% | Анализирует тему, определяет язык, генерирует заголовок и branding-контекст |
| 2 | **Outline Agent** | 12% | Создаёт структуру презентации: заголовки слайдов, content_shape для каждого слайда, ключевые тезисы |
| 3 | **Outline Critic** | 18% | Оценивает структуру по 10-балльной шкале, предлагает улучшения (логика, баланс, разнообразие shapes) |
| 4 | **Research Agent** | 23% | Обогащает контент фактами, статистикой и данными через веб-поиск |
| 5 | **Writer** (параллельный) | 30% | Генерирует контент для каждого слайда параллельно (до 5 одновременно), используя content_shape как формат |
| 6 | **Storytelling Agent** | 40% | Улучшает нарратив: переписывает заголовки в McKinsey-стиле, добавляет связность между слайдами |
| 7 | **Theme Selector** | 48% | AI-подбор визуальной темы на основе анализа промпта (тональность, отрасль, аудитория) |
| 8 | **Layout Mapper** | 55% | Маппинг content_shape → HTML-макет с учётом разнообразия и плотности контента |
| 9 | **Image Generator** | 60% | Выбирает слайды для иллюстраций и генерирует AI-изображения |
| 10 | **Speaker Coach** | 71% | Генерирует заметки спикера для каждого слайда с таймингами |
| 11 | **Data Viz Agent** | 72% | Анализирует данные и генерирует SVG-графики (bar, line, pie, donut, radar, horizontal-bar) |
| 12 | **HTML Composer** (LLM) | 75% | Маппит контент Writer → данные для HTML-шаблонов через LLM |
| 13 | **QA Agent** | 85% | Структурная валидация: required fields, типы данных, иконки, лимиты. Auto-fix (`fixSlideStructure`) |
| 14 | **Design Critic** | 92% | Визуальная валидация: контраст, плотность, overflow, баланс. Auto-fix (`fixSlideDensity`) |
| 15 | **Assembly** | 95% | Финальная сборка: рендеринг HTML через Template Engine, инъекция CSS-темы, нумерация слайдов |

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

Пайплайн включает три уровня контроля качества:

**fixSlideStructure** (QA Agent) — структурная нормализация данных после HTML Composer. Конвертирует строковые bullets в объекты `{title, description}`, нормализует иконки в `{name, url}`, добавляет обязательные поля (column titles, step numbers), фиксит цвета verdict, операторы формул, статусы чеклиста.

**fixSlideDensity** (Design Critic) — контроль плотности контента перед визуальной оценкой. Smart truncation по границам предложений (не по символам), лимиты количества элементов (bullets: 6–8, metrics: 6, steps: 7, events: 8), rebalancing двух колонок и SWOT-квадрантов, ограничения для org-chart (9 members, 5 departments) и kanban (4 cards/column).

**Design Critic** (LLM + локальные валидаторы) — 10 валидаторов визуального качества: контраст текста, overflow, баланс, размеры шрифтов, whitespace, цветовая гармония, consistency, density, diversity, conciseness. Генерирует CSS-фиксы и оценку по 10-балльной шкале.

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

Система включает **12 предустановленных тем** с автоматическим AI-подбором на основе анализа промпта.

| Тема | Категория | Описание |
|---|---|---|
| Corporate Blue | Business | Классическая корпоративная тема |
| Modern Purple | Creative | Современный фиолетовый градиент |
| Ocean Deep | Nature | Глубокий океанический синий |
| Sunset Warm | Creative | Тёплые закатные тона |
| Forest Green | Nature | Природный зелёный |
| Cosmic Dark | Dark | Тёмная космическая тема |
| Rose Gold | Creative | Розовое золото |
| Arctic Frost | Nature | Арктический холодный |
| Midnight Noir | Dark | Полночный чёрный |
| Citrus Energy | Creative | Энергичный цитрусовый |
| Executive Navy Red | Business | Деловой тёмно-синий с красным акцентом |
| Data Navy Blue | Business | Аналитический тёмно-синий |

Каждая тема содержит полный набор CSS-переменных: цвета фона, текста, акцентов, градиенты, шрифты (через Google Fonts CDN), тени и скругления. Theme Selector анализирует тональность промпта (формальный/креативный), отрасль и аудиторию для оптимального выбора.

Также поддерживаются **пользовательские шаблоны** — загрузка PPTX/PDF с автоматическим извлечением цветовой палитры и стилей.

---

## Режимы генерации

### Автоматический (Batch)

Полная генерация без остановок. Пользователь вводит тему, выбирает параметры (количество слайдов, тема дизайна) и получает готовую презентацию. Прогресс отображается в реальном времени через SSE.

### Интерактивный

Пошаговая генерация с утверждением на каждом этапе:

1. **Структура** — пользователь видит outline и может редактировать заголовки, менять порядок слайдов (drag-and-drop), добавлять/удалять слайды
2. **Контент** — пользователь видит превью каждого слайда и может регенерировать отдельные слайды, загружать изображения
3. **Финализация** — готовая презентация с возможностью inline-редактирования

### Чат-интерфейс

Основной интерфейс — чат с AI-ассистентом, который:
- Принимает тему презентации текстом
- Поддерживает загрузку файлов (PDF, DOCX, PPTX, изображения) как контекст
- Предлагает выбор режима (быстрый / интерактивный)
- Показывает прогресс генерации в реальном времени
- Отображает превью слайдов прямо в чате
- Хранит историю сессий с возможностью переименования и удаления

---

## Функциональность

### Генерация презентаций

- Мультиагентный AI-пайплайн с 15 этапами (14 агентов + Assembly)
- 45 HTML-макетов с адаптивной типографикой
- 12 тем оформления с AI-подбором
- AI-генерация изображений для слайдов
- SVG-графики (bar, line, pie, donut, radar, horizontal-bar)
- Заметки спикера с таймингами
- Обогащение фактами через Research Agent
- Нарратив в McKinsey-стиле через Storytelling Agent
- Трёхуровневый контроль качества (QA + Design Critic + Outline Critic)

### Редактирование

- **Inline-редактирование** — клик по тексту на слайде для прямого редактирования (contentEditable)
- **Inline-редактирование изображений** — замена изображений через AI-генерацию или загрузку
- **Drag-and-drop** — переупорядочивание слайдов перетаскиванием
- **Регенерация слайда** — повторная генерация отдельного слайда без пересоздания всей презентации
- **Auto-save** — автоматическое сохранение изменений
- **Version History** — история версий с возможностью отката

### Экспорт и шаринг

- **HTML** — нативный формат, открывается в любом браузере
- **PPTX** — экспорт в PowerPoint через pptxgenjs (поддержка 35 типов слайдов)
- **PDF** — экспорт в PDF
- **Share by Link** — публичная ссылка для просмотра без авторизации

### Пользовательские шаблоны

- Загрузка PPTX/PDF как шаблон
- Автоматическое извлечение цветовой палитры, шрифтов и стилей
- Применение пользовательского шаблона при генерации
- Галерея шаблонов

### Интерфейс

- Чат-интерфейс с историей сессий и боковой панелью
- SSE-стриминг прогресса генерации в реальном времени
- Превью слайдов в чате
- Полноэкранный просмотр с навигацией
- Загрузка файлов (drag-and-drop, paste-to-attach)
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
| shadcn/ui | UI-компоненты |
| Wouter | Маршрутизация |
| Axios | HTTP-клиент |
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
| Vitest | Тестирование (1152 теста) |

---

## Структура проекта

```
presentation-frontend/
├── client/                          # Frontend (React)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ChatPage.tsx         # Чат-интерфейс (основной UI)
│   │   │   ├── Generate.tsx         # Страница batch-генерации
│   │   │   ├── Interactive.tsx      # Интерактивный режим
│   │   │   ├── Viewer.tsx           # Просмотр презентации
│   │   │   ├── SharedViewer.tsx     # Публичный просмотр по ссылке
│   │   │   └── History.tsx          # История презентаций
│   │   ├── components/
│   │   │   ├── ChatSidebar.tsx      # Боковая панель чата
│   │   │   ├── SlideEditor.tsx      # Редактор слайдов
│   │   │   ├── SlidePreview.tsx     # Превью слайда
│   │   │   ├── InlineEditableSlide.tsx  # Inline-редактирование
│   │   │   ├── FileUploadButton.tsx # Загрузка файлов
│   │   │   └── AppLayout.tsx        # Общий layout
│   │   └── lib/
│   │       ├── api.ts               # API-клиент (axios)
│   │       └── constants.ts         # Константы (импорт из shared)
│   └── public/                      # Статические файлы
│
├── server/                          # Backend (Express)
│   ├── pipeline/                    # Мультиагентный пайплайн
│   │   ├── generator.ts             # Оркестратор пайплайна
│   │   ├── prompts.ts               # Системные промпты всех агентов
│   │   ├── templateEngine.ts        # 45 HTML-макетов + рендеринг
│   │   ├── designCriticAgent.ts     # Design Critic (визуальное качество)
│   │   ├── qaAgent.ts               # QA Agent (структурная валидация)
│   │   ├── dataVizAgent.ts          # Data Visualization (SVG-графики)
│   │   ├── svgChartEngine.ts        # SVG Chart Engine (6 типов)
│   │   ├── researchAgent.ts         # Research Agent (факты и статистика)
│   │   ├── storytellingAgent.ts     # Storytelling Agent (нарратив)
│   │   ├── speakerCoachAgent.ts     # Speaker Coach (заметки спикера)
│   │   ├── outlineCritic.ts         # Outline Critic (проверка структуры)
│   │   ├── themeSelector.ts         # AI-подбор темы
│   │   ├── themes.ts                # Темы оформления (CSS-переменные)
│   │   ├── adaptiveSizing.ts        # Адаптивная типографика
│   │   ├── autoDensity.ts           # Auto-density fallback
│   │   ├── inlineFieldInjector.ts   # data-field атрибуты для редактирования
│   │   └── markdownInline.ts        # Inline markdown → HTML
│   │
│   ├── chatOrchestrator.ts          # Оркестратор чат-сессий
│   ├── chatRoutes.ts                # API чата (SSE, сообщения, файлы)
│   ├── presentationRoutes.ts        # API презентаций (CRUD, экспорт, шаринг)
│   ├── interactiveRoutes.ts         # API интерактивного режима
│   ├── slideEditRoutes.ts           # API редактирования слайдов
│   ├── templateRoutes.ts            # API пользовательских шаблонов
│   ├── pptxExport.ts                # Генерация PPTX
│   ├── pdfExport.ts                 # Генерация PDF
│   ├── fileExtractor.ts             # Извлечение текста из файлов
│   ├── templateParser.ts            # Парсинг пользовательских шаблонов
│   └── *Db.ts                       # Database helpers (chatDb, presentationDb, etc.)
│
├── shared/                          # Общий код (клиент + сервер)
│   ├── themes.ts                    # THEME_PRESETS (единый источник)
│   ├── types.ts                     # Общие типы
│   └── const.ts                     # Общие константы
│
├── drizzle/                         # Схема базы данных
│   └── schema.ts                    # Таблицы (Drizzle ORM)
│
└── server/pipeline/*.test.ts        # Тесты (1152 теста, 40 файлов)
```

### Размер кодовой базы

| Категория | Строк кода | Файлов |
|---|---|---|
| Pipeline (агенты) | ~13 500 | 17 |
| Routes (API) | ~6 800 | 18 |
| Server (прочее) | ~3 500 | 13 |
| Client (страницы) | ~5 400 | 8 |
| Client (компоненты) | ~6 900 | 52 |
| Shared | ~100 | 4 |
| Тесты | ~14 300 | 40 |
| **Итого** | **~47 000** | **139** |

---

## База данных

Приложение использует MySQL (TiDB) через Drizzle ORM. Схема включает 6 таблиц:

| Таблица | Описание |
|---|---|
| `users` | Пользователи (Manus OAuth), роли (admin/user) |
| `presentations` | Презентации: HTML, слайды (JSON), тема, метаданные, share-токен |
| `chatSessions` | Чат-сессии: тема, статус, настройки, метаданные |
| `chatFiles` | Загруженные файлы в чат-сессиях |
| `customTemplates` | Пользовательские шаблоны (загруженные PPTX/PDF) |
| `slideVersions` | История версий слайдов для отката изменений |

---

## API

Приложение использует **54 REST API endpoints** через Express + 2 tRPC-процедуры для аутентификации. Основные группы:

### Презентации (`/api/v1/presentations`)

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

### Чат (`/api/v1/chat`)

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

### Редактирование слайдов (`/api/v1/presentations/:id/slides`)

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
| POST | `/:id/reassemble` | Пересобрать HTML презентации |
| GET | `/:id/slides/:index/versions` | История версий слайда |
| GET | `/:id/slides/:index/versions/:versionId` | Получить конкретную версию |
| POST | `/:id/slides/:index/versions/:versionId/restore` | Восстановить версию |

### Интерактивный режим (`/api/v1/interactive`)

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

### Пользовательские шаблоны (`/api/v1/templates`)

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/` | Список шаблонов |
| POST | `/upload` | Загрузить шаблон (PPTX/PDF) |
| GET | `/:id` | Получить шаблон |
| DELETE | `/:id` | Удалить шаблон |

### Публичный доступ (`/api/v1/shared`)

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/:token` | Получить презентацию по share-токену |
| GET | `/:token/slides` | Получить слайды по share-токену |
| GET | `/:token/html` | Получить HTML по share-токену |
| GET | `/:token/export/pptx` | Экспорт в PPTX по share-токену |
| GET | `/:token/export/pdf` | Экспорт в PDF по share-токену |

---

## Разработка

### Запуск

```bash
pnpm install
pnpm dev
```

### Тестирование

```bash
pnpm test              # Запуск всех тестов (1152 теста)
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

**REST vs tRPC.** Приложение использует Express REST API для основной функциональности (SSE streaming, бинарные экспорты, file uploads, публичные endpoints) и tRPC для аутентификации. Решение обосновано тем, что большинство из 54 endpoints требуют Express-специфичные возможности (SSE, multipart uploads, бинарные ответы). Новые endpoints рекомендуется добавлять через tRPC.

**Два уровня auto-fix.** `fixSlideStructure` (QA Agent) нормализует структуру данных после HTML Composer, `fixSlideDensity` (Design Critic) контролирует плотность контента перед визуальной оценкой. Функции работают последовательно на разных этапах пайплайна и не дублируют друг друга.

**THEME_PRESETS.** Единый источник в `shared/themes.ts`. Клиент использует базовые поля (id, name, color, gradient) для UI-селектора, сервер расширяет их CSS-переменными и шрифтами для генерации.
