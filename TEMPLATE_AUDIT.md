# Template Overflow Audit — All 27 Layouts

Slide dimensions: **1280 x 720px**
Footer height: **32px** → usable height: **688px**

## Audit Criteria
1. **Title font size** — can long titles overflow?
2. **Content overflow** — does content exceed slide bounds with max items?
3. **Text truncation** — are ellipsis/clamp mechanisms in place?
4. **Dynamic grid** — does grid adapt to item count?
5. **Padding** — does padding leave enough room for content?
6. **Vertical centering** — does flex layout handle overflow gracefully?

---

## ORIGINAL 18 LAYOUTS

### 1. title-slide ✅ OK (minor)
- Title: 48px, no clamp → **RISK** with very long titles
- Padding: 48px top, 32px bottom = 80px vertical
- Two-panel flex layout, content centered
- **Issue**: No text-overflow on title (48px font, could be 2+ lines)

### 2. section-header ✅ OK (minor)
- Title: 60px, no clamp → **RISK** with long titles
- Centered layout, max-width: 900px
- **Issue**: No text-overflow on title

### 3. text-slide ⚠️ NEEDS FIX
- Title: 42px, no clamp → **RISK**
- Bullets: no limit on count, gap 14px
- Each bullet has title (17px) + description (15px) = ~50px per bullet
- With 5 bullets: ~250px + title area (~80px) + padding (88px) = ~418px ✅
- With 8 bullets: ~400px + 80 + 88 = ~568px ✅
- **Issue**: No overflow:hidden on bullet container, no line-clamp on descriptions

### 4. two-column ⚠️ NEEDS FIX
- Title: 42px centered, no clamp
- Bullets: 16px font, no limit on count
- Cards have no max-height or overflow control
- **Issue**: Many bullets can push content below slide

### 5. image-text ✅ OK
- Title: 36px (smaller than others)
- Bullets have title (16px) + description (14px)
- Two-panel layout limits content area

### 6. image-fullscreen ✅ OK
- Minimal text overlay, title 48px at bottom
- Subtitle has max-width: 672px

### 7. quote-slide ✅ OK
- Quote: 30px, max-width: 768px
- Centered layout, minimal content

### 8. chart-slide ✅ OK
- Title: 42px + optional description
- Chart area is flex:1 with max constraints

### 9. table-slide ⚠️ NEEDS FIX
- Title: 42px
- Table has no max-height or overflow control
- Many rows will push table below slide bounds
- **Issue**: No overflow:auto or max-height on table container

### 10. icons-numbers ✅ FIXED (previous sprint)
- Already has smart grid, line-clamp, reduced font sizes

### 11. timeline ⚠️ NEEDS FIX
- Title: 42px
- Events: gap 20px, each event ~60-80px
- With 6+ events: easily exceeds slide height
- **Issue**: No overflow control, no max items consideration

### 12. process-steps ⚠️ NEEDS FIX
- Title: 42px
- Steps use dynamic grid columns: `repeat(N, 1fr)`
- With 6+ steps: columns become very narrow, text overflows
- Step number circle: 56px, title: 18px, description: 13px
- **Issue**: No max columns, no text truncation on step titles/descriptions

### 13. comparison ✅ OK (minor)
- Title: 42px centered
- Two cards with bullets (16px)
- **Issue**: Many bullets can overflow cards (no max-height)

### 14. final-slide ✅ OK
- Centered layout, minimal content
- Title: 60px, subtitle: 20px

### 15. agenda-table-of-contents ⚠️ NEEDS FIX
- Title: 42px
- Sections: each ~64px (padding 14px + title 17px + description 14px)
- With 8 sections: ~512px + title area (~80px) + padding (88px) = ~680px ⚠️ tight
- With 10 sections: easily overflows
- **Issue**: No overflow control on sections container

### 16. team-profiles ⚠️ NEEDS FIX
- Title: 42px
- Grid columns = member count (dynamic)
- With 6+ members: columns very narrow
- Avatar: 80px, name: 16px, role: 13px, description: 12px
- **Issue**: No max columns, no text truncation, descriptions can overflow

### 17. logo-grid ✅ OK
- Fixed 4-column grid
- Each logo card: 200x120px fixed size

### 18. video-embed ✅ OK
- Fixed video container: 800x400px
- Minimal text content

---

## NEW 9 LAYOUTS (Sprint 3)

### 19. waterfall-chart ⚠️ NEEDS FIX
- Title: 42px + optional description (18px)
- Bars use dynamic flex columns
- With many bars: labels (12px) can overlap
- **Issue**: No max bar count, labels can overflow with long text

### 20. swot-analysis ⚠️ NEEDS FIX
- Title: 42px centered
- 2x2 grid with gap 16px
- Each quadrant: padding 24px, header ~46px, items with 14px font
- Available per quadrant: ~(688 - 80 - 24) / 2 - 46 = ~246px for items
- With 5+ items per quadrant: 5 * 30px = 150px ✅
- With 8+ items: 8 * 30px = 240px ⚠️ tight
- **Issue**: No overflow:hidden on quadrant item lists

### 21. funnel ✅ OK (minor)
- Title: 42px centered
- Stages stack vertically with gap 6px
- Each stage: min-height 52px
- With 6 stages: 6 * 58px = 348px + title area (~80px) + padding (88px) = ~516px ✅
- **Issue**: With 8+ stages and descriptions, could get tight

### 22. roadmap ⚠️ NEEDS FIX
- Title: 42px + optional description
- Milestones use dynamic grid columns
- With 6+ milestones: columns very narrow, text overflows
- Text: 15px title, 12px description, 12px date
- **Issue**: No max columns, no text truncation

### 23. pyramid ✅ OK (minor)
- Title: 42px centered
- Two-panel: pyramid visual + descriptions
- Levels stack vertically with gap 4px (left) and 12px (right)
- **Issue**: With many levels, descriptions can overflow

### 24. matrix-2x2 ✅ OK (minor)
- Title: 42px centered
- Fixed 2x2 grid with aspect-ratio: 1.4
- Quadrant items: 12px font
- **Issue**: Many items per quadrant can overflow

### 25. pros-cons ⚠️ NEEDS FIX
- Title: 42px centered
- Two cards with height: 100%
- Items: 15px font with 24px icon + gap 12px = ~30px per item
- Card padding: 24px, header: ~56px
- Available: ~(688 - 80 - 24) / 1 - 56 = ~528px (full height cards)
- **Issue**: Cards have `height: 100%` but no overflow control

### 26. checklist ⚠️ NEEDS FIX
- Title: 42px + optional description
- 2-column grid with gap 12px
- Each item: padding 14px, title 15px, description 13px = ~60px
- With 8 items (4 per column): 4 * 72px = 288px + title (~80px) + padding (88px) = ~456px ✅
- With 12 items: 6 * 72px = 432px + 168 = 600px ✅
- With 16 items: 8 * 72px = 576px + 168 = 744px ⚠️ OVERFLOW
- **Issue**: No max items or overflow control

### 27. highlight-stats ✅ OK
- Title: 42px
- Two-panel: main stat + supporting stats
- Main stat: fixed area with large number
- Supporting stats: cards stacked vertically

---

## SUMMARY OF FIXES NEEDED

| Template | Priority | Issues |
|----------|----------|--------|
| text-slide | Medium | Add line-clamp on descriptions, overflow:hidden on container |
| two-column | Medium | Add overflow:hidden on card content, line-clamp |
| table-slide | High | Add max-height + overflow:auto on table wrapper |
| timeline | High | Add overflow:hidden, reduce gap for many events |
| process-steps | High | Cap columns at 5, add text truncation |
| comparison | Medium | Add overflow:hidden on card content |
| agenda-table-of-contents | Medium | Add overflow:hidden, reduce item size for many sections |
| team-profiles | High | Cap columns at 5, add text truncation |
| waterfall-chart | Medium | Cap bars, add text truncation on labels |
| swot-analysis | Medium | Add overflow:hidden on item lists |
| roadmap | High | Cap milestones at 5, add text truncation |
| pros-cons | Medium | Add overflow:hidden on item lists |
| checklist | Medium | Add overflow:hidden on grid |
| title-slide | Low | Add line-clamp on title |
| section-header | Low | Add line-clamp on title |

### Common Patterns to Apply:
1. **Title overflow**: Add `-webkit-line-clamp: 2` + `text-overflow: ellipsis` on all titles ≥ 42px
2. **Container overflow**: Add `overflow: hidden` on flex-1 content areas
3. **Dynamic grids**: Cap max columns (e.g., 5 for process-steps, team-profiles, roadmap)
4. **List overflow**: Add `overflow: hidden` on scrollable lists
5. **Text truncation**: Add line-clamp on descriptions in dense layouts
