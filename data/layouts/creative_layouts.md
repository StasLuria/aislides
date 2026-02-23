# Creative Layout Family — CSS Templates

> Семейство макетов `creative` для пресетов `playful_creative`, `illustration_storytelling`.
> 50-60% отступов, яркие цвета, скруглённые углы, emoji-буллеты.
> Размер слайда: 1280×720px (16:9).

## Общие правила

- Все стили — инлайновые (атрибут `style`).
- Цвета — HEX-коды из S3 `color_palette`.
- Шрифты — Google Fonts из S3 `typography`.
- Размер слайда: `width:1280px; height:720px`.
- Базовый отступ: `spacing_unit` из S3 (обычно 8px).
- **Принцип:** энергия, цвет, скруглённые формы, дружелюбность.

## Плейсхолдеры

| Плейсхолдер | Источник | Пример |
|:---|:---|:---|
| `[bg]` | `color_palette.background` | `#FFFBF0` |
| `[text]` | `color_palette.text_primary` | `#2D1B69` |
| `[text2]` | `color_palette.text_secondary` | `#6B5B95` |
| `[accent]` | `color_palette.accent` | `#FF6B35` |
| `[accent2]` | `color_palette.accent_secondary` | `#F7C948` |
| `[surface]` | `color_palette.surface` | `#FFF3E0` |
| `[h_font]` | `typography.font_family_heading` | `Poppins` |
| `[b_font]` | `typography.font_family_body` | `Nunito` |

---

## Layout: creative_hero

Титульный слайд — яркий, с крупным заголовком и декоративным кругом.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;
            padding:80px;box-sizing:border-box;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-60px;right:-60px;width:300px;height:300px;
                background:[accent2];border-radius:50%;opacity:0.15;"></div>
    <div style="position:absolute;bottom:-40px;left:-40px;width:200px;height:200px;
                background:[accent];border-radius:50%;opacity:0.1;"></div>
    <h1 style="font-family:'[h_font]',sans-serif;font-size:56px;font-weight:800;
               color:[text];margin:0 0 20px 0;line-height:1.15;
               max-width:800px;position:relative;">
        {{title}}
    </h1>
    <p style="font-family:'[b_font]',sans-serif;font-size:22px;
              color:[text2];margin:0;max-width:600px;line-height:1.6;
              position:relative;">
        {{subtitle}}
    </p>
    <div style="display:flex;gap:8px;margin-top:40px;position:relative;">
        <div style="width:12px;height:12px;background:[accent];border-radius:50%;"></div>
        <div style="width:12px;height:12px;background:[accent2];border-radius:50%;"></div>
        <div style="width:12px;height:12px;background:[text2];border-radius:50%;"></div>
    </div>
</div>
```

---

## Layout: creative_section

Разделитель секции — яркий фон, крупный текст.

```html
<div style="width:1280px;height:720px;background:[accent];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:80px;box-sizing:border-box;position:relative;overflow:hidden;">
    <div style="position:absolute;top:40px;right:40px;width:160px;height:160px;
                background:rgba(255,255,255,0.1);border-radius:50%;"></div>
    <h2 style="font-family:'[h_font]',sans-serif;font-size:52px;font-weight:800;
               color:#FFFFFF;margin:0;text-align:center;position:relative;">
        {{section_title}}
    </h2>
</div>
```

---

## Layout: creative_key_point

Ключевое сообщение в карточке с скруглёнными углами.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            justify-content:center;align-items:center;
            padding:80px;box-sizing:border-box;">
    <div style="background:[surface];border-radius:24px;padding:64px;
                max-width:800px;text-align:center;
                box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <div style="font-size:48px;margin-bottom:24px;">{{emoji}}</div>
        <p style="font-family:'[h_font]',sans-serif;font-size:36px;font-weight:800;
                  color:[text];margin:0;line-height:1.3;">
            {{key_message}}
        </p>
    </div>
</div>
```

---

## Layout: creative_bullets

Буллеты с emoji-маркерами и карточным стилем.

```html
<div style="width:1280px;height:720px;background:[bg];padding:64px 80px;
            box-sizing:border-box;display:flex;flex-direction:column;">
    <h2 style="font-family:'[h_font]',sans-serif;font-size:40px;font-weight:800;
               color:[text];margin:0 0 40px 0;">
        {{title}}
    </h2>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px;">
        <div style="background:[surface];border-radius:16px;padding:20px 28px;
                    display:flex;align-items:center;gap:16px;">
            <span style="font-size:28px;">{{emoji_1}}</span>
            <p style="font-family:'[b_font]',sans-serif;font-size:18px;
                      color:[text];margin:0;line-height:1.5;">
                {{bullet_1}}
            </p>
        </div>
        <!-- Повторить для каждого буллета -->
    </div>
</div>
```

---

## Layout: creative_image_text

Изображение + текст в карточном стиле.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            gap:40px;padding:64px 80px;box-sizing:border-box;align-items:center;">
    <div style="flex:1;background:[surface];border-radius:24px;height:100%;
                display:flex;align-items:center;justify-content:center;
                overflow:hidden;">
        <p style="font-family:'[b_font]',sans-serif;font-size:16px;color:[text2];">
            {{image_placeholder}}
        </p>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <h2 style="font-family:'[h_font]',sans-serif;font-size:36px;font-weight:800;
                   color:[text];margin:0 0 20px 0;">
            {{title}}
        </h2>
        <p style="font-family:'[b_font]',sans-serif;font-size:18px;
                  color:[text2];margin:0;line-height:1.7;">
            {{content}}
        </p>
    </div>
</div>
```

---

## Layout: creative_quote

Цитата в ярком стиле с декоративным элементом.

```html
<div style="width:1280px;height:720px;background:[surface];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:80px;box-sizing:border-box;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-20px;left:-20px;width:120px;height:120px;
                background:[accent];border-radius:50%;opacity:0.15;"></div>
    <div style="font-size:64px;margin-bottom:16px;">💬</div>
    <blockquote style="font-family:'[h_font]',sans-serif;font-size:32px;font-weight:700;
                       color:[text];text-align:center;margin:0;
                       max-width:800px;line-height:1.4;">
        {{quote_text}}
    </blockquote>
    <p style="font-family:'[b_font]',sans-serif;font-size:16px;
              color:[text2];margin-top:28px;">
        — {{author}}
    </p>
</div>
```

---

## Layout: creative_cta

Финальный слайд — яркий CTA с декоративными элементами.

```html
<div style="width:1280px;height:720px;background:[bg];display:flex;
            flex-direction:column;justify-content:center;align-items:center;
            padding:80px;box-sizing:border-box;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-40px;right:-40px;width:240px;height:240px;
                background:[accent2];border-radius:50%;opacity:0.12;"></div>
    <div style="font-size:56px;margin-bottom:24px;">🚀</div>
    <h1 style="font-family:'[h_font]',sans-serif;font-size:48px;font-weight:800;
               color:[text];margin:0 0 16px 0;text-align:center;">
        {{closing_title}}
    </h1>
    <p style="font-family:'[b_font]',sans-serif;font-size:20px;
              color:[text2];margin:0 0 40px 0;text-align:center;max-width:600px;">
        {{closing_subtitle}}
    </p>
    <div style="background:[accent];border-radius:12px;padding:16px 40px;">
        <span style="font-family:'[h_font]',sans-serif;font-size:18px;
                     font-weight:700;color:#FFFFFF;">
            {{cta_text}}
        </span>
    </div>
</div>
```
