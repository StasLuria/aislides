# Corporate Layout Family — CSS Templates

> Семейство макетов `corporate` для пресета `corporate_classic`.
> 55-60% отступов, dot-пули, профессионализм.
> Размер слайда: 1280×720px (16:9).

## Общие правила

- Все стили — инлайновые (атрибут `style`).
- Цвета — HEX-коды из S3 `color_palette`.
- Шрифты — Google Fonts из S3 `typography`.
- Размер слайда: `width:1280px; height:720px`.
- Базовый отступ: `spacing_unit` из S3 (обычно 4px).
- Все размеры кратны `spacing_unit`.

## Плейсхолдеры

| Плейсхолдер | Источник | Пример |
|:---|:---|:---|
| `[bg]` | `color_palette.background` | `#FFFFFF` |
| `[text]` | `color_palette.text_primary` | `#1A1A2E` |
| `[text2]` | `color_palette.text_secondary` | `#6B7280` |
| `[accent]` | `color_palette.accent` | `#0066CC` |
| `[accent2]` | `color_palette.accent_secondary` | `#00B4D8` |
| `[surface]` | `color_palette.surface` | `#F8F9FA` |
| `[h_font]` | `typography.font_family_heading` | `Inter` |
| `[b_font]` | `typography.font_family_body` | `Inter` |

---

## Layout: hero_title

Крупный заголовок по центру экрана. Используется для титульного слайда.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:80px;box-sizing:border-box;">
    <h1 style="font-family:'[h_font]',sans-serif;font-size:56px;font-weight:700;
               color:[text];margin:0 0 24px 0;text-align:center;
               letter-spacing:-0.02em;line-height:1.2;">
        {{title}}
    </h1>
    <p style="font-family:'[b_font]',sans-serif;font-size:24px;
              color:[text2];margin:0;text-align:center;max-width:800px;
              line-height:1.6;">
        {{subtitle}}
    </p>
    <div style="width:80px;height:4px;background:[accent];margin-top:40px;
                border-radius:2px;"></div>
</div>
```

---

## Layout: title_content

Заголовок сверху, контент (буллеты) ниже. Основной рабочий макет.

```html
<div style="width:1280px;height:720px;background:[bg];padding:60px 80px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="margin-bottom:40px;">
        <h2 style="font-family:'[h_font]',sans-serif;font-size:40px;font-weight:700;
                   color:[text];margin:0 0 8px 0;letter-spacing:-0.01em;">
            {{title}}
        </h2>
        <div style="width:60px;height:3px;background:[accent];border-radius:2px;"></div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <ul style="list-style:none;padding:0;margin:0;">
            <li style="font-family:'[b_font]',sans-serif;font-size:20px;color:[text];
                       padding:12px 0;padding-left:24px;position:relative;line-height:1.5;">
                <span style="position:absolute;left:0;color:[accent];font-size:20px;">•</span>
                {{bullet_1}}
            </li>
            <!-- Повторить для каждого буллета -->
        </ul>
    </div>
    <div style="font-family:'[b_font]',sans-serif;font-size:14px;color:[text2];
                text-align:right;">{{slide_number}}</div>
</div>
```

---

## Layout: two_column

Две колонки с контентом. Для сравнений, «до/после», «проблема/решение».

```html
<div style="width:1280px;height:720px;background:[bg];padding:60px 80px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <h2 style="font-family:'[h_font]',sans-serif;font-size:36px;font-weight:700;
               color:[text];margin:0 0 40px 0;">
        {{title}}
    </h2>
    <div style="flex:1;display:flex;gap:40px;">
        <div style="flex:1;background:[surface];border-radius:12px;padding:32px;">
            <h3 style="font-family:'[h_font]',sans-serif;font-size:24px;
                       color:[accent];margin:0 0 16px 0;">
                {{column_1_title}}
            </h3>
            <p style="font-family:'[b_font]',sans-serif;font-size:18px;
                      color:[text];line-height:1.6;margin:0;">
                {{column_1_content}}
            </p>
        </div>
        <div style="flex:1;background:[surface];border-radius:12px;padding:32px;">
            <h3 style="font-family:'[h_font]',sans-serif;font-size:24px;
                       color:[accent];margin:0 0 16px 0;">
                {{column_2_title}}
            </h3>
            <p style="font-family:'[b_font]',sans-serif;font-size:18px;
                      color:[text];line-height:1.6;margin:0;">
                {{column_2_content}}
            </p>
        </div>
    </div>
</div>
```

---

## Layout: key_point

Акцентное сообщение крупным шрифтом. Для ключевых выводов и цитат.

```html
<div style="width:1280px;height:720px;background:[accent];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:100px;box-sizing:border-box;">
    <div style="font-family:'[h_font]',sans-serif;font-size:48px;font-weight:700;
                color:#FFFFFF;text-align:center;line-height:1.3;max-width:900px;">
        {{key_message}}
    </div>
    <div style="width:60px;height:3px;background:rgba(255,255,255,0.5);
                margin-top:40px;border-radius:2px;"></div>
</div>
```

---

## Layout: process_steps

Шаги процесса, расположенные горизонтально. Для таймлайнов и процессов.

```html
<div style="width:1280px;height:720px;background:[bg];padding:60px 80px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <h2 style="font-family:'[h_font]',sans-serif;font-size:36px;font-weight:700;
               color:[text];margin:0 0 48px 0;">
        {{title}}
    </h2>
    <div style="flex:1;display:flex;gap:24px;align-items:center;">
        <!-- Шаг 1 -->
        <div style="flex:1;text-align:center;">
            <div style="width:64px;height:64px;background:[accent];border-radius:50%;
                        display:flex;align-items:center;justify-content:center;
                        margin:0 auto 16px;font-family:'[h_font]',sans-serif;
                        font-size:28px;font-weight:700;color:#FFFFFF;">
                1
            </div>
            <h3 style="font-family:'[h_font]',sans-serif;font-size:20px;
                       color:[text];margin:0 0 8px 0;">
                {{step_1_title}}
            </h3>
            <p style="font-family:'[b_font]',sans-serif;font-size:16px;
                      color:[text2];margin:0;line-height:1.5;">
                {{step_1_description}}
            </p>
        </div>
        <!-- Стрелка -->
        <div style="font-size:24px;color:[accent];">→</div>
        <!-- Повторить для каждого шага -->
    </div>
</div>
```

---

## Layout: data_table

Таблица с данными. Для отчётов и сравнений.

```html
<div style="width:1280px;height:720px;background:[bg];padding:60px 80px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <h2 style="font-family:'[h_font]',sans-serif;font-size:36px;font-weight:700;
               color:[text];margin:0 0 32px 0;">
        {{title}}
    </h2>
    <div style="flex:1;overflow:auto;">
        <table style="width:100%;border-collapse:collapse;
                      font-family:'[b_font]',sans-serif;">
            <thead>
                <tr>
                    <th style="padding:16px 20px;text-align:left;font-size:16px;
                               font-weight:600;color:[text];border-bottom:2px solid [accent];
                               background:[surface];">
                        {{header_1}}
                    </th>
                    <!-- Повторить для каждого столбца -->
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding:14px 20px;font-size:16px;color:[text];
                               border-bottom:1px solid #E5E7EB;">
                        {{cell_1_1}}
                    </td>
                    <!-- Повторить для каждой ячейки -->
                </tr>
            </tbody>
        </table>
    </div>
</div>
```

---

## Layout: quote

Цитата с автором. Для вдохновляющих высказываний.

```html
<div style="width:1280px;height:720px;background:[surface];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:100px;box-sizing:border-box;">
    <div style="font-size:80px;color:[accent];font-family:Georgia,serif;
                line-height:1;margin-bottom:24px;">
        "
    </div>
    <blockquote style="font-family:'[h_font]',sans-serif;font-size:32px;
                       color:[text];text-align:center;margin:0;
                       max-width:800px;line-height:1.5;font-style:italic;">
        {{quote_text}}
    </blockquote>
    <p style="font-family:'[b_font]',sans-serif;font-size:18px;
              color:[text2];margin-top:32px;">
        — {{author}}
    </p>
</div>
```

---

## Layout: section_divider

Разделитель секций. Для перехода между частями презентации.

```html
<div style="width:1280px;height:720px;background:[text];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:80px;box-sizing:border-box;">
    <div style="width:80px;height:4px;background:[accent];margin-bottom:32px;
                border-radius:2px;"></div>
    <h2 style="font-family:'[h_font]',sans-serif;font-size:48px;font-weight:700;
               color:[bg];margin:0;text-align:center;letter-spacing:-0.02em;">
        {{section_title}}
    </h2>
</div>
```

---

## Layout: closing

Финальный слайд. Спасибо, контакты, CTA.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:80px;box-sizing:border-box;">
    <h1 style="font-family:'[h_font]',sans-serif;font-size:56px;font-weight:700;
               color:[text];margin:0 0 24px 0;text-align:center;">
        {{closing_title}}
    </h1>
    <p style="font-family:'[b_font]',sans-serif;font-size:24px;
              color:[text2];margin:0 0 40px 0;text-align:center;">
        {{closing_subtitle}}
    </p>
    <div style="display:flex;gap:32px;align-items:center;">
        <a href="mailto:{{email}}"
           style="font-family:'[b_font]',sans-serif;font-size:18px;
                  color:[accent];text-decoration:none;">
            {{email}}
        </a>
        <span style="color:[text2];">|</span>
        <span style="font-family:'[b_font]',sans-serif;font-size:18px;
                     color:[text2];">
            {{website}}
        </span>
    </div>
    <div style="width:60px;height:3px;background:[accent];margin-top:48px;
                border-radius:2px;"></div>
</div>
```
