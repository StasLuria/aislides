# Data Layout Family — CSS Templates

> Семейство макетов `data` для пресета `data_visualization`.
> 40-50% отступов, оптимизировано для таблиц, графиков и числовых данных.
> Размер слайда: 1280×720px (16:9).

## Общие правила

- Все стили — инлайновые (атрибут `style`).
- Цвета — HEX-коды из S3 `color_palette`.
- Шрифты — Google Fonts из S3 `typography`.
- Размер слайда: `width:1280px; height:720px`.
- Базовый отступ: `spacing_unit` из S3 (обычно 4px).
- **Принцип:** информативность, плотность данных, чёткая иерархия, нет декора.

## Плейсхолдеры

| Плейсхолдер | Источник | Пример |
|:---|:---|:---|
| `[bg]` | `color_palette.background` | `#FFFFFF` |
| `[text]` | `color_palette.text_primary` | `#333333` |
| `[text2]` | `color_palette.text_secondary` | `#666666` |
| `[accent]` | `color_palette.accent` | `#4E79A7` |
| `[accent2]` | `color_palette.accent_secondary` | `#F28E2B` |
| `[surface]` | `color_palette.surface` | `#F5F5F5` |
| `[h_font]` | `typography.font_family_heading` | `Source Sans Pro` |
| `[b_font]` | `typography.font_family_body` | `Source Sans Pro` |

---

## Layout: data_hero

Титульный слайд — чистый, с акцентной линией сверху.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;
            padding:64px 80px;box-sizing:border-box;position:relative;">
    <div style="position:absolute;top:0;left:0;width:100%;height:4px;
                background:[accent];"></div>
    <h1 style="font-family:'[h_font]',sans-serif;font-size:48px;font-weight:600;
               color:[text];margin:0 0 16px 0;line-height:1.2;">
        {{title}}
    </h1>
    <p style="font-family:'[b_font]',sans-serif;font-size:20px;
              color:[text2];margin:0;max-width:700px;line-height:1.5;">
        {{subtitle}}
    </p>
    <div style="display:flex;gap:24px;margin-top:40px;">
        <div style="background:[surface];border-radius:4px;padding:12px 20px;">
            <span style="font-family:'[b_font]',sans-serif;font-size:14px;
                         color:[text2];">{{date}}</span>
        </div>
        <div style="background:[surface];border-radius:4px;padding:12px 20px;">
            <span style="font-family:'[b_font]',sans-serif;font-size:14px;
                         color:[text2];">{{author}}</span>
        </div>
    </div>
</div>
```

---

## Layout: data_section

Разделитель секции — строгий, с номером.

```html
<div style="width:1280px;height:720px;background:[surface];display:flex;
            flex-direction:column;justify-content:center;
            padding:64px 80px;box-sizing:border-box;">
    <span style="font-family:'[h_font]',sans-serif;font-size:16px;font-weight:600;
                 color:[accent];margin-bottom:12px;text-transform:uppercase;
                 letter-spacing:0.05em;">
        Section {{section_number}}
    </span>
    <h2 style="font-family:'[h_font]',sans-serif;font-size:44px;font-weight:600;
               color:[text];margin:0;">
        {{section_title}}
    </h2>
    <div style="width:48px;height:3px;background:[accent];margin-top:20px;"></div>
</div>
```

---

## Layout: data_table

Таблица с данными — плотная, с чёткими границами.

```html
<div style="width:1280px;height:720px;background:[bg];padding:48px 64px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;
                margin-bottom:24px;">
        <h2 style="font-family:'[h_font]',sans-serif;font-size:28px;font-weight:600;
                   color:[text];margin:0;">
            {{title}}
        </h2>
        <span style="font-family:'[b_font]',sans-serif;font-size:13px;color:[text2];">
            {{source}}
        </span>
    </div>
    <div style="flex:1;overflow:auto;">
        <table style="width:100%;border-collapse:collapse;
                      font-family:'[b_font]',sans-serif;font-size:15px;">
            <thead>
                <tr style="background:[accent];color:#FFFFFF;">
                    <th style="padding:12px 16px;text-align:left;font-weight:600;
                               font-size:14px;">
                        {{header_1}}
                    </th>
                    <!-- Повторить для каждого столбца -->
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom:1px solid #E0E0E0;">
                    <td style="padding:10px 16px;color:[text];">
                        {{cell_1_1}}
                    </td>
                    <!-- Повторить для каждой ячейки -->
                </tr>
                <tr style="background:[surface];border-bottom:1px solid #E0E0E0;">
                    <td style="padding:10px 16px;color:[text];">
                        {{cell_2_1}}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <div style="font-family:'[b_font]',sans-serif;font-size:12px;color:[text2];
                margin-top:12px;">
        {{footnote}}
    </div>
</div>
```

---

## Layout: data_chart

Слайд для графика — заголовок, область графика, аннотация.

```html
<div style="width:1280px;height:720px;background:[bg];padding:48px 64px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;
                margin-bottom:20px;">
        <h2 style="font-family:'[h_font]',sans-serif;font-size:28px;font-weight:600;
                   color:[text];margin:0;">
            {{title}}
        </h2>
        <div style="display:flex;gap:16px;">
            <div style="display:flex;align-items:center;gap:6px;">
                <div style="width:12px;height:12px;background:[accent];
                            border-radius:2px;"></div>
                <span style="font-family:'[b_font]',sans-serif;font-size:13px;
                             color:[text2];">{{legend_1}}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                <div style="width:12px;height:12px;background:[accent2];
                            border-radius:2px;"></div>
                <span style="font-family:'[b_font]',sans-serif;font-size:13px;
                             color:[text2];">{{legend_2}}</span>
            </div>
        </div>
    </div>
    <div style="flex:1;background:[surface];border-radius:4px;padding:24px;
                display:flex;align-items:center;justify-content:center;
                border:1px solid #E0E0E0;">
        <!-- Chart placeholder -->
        <p style="font-family:'[b_font]',sans-serif;font-size:16px;color:[text2];">
            {{chart_description}}
        </p>
    </div>
    <div style="font-family:'[b_font]',sans-serif;font-size:12px;color:[text2];
                margin-top:12px;">
        {{source}}
    </div>
</div>
```

---

## Layout: data_comparison

Сравнение двух метрик / показателей.

```html
<div style="width:1280px;height:720px;background:[bg];padding:48px 64px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <h2 style="font-family:'[h_font]',sans-serif;font-size:28px;font-weight:600;
               color:[text];margin:0 0 32px 0;">
        {{title}}
    </h2>
    <div style="flex:1;display:flex;gap:32px;">
        <div style="flex:1;background:[surface];border-radius:4px;padding:32px;
                    border-top:4px solid [accent];">
            <span style="font-family:'[h_font]',sans-serif;font-size:48px;
                         font-weight:600;color:[accent];display:block;
                         margin-bottom:12px;">
                {{metric_1_value}}
            </span>
            <h3 style="font-family:'[h_font]',sans-serif;font-size:18px;
                       font-weight:600;color:[text];margin:0 0 8px 0;">
                {{metric_1_label}}
            </h3>
            <p style="font-family:'[b_font]',sans-serif;font-size:15px;
                      color:[text2];margin:0;line-height:1.5;">
                {{metric_1_description}}
            </p>
        </div>
        <div style="flex:1;background:[surface];border-radius:4px;padding:32px;
                    border-top:4px solid [accent2];">
            <span style="font-family:'[h_font]',sans-serif;font-size:48px;
                         font-weight:600;color:[accent2];display:block;
                         margin-bottom:12px;">
                {{metric_2_value}}
            </span>
            <h3 style="font-family:'[h_font]',sans-serif;font-size:18px;
                       font-weight:600;color:[text];margin:0 0 8px 0;">
                {{metric_2_label}}
            </h3>
            <p style="font-family:'[b_font]',sans-serif;font-size:15px;
                      color:[text2];margin:0;line-height:1.5;">
                {{metric_2_description}}
            </p>
        </div>
    </div>
</div>
```

---

## Layout: data_bullets

Буллеты с нумерацией для аналитических выводов.

```html
<div style="width:1280px;height:720px;background:[bg];padding:48px 64px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <h2 style="font-family:'[h_font]',sans-serif;font-size:28px;font-weight:600;
               color:[text];margin:0 0 32px 0;">
        {{title}}
    </h2>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:12px;">
        <div style="display:flex;align-items:flex-start;gap:16px;
                    padding:16px;background:[surface];border-radius:4px;
                    border-left:3px solid [accent];">
            <span style="font-family:'[h_font]',sans-serif;font-size:20px;
                         font-weight:600;color:[accent];min-width:28px;">1.</span>
            <p style="font-family:'[b_font]',sans-serif;font-size:16px;
                      color:[text];margin:0;line-height:1.5;">
                {{bullet_1}}
            </p>
        </div>
        <!-- Повторить для каждого буллета -->
    </div>
</div>
```

---

## Layout: data_cta

Финальный слайд — строгий CTA с ключевой метрикой.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:64px 80px;box-sizing:border-box;position:relative;">
    <div style="position:absolute;top:0;left:0;width:100%;height:4px;
                background:[accent];"></div>
    <span style="font-family:'[h_font]',sans-serif;font-size:72px;font-weight:600;
                 color:[accent];display:block;margin-bottom:16px;">
        {{key_metric}}
    </span>
    <h1 style="font-family:'[h_font]',sans-serif;font-size:40px;font-weight:600;
               color:[text];margin:0 0 12px 0;text-align:center;">
        {{closing_title}}
    </h1>
    <p style="font-family:'[b_font]',sans-serif;font-size:18px;
              color:[text2];margin:0;text-align:center;max-width:600px;">
        {{closing_subtitle}}
    </p>
</div>
```
