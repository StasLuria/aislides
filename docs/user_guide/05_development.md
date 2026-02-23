# 5. Для разработчиков

Этот раздел предназначен для тех, кто хочет внести свой вклад в проект или глубже понять его архитектуру.

## Структура проекта

```
/ai-presentation-generator
├── backend/         # FastAPI-приложение (Python)
│   ├── app/
│   └── ...
├── frontend/        # React-приложение (TypeScript, Vite)
│   ├── src/
│   └── ...
├── engine/          # Ядро генерации (LLM-агенты, пайплайн)
│   ├── nodes/
│   └── ...
├── tools/           # Инструменты для LLM (промпты, логика)
├── schemas/         # Pydantic-модели для данных
├── data/            # Статичные данные (пресеты, макеты)
├── tests/           # Unit и integration тесты
├── docs/            # Документация
├── docker-compose.yml # Конфигурация Docker для продакшена
├── docker-compose.dev.yml # Конфигурация для разработки
└── Makefile         # Утилиты для разработки и Docker
```

## Локальная разработка (с Hot-Reload)

Для удобной разработки с автоматической перезагрузкой при изменениях в коде используйте `docker-compose.dev.yml`.

1.  **Запустите в режиме разработки:**

    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up
    ```

    Эта команда:
    - Запустит backend с `uvicorn --reload`.
    - Пробросит исходный код в контейнеры через volumes, поэтому изменения в локальных файлах сразу отразятся в работающем приложении.
    - Frontend (Vite) по умолчанию работает в режиме hot-reload.

2.  **Доступные порты:**
    - Frontend: [http://localhost:3000](http://localhost:3000)
    - Backend API: [http://localhost:8000](http://localhost:8000)
    - PostgreSQL: `localhost:5432`

## Запуск тестов

Перед каждым коммитом рекомендуется запускать полный набор тестов и проверок.

- **Все тесты (backend + frontend):**

  ```bash
  make check && make test-frontend
  ```

- **Только backend-тесты:**

  ```bash
  poetry run pytest
  ```

- **Только frontend-тесты:**

  ```bash
  cd frontend && pnpm test
  ```

## Внесение изменений (Contribution Flow)

1.  Создайте новую ветку (`git checkout -b feature/my-new-feature`).
2.  Внесите изменения в код.
3.  Напишите тесты для новой функциональности.
4.  Убедитесь, что все тесты и проверки проходят (`make check`).
5.  Сделайте коммит, следуя [стандартам Conventional Commits](https://www.conventionalcommits.org/).
6.  Отправьте Pull Request в `main` ветку.

Более подробно о стандартах кода и Definition of Done читайте в `CONTRIBUTING.md`.
