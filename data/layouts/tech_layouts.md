# Tech Layout Family — CSS Templates

> Семейство макетов `tech` для пресетов `tech_innovation`, `dark_mode_code`.
> 50-55% отступов, моноширинные акценты, градиенты, неоновые цвета.
> Размер слайда: 1280×720px (16:9).

## Общие правила

- Все стили — инлайновые (атрибут `style`).
- Цвета — HEX-коды из S3 `color_palette`.
- Шрифты — Google Fonts из S3 `typography`.
- Размер слайда: `width:1280px; height:720px`.
- Базовый отступ: `spacing_unit` из S3 (обычно 4px).
- **Принцип:** технологичность, тёмные фоны, яркие акценты, code-like элементы.

## Плейсхолдеры

| Плейсхолдер | Источник | Пример |
|:---|:---|:---|
| `[bg]` | `color_palette.background` | `#0A0E27` |
| `[text]` | `color_palette.text_primary` | `#FFFFFF` |
| `[text2]` | `color_palette.text_secondary` | `#A0AEC0` |
| `[accent]` | `color_palette.accent` | `#00D4FF` |
| `[accent2]` | `color_palette.accent_secondary` | `#7C3AED` |
| `[surface]` | `color_palette.surface` | `#151B3A` |
| `[h_font]` | `typography.font_family_heading` | `JetBrains Mono` |
| `[b_font]` | `typography.font_family_body` | `Inter` |

---

## Layout: tech_hero

Титульный слайд с акцентной линией и моноширинным подзаголовком.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;
            padding:80px;box-sizing:border-box;position:relative;">
    <div style="position:absolute;top:0;left:0;right:0;height:4px;
                background:linear-gradient(90deg,[accent],[accent2]);"></div>
    <h1 style="font-family:'[h_font]',monospace;font-size:52px;font-weight:700;
               color:[text];margin:0 0 20px 0;letter-spacing:-0.02em;
               line-height:1.15;">
        {{title}}
    </h1>
    <p style="font-family:'[b_font]',sans-serif;font-size:20px;
              color:[text2];margin:0;max-width:700px;line-height:1.6;">
        {{subtitle}}
    </p>
    <div style="display:flex;gap:8px;margin-top:40px;">
        <div style="width:40px;height:4px;background:[accent];border-radius:2px;"></div>
        <div style="width:20px;height:4px;background:[accent2];border-radius:2px;"></div>
        <div style="width:10px;height:4px;background:[text2];border-radius:2px;"></div>
    </div>
</div>
```

---

## Layout: tech_section

Разделитель секции с номером в моноширинном стиле.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;
            padding:80px;box-sizing:border-box;">
    <span style="font-family:'[h_font]',monospace;font-size:16px;
                 color:[accent];margin-bottom:16px;letter-spacing:0.1em;">
        // SECTION {{section_number}}
    </span>
    <h2 style="font-family:'[h_font]',monospace;font-size:48px;font-weight:700;
               color:[text];margin:0;letter-spacing:-0.02em;">
        {{section_title}}
    </h2>
    <div style="width:60px;height:3px;background:[accent];margin-top:24px;
                border-radius:2px;"></div>
</div>
```

---

## Layout: tech_key_point

Ключевое сообщение с акцентным фоном.

```html
<div style="width:1280px;height:720px;background:[surface];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:80px;box-sizing:border-box;position:relative;">
    <div style="position:absolute;top:0;left:0;right:0;height:3px;
                background:linear-gradient(90deg,[accent],[accent2]);"></div>
    <p style="font-family:'[h_font]',monospace;font-size:40px;font-weight:700;
              color:[text];text-align:center;margin:0;line-height:1.3;
              max-width:900px;">
        {{key_message}}
    </p>
    <span style="font-family:'[b_font]',sans-serif;font-size:16px;
                 color:[accent];margin-top:32px;">
        {{annotation}}
    </span>
</div>
```

---

## Layout: tech_bullets

Буллеты со стрелками и моноширинными маркерами.

```html
<div style="width:1280px;height:720px;background:[bg];padding:64px 80px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <h2 style="font-family:'[h_font]',monospace;font-size:36px;font-weight:700;
               color:[text];margin:0 0 40px 0;">
        {{title}}
    </h2>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <ul style="list-style:none;padding:0;margin:0;">
            <li style="font-family:'[b_font]',sans-serif;font-size:18px;color:[text];
                       padding:14px 0;padding-left:32px;position:relative;
                       line-height:1.5;border-left:2px solid [surface];">
                <span style="position:absolute;left:-1px;top:14px;width:8px;height:2px;
                             background:[accent];"></span>
                {{bullet_1}}
            </li>
            <!-- Повторить для каждого буллета -->
        </ul>
    </div>
    <div style="font-family:'[h_font]',monospace;font-size:12px;color:[text2];
                text-align:right;">{{slide_number}}</div>
</div>
```

---

## Layout: tech_process

Шаги процесса с code-like нумерацией.

```html
<div style="width:1280px;height:720px;background:[bg];padding:64px 80px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <h2 style="font-family:'[h_font]',monospace;font-size:36px;font-weight:700;
               color:[text];margin:0 0 48px 0;">
        {{title}}
    </h2>
    <div style="flex:1;display:flex;gap:32px;align-items:flex-start;">
        <div style="flex:1;background:[surface];border-radius:8px;padding:28px;
                    border-top:3px solid [accent];">
            <span style="font-family:'[h_font]',monospace;font-size:14px;
                         color:[accent];display:block;margin-bottom:12px;">
                step[0]
            </span>
            <h3 style="font-family:'[b_font]',sans-serif;font-size:20px;
                       font-weight:600;color:[text];margin:0 0 8px 0;">
                {{step_1_title}}
            </h3>
            <p style="font-family:'[b_font]',sans-serif;font-size:15px;
                      color:[text2];margin:0;line-height:1.5;">
                {{step_1_description}}
            </p>
        </div>
        <!-- Повторить для каждого шага -->
    </div>
</div>
```

---

## Layout: tech_chart

Слайд для графика/диаграммы с заголовком и аннотацией.

```html
<div style="width:1280px;height:720px;background:[bg];padding:64px 80px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;
                margin-bottom:32px;">
        <h2 style="font-family:'[h_font]',monospace;font-size:32px;font-weight:700;
                   color:[text];margin:0;">
            {{title}}
        </h2>
        <span style="font-family:'[h_font]',monospace;font-size:14px;color:[text2];">
            {{annotation}}
        </span>
    </div>
    <div style="flex:1;background:[surface];border-radius:8px;padding:32px;
                display:flex;align-items:center;justify-content:center;
                border:1px solid rgba(255,255,255,0.1);">
        <!-- Chart placeholder -->
        <p style="font-family:'[b_font]',sans-serif;font-size:16px;color:[text2];">
            {{chart_description}}
        </p>
    </div>
</div>
```

---

## Layout: tech_cta

Финальный слайд — CTA с gradient accent.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;
            padding:80px;box-sizing:border-box;position:relative;">
    <div style="position:absolute;bottom:0;left:0;right:0;height:4px;
                background:linear-gradient(90deg,[accent],[accent2]);"></div>
    <h1 style="font-family:'[h_font]',monospace;font-size:48px;font-weight:700;
               color:[text];margin:0 0 16px 0;">
        {{closing_title}}
    </h1>
    <p style="font-family:'[b_font]',sans-serif;font-size:20px;
              color:[text2];margin:0 0 48px 0;max-width:600px;">
        {{closing_subtitle}}
    </p>
    <div style="display:flex;gap:24px;align-items:center;">
        <span style="font-family:'[h_font]',monospace;font-size:15px;color:[accent];">
            {{email}}
        </span>
        <span style="color:[text2];">·</span>
        <span style="font-family:'[h_font]',monospace;font-size:15px;color:[text2];">
            {{website}}
        </span>
    </div>
</div>
```
