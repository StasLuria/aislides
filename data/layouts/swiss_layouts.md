# Swiss Layout Family — CSS Templates

> Семейство макетов `swiss` для пресетов `swiss_minimalist`, `scandinavian`, `neo_swiss`.
> 65-70% отступов, типографика как главный элемент, минимум декора.
> Размер слайда: 1280×720px (16:9).

## Общие правила

- Все стили — инлайновые (атрибут `style`).
- Цвета — HEX-коды из S3 `color_palette`.
- Шрифты — Google Fonts из S3 `typography`.
- Размер слайда: `width:1280px; height:720px`.
- Базовый отступ: `spacing_unit` из S3 (обычно 8px).
- Все размеры кратны `spacing_unit`.
- **Принцип:** максимум белого пространства, минимум элементов.

## Плейсхолдеры

| Плейсхолдер | Источник | Пример |
|:---|:---|:---|
| `[bg]` | `color_palette.background` | `#FFFFFF` |
| `[text]` | `color_palette.text_primary` | `#000000` |
| `[text2]` | `color_palette.text_secondary` | `#666666` |
| `[accent]` | `color_palette.accent` | `#FF0000` |
| `[accent2]` | `color_palette.accent_secondary` | `#333333` |
| `[surface]` | `color_palette.surface` | `#F5F5F5` |
| `[h_font]` | `typography.font_family_heading` | `Helvetica Neue` |
| `[b_font]` | `typography.font_family_body` | `Helvetica Neue` |

---

## Layout: swiss_hero

Титульный слайд. Крупный заголовок слева, минималистичная линия-акцент.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:flex-end;
            padding:80px;box-sizing:border-box;">
    <div style="width:64px;height:4px;background:[accent];margin-bottom:32px;"></div>
    <h1 style="font-family:'[h_font]',sans-serif;font-size:64px;font-weight:700;
               color:[text];margin:0 0 16px 0;letter-spacing:-0.03em;
               line-height:1.1;max-width:900px;">
        {{title}}
    </h1>
    <p style="font-family:'[b_font]',sans-serif;font-size:20px;font-weight:300;
              color:[text2];margin:0;max-width:600px;line-height:1.6;">
        {{subtitle}}
    </p>
</div>
```

---

## Layout: swiss_section

Разделитель секций. Номер секции + заголовок.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            align-items:flex-end;padding:80px;box-sizing:border-box;">
    <div>
        <span style="font-family:'[h_font]',sans-serif;font-size:120px;
                     font-weight:700;color:[surface];line-height:1;
                     display:block;margin-bottom:16px;">
            {{section_number}}
        </span>
        <h2 style="font-family:'[h_font]',sans-serif;font-size:48px;font-weight:700;
                   color:[text];margin:0;letter-spacing:-0.02em;">
            {{section_title}}
        </h2>
    </div>
</div>
```

---

## Layout: swiss_key_point

Одно ключевое сообщение крупным шрифтом на чистом фоне.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;
            padding:80px 120px;box-sizing:border-box;">
    <div style="width:48px;height:4px;background:[accent];margin-bottom:40px;"></div>
    <p style="font-family:'[h_font]',sans-serif;font-size:44px;font-weight:700;
              color:[text];margin:0;line-height:1.3;letter-spacing:-0.02em;
              max-width:900px;">
        {{key_message}}
    </p>
</div>
```

---

## Layout: swiss_bullets

Заголовок + буллеты с dash-стилем. Минимум декора.

```html
<div style="width:1280px;height:720px;background:[bg];padding:80px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <h2 style="font-family:'[h_font]',sans-serif;font-size:40px;font-weight:700;
               color:[text];margin:0 0 48px 0;letter-spacing:-0.02em;">
        {{title}}
    </h2>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <ul style="list-style:none;padding:0;margin:0;">
            <li style="font-family:'[b_font]',sans-serif;font-size:20px;font-weight:300;
                       color:[text];padding:14px 0;padding-left:32px;position:relative;
                       line-height:1.5;border-bottom:1px solid [surface];">
                <span style="position:absolute;left:0;color:[text2];font-weight:400;">—</span>
                {{bullet_1}}
            </li>
            <!-- Повторить для каждого буллета -->
        </ul>
    </div>
</div>
```

---

## Layout: swiss_process

Горизонтальные шаги процесса с нумерацией.

```html
<div style="width:1280px;height:720px;background:[bg];padding:80px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <h2 style="font-family:'[h_font]',sans-serif;font-size:36px;font-weight:700;
               color:[text];margin:0 0 56px 0;letter-spacing:-0.02em;">
        {{title}}
    </h2>
    <div style="flex:1;display:flex;gap:48px;align-items:flex-start;">
        <div style="flex:1;">
            <span style="font-family:'[h_font]',sans-serif;font-size:56px;
                         font-weight:700;color:[surface];display:block;
                         margin-bottom:16px;line-height:1;">01</span>
            <h3 style="font-family:'[h_font]',sans-serif;font-size:20px;
                       font-weight:700;color:[text];margin:0 0 8px 0;">
                {{step_1_title}}
            </h3>
            <p style="font-family:'[b_font]',sans-serif;font-size:16px;
                      font-weight:300;color:[text2];margin:0;line-height:1.5;">
                {{step_1_description}}
            </p>
        </div>
        <!-- Повторить для каждого шага -->
    </div>
</div>
```

---

## Layout: swiss_comparison

Две колонки для сравнения. Чистый grid без декоративных элементов.

```html
<div style="width:1280px;height:720px;background:[bg];padding:80px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <h2 style="font-family:'[h_font]',sans-serif;font-size:36px;font-weight:700;
               color:[text];margin:0 0 48px 0;letter-spacing:-0.02em;">
        {{title}}
    </h2>
    <div style="flex:1;display:flex;gap:64px;">
        <div style="flex:1;border-top:3px solid [accent];padding-top:24px;">
            <h3 style="font-family:'[h_font]',sans-serif;font-size:24px;
                       font-weight:700;color:[text];margin:0 0 16px 0;">
                {{column_1_title}}
            </h3>
            <p style="font-family:'[b_font]',sans-serif;font-size:18px;
                      font-weight:300;color:[text2];margin:0;line-height:1.6;">
                {{column_1_content}}
            </p>
        </div>
        <div style="flex:1;border-top:3px solid [text2];padding-top:24px;">
            <h3 style="font-family:'[h_font]',sans-serif;font-size:24px;
                       font-weight:700;color:[text];margin:0 0 16px 0;">
                {{column_2_title}}
            </h3>
            <p style="font-family:'[b_font]',sans-serif;font-size:18px;
                      font-weight:300;color:[text2];margin:0;line-height:1.6;">
                {{column_2_content}}
            </p>
        </div>
    </div>
</div>
```

---

## Layout: swiss_quote

Цитата — крупный текст, минимум оформления.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;
            padding:80px 120px;box-sizing:border-box;">
    <div style="width:48px;height:4px;background:[accent];margin-bottom:40px;"></div>
    <blockquote style="font-family:'[h_font]',sans-serif;font-size:36px;
                       font-weight:300;color:[text];margin:0;
                       line-height:1.4;max-width:900px;font-style:italic;">
        {{quote_text}}
    </blockquote>
    <p style="font-family:'[b_font]',sans-serif;font-size:16px;font-weight:400;
              color:[text2];margin-top:32px;">
        {{author}}
    </p>
</div>
```

---

## Layout: swiss_funnel

Воронка — вертикальные блоки с уменьшающейся шириной.

```html
<div style="width:1280px;height:720px;background:[bg];padding:80px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <h2 style="font-family:'[h_font]',sans-serif;font-size:36px;font-weight:700;
               color:[text];margin:0 0 48px 0;letter-spacing:-0.02em;">
        {{title}}
    </h2>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;
                align-items:center;gap:12px;">
        <div style="width:100%;max-width:900px;background:[surface];padding:20px 32px;
                    font-family:'[b_font]',sans-serif;font-size:18px;color:[text];
                    text-align:center;">
            {{stage_1}}
        </div>
        <div style="width:100%;max-width:720px;background:[surface];padding:20px 32px;
                    font-family:'[b_font]',sans-serif;font-size:18px;color:[text];
                    text-align:center;">
            {{stage_2}}
        </div>
        <div style="width:100%;max-width:540px;background:[accent];padding:20px 32px;
                    font-family:'[b_font]',sans-serif;font-size:18px;color:#FFFFFF;
                    text-align:center;font-weight:700;">
            {{stage_3}}
        </div>
    </div>
</div>
```

---

## Layout: swiss_timeline

Горизонтальная временная шкала с точками.

```html
<div style="width:1280px;height:720px;background:[bg];padding:80px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <h2 style="font-family:'[h_font]',sans-serif;font-size:36px;font-weight:700;
               color:[text];margin:0 0 56px 0;letter-spacing:-0.02em;">
        {{title}}
    </h2>
    <div style="flex:1;position:relative;display:flex;align-items:center;">
        <div style="position:absolute;top:50%;left:80px;right:80px;
                    height:2px;background:[surface];"></div>
        <div style="flex:1;display:flex;justify-content:space-between;
                    padding:0 40px;position:relative;">
            <div style="text-align:center;z-index:1;">
                <div style="width:16px;height:16px;background:[accent];
                            border-radius:50%;margin:0 auto 16px;"></div>
                <h3 style="font-family:'[h_font]',sans-serif;font-size:18px;
                           font-weight:700;color:[text];margin:0 0 4px 0;">
                    {{event_1_date}}
                </h3>
                <p style="font-family:'[b_font]',sans-serif;font-size:14px;
                          font-weight:300;color:[text2];margin:0;max-width:160px;">
                    {{event_1_description}}
                </p>
            </div>
            <!-- Повторить для каждого события -->
        </div>
    </div>
</div>
```

---

## Layout: swiss_cta

Финальный слайд — призыв к действию, минималистичный.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;
            padding:80px;box-sizing:border-box;">
    <div style="width:48px;height:4px;background:[accent];margin-bottom:32px;"></div>
    <h1 style="font-family:'[h_font]',sans-serif;font-size:52px;font-weight:700;
               color:[text];margin:0 0 16px 0;letter-spacing:-0.03em;">
        {{closing_title}}
    </h1>
    <p style="font-family:'[b_font]',sans-serif;font-size:20px;font-weight:300;
              color:[text2];margin:0 0 48px 0;max-width:600px;">
        {{closing_subtitle}}
    </p>
    <div style="display:flex;gap:24px;">
        <span style="font-family:'[b_font]',sans-serif;font-size:16px;
                     color:[text2];">{{email}}</span>
        <span style="color:[surface];">|</span>
        <span style="font-family:'[b_font]',sans-serif;font-size:16px;
                     color:[text2];">{{website}}</span>
    </div>
</div>
```
