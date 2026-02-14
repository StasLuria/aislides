# PPTX Export Issues Found

## Slide 1 (title-slide): OK
- Blue background, white text, title + description + date
- Looks decent but basic

## Slide 2 (highlight-stats): BROKEN
- Only title "Выручка 850M ₽, NPS 72, но отток 4.2%" is shown
- mainStat and supportingStats are NOT rendered
- The slide is almost empty — just title + slide number
- Root cause: highlight-stats maps to addStatsSlide which expects `data.metrics[]` array
  but highlight-stats uses `data.mainStat` + `data.supportingStats` — different structure!

## Slide 3 (stats-chart): BROKEN  
- Chart renders as a plain table fallback (Q1 2025: 680, Q2: 730, etc.)
- No actual chart visualization — the chartData likely failed to render as PptxGenJS chart
- The SVG chart (chartSvg) is completely ignored
- Root cause: stats-chart maps to addChartSlide, but the chart rendering probably fails

## Slide 4 (section-header): OK
- Blue background, white text, title + subtitle

## Slide 5 (icons-numbers): PARTIALLY WORKING
- Stats values (340, 1500 ₽, 8%) render correctly with labels
- BUT: descriptions contain raw markdown (**13%**, **300**) — not stripped
- Raw ** markers visible in text

## Key Issues Summary:
1. **highlight-stats layout not handled** — maps to addStatsSlide but data structure mismatch
2. **Charts render as table fallback** — SVG charts (chartSvg) are completely ignored
3. **Markdown not stripped** — raw **bold** markers appear in descriptions
4. **Many layouts fall to generic** — comparison-table, financial-formula, verdict-analysis, card-grid are not handled
5. **No background images** — slides with backgroundImage data are plain white
6. **No gradient backgrounds** — only solid colors
7. **Slide number position wrong** — y: 4.9 on LAYOUT_WIDE (7.5" tall) should be ~6.9
8. **No decorative elements** — no shapes, lines, accent bars that make slides look professional

## Slide 6 (image-text): OK-ish
- Image loads correctly (left side), bullets on right
- But bullet descriptions are missing — only titles shown
- Title truncated "Продукт и Разработка: Инновации и"

## Slide 7 (comparison-table): BROKEN → falls to generic
- Only title + description text shown as paragraph
- The actual comparison table (columns, features, headers) is completely lost
- Layout "comparison-table" not in switch → addGenericSlide

## Slide 8 (financial-formula): BROKEN → falls to generic
- Only title "EBITDA 18% при выручке 850M ₽" shown
- Formula components (formulaParts, components) completely lost
- Layout "financial-formula" not in switch → addGenericSlide

## Slide 9 (verdict-analysis): BROKEN → falls to generic
- Only title shown, all verdict data lost
- criteria[], verdictText, verdictDetails — all missing
- Layout "verdict-analysis" not in switch → addGenericSlide

## Slide 10 (card-grid): BROKEN → falls to generic
- Only title + truncated description shown
- cards[] array completely lost
- Layout "card-grid" not in switch → addGenericSlide

## Slide 11 (highlight-stats): BROKEN (same as slide 2)
- Only title, mainStat/supportingStats not rendered

## Slide 12 (final-slide): OK
- Blue background, thank you text

## CRITICAL ISSUES RANKED:
1. Many layouts fall to generic (comparison-table, financial-formula, verdict-analysis, card-grid) — EMPTY slides
2. highlight-stats data structure mismatch — mainStat/supportingStats ignored
3. Charts render as table fallback instead of actual charts
4. Markdown **bold** markers not stripped
5. Slide number positioned at y:4.9 but LAYOUT_WIDE is 7.5" tall → should be ~6.9
6. No accent bars, shapes, or decorative elements
