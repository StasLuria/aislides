# Luxury Layout Family — CSS Templates

> Семейство макетов `luxury` для пресетов `elegant_premium`, `luxury_cinematic`.
> 65-70% отступов, утончённая типографика, serif-шрифты, золотые акценты.
> Размер слайда: 1280×720px (16:9).

## Общие правила

- Все стили — инлайновые (атрибут `style`).
- Цвета — HEX-коды из S3 `color_palette`.
- Шрифты — Google Fonts из S3 `typography`.
- Размер слайда: `width:1280px; height:720px`.
- Базовый отступ: `spacing_unit` из S3 (обычно 8px).
- **Принцип:** элегантность, сдержанность, безупречная типографика, минимум буллетов.

## Плейсхолдеры

| Плейсхолдер | Источник | Пример |
|:---|:---|:---|
| `[bg]` | `color_palette.background` | `#0A0A0A` |
| `[text]` | `color_palette.text_primary` | `#FAFAFA` |
| `[text2]` | `color_palette.text_secondary` | `#B8B8B8` |
| `[accent]` | `color_palette.accent` | `#D4AF37` |
| `[accent2]` | `color_palette.accent_secondary` | `#8B7355` |
| `[surface]` | `color_palette.surface` | `#1A1A1A` |
| `[h_font]` | `typography.font_family_heading` | `Playfair Display` |
| `[b_font]` | `typography.font_family_body` | `Lato` |

---

## Layout: luxury_hero

Титульный слайд — крупный serif-заголовок по центру с тонкой линией.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:100px;box-sizing:border-box;">
    <div style="width:1px;height:60px;background:[accent];margin-bottom:40px;"></div>
    <h1 style="font-family:'[h_font]',serif;font-size:56px;font-weight:700;
               color:[text];margin:0 0 20px 0;text-align:center;
               letter-spacing:0.02em;line-height:1.2;">
        {{title}}
    </h1>
    <p style="font-family:'[b_font]',sans-serif;font-size:18px;font-weight:300;
              color:[text2];margin:0;text-align:center;max-width:600px;
              letter-spacing:0.05em;text-transform:uppercase;line-height:1.8;">
        {{subtitle}}
    </p>
    <div style="width:1px;height:60px;background:[accent];margin-top:40px;"></div>
</div>
```

---

## Layout: luxury_section

Разделитель секции — элегантный, с тонкими линиями.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:100px;box-sizing:border-box;">
    <div style="display:flex;align-items:center;gap:24px;margin-bottom:32px;">
        <div style="width:60px;height:1px;background:[accent];"></div>
        <span style="font-family:'[b_font]',sans-serif;font-size:14px;
                     color:[accent];letter-spacing:0.15em;text-transform:uppercase;">
            {{section_label}}
        </span>
        <div style="width:60px;height:1px;background:[accent];"></div>
    </div>
    <h2 style="font-family:'[h_font]',serif;font-size:48px;font-weight:700;
               color:[text];margin:0;text-align:center;letter-spacing:0.01em;">
        {{section_title}}
    </h2>
</div>
```

---

## Layout: luxury_key_point

Ключевое сообщение — крупный serif-текст с акцентной линией.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;
            padding:100px 140px;box-sizing:border-box;">
    <div style="width:40px;height:1px;background:[accent];margin-bottom:40px;"></div>
    <p style="font-family:'[h_font]',serif;font-size:42px;font-weight:400;
              color:[text];margin:0;line-height:1.4;font-style:italic;
              max-width:800px;">
        {{key_message}}
    </p>
    <div style="width:40px;height:1px;background:[accent];margin-top:40px;"></div>
</div>
```

---

## Layout: luxury_quote

Цитата — элегантная, с serif-шрифтом и тонким оформлением.

```html
<div style="width:1280px;height:720px;background:[surface];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:100px;box-sizing:border-box;">
    <div style="font-family:'[h_font]',serif;font-size:72px;color:[accent];
                line-height:1;margin-bottom:16px;">
        &ldquo;
    </div>
    <blockquote style="font-family:'[h_font]',serif;font-size:34px;font-weight:400;
                       color:[text];text-align:center;margin:0;
                       max-width:800px;line-height:1.5;font-style:italic;">
        {{quote_text}}
    </blockquote>
    <div style="display:flex;align-items:center;gap:16px;margin-top:40px;">
        <div style="width:40px;height:1px;background:[accent];"></div>
        <p style="font-family:'[b_font]',sans-serif;font-size:14px;font-weight:300;
                  color:[text2];margin:0;letter-spacing:0.1em;text-transform:uppercase;">
            {{author}}
        </p>
        <div style="width:40px;height:1px;background:[accent];"></div>
    </div>
</div>
```

---

## Layout: luxury_image_text

Изображение слева, текст справа. Для визуальных историй.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            box-sizing:border-box;">
    <div style="flex:1;background:[surface];display:flex;align-items:center;
                justify-content:center;">
        <p style="font-family:'[b_font]',sans-serif;font-size:14px;
                  color:[text2];text-transform:uppercase;letter-spacing:0.1em;">
            {{image_placeholder}}
        </p>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;
                padding:80px;box-sizing:border-box;">
        <div style="width:40px;height:1px;background:[accent];margin-bottom:32px;"></div>
        <h2 style="font-family:'[h_font]',serif;font-size:36px;font-weight:700;
                   color:[text];margin:0 0 20px 0;letter-spacing:0.01em;">
            {{title}}
        </h2>
        <p style="font-family:'[b_font]',sans-serif;font-size:18px;font-weight:300;
                  color:[text2];margin:0;line-height:1.7;">
            {{content}}
        </p>
    </div>
</div>
```

---

## Layout: luxury_cta

Финальный слайд — элегантный CTA.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:100px;box-sizing:border-box;">
    <div style="width:1px;height:48px;background:[accent];margin-bottom:40px;"></div>
    <h1 style="font-family:'[h_font]',serif;font-size:48px;font-weight:700;
               color:[text];margin:0 0 16px 0;text-align:center;
               letter-spacing:0.02em;">
        {{closing_title}}
    </h1>
    <p style="font-family:'[b_font]',sans-serif;font-size:16px;font-weight:300;
              color:[text2];margin:0 0 48px 0;text-align:center;
              letter-spacing:0.05em;text-transform:uppercase;">
        {{closing_subtitle}}
    </p>
    <div style="display:flex;gap:32px;align-items:center;">
        <span style="font-family:'[b_font]',sans-serif;font-size:14px;
                     color:[accent];letter-spacing:0.05em;">{{email}}</span>
        <div style="width:1px;height:16px;background:[text2];"></div>
        <span style="font-family:'[b_font]',sans-serif;font-size:14px;
                     color:[text2];letter-spacing:0.05em;">{{website}}</span>
    </div>
</div>
```
