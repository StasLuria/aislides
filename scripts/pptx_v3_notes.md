# PPTX Export V3 - Visual Inspection Notes

## Fixed Issues:
- Slide 8 (financial-formula): "СЕБЕСТОИМОСТЬ" now fits on one line — FIXED
- Slide 4 (section-header): Title still wraps "Детальный Анализ: Достижения по Ключевым" — section-header uses different title function, needs separate fix
- Slide 6 (image-text): Title still truncated "Продукт и Разработка: Инновации и" — same issue

## Slide 9 verdict-analysis: FIXED
- HIGH severity: RED dot + RED "HIGH" label — CORRECT
- MEDIUM severity: AMBER/ORANGE dot + AMBER "MEDIUM" label — CORRECT
- Verdict details: now uses bullet separator instead of comma-separated ALL CAPS — IMPROVED

## Remaining minor issues:
- Slide 4 section-header: title wraps (uses addSectionHeader, not addTitle) — needs shrinkText
- Slide 6 image-text: title truncated — needs shrinkText in addImageText
