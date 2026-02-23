# CJM 5 «Редизайн» — Анализ и план

## Что есть сейчас
- S0 PlannerNode: генерирует план S1→S2→S3→S4→S5 для новой презентации
- S0 PlannerNode: для edit_context — частичная перегенерация зависимых шагов
- EngineAPI.run(): полный цикл, EngineAPI.apply_edit(): правка артефакта
- EngineBridge: мост между engine и WebSocket

## Что нужно для Redesign
CJM 5: Пользователь загружает СУЩЕСТВУЮЩУЮ презентацию и хочет сменить стиль.
Входные данные: existing_presentation (HTML) + new_style_request

## Подход
Redesign = S3 (новый дизайн) → S4 (перегенерация слайдов) → S5 (валидация)
S1 и S2 пропускаются — нарратив уже есть в существующей презентации.

### Что нужно реализовать:
1. **Новый метод EngineAPI.redesign()** — принимает existing_results (S1, S2 из старой презентации) + new_style
2. **Обновить S0 SYSTEM_PROMPT** — добавить правило для redesign: S3→S4→S5
3. **Новый WebSocket message type: `redesign`** — клиент отправляет existing_presentation + new_style
4. **Новый handler в websocket.py** — _handle_redesign()
5. **Новый метод EngineBridge.run_redesign()**
6. **Frontend: кнопка "Сменить стиль"** — отправляет redesign через WS
7. **Тесты**: unit + integration

### Ключевое решение:
S0 PlannerNode уже умеет генерировать частичные планы (правило 2: для edit_context).
Для redesign мы:
- Передаём existing_results с S1 и S2 (нарратив сохраняется)
- В user_input.prompt = "Смени стиль на {new_style}"
- S0 должен сгенерировать план: S3→S4→S5

Это уже работает! Нужно только:
1. Добавить redesign_context в S0 prompt
2. Добавить EngineAPI.redesign() для удобства
3. Добавить WebSocket handler + EngineBridge method
4. Добавить frontend UI
5. Тесты
