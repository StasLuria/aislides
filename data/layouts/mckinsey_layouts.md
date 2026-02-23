# McKinsey Layout Family — CSS Templates

> Семейство макетов `mckinsey` для пресетов `consulting_classic`, `consulting_dense`.
> 40-50% отступов, плотная подача информации, структурированные данные.
> Размер слайда: 1280×720px (16:9).

## Общие правила

- Все стили — инлайновые (атрибут `style`).
- Цвета — HEX-коды из S3 `color_palette`.
- Шрифты — Google Fonts из S3 `typography`.
- Размер слайда: `width:1280px; height:720px`.
- Базовый отступ: `spacing_unit` из S3 (обычно 4px).
- **Принцип:** плотность информации, чёткая иерархия, takeaway message на каждом слайде.
- **Правило McKinsey:** каждый слайд имеет action title (вывод, а не описание).

## Плейсхолдеры

| Плейсхолдер | Источник | Пример |
|:---|:---|:---|
| `[bg]` | `color_palette.background` | `#FFFFFF` |
| `[text]` | `color_palette.text_primary` | `#003366` |
| `[text2]` | `color_palette.text_secondary` | `#4A6A8A` |
| `[accent]` | `color_palette.accent` | `#003366` |
| `[accent2]` | `color_palette.accent_secondary` | `#CC0000` |
| `[surface]` | `color_palette.surface` | `#F0F4F8` |
| `[h_font]` | `typography.font_family_heading` | `Georgia` |
| `[b_font]` | `typography.font_family_body` | `Arial` |

---

## Layout: mck_hero

Титульный слайд — строгий, с горизонтальной линией.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;
            padding:64px 80px;box-sizing:border-box;">
    <div style="width:100%;height:3px;background:[accent];margin-bottom:40px;"></div>
    <h1 style="font-family:'[h_font]',serif;font-size:44px;font-weight:700;
               color:[text];margin:0 0 20px 0;line-height:1.25;">
        {{title}}
    </h1>
    <p style="font-family:'[b_font]',sans-serif;font-size:20px;
              color:[text2];margin:0;max-width:800px;line-height:1.5;">
        {{subtitle}}
    </p>
    <div style="margin-top:48px;display:flex;gap:24px;">
        <span style="font-family:'[b_font]',sans-serif;font-size:14px;
                     color:[text2];">{{date}}</span>
        <span style="color:[text2];">|</span>
        <span style="font-family:'[b_font]',sans-serif;font-size:14px;
                     color:[text2];">{{confidentiality}}</span>
    </div>
</div>
```

---

## Layout: mck_section

Разделитель секции — минимальный, с номером.

```html
<div style="width:1280px;height:720px;background:[accent];display:flex;
            flex-direction:column;justify-content:center;
            padding:64px 80px;box-sizing:border-box;">
    <span style="font-family:'[b_font]',sans-serif;font-size:18px;
                 color:rgba(255,255,255,0.6);margin-bottom:12px;">
        Section {{section_number}}
    </span>
    <h2 style="font-family:'[h_font]',serif;font-size:44px;font-weight:700;
               color:#FFFFFF;margin:0;">
        {{section_title}}
    </h2>
</div>
```

---

## Layout: mck_key_point

Ключевой вывод — action title + supporting evidence.

```html
<div style="width:1280px;height:720px;background:[bg];padding:48px 64px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="background:[accent];padding:16px 24px;margin-bottom:32px;">
        <h2 style="font-family:'[b_font]',sans-serif;font-size:22px;font-weight:700;
                   color:#FFFFFF;margin:0;line-height:1.3;">
            {{action_title}}
        </h2>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;
                padding:0 24px;">
        <p style="font-family:'[b_font]',sans-serif;font-size:18px;
                  color:[text];margin:0;line-height:1.6;">
            {{supporting_text}}
        </p>
    </div>
    <div style="font-family:'[b_font]',sans-serif;font-size:12px;color:[text2];
                border-top:1px solid #E0E0E0;padding-top:12px;">
        Source: {{source}}
    </div>
</div>
```

---

## Layout: mck_bullets

Буллеты с action title — плотная подача.

```html
<div style="width:1280px;height:720px;background:[bg];padding:48px 64px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="background:[accent];padding:14px 24px;margin-bottom:28px;">
        <h2 style="font-family:'[b_font]',sans-serif;font-size:20px;font-weight:700;
                   color:#FFFFFF;margin:0;">
            {{action_title}}
        </h2>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <ul style="list-style:none;padding:0;margin:0;">
            <li style="font-family:'[b_font]',sans-serif;font-size:17px;color:[text];
                       padding:10px 0;padding-left:20px;position:relative;
                       line-height:1.4;border-bottom:1px solid #F0F0F0;">
                <span style="position:absolute;left:0;color:[text2];">—</span>
                {{bullet_1}}
            </li>
            <!-- Повторить для каждого буллета -->
        </ul>
    </div>
    <div style="font-family:'[b_font]',sans-serif;font-size:12px;color:[text2];
                text-align:right;margin-top:12px;">{{slide_number}}</div>
</div>
```

---

## Layout: mck_process

Процесс / фреймворк — горизонтальные блоки с нумерацией.

```html
<div style="width:1280px;height:720px;background:[bg];padding:48px 64px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="background:[accent];padding:14px 24px;margin-bottom:32px;">
        <h2 style="font-family:'[b_font]',sans-serif;font-size:20px;font-weight:700;
                   color:#FFFFFF;margin:0;">
            {{action_title}}
        </h2>
    </div>
    <div style="flex:1;display:flex;gap:20px;align-items:stretch;">
        <div style="flex:1;background:[surface];padding:24px;display:flex;
                    flex-direction:column;">
            <div style="font-family:'[b_font]',sans-serif;font-size:32px;
                        font-weight:700;color:[accent];margin-bottom:12px;">1</div>
            <h3 style="font-family:'[b_font]',sans-serif;font-size:18px;
                       font-weight:700;color:[text];margin:0 0 8px 0;">
                {{step_1_title}}
            </h3>
            <p style="font-family:'[b_font]',sans-serif;font-size:15px;
                      color:[text2];margin:0;line-height:1.4;">
                {{step_1_description}}
            </p>
        </div>
        <!-- Повторить для каждого шага -->
    </div>
</div>
```

---

## Layout: mck_comparison

Сравнительная таблица / матрица.

```html
<div style="width:1280px;height:720px;background:[bg];padding:48px 64px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="background:[accent];padding:14px 24px;margin-bottom:28px;">
        <h2 style="font-family:'[b_font]',sans-serif;font-size:20px;font-weight:700;
                   color:#FFFFFF;margin:0;">
            {{action_title}}
        </h2>
    </div>
    <div style="flex:1;display:flex;gap:24px;">
        <div style="flex:1;border:2px solid [accent];padding:24px;">
            <h3 style="font-family:'[b_font]',sans-serif;font-size:18px;
                       font-weight:700;color:[accent];margin:0 0 16px 0;
                       padding-bottom:12px;border-bottom:1px solid #E0E0E0;">
                {{option_1_title}}
            </h3>
            <p style="font-family:'[b_font]',sans-serif;font-size:15px;
                      color:[text];margin:0;line-height:1.5;">
                {{option_1_content}}
            </p>
        </div>
        <div style="flex:1;border:2px solid [accent2];padding:24px;">
            <h3 style="font-family:'[b_font]',sans-serif;font-size:18px;
                       font-weight:700;color:[accent2];margin:0 0 16px 0;
                       padding-bottom:12px;border-bottom:1px solid #E0E0E0;">
                {{option_2_title}}
            </h3>
            <p style="font-family:'[b_font]',sans-serif;font-size:15px;
                      color:[text];margin:0;line-height:1.5;">
                {{option_2_content}}
            </p>
        </div>
    </div>
</div>
```

---

## Layout: mck_data_table

Плотная таблица данных с action title.

```html
<div style="width:1280px;height:720px;background:[bg];padding:48px 64px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="background:[accent];padding:14px 24px;margin-bottom:24px;">
        <h2 style="font-family:'[b_font]',sans-serif;font-size:20px;font-weight:700;
                   color:#FFFFFF;margin:0;">
            {{action_title}}
        </h2>
    </div>
    <div style="flex:1;overflow:auto;">
        <table style="width:100%;border-collapse:collapse;
                      font-family:'[b_font]',sans-serif;font-size:14px;">
            <thead>
                <tr>
                    <th style="padding:10px 14px;text-align:left;font-weight:700;
                               color:[text];border-bottom:2px solid [accent];
                               font-size:13px;text-transform:uppercase;
                               letter-spacing:0.03em;">
                        {{header_1}}
                    </th>
                    <!-- Повторить для каждого столбца -->
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding:8px 14px;color:[text];
                               border-bottom:1px solid #E8E8E8;">
                        {{cell_1_1}}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <div style="font-family:'[b_font]',sans-serif;font-size:11px;color:[text2];
                margin-top:8px;">
        Source: {{source}}
    </div>
</div>
```

---

## Layout: mck_chart

График с action title и источником.

```html
<div style="width:1280px;height:720px;background:[bg];padding:48px 64px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="background:[accent];padding:14px 24px;margin-bottom:24px;">
        <h2 style="font-family:'[b_font]',sans-serif;font-size:20px;font-weight:700;
                   color:#FFFFFF;margin:0;">
            {{action_title}}
        </h2>
    </div>
    <div style="flex:1;background:[surface];padding:24px;
                display:flex;align-items:center;justify-content:center;">
        <!-- Chart placeholder -->
        <p style="font-family:'[b_font]',sans-serif;font-size:16px;color:[text2];">
            {{chart_description}}
        </p>
    </div>
    <div style="font-family:'[b_font]',sans-serif;font-size:11px;color:[text2];
                margin-top:8px;">
        Source: {{source}}
    </div>
</div>
```

---

## Layout: mck_cta

Финальный слайд — рекомендация / next steps.

```html
<div style="width:1280px;height:720px;background:[bg];padding:48px 64px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="background:[accent];padding:14px 24px;margin-bottom:32px;">
        <h2 style="font-family:'[b_font]',sans-serif;font-size:20px;font-weight:700;
                   color:#FFFFFF;margin:0;">
            Recommendation
        </h2>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <h1 style="font-family:'[h_font]',serif;font-size:36px;font-weight:700;
                   color:[text];margin:0 0 20px 0;line-height:1.3;">
            {{closing_title}}
        </h1>
        <p style="font-family:'[b_font]',sans-serif;font-size:18px;
                  color:[text2];margin:0 0 32px 0;line-height:1.5;max-width:800px;">
            {{closing_subtitle}}
        </p>
        <div style="display:flex;gap:16px;">
            <div style="background:[accent];color:#FFFFFF;padding:12px 24px;
                        font-family:'[b_font]',sans-serif;font-size:15px;
                        font-weight:700;">
                {{next_step_1}}
            </div>
            <div style="background:[surface];color:[text];padding:12px 24px;
                        font-family:'[b_font]',sans-serif;font-size:15px;
                        font-weight:700;border:1px solid #E0E0E0;">
                {{next_step_2}}
            </div>
        </div>
    </div>
    <div style="font-family:'[b_font]',sans-serif;font-size:12px;color:[text2];
                border-top:1px solid #E0E0E0;padding-top:12px;">
        {{confidentiality}}
    </div>
</div>
```
