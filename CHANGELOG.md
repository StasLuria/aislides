# CHANGELOG

> Auto-generated from `todo.md` by `pnpm changelog`
> Last updated: 2026-02-16

## Summary

| Metric | Value |
|---|---|
| Total sections | 134 |
| Total tasks | 1256 |
| Completed | 1244 (99%) |
| Pending | 12 |

---

## Detailed Changelog

### 🚀 Round 49: Research-First Pipeline Refactoring ✅

- [x] Refactor pipeline order: Research → Analysis → Planner → Outline → Critic → Writer
- [x] Update prompts.ts: inject analysis_context into Master Planner, Outline, Writer prompts
- [x] Update outlineCritic.ts: add research coverage validation + accept AnalysisResult
- [x] Update storytellingAgent.ts: accept AnalysisResult, use narrative arc from analysis
- [x] Refactor generator.ts: move Research+Analysis before Planner, pass context downstream
- [x] Update runPlanner to accept analysisContext parameter
- [x] Update runOutline to accept analysisContext parameter
- [x] Update runWriterSingle/runWriterParallel to accept analysisHighlights
- [x] Verify TypeScript compilation (0 errors)
- [x] Run tests and fix failures (1567/1567 passed, fixed devtools test: 18→19 steps, 58→64 endpoints)
- [x] Save checkpoint

### 🚀 Round 48: Annotation Highlights, Apply Changes, Slide Quoting ✅

- [x] Feature 1: Highlight annotated text fragments in messages with colored background and tooltip on hover
- [x] Feature 2: "Apply Changes" button — when AI suggests edits to a quoted fragment, show button to auto-apply
- [x] Feature 3: Quote specific slide — ability to quote a slide thumbnail for design corrections
- [x] Frontend: Parse annotations and wrap matching text in highlighted spans with tooltip
- [x] Frontend: Detect AI response patterns with suggested edits and show "Apply" button
- [x] Frontend: Add "Quote slide" button on slide preview thumbnails
- [x] Backend: Slide quote context injection into AI prompt (similar to text quote)
- [x] Write tests (15 tests passed)
- [x] Browser test (all features confirmed)
- [x] Save checkpoint

### 🚀 Round 47: Quote Context in AI Prompts ✅

- [x] Feature: Pass quote context to AI model when user sends message with a quote
- [x] Feature: Pass annotation context to AI model when user references an annotation
- [x] Frontend: Include quote data in the message payload sent to backend
- [x] Backend: Inject quote context into the AI prompt so model understands the reference
- [x] Backend: Format quote as clear instruction (e.g., "User is referencing this fragment: «...» and asks: ...")
- [x] Write tests (11 tests passed)
- [x] Browser test
- [x] Save checkpoint

### 🚀 Round 46: Quote-Reply + Inline Annotations ✅

- [x] Feature 1: Quote-reply — select text in message, popup with "Цитировать" button, quote inserted into input field as context
- [x] Feature 2: Inline annotations — select text in message, popup with "Аннотация" button, leave a note attached to that fragment
- [x] Backend: Store annotations in message data (annotations field with text range, note, id)
- [x] Backend: API endpoints for adding/deleting annotations
- [x] Frontend: Text selection detection in message bubbles
- [x] Frontend: Selection popup with "Цитировать" and "Аннотация" options
- [x] Frontend: Quote block in input area with selected text and close button
- [x] Frontend: Highlighted annotated text in messages with tooltip/popover for annotation notes
- [x] Frontend: Annotation input dialog
- [x] Write vitest tests
- [x] Browser test all features
- [x] Save checkpoint

### 🚀 Round 45: Comments on Messages + Comments on Slides + Copy Any Message ✅

- [x] Feature 1: Comments on chat messages — button on hover, inline comment input, comments displayed under message
- [x] Feature 2: Comments on slide previews — comment button on slide thumbnails, comment displayed under slide
- [x] Feature 3: Copy any message — verify copy button works for all message types (user, AI, system)
- [x] Backend: Add comments storage to chat messages (messageComments in session JSON or separate structure)
- [x] Backend: API endpoints for adding/deleting comments on messages
- [x] Backend: API endpoints for adding/deleting comments on slides
- [x] Frontend: Comment button on hover for message bubbles
- [x] Frontend: Inline comment input form (appears on click)
- [x] Frontend: Display comments under messages with timestamp and delete option
- [x] Frontend: Comment button on slide preview thumbnails
- [x] Frontend: Slide comment input and display
- [x] Frontend: Verify copy button works for all message types
- [x] Write vitest tests for comment endpoints
- [x] Browser test all features
- [x] Save checkpoint

### 🚀 Round 44: Fix User Chat Bubble Text Color ✅

- [x] Fix black text on blue background in user chat bubbles — removed text-foreground from StreamingText component, now inherits text-primary-foreground (white) from parent bubble
- [x] Browser verified: long user message "С вебсаммит из заметок..." now shows white text on blue background
- [x] Save checkpoint

### 🚀 Round 43: Persist Slide Previews + Theme Preview + PPTX Export Verification ✅

- [x] Investigate: chat history loads messages from DB JSON, slidePreview (singular) existed but not slidePreviews (array)
- [x] Investigate: PPTX export uses p.themeCss from DB — already correct after theme change
- [x] DB: Added slidePreviews?: {html:string, index:number}[] to ChatMessage interface (stored in JSON, no migration needed)
- [x] Backend: Save slide preview HTML fragments in batch mode completion message (chatOrchestrator)
- [x] Backend: Save slide preview HTML fragments in step-by-step finalization message
- [x] Frontend: Persisted slidePreviews auto-loaded via existing message mapping — SlidePreviewsGallery renders them
- [x] Frontend: Theme preview in Viewer — click theme shows preview of slide 0 with new CSS in iframe
- [x] Frontend: "Применить тему" button confirms and applies theme change to all slides
- [x] Verified: PPTX export uses p.themeCss which is updated by change-theme endpoint — no fix needed
- [x] PPTX export confirmed working (PDF export tested with 200 status after theme change)
- [x] Write vitest tests for preview-theme endpoint (6 tests)
- [x] Write vitest tests for change-theme endpoint (7 tests from Round 42)
- [x] Browser tested: theme preview, theme apply, slide rendering with new theme
- [x] All 1526 tests passing
- [x] Save checkpoint

### 🚀 Round 42: BSPB Theme Test + Post-Generation Theme Switching + Fullscreen Preview ✅

- [x] Test BSPB theme in quick mode via browser — verified white background, blue accents, БСПБ logo, no purple default
- [x] Backend: POST /api/v1/presentations/:id/change-theme — re-renders all slides with new theme CSS
- [x] Backend: Returns updated slide HTML + full presentation HTML after theme change
- [x] Frontend: Theme switcher popover in Viewer toolbar with all 12 themes + color swatches
- [x] Frontend: Apply new theme to all slide iframes after theme change (re-fetches full HTML)
- [x] Frontend: Fullscreen slide lightbox in chat (click thumbnail → fullscreen with dark overlay)
- [x] Frontend: Left/right navigation arrows in fullscreen modal
- [x] Frontend: Keyboard navigation (ArrowLeft/Right, Escape to close)
- [x] Frontend: Slide counter indicator ("3 / 15") + bottom thumbnail strip
- [x] Write vitest tests for theme change endpoint (7 tests)
- [x] Write vitest tests for renderSlidePreview with different themes (8 tests)
- [x] All 1519 tests passing
- [x] Save checkpoint

### 🚀 Round 41: Fix BSPB Theme Not Applied + Preview Overflow + Design Feedback ✅

- [x] Investigate why BSPB theme CSS is not applied to generated slides (purple/lavender instead of white)
- [x] Fix theme CSS injection: added renderSlidePreview() helper that wraps slide HTML with BASE_CSS + theme CSS
- [x] Fix batch mode: slide previews now wrapped with full theme CSS at completion
- [x] Fix step-by-step finalization: slide previews now wrapped with full theme CSS
- [x] Fix slide preview overflow (container uses explicit width/height with overflow:hidden)
- [x] Design feedback already works correctly (requires_recompose triggers full re-compose)
- [x] Write renderSlidePreview tests (8 new tests — 1506 total passing)
- [x] Update all test mocks to include renderSlidePreview
- [x] Save checkpoint

### 🚀 Round 40: Fix Title Slide Text Overflow ✅

- [x] Fix description text truncation on title slide (text cut off with "…")
- [x] Removed -webkit-line-clamp from title and description, reduced font sizes (title 38px, desc 14px)
- [x] Ensure title and description both fit within the blue panel
- [x] Save checkpoint

### 🚀 Round 39: Fix BSPB Theme (white bg, no circles) + Design Feedback Not Applied ✅

- [x] Fix BSPB theme CSS: remove decorative circles/blobs, use pure white background
- [x] Hide ALL inline decorative circles via CSS (div[style*="border-radius: 50%"] display:none)
- [x] Make card backgrounds pure white, remove all gradient/colored backgrounds
- [x] Fix design feedback: add requires_recompose flag to LLM prompt for visual/CSS changes
- [x] Improve feedback prompt to explicitly handle background, colors, circles requests
- [x] Write tests (4 new tests — 1498 total passing)
- [x] Save checkpoint

### 🚀 Round 38: Fix Interactive Mode Bugs (SQL error + repeated mode selection) ✅

- [x] Fix SQL error: topic column too short (varchar 512) → changed to text in schema + migration
- [x] Fix mode selection: processAction mode_step/mode_quick now directly call handleModeSelection (bypass processMessage)
- [x] Fix error handling: sanitize SQL errors, don't show raw DB errors to users
- [x] Fix handleTopicInput: update phase BEFORE streaming to prevent race condition
- [x] Add step_structure to processMessage switch statement
- [x] Fix retry_step/retry_quick to also bypass processMessage
- [x] Write tests for mode selection bug fixes (10 new tests — 1494 total passing)
- [x] Save checkpoint

### 🚀 Round 37: BSPB Title Slide from Original Presentation ✅

- [x] Extract/study the original BSPB title slide design (Kazan Cathedral photo, blue overlay, logo, red accent)
- [x] Upload the Kazan Cathedral building photo to S3 CDN
- [x] Update the title-slide template in BSPB theme to match original design
- [x] Test the new title slide in browser
- [x] Save checkpoint

### 🚀 Round 36: Advanced inline editor UX improvements ✅

- [x] Task 1: Drag-and-drop reordering of elements within slides (cards, bullet points, list items)
- [x] Task 1: Visual drag handles and drop indicators
- [x] Task 1: Update data model after reorder and re-render slide
- [x] Task 2: Format painter — copy style from one element and apply to another
- [x] Task 2: Visual indicator for "style copied" state
- [x] Task 2: Support copying font size, color, weight, alignment
- [x] Task 3: Debounced autosave — save changes automatically after typing stops (1.5s delay)
- [x] Task 3: Visual autosave indicator (saving... / saved)
- [x] Task 3: Remove blur-only save dependency, keep blur as immediate save trigger
- [x] Write tests for all three features (1482/1482 passed)
- [x] Test all features in browser
- [x] Save checkpoint

### 🚀 Round 35: Advanced inline editing improvements ✅

- [x] Task 1: Create test presentation with complex layouts (SWOT, funnel, roadmap, pyramid, matrix-2x2, pros-cons, checklist, kanban-board, org-chart, scenario-cards, vertical-timeline, comparison-table)
- [x] Task 1: Test inline editing on each complex layout — verify all fields are editable
- [x] Task 1: Fix any editing issues found on complex layouts
- [x] Task 2: Add table cell editing for risk-matrix layout (risk names, probability, impact columns)
- [x] Task 2: Test risk-matrix table cell editing in browser
- [x] Task 3: Implement Undo/Redo in inline editor (Ctrl+Z / Ctrl+Shift+Z)
- [x] Task 3: Test Undo/Redo in browser
- [x] Run all tests and save checkpoint (1462/1462 passed)

### 🚀 Round 34: Fix slide editing mode — text not editable on click ✅

- [x] Bug 1: Table/complex layout elements not editable in inline edit mode (e.g., slide 9 risk-matrix, table cells)
- [x] Bug 2: Bullet structure lost after editing — textContent flattens HTML list items into plain text (e.g., slide 3 image-text)
- [x] Investigate inlineFieldInjector.ts — how data-field attributes are injected and how findElement works
- [x] Fix findElement to handle table cells and complex nested layouts (added 18 missing layout cases + virtual selectors GENERIC_CARD_TITLE/DESC, MITIGATION_TITLE/DESC, etc.)
- [x] Fix text save mechanism to preserve HTML structure (innerText instead of textContent + \n→<br> in parseInlineMarkdown)
- [x] Fix critical syntax error: comment with \n in template literal broke entire inline edit script
- [x] Test editing in browser on multiple slide types (slide 3 image-text, slide 9 risk-matrix)
- [x] Run tests and save checkpoint (1436/1436 passed)

### 🚀 Round 33: Fix card/column blocks vertical centering on slides ✅

- [x] Fix two-column template: changed flex:1 stretch to auto-height centered
- [x] Fix icons-numbers template: replaced grid-template-rows:1fr with auto rows
- [x] Fix comparison template: added justify-content:center and align-items:start
- [x] Fix process-steps template: added centering wrapper
- [x] Fix pros-cons template: changed align-items:stretch to align-items:start
- [x] Fix card-grid template: replaced grid-auto-rows:1fr with flex centering wrapper
- [x] Visual test confirmed: cards now centered and sized to content
- [x] All 1436 tests passing

### 🚀 Round 32d: Full UI Flow Test ✅

- [x] Open app UI, start new chat
- [x] Enter banking topic "Стратегия развития розничного кредитования Банка Санкт-Петербург на 2026 год" and select fast mode
- [x] Monitor generation progress (5% → 81% → 95% → 100%, slide previews appeared during generation)
- [x] Preview generated slides in chat (14 thumbnails: 3 preview + 11 final)
- [x] Test full presentation view — inspected slides 1, 2, 5, 6, 11 in detail, all BSPB branded
- [x] Test export/download — PDF download confirmed ("PDF файл скачан" toast)
- [x] No issues found — full UI flow works correctly end-to-end

### 🚀 Round 32c: Visual Test of BSPB Theme ✅

- [x] Generate test presentation on banking topic via API (VrDg7Pfg9OyUGqfa, 11 slides, score 8.0/10)
- [x] Visually inspect all slides for BSPB branding — ALL PASS: logo top-right on every slide, red accent lines, red bottom stripe, blue headings, Arial font, charts use brand colors
- [x] No visual issues found — theme is production-ready

### 🚀 Round 32b: BSPB Logo Integration ✅

- [x] Upload BSPB logo PNG to S3 (CDN: SCJeOuRodLGBvIFn.png)
- [x] Update bspb_corporate theme CSS to use real logo URL
- [x] Verify logo renders correctly on slides
- [x] All 1436 tests passing

### 🚀 Round 32: BSPB Brand Template & Business Copywriter Skill ✅

- [x] Install business-copywriter skill into skills directory
- [x] Analyze BSPB brand template PPTX — extract colors, fonts, layouts, styles
- [x] Create bspb_corporate theme with brand colors (#0057AB blue, #E9243A red accent), Arial font, white backgrounds
- [x] Add BSPB logo (top-right), red accent line under headings, red bottom stripe to theme CSS
- [x] Register bspb_corporate in shared/themes.ts and server/pipeline/themes.ts with full CSS variables
- [x] Set bspb_corporate as default theme (weight 2.0 in themeSelector, fallback for ambiguous prompts)
- [x] Add BSPB-specific keywords to themeSelector (банк, бспб, финанс, кредит, проект, etc.)
- [x] Integrate business-copywriter skill into Writer agent prompt (full copywriting_style section with principles, frameworks PAS/BAB/FAB/4Ps, language rules, evidence handling, audience adaptation)
- [x] Integrate copywriting guidelines into Outline agent prompt (headline-as-conclusion, one-slide-one-thought)
- [x] Integrate copywriting guidelines into Storytelling agent prompt (no bureaucratic language, no foreign words, data-as-stories)
- [x] Fix 6 failing tests: update theme count 12→13, default fallback corporate_blue→bspb_corporate, fintech/banking arctic_frost→bspb_corporate
- [x] All 1436 tests passing, 0 TypeScript errors

### 🐛 Round 31: Bug fix — empty slide preview in step-by-step mode ✅

- [x] Root cause: slide_preview sent bare slideHtml without BASE_CSS or themeCss; section-header relies on CSS variables for colors/backgrounds
- [x] Fix: send previewHtml (from renderPresentation with full CSS+theme+fonts) instead of slideHtml in both generateSlideDesign and handleSlideDesignFeedback
- [x] Fix: SlidePreviewCard detects full HTML documents and renders directly with override styles (no dark bg, no padding)
- [x] All 1436 tests passing, 0 TypeScript errors

### 🐛 Round 30: Bug fixes — slide preview clipping + design feedback not working ✅

- [x] Fix slide preview in chat: iframe scaled at element level (1280x720 → transform scale) instead of inside content
- [x] Fix design feedback: LLM now receives current slideData, extracts data_patches, applies via deepMerge; layout changes re-compose with feedback hint
- [x] Added deepMerge helper and local llmText wrapper to chatOrchestrator
- [x] Added htmlComposerSystem/htmlComposerUser imports for feedback re-composition
- [x] All 1436 tests passing, 0 TypeScript errors

### 🚀 Round 29: Slide progress bar in chat UI ✅

- [x] Backend: Send slide_progress SSE event with currentSlide/totalSlides/phase data
- [x] Frontend: SlideProgressBar component — visual indicator "Слайд 3 из 10" with step dots/bar
- [x] Frontend: Integrate progress bar into ChatPage, show during step_slide_content and step_slide_design phases
- [x] Frontend: Show current phase label (Контент / Дизайн) alongside slide number
- [x] Write 3 vitest tests for slide_progress events (all passing)
- [x] All 1436 tests passing (3 new + 1433 existing), 0 TypeScript errors

### 🚀 Round 28: Implement true slide-by-slide step-by-step mode ✅

- [x] Analyze current handleStructureApproval — currently launches full generation instead of slide-by-slide
- [x] Add new session phases: step_slide_content, step_slide_design
- [x] After structure approval → propose content for slide 1 (not generate all slides)
- [x] Wait for user "готово" (approve_slide_content) before generating design for current slide
- [x] Wait for user "готово" (approve_slide_design) on design before moving to next slide
- [x] Support user corrections at each step (content via handleSlideContentFeedback, design via handleSlideDesignFeedback)
- [x] Support "готово + ещё слайд + описание" to add new slides mid-process (handleAddNewSlide)
- [x] Track currentSlideIndex in session metadata + pendingSlideIndex for resume after new slide
- [x] Generate HTML for each slide individually after design approval (generateSlideDesign)
- [x] Assemble final presentation after all slides approved (finalizeStepPresentation)
- [x] Write 7 vitest tests for slide-by-slide workflow (all passing)
- [x] All 1433 tests passing (7 new + 1426 existing), 0 TypeScript errors

### 🚀 Round 27: Fix card-grid layout — old presentations with broken grid CSS ✅

- [x] Root cause: old presentations generated with JS ternary (? :) in Nunjucks → `repeat(, 1fr)` invalid CSS → browser falls back to 1 column
- [x] Template already fixed in Round 25 — new presentations render correctly
- [x] Add client-side sanitizeSlideHtml() in Viewer.tsx — per-slide-container regex fix for `repeat(, 1fr)`
- [x] Add client-side sanitizeSlideHtml() in SharedViewer.tsx — same per-slide-container fix for shared links
- [x] Sanitization counts `.card` elements per slide-container to compute correct cols (min(cardCount, 3))
- [x] All 1426 tests passing, 0 regressions

### 🚀 Round 26: Image-based structure recognition from uploaded screenshots ✅

- [x] Analyze how image attachments are currently handled in chat/generation flow
- [x] Improve extractFromImage Vision LLM prompt to recognize presentation structure with [PRESENTATION_OUTLINE] marker
- [x] Add parseOutlineFromFiles function to chatOrchestrator — parses structured outline from extracted text
- [x] Fix startStepByStepGeneration — now passes file context to pipeline (was missing)
- [x] Fix handleStructureApproval — now passes file context to generatePresentation (was missing)
- [x] Add preBuiltOutline field to GenerationConfig — skips runOutline + runOutlineCritic when provided
- [x] Update generatePresentation to use preBuiltOutline when available
- [x] Support in both quick mode and step-by-step mode
- [x] Write 9 vitest tests for parseOutlineFromFiles (all passing)
- [x] All 1426 tests passing (9 new + 1417 existing), 0 TypeScript errors

### 🚀 Round 25: Fix card-grid layout issues ✅

- [x] Fix card-grid cards showing empty content — root cause: JS ternary (? :) not supported by Nunjucks, c_cols was empty
- [x] Fix card-grid card text overflow/clipping — restructured: icon+title+badge in header row, description below, auto-rows
- [x] Verify fix visually — both 4-card and 5-card layouts render correctly with 3-column grid
- [x] Run full test suite — 1417 tests passing, 0 regressions

### 🚀 Round 24: Fix PPTX Export Quality ✅

- [x] Review current PPTX export code — only 8 of 30+ layouts handled
- [x] Test export on a real presentation — 6/12 slides blank/broken
- [x] Document specific issues: empty slides, SVG charts ignored, markdown markers, wrong footer position
- [x] Full rewrite of pptxExport.ts with 30+ layout handlers
- [x] Added: highlight-stats, comparison-table, financial-formula, verdict-analysis, card-grid, image-text, SWOT, process-steps, icons-numbers, timeline, chart-text, agenda, quote-slide, section-header, final-slide
- [x] Fix: PptxGenJS shapes/charts are instance properties, not static
- [x] Fix: stripMd handles non-string inputs (numbers, objects)
- [x] Fix: icon objects (not emoji strings) handled properly
- [x] Fix: comparison-table handles empty headers with columns fallback
- [x] Fix: verdict severity dot colors (RED/AMBER/GREEN based on HIGH/MEDIUM/LOW)
- [x] Fix: title truncation — shrinkText + adaptive fontSize for all title functions
- [x] Fix: section-header adaptive font sizing for long titles
- [x] Fix: financial formula label word-wrap with smaller font + shrinkText
- [x] Native PptxGenJS charts for bar/line/pie/doughnut data
- [x] Images included via addImage with fallback placeholder
- [x] Text formatting, theme colors, backgrounds all preserved
- [x] Visual inspection: 12/12 slides rendering correctly (was 6/12)
- [x] All 1398 vitest tests passing, 0 regressions
- [x] Tested on Quarterly Review presentation (12 slides, all layouts)

### 🚀 Round 23: Fact-Checking in Final Review + Chart Label Fix ✅

- [x] Analyze current finalReview.ts to understand scoring flow
- [x] Create factChecker.ts: extract numbers, %, currencies, dates from prompt
- [x] normalizeNumber: handle рублей/млн/млрд/тыс/$€₽/M/B/K suffixes
- [x] extractFacts: 4 patterns (currency, percentage, standalone numbers, dates/quarters)
- [x] areFactsContradictory: compare same-unit facts, flag >3x ratio or >10pp % diff
- [x] contextOverlap: keyword-based similarity to match related metrics
- [x] Integrate fact-checker into pipeline Final Review step (generator.ts)
- [x] Apply penalty (0-3 points) to Final Review score for contradictions
- [x] Write vitest tests for fact-checking (16 tests in factChecker.test.ts)
- [x] Fix: strip trailing currency names (рублей, долларов) before parsing
- [x] Fix: skip bare numbers without units in currency extraction
- [x] Fix: don't compare unitless numbers to avoid false positives
- [x] SVG Bar chart: pre-calculate positions, detect overlap, place inside bar if tall enough
- [x] SVG Line chart: alternate above/below placement when labels overlap
- [x] SVG Pie/Donut chart: adaptive legend sizing, "+N more" truncation for many items
- [x] Chart.js chart-slide: add autoSkip, maxRotation 45°, autoSkipPadding, maxTicksLimit
- [x] Adaptive x-axis font size: 8px for >8 items, 9px for >6, 10px default
- [x] Adaptive x-axis label truncation: 10 chars for >8 items
- [x] Write vitest tests for chart label fixes (14 tests in svgChartEngine.labelOverlap.test.ts)
- [x] All 1398 tests passing, 0 regressions

### 🚀 Round 22: Comprehensive Quality Testing & Validation ✅

- [x] Test 1: Business Strategy — "Стратегия выхода на рынок Юго-Восточной Азии для SaaS-компании" (batch mode, 339s, 12 slides, 7.7/10)
- [x] Test 2: Product Pitch — "AI-ассистент для юристов: LexAI" (batch mode, 320s, 10 slides, 8.8/10)
- [x] Test 3: Investor Deck — "Series B: AI-платформа цепочек поставок" (batch mode, 344s, 12 slides, 7.8/10)
- [x] Test 4: Educational — "Основы машинного обучения" (batch mode, 369s, 12 slides, 7.3/10)
- [x] Test 5: Quarterly Review — "Итоги Q4 2025" (batch mode, 344s, 12 slides, 7.7/10)
- [x] Collect Design Critic scores for all 5 generations (avg 7.6/10 rule-based, 7.7/10 LLM)
- [x] Measure generation time for all 5 generations (avg 343s)
- [x] Count layout diversity per presentation (avg 89.6%)
- [x] Check content_shape diversity per presentation
- [x] Visual inspection of all generated slides (3 presentations inspected visually)
- [x] Check for text overflow, empty slides, broken charts (chart label overlap found, title truncation found)
- [x] Verify image generation quality (placeholder images used, topic-relevant images recommended)
- [x] Check footer rendering (slide numbers, title) — working correctly
- [x] Check transitions and navigation in Viewer — working correctly
- [x] Write QUALITY_REPORT.md with all metrics, screenshots, and findings
- [x] Compare with baseline metrics (Final Review avg 7.9/10 vs baseline 7.7/10 — improved)
- [x] List any bugs or quality issues found (1 bug fixed: row.slice TypeError, 3 visual issues documented)
- [x] Provide recommendations for further improvements (8 recommendations in 3 priority levels)

### 🚀 Round 21: Phase 4 Advanced Implementation ✅

- [x] Create server/pipeline/referenceLibrary.ts with 12 exemplar presentation structures
- [x] Covers all 5 presentation types (business_strategy, product_pitch, investor_deck, educational, quarterly_review)
- [x] Each reference: name, narrative_arc, keywords, slide_count, slides with role/title_pattern/content_shape/purpose
- [x] matchReference(prompt, type, slideCount) with keyword scoring + slide count matching
- [x] Integrate into pipeline: Planner → Type Classifier → Reference Match → Outline Agent
- [x] formatReferenceHint() injects reference structure into Outline Agent prompt
- [x] Write vitest tests for reference matching and structure (phase4.test.ts)
- [x] Integrate web search via Data API (Google search) into Research Agent
- [x] Generate 2-3 search queries per slide topic
- [x] Extract facts, statistics, and quotes from search results
- [x] LLM verification of search results before injection
- [x] Source citations added to slide content
- [x] Graceful fallback to LLM-only if web search unavailable
- [x] Write vitest tests for search integration (phase4.test.ts)
- [x] Create server/pipeline/finalReview.ts
- [x] Render sampled slides to PNG via Puppeteer (first, last, every 3rd)
- [x] Send screenshots to Vision LLM for holistic evaluation
- [x] 5-criteria scoring: narrative flow, visual consistency, content quality, pacing, professionalism
- [x] Executive summary generation with strengths, weaknesses, suggestions
- [x] Integrated into pipeline before assembly (step 7.5)
- [x] Write vitest tests for final review module (phase4.test.ts)
- [x] All 1347 tests passing (32 new tests)
- [x] Pipeline now 18-step (added Final Review)
- [x] Save checkpoint

### 🚀 Round 20: Phase 3 Visual Review + Composer Few-Shot ✅

- [x] Already implemented: 20+ structured_content_mapping examples in htmlComposerSystem
- [x] Covers all content_shapes: stat_cards, process_steps, timeline, comparison, etc.
- [x] Data format matches templateEngine.ts expectations exactly
- [x] Create layoutVoting.ts with top-3 candidates + confidence scoring
- [x] Add diversity penalty (repeat 0.15, adjacent 0.25, unused bonus 0.05)
- [x] Add mandatory layout overrides for specific content_shapes (kanban, org, swot)
- [x] Update LAYOUT_SYSTEM prompt to request top-3 candidates with confidence 0-1
- [x] Integrate into runLayout with legacy fallback on schema failure
- [x] Write vitest tests for voting and diversity (20 tests in phase3.test.ts)
- [x] Integrate existing runLlmDesignCritique into pipeline after local Design Critic
- [x] LLM evaluates visual rhythm, hierarchy, pacing, professional polish
- [x] Returns revised score + actionable suggestions
- [x] Graceful fallback if LLM critique fails
- [x] Write vitest tests for LLM critique integration
- [x] Create visualReviewer.ts with Puppeteer slide rendering (1280×720)
- [x] Send screenshots to Vision LLM for quality assessment
- [x] 4-criteria scoring: readability, balance, density, professionalism (threshold 6.0)
- [x] Iterative improvement: if score < 6, apply CSS fixes and re-render (max 2 iterations)
- [x] Sample strategy: review first, last, and every 3rd slide
- [x] Integrate into pipeline after Design Critic, before Assembly (step 6.5)
- [x] Write vitest tests for visual reviewer module structure
- [x] All 1315 tests passing (21 new tests)
- [x] Pipeline now 17-step (added Visual Reviewer)
- [x] Save checkpoint

### 🚀 Round 19: Phase 2 Evaluator-Optimizer Implementation ✅

- [x] Create contentEvaluator.ts with 4-criteria rubric (SPECIFICITY, DENSITY, NOVELTY, ACTIONABILITY)
- [x] Score each slide 1-5 per criterion, threshold ≥ 3.5 to pass (2.5 for structural slides)
- [x] Generate specific feedback for failing slides (not generic "improve it")
- [x] Add evaluator loop in pipeline: Writer → Evaluator → [pass/retry with feedback] (max 2 retries)
- [x] Evaluator feedback injected into Writer key_points for targeted rewrites
- [x] Write vitest tests for scoring, feedback, retry logic (33 tests in phase2.test.ts)
- [x] Modify runWriterParallel: key slides (title, first 2 content, conclusion, final) → sequential
- [x] Core slides → parallel batches of 3 with full key context
- [x] Key context includes all 5 narrative anchor slides for coherence
- [x] Core slides get rich context from all key slides (not just last 4)
- [x] Write vitest tests for execution order and context passing (33 tests in phase2.test.ts)

### 🚀 Round 18: Phase 1 Quick Wins Implementation ✅

- [x] Refactor qaAgent.ts: add 3 severity levels (full/content/quick) based on layout complexity
- [x] Full QA: for critical layouts (title, final, section-header, big-statement) — deep 5-criteria validation
- [x] Content QA: for data-heavy layouts (stats, charts, tables, etc.) — 4-criteria validation
- [x] Quick QA: for simple layouts (text, bullets, quotes, images) — 2-criteria fast check
- [x] Apply QA to ALL slides in pipeline (not just critical), with severity-appropriate checks
- [x] Add retry logic: 1 retry for full/content, 0 retries for quick (getQARetryBudget)
- [x] Write vitest tests for 3 severity levels
- [x] Add 5 few-shot examples to Writer system prompt (stat_cards, process_steps, comparison, timeline, bullet_points)
- [x] Examples cover key content shapes with Input/Output format
- [x] Write vitest tests verifying few-shot examples are included in prompt
- [x] Add content density validator (contentDensityValidator.ts): max 6 bullets, 6 stat_cards, 6 steps, etc.
- [x] Add auto-split logic: if >8 bullets, split into 2 slides with renumbering
- [x] Integrate density check into pipeline after Writer+Storytelling, before Layout
- [x] Write vitest tests for density validation and auto-split
- [x] Create presentationTypeClassifier.ts with 5 types + keyword-based classification
- [x] Add type-specific hints for Outline, Writer, and Layout agents (outlineHint, writerHint, layoutHint)
- [x] Integrate classification into main pipeline after Planner step
- [x] Write vitest tests for type classification
- [x] Add CoT instructions to LAYOUT_SYSTEM prompt (4-step reasoning: CONTENT TYPE → SHAPE HINT → VISUAL FIT → DIVERSITY)
- [x] Add content_shape → layout affinity rules (6 shape types mapped to preferred layouts)
- [x] Write vitest tests for CoT and affinity rules
- [x] Inject transition_phrase from Storytelling Agent into SlideContent
- [x] Update HTML Composer prompt + htmlComposerUser to use transition_phrase as subtitle/opening
- [x] Write vitest tests for transition injection

### 🚀 Round 17: Development Plan for Pipeline Quality Improvements ✅

- [x] Write comprehensive DEVELOPMENT_PLAN.md with 4 phases, 15 steps
- [x] Include file-level changes, acceptance criteria, and impact estimates for each step
- [x] Include summary table with LLM call counts and time estimates

### 🚀 Round 16: Pipeline Audit & Quality Improvement Report ✅

- [x] Research: Anthropic Building Effective Agents guide (Evaluator-Optimizer, Parallelization patterns)
- [x] Research: OpenAI Practical Guide to Building Agents (guardrails, structured outputs)
- [x] Research: PPTAgent paper (schema-driven generation, PPTEval metrics)
- [x] Research: PreGenie paper (visual review loop, two-level code+rendered review)
- [x] Research: LangChain Reflection Agents (Basic Reflection, Reflexion, LATS patterns)
- [x] Research: OpenAI Prompt Engineering Guide (few-shot, chain-of-thought, structured output)
- [x] Research: Reddit community insights (quality differentiators, user pain points)
- [x] Research: Presentation design principles (6x6 rule, visual hierarchy, whitespace)
- [x] Audit: Full pipeline flow analysis (15 agents, ~45 LLM calls, timing breakdown)
- [x] Audit: All agent prompts reviewed (prompts.ts, all agent files)
- [x] Audit: Identified 12 critical problems with severity levels
- [x] Report: PIPELINE_AUDIT_REPORT.md with 8 sections, 3 improvement levels, 4 implementation phases
- [x] Report: Detailed recommendations with code examples for each improvement
- [x] Report: Prioritized implementation plan (Quick Wins → Architecture → Advanced)
- [x] Report: Expected impact metrics (quality scores, time, cost projections)

### 🚀 Round 15: Analytics Export, Error Notifications, Theme A/B Metrics ✅

- [x] CSV export: REST endpoint GET /api/v1/analytics/export/csv with BOM for Excel
- [x] CSV export: download buttons (CSV, JSON, PDF/HTML) on Analytics dashboard header
- [x] PDF/HTML export: REST endpoint GET /api/v1/analytics/export/pdf (styled HTML report)
- [x] JSON export: REST endpoint GET /api/v1/analytics/export/json with structured data
- [x] Error notifications: notifyOwner() on batch generation failure (presentationRoutes.ts)
- [x] Error notifications: notifyOwner() on interactive assembly failure (interactiveRoutes.ts)
- [x] Error notifications: includes presentation ID, error message, stage, and timestamp
- [x] Theme A/B metrics: export_events DB table with format, themePreset, isShared fields
- [x] Theme A/B metrics: logExportEvent() called in all 4 export endpoints (PPTX/PDF x auth/shared)
- [x] Theme A/B metrics: getThemeQualityMetrics() with quality score (40% completion + 60% export rate)
- [x] Theme A/B metrics: tRPC procedures themeQuality + exportFormatDistribution
- [x] Theme A/B metrics: A/B quality table + export format donut chart on Analytics dashboard
- [x] Write vitest tests for all new features (16 new tests, 1203 total across 41 files)

### 🚀 Round 14: CI/CD, Analytics Dashboard, Postman Collection ✅

- [x] Pre-commit hook: install husky for git hooks
- [x] Pre-commit hook: configure `pnpm readme --skip-tests && pnpm changelog` on pre-commit
- [x] Pre-commit hook: auto-stage updated README.md and CHANGELOG.md
- [x] Postman collection: create export script from OpenAPI spec (9 folders, 54 endpoints)
- [x] Postman collection: add `pnpm postman` and `pnpm postman:dry` commands to package.json
- [x] Postman collection: include environment variables template (postman/environment.json)
- [x] Analytics dashboard: add 8 tRPC procedures (overview, dailyCounts, statusDistribution, themeDistribution, modeDistribution, slideCountDistribution, topPrompts, recentPresentations)
- [x] Analytics dashboard: query presentations by status, theme, mode, time period with date range filters
- [x] Analytics dashboard: calculate success rate, average slide count, total/completed/failed counts
- [x] Analytics dashboard: build frontend page with 7 chart panels (Recharts: area, donut, bar, progress bars, table)
- [x] Analytics dashboard: add /analytics route and navigation entry in AppLayout
- [x] Write vitest tests for all new features (35 tests across 7 describe blocks)

### 🚀 Round 13: Developer Tools — Auto-README, Swagger, CHANGELOG ✅

- [x] Auto-README script: collect metrics (tests, lines, endpoints, layouts, themes, agents) from codebase
- [x] Auto-README script: generate/update README.md sections with live data
- [x] Auto-README script: add `pnpm readme` command to package.json
- [x] Swagger/OpenAPI: install swagger-ui-express (no swagger-jsdoc — manual OpenAPI spec)
- [x] Swagger/OpenAPI: define full OpenAPI 3.0 spec for all 54 REST endpoints in server/swagger.ts
- [x] Swagger/OpenAPI: serve interactive docs at /api/docs
- [x] CHANGELOG.md: parse todo.md rounds into versioned changelog entries
- [x] CHANGELOG.md: auto-generate from todo.md structure
- [x] CHANGELOG.md: add `pnpm changelog` command to package.json
- [x] Write vitest tests for all three tools (18 tests)

### 🚀 Round 12: README Audit & Corrections ✅

- [x] Audit README.md against actual codebase for factual accuracy
- [x] Fix agent count: 10 → 15 (14 agents + Assembly) in all occurrences
- [x] Fix PPTX export layout count: 15+ → 28 supported slide types
- [x] Fix Nunjucks reference → Кастомный Jinja2-рендерер (no external dependency)
- [x] Fix pipeline line count: ~13,500 → ~20,800
- [x] Fix routes line count: ~4,800 → ~3,300
- [x] Fix shared line count: ~500 → ~100
- [x] Fix tests line count: ~11,000 → ~14,300
- [x] Fix total line count: ~41,000 → ~49,700
- [x] Fix API endpoint count: 37+ → 54 REST + 2 tRPC
- [x] Remove non-existent GET /:id/progress endpoint
- [x] Fix chat upload endpoint: /files → /upload
- [x] Add missing chat endpoints: /action, /files (GET), /title (PATCH), /metadata (PATCH)
- [x] Fix slide edit routes path: /api/v1/slides → /api/v1/presentations/:id/slides
- [x] Add all 13 slide edit endpoints (was 5)
- [x] Add missing interactive routes section (11 endpoints)
- [x] Add missing template routes section (4 endpoints)
- [x] Add missing shared routes: /slides, /html
- [x] Add missing presentation routes: /html, /retry, GET /share
- [x] Remove scenario_cards from content shapes (it's a layout, not a shape) — 16 shapes total
- [x] Fix prompts.ts: "41 layouts available" → "45 layouts available"
- [x] All 1152 tests passing (40 test files) — zero regressions

### 🚀 Round 11: Project Documentation ✅

- [x] Inventory all features, pipeline agents, templates, and architecture — 45 layouts, 12 themes, 17 content shapes, 10 agents, 37+ API endpoints
- [x] Write comprehensive README.md — full project description, architecture diagram, pipeline flow, template list, theme list, API reference, tech stack, file structure, DB schema, dev guide
- [x] All 1152 tests passing (40 test files)
- [x] Save checkpoint

### 🚀 Round 10: Deep Refactoring — THEME_PRESETS, autoFixSlideData, REST→tRPC ✅

- [x] Analyze THEME_PRESETS duplication between server and client — different structures (UI vs CSS generation)
- [x] Create shared/themes.ts with base ThemePresetBase type + THEME_PRESETS + THEME_CATEGORIES
- [x] Update server themes.ts: ThemePreset extends ThemePresetBase, eliminates id/name/nameRu/color/gradient duplication
- [x] Update client constants.ts: imports THEME_PRESETS and THEME_CATEGORIES from shared/themes.ts
- [x] Fix generator.ts and templateParser.ts: add base fields (color, gradient, dark, category, descRu) to custom theme objects
- [x] Analyze two autoFixSlideData functions — QA (structural: types, icons, required fields) vs Design Critic (density: truncation, limits, rebalancing)
- [x] Decision: keep separate (different roles, different pipeline stages), rename for clarity
- [x] Rename QA autoFixSlideData → fixSlideStructure (called after HTML Composer)
- [x] Rename Design Critic autoFixSlideData → fixSlideDensity (called before Design Critique)
- [x] Add @deprecated backward-compatible aliases for test compatibility
- [x] Update generator.ts imports to use new names
- [x] Analyze REST→tRPC migration: 37+ Express endpoints, only ~10 are simple CRUD migratable
- [x] Decision: skip full migration — SSE streaming, binary exports (PPTX/PDF), multer uploads, public shared endpoints all require Express
- [x] Architecture decision: keep existing Express routes, use tRPC for new endpoints going forward
- [x] All 1152 tests passing (40 test files) — zero regressions

### 🚀 Round 9: Codebase Audit & Refactoring ✅

- [x] Inventory all files, modules, and sizes — 28k+ lines server, 7k+ lines client, 11k+ lines tests
- [x] Audit server-side: found duplicated autoFixSlideData (QA vs DesignCritic), dead buildPreviewData, unused backendProxy
- [x] Audit client-side: found unused ComponentShowcase, ManusDialog, ConnectionStatus, History page, 6 unused shadcn components
- [x] Audit shared/config: found THEME_PRESETS duplication (server vs client), dual API patterns (api.ts + tRPC)
- [x] Compiled AUDIT_REPORT.md with 7 critical findings, 5 medium, 4 low priority
- [x] Deleted 17 dead files (~3,600 lines): backendProxy.ts, index.ts (old server), ConnectionStatus, ManusDialog, ComponentShowcase, History page, 6 unused shadcn UI components
- [x] Consolidated buildPreviewData → buildFallbackData (eliminated duplication)
- [x] Updated interactiveRoutes.ts to use buildFallbackData + image injection
- [x] Updated interactiveRoutes.test.ts: fixed mock to use vi.importActual for buildFallbackData, updated layout names and expectations
- [x] All 1152 tests passing (40 test files) — zero regressions

### 🚀 Round 8: DataViz Fix + Design Critique + Org-Chart + Prompt Fix ✅

- [x] Diagnose DataViz parseNumericValue str.replace bug — already fixed with type-guard (string|number|null|undefined handling)
- [x] Verified type-guards for numeric values in DataViz pipeline (parseNumericValue handles all types)
- [x] Audit Design Critique scoring — identified common fixable errors (contrast, font sizing, truncation)
- [x] Improve autoFixSlideData: smart truncation by sentence boundary (not character cutoff)
- [x] Improve autoFixSlideData: lower threshold from 1.5x to 1.3x for earlier intervention
- [x] Add auto-fix: two-column rebalancing when columns differ by 3+ items
- [x] Add auto-fix: SWOT quadrant items limited to 4 per quadrant
- [x] Add auto-fix: org-chart members (max 9) and departments (max 5)
- [x] Add auto-fix: table cell truncation (max 55 chars)
- [x] Add auto-fix: quote truncation (max 240 chars)
- [x] Add auto-fix: cards (max 6), checklist items (max 8), kanban cards per column (max 4)
- [x] Add auto-fix: comparison features (max 6 rows)
- [x] Org-chart template already fully implemented: templateEngine, layout agent, autoDensity, buildFallbackData, QA, Composer
- [x] Fix critical bug: postProcessOutlineShapes received short chat title instead of full user prompt
- [x] Root cause: generateSessionTitle() overwrote session.topic with 5-7 word title
- [x] Fix: generateSessionTitle now saves title to metadata.displayTitle, preserving original prompt in session.topic
- [x] Fix: chat routes updated to use metadata.displayTitle for display, topic for pipeline
- [x] Verified: test generation with full prompt → all 4 specialized shapes correctly assigned (org_structure, swot_quadrants, checklist_items, kanban_board)
- [x] Write 18 new vitest tests for autoFixSlideData (smart truncation, limits, rebalancing, SWOT, org-chart)
- [x] All 1152 tests passing (40 test files)

### 🚀 Round 7: Test Generation + Kanban Board + LLM Validation ✅

- [x] Run test generation #1: "Управление IT-проектом" — Layout Agent used old templates (timeline-horizontal, pros-cons)
- [x] Run test generation #2: "AI-стартап: запуск и развитие до Series A" — Layout Agent assigned vertical-timeline (slide 5) and comparison-table (slide 8) ✅
- [x] Verify vertical-timeline renders correctly: 4 events with connector line, badges, highlighted event
- [x] Verify comparison-table renders correctly: 3 columns, 5 features, highlighted "our solution" column
- [x] Add 3 new content_shapes to Outline Agent: kanban_board, checklist_items, swot_quadrants
- [x] Add Writer instructions for new content_shapes with structured_content field definitions
- [x] Update content_shape_to_layout_mapping with MANDATORY rules for new shapes
- [x] Strengthen Layout Agent: MANDATORY vertical-timeline for timeline_events(4+), comparison-table for comparison_matrix
- [x] Add StructuredContent interface fields: columns (kanban), checklist, swot
- [x] Update buildFallbackData: checklist handles structured_content.checklist, swot handles .swot, kanban handles .columns
- [x] Create kanban-board HTML template (3-5 columns, cards with priority dots, tags, assignee avatars)
- [x] Register kanban-board in: templateEngine, layout agent (available_layouts + content_matching_rules), autoDensity, buildFallbackData, IMAGE/CHART_PROTECTED, qaAgent (LAYOUT_REQUIREMENTS + validation + auto-fix)
- [x] Add Composer mapping example for kanban-board and layout schema
- [x] Add LLM validation for critical slides: validateCriticalSlideContent() checks title-slide (title length, description, no placeholder text) and final-slide (thankYouText, no lorem ipsum)
- [x] Integrate LLM validation into batch processing loop in generator.ts
- [x] Write round7.test.ts — 26 tests for kanban-board, LLM validation, new content_shapes
- [x] All 1118 tests passing (39 test files)
- [x] DataViz error found: parseNumericValue str.replace not a function — non-blocking, charts skipped gracefully

### 🚀 Round 6: New Templates + Composer Validation + Test Generation ✅

- [x] Create vertical-timeline HTML template (vertical connector line, icons, badges, highlight for current event)
- [x] Create comparison-table HTML template (multi-column with highlight column, check/cross marks, footnote)
- [x] Create quote-highlight HTML template (large quote with accent border, optional accentPanel with big number)
- [x] Register new templates in templateEngine, layout agent (available_layouts + content_matching_rules), autoDensity, buildFallbackData
- [x] Add new templates to IMAGE_PROTECTED_LAYOUTS and CHART_PROTECTED_LAYOUTS
- [x] Strengthen HTML Composer: 6 new mapping examples (quote-highlight, vertical-timeline, comparison-table, checklist, swot-analysis)
- [x] Add 3 new layout schemas to layout_schemas section
- [x] Expand IMPORTANT RULES: 5 new rules for new templates
- [x] Add LAYOUT_REQUIREMENTS for 18 previously missing layouts (card-grid, financial-formula, big-statement, verdict-analysis, vertical-timeline, comparison-table, quote-highlight, highlight-stats, waterfall-chart, swot-analysis, funnel, roadmap, pyramid, matrix-2x2, pros-cons, checklist)
- [x] Add validation checks: cards icon format, features/columns match, verdictColor hex, formulaParts symbol, vertical-timeline icons, quote length
- [x] Add auto-fix logic: card-grid icons, verdict-analysis color names→hex, financial-formula operator→symbol, vertical-timeline string icons, comparison-table feature_label→featureLabel, checklist status colors
- [x] Add buildFallbackData cases for checklist and swot-analysis (with text-only fallbacks)
- [x] Fix quote-highlight fallback: text→quote, attribution→author mapping
- [x] Fix text-only fallbacks: ensure min 3 events (vertical-timeline), min 2 features (comparison-table)
- [x] Write newTemplatesQA.test.ts — 26 tests for validation + auto-fix
- [x] Write testGeneration.test.ts — 11 integration tests (buildFallbackData → autoFix → validate)
- [x] All 1092 tests passing (38 test files)

### 🚀 Round 5: HTML Composer Mapping Improvement ✅

- [x] Audit all templates and extract expected data keys for each
- [x] Create per-template JSON example mappings (16 content_shape → layout pairs with concrete INPUT/OUTPUT)
- [x] Replace short one-liner mappings in HTML Composer prompt with detailed examples
- [x] Add 4 missing layout schemas to layout_schemas section (card-grid, financial-formula, big-statement, verdict-analysis)
- [x] Fix buildFallbackData: financial-formula now handles Writer's "parts" field + operator→symbol mapping
- [x] Fix buildFallbackData: verdict-analysis now handles Writer's "items" field + severity→hex color mapping
- [x] Fix buildFallbackData: card-grid now uses icon_hint from Writer's structured_content
- [x] Add IMPORTANT RULES section: camelCase keys, icon objects, symbol field, hex colors
- [x] Write composerMapping.test.ts — 10 new tests for all improved fallback mappings
- [x] All 1055 tests passing (35 test files)

### 🚀 Round 4: New Templates + Design Critic + Test Generation ✅

- [x] Audit existing HTML templates — identified 18 layouts, found gaps for card_grid, financial_formula, big_statement, verdict_analysis
- [x] Create card-grid HTML template (3-6 cards with icons/badges/descriptions)
- [x] Create financial-formula HTML template (formula + breakdown components)
- [x] Create big-statement HTML template (large quote/statement with attribution)
- [x] Create verdict-analysis HTML template (criteria grid + verdict box)
- [x] Register all 4 new templates in templateEngine.ts + layout agent prompts
- [x] Strengthen Design Critic with visual density checks (empty slide detection)
- [x] Strengthen Design Critic with content shape diversity validation
- [x] Strengthen Design Critic with text conciseness checks (max 500 chars per bullet)
- [x] Write tests for new templates and design critic (1045 tests passing)
- [x] Fix Writer structured_content: switched from strict JSON schema to llmText for free-form content
- [x] Fix image-text override: protected 20+ rich layouts from being replaced by image-text
- [x] Fix chart layout fixup: protected highlight-stats, icons-numbers, table-slide, scenario-cards from chart override
- [x] Run 7 test generations — diversity improved from 2 text-only to 9/12 slides with visual elements
- [x] Design Critic score improved from 6.1 to 7.7/10

### 🚀 Deep Quality Improvement: Presentation Generation Pipeline ✅

- [x] Fix: Title text overflow — storytelling agent now enforces 60-char max + hard truncation post-processing
- [x] Fix: Text-wall slides — subtitle truncation at 200 chars for section-header and final-slide
- [x] Audit: Analyzed writer agent — found all slides produce identical 4-5 bullet format
- [x] Audit: Analyzed layout agent — found chart injection forces layout changes
- [x] Audit: Analyzed design critic — found outline critic lacks content_shape diversity checks
- [x] Improve: Writer agent — complete rewrite with 12 content_shape types (stat_cards, card_grid, process_steps, table_data, timeline_events, financial_formula, analysis_with_verdict, comparison_two_sides, chart_with_context, quote_highlight, single_concept, bullet_points)
- [x] Improve: Outline agent — now assigns content_shape and slide_category per slide with diversity rules
- [x] Improve: Layout agent — added content_shape-to-layout mapping for better layout selection
- [x] Improve: HTML Composer — now receives structured_content for richer data mapping
- [x] Improve: Outline Critic — added content_shape diversity validation (min 4 shapes, max 40% bullets)
- [x] Improve: Text length constraints — title max 60 chars, subtitle max 200 chars, enforced at multiple levels
- [x] Write vitest tests — 1024 tests passing (34 test files)

### 🐛 Bug Fix: Sidebar Scroll in Viewer ✅

- [x] Fix trackpad/mouse wheel scroll not working on slide thumbnail sidebar (added overflow-hidden to ScrollArea)
- [x] Fix arrow down/up keys not navigating slides (added ArrowDown/ArrowUp to keyboard handler)
- [x] Add auto-scroll sidebar thumbnail into view when slide changes
- [x] Apply same overflow-hidden fix to version history and slide editor ScrollAreas
- [x] Write vitest tests for keyboard navigation (12 tests passing)

### ✨ Task: PDF Export ✅

- [x] Backend: PDF export module using puppeteer with chromium (1280x720 landscape)
- [x] Backend: GET /api/v1/presentations/:id/export/pdf (authenticated)
- [x] Backend: GET /api/v1/shared/:token/export/pdf (shared)
- [x] Frontend: "Скачать PDF" button in Viewer alongside PPTX/HTML
- [x] Frontend: PDF download in SharedViewer for public links
- [x] Write vitest tests for PDF export (3 tests, puppeteer-based)

### ✨ Task: Version History ✅

- [x] Backend: Create slide_versions table in drizzle schema (presentationId, slideIndex, slideData, createdAt)
- [x] Backend: Auto-save version on each slide edit (PUT, PATCH, layout change)
- [x] Backend: GET /api/v1/presentations/:id/slides/:index/versions — list versions
- [x] Backend: POST /api/v1/presentations/:id/slides/:index/versions/:versionId/restore — restore version
- [x] Backend: GET /api/v1/presentations/:id/slides/:index/versions/:versionId — preview version
- [x] Frontend: Version history panel in Viewer with timeline (right panel)
- [x] Frontend: Preview and restore previous versions with inline thumbnail
- [x] Frontend: History icon button in toolbar with toggle
- [x] Write vitest tests for version history (5 tests)

### ✨ Task: Template Gallery ✅

- [x] Backend: Extended THEME_PRESETS with categories and descriptions (business, creative, dark, nature)
- [x] Frontend: Gallery view in settings panel with visual preview cards (gradient + mockup)
- [x] Frontend: Category filter tabs (Все, Бизнес, Креатив, Тёмные, Природа)
- [x] Frontend: Toggle between compact chips view and gallery grid view
- [x] Frontend: Click to select template → applies to next generation
- [x] Write vitest tests for gallery feature (7 tests)

### ✨ Task: Share by Link ✅

- [x] Backend: Add shareToken + shareEnabled columns to presentations table, migrated schema
- [x] Backend: POST /api/v1/presentations/:id/share — generate/toggle share link
- [x] Backend: GET /api/v1/presentations/:id/share — get share status
- [x] Backend: GET /api/v1/shared/:token — public endpoint to view shared presentation
- [x] Backend: GET /api/v1/shared/:token/slides, /html, /export/pptx — public data endpoints
- [x] Frontend: Share button + dialog with switch toggle and copy-link in Viewer
- [x] Frontend: Public viewer page at /shared/:token (no auth, fullscreen, PPTX/HTML download)
- [x] Write vitest tests for share feature (4 tests)

### ✨ Task: PPTX Export ✅

- [x] Backend: Install pptxgenjs library
- [x] Backend: Create PPTX export endpoint GET /api/v1/presentations/:id/export/pptx
- [x] Backend: Convert HTML slide data (title, content, images, charts) to PPTX slides
- [x] Backend: Map all 30+ layout types to PPTX compositions (charts, tables, stats, timeline, etc.)
- [x] Backend: Support charts (bar, line, pie, donut, radar) in PPTX via pptxgenjs native charts
- [x] Backend: Theme colors from CSS variables applied to PPTX
- [x] Frontend: Add "Скачать PPTX" button in Viewer with loading state
- [x] Write vitest tests for PPTX export (6 tests)

### 🐛 Bug Fixes from CJM Testing ✅

- [x] Bug 1: Add confirmation dialog before deleting a chat
- [x] Bug 2: Localize SESSION_NOT_FOUND error to Russian "Чат не найден"
- [x] Bug 3: Fix template name encoding issue in settings panel (garbled Cyrillic)

### ✨ Task: Comprehensive product testing ✅

- [x] Test CJM: New user → create presentation (quick mode)
- [x] Test CJM: New user → create presentation (step-by-step mode)
- [x] Test CJM: User → view/edit existing presentation
- [x] Test CJM: User → file upload → presentation
- [x] Test all UI elements, text visibility, chart labels
- [x] Fix any discovered issues (3 bugs fixed: delete confirm, SESSION_NOT_FOUND, template encoding)

### ✨ Task: Improve Design Critique scoring ✅

- [x] Scoring formula: normalized by slide count + diminishing returns (sqrt curve), max penalties capped
- [x] Whitespace validator: text density 800→1200, overflow threshold 1.2x→1.5x
- [x] Color harmony: skip SVG charts, distance 150→200, min 5 off-theme colors
- [x] Font sizing: ratio threshold 6x→8x
- [x] Text overflow: increased limits for Russian text (+10-30 chars per field)
- [x] Updated 3 tests for new thresholds, all 975 tests passing

### ✨ Task: Add radar chart support ✅

- [x] Add renderRadarChart to svgChartEngine.ts (grid rings, data polygon, axis labels, values, legend)
- [x] Update recommendChartType for multi-criteria/parameter/indicator data (4-10 points)
- [x] Update dataVizAgent LLM prompt and JSON schema to include radar option
- [x] Add 10 radar chart tests (rendering, grid, edge cases, recommendChartType)
- [x] All 975 tests passing

### ✨ Task: Fix TS errors in chatRoutes.ts ✅

- [x] Fix 4 nullable db/dbInner TS errors in chatRoutes.ts (added non-null assertions)

### ✨ Fix: Chart axis labels and units ✅

- [x] Fix truncated X-axis labels on charts: increased truncateLabel limits (18→24 chars), added wrapLabel for multi-line SVG labels, adaptive font-size for long single words, increased bottom/left margins
- [x] Fix LLM generating illogical units: improved dataVizAgent prompt with strict unit rules, added sanitizeUnit() validation, improved content agent prompt for data_points
- [x] Increased pie/donut legend label limits with dynamic calculation based on data count
- [x] Added 12 new tests for sanitizeUnit, wrapLabel, renderMultiLineLabel, formatValue
- [x] Test chart rendering with new generation: "производительность" (20 chars) fully visible, all labels readable
- [x] All 965 tests passing

### 🐛 Bug Fix: Pressing Enter with attached file does nothing ✅

- [x] File is shown as chip, text is entered, but pressing Enter/Send button does nothing
- [x] Root cause: stale closure in sendMessage — sessionId was null after createSession() because React state hadn't updated yet
- [x] Fix: added overrideSessionId parameter to sendMessage in useSSEChat, pass explicit session ID from handleSend and pendingMessageRef effect
- [x] Verified: file attach + send creates session, uploads file, sends message, AI responds correctly
- [x] 953 tests passing

### 🐛 Bug Fix: Chat resets to empty after sending message with attached file ✅

- [x] After uploading a file and sending a message, the chat resets to "Создайте презентацию"
- [x] The session is not saved — it disappears from the sidebar
- [x] Root cause: pendingMessageRef useEffect fires when sessionId changes (from navigate), but pendingMessageRef.current is still null because uploadFilesToSession hasn't finished yet
- [x] Fix: when files are attached, call sendMessage directly after file upload completes instead of relying on pendingMessageRef
- [x] 953 tests passing

### ✨ Paste-to-attach & File chips inside input area ✅

- [x] Add paste event handler (Ctrl+V / Cmd+V) on textarea to attach files from clipboard
- [x] Move attached file chips from separate area to inside the input container (above textarea)
- [x] File chips: show file icon (by type), truncated name, file size, and X remove button
- [x] Support pasting images from clipboard as attachments
- [x] Visual: unified input container with file chips on top, textarea below (like ChatGPT/Claude UI)
- [x] Extracted validateFiles() helper for reuse between file input and paste
- [x] Updated hint text to mention Ctrl+V
- [x] 953 tests passing

### ✨ Auto-save Settings in localStorage ✅

- [x] Save last selected theme preset to localStorage on change
- [x] Save last selected generation mode (quick/step_by_step) to localStorage on change
- [x] Save last selected slide count to localStorage on change
- [x] Restore saved settings when opening a new chat (not when loading existing session)
- [x] Handle edge cases: invalid/corrupted localStorage data, custom template not restored (may be deleted)
- [x] 953 tests passing

### ✨ Navigation: Back from presentation viewer → originating chat ✅

- [x] "Back" button in presentation viewer returns to the chat session that opened it (via ?from=chat/{id} query param)
- [x] Pass session ID context when navigating from chat to presentation viewer
- [x] Escape key in viewer also returns to originating chat
- [x] Removed History page from navigation (redundant with chat sidebar)
- [x] /history redirects to /chat for backwards compatibility
- [x] Logo now links to /chat instead of /
- [x] 953 tests passing

### ✨ Typing Indicator Animation ✅

- [x] Add "AI думает" animation with bouncing dots while waiting for first SSE tokens
- [x] Show animated dots indicator in assistant message bubble when isStreaming and content is empty
- [x] Smooth transition from typing indicator to actual content when first token arrives (StreamingText auto-switches)
- [x] 953 tests passing

### 🐛 Bug Fix: Chat UI doesn't update after sending message ✅

- [x] After sending first message, screen stays on empty "Создайте презентацию" instead of showing chat
- [x] SSE progress events not displayed in real-time — user must switch chats and back to see results
- [x] When presentation is ready, the "Посмотреть презентацию" button doesn't appear until chat is re-opened
- [x] Root cause: race condition between loadSession (useEffect on params.id) and sendMessage (pendingMessageRef)
- [x] loadSession called by useEffect after navigate("/chat/${newId}") wiped messages added by sendMessage
- [x] Fix: added justCreatedSessionRef flag — set before navigate, checked in useEffect to skip loadSession
- [x] 953 tests passing

### ✨ Custom Template Upload Feature ✅

- [x] DB: Create customTemplates table (templateId, userId, name, description, s3Url, thumbnailUrl, cssVariables, fontsUrl, metadata, status)
- [x] DB: Push migration with pnpm db:push
- [x] Backend: POST /api/v1/templates/upload — upload PPTX/HTML file, store in S3
- [x] Backend: Template parser — extract colors, fonts, styles from PPTX (jszip + xml parsing)
- [x] Backend: LLM analysis — analyze uploaded template and generate CSS variables (ThemePreset format)
- [x] Backend: GET /api/v1/templates — list user's custom templates
- [x] Backend: GET /api/v1/templates/:id — get template details with CSS preview
- [x] Backend: DELETE /api/v1/templates/:id — delete a custom template
- [x] Backend: Generate thumbnail preview for uploaded template (color palette + gradient preview)
- [x] Pipeline: Accept customTemplateId in GenerationConfig
- [x] Pipeline: Load custom template CSS and apply during generation (replaces theme preset)
- [x] Pipeline: Pass custom template to chatOrchestrator for both quick and step-by-step modes
- [x] Frontend: Template management integrated into chat settings panel (no separate page needed)
- [x] Frontend: Template upload button in settings panel (PPTX, HTML)
- [x] Frontend: Template preview card with color dot and gradient preview
- [x] Frontend: Template selector in chat settings panel (alongside theme presets)
- [x] Frontend: "Мои шаблоны" section in settings panel with upload + select + delete
- [x] Write vitest tests for template parsing and CSS generation (16 new tests — 953 total passing)
- [x] End-to-end test: verified UI renders correctly, API endpoints respond, template selection works

### 🐛 Bug Fix: Empty 'Новый чат' sessions STILL being created (persistent) ✅

- [x] Previous fix was insufficient — sessions still appear on page load/navigation
- [x] Deep audit: find ALL code paths that call createSession or POST /sessions
- [x] Root cause: old orphan sessions (0 messages, idle phase) from before lazy-creation fix
- [x] Fix: Server-side filtering in GET /sessions — exclude sessions with 0 messages + idle phase
- [x] Fix: loadSession handles 404 by redirecting to /chat (deleted/missing sessions)
- [x] Deleted 3 remaining orphan sessions from DB
- [x] 937 tests passing

### ✨ Feature: File Upload for Presentation Creation ✅

- [x] Backend: POST /api/v1/chat/sessions/:id/upload endpoint (multipart/form-data with multer)
- [x] Backend: GET /api/v1/chat/sessions/:id/files endpoint to list uploaded files
- [x] Backend: Text extraction from PDF (pdf-parse), DOCX (mammoth), PPTX (jszip), TXT, images (LLM vision)
- [x] Backend: Upload files to S3 via storagePut, store metadata in chat_files table
- [x] Backend: DB schema — chat_files table (fileId, sessionId, filename, mimeType, fileSize, s3Url, extractedText, status, createdAt)
- [x] Backend: Integrate extracted file content into chatOrchestrator (handleTopicInput + startQuickGeneration)
- [x] Backend: Pass file context to pipeline prompt (appended to topic with file content sections)
- [x] Frontend: FileUploadButton component (paperclip icon) in chat input area
- [x] Frontend: Drag-and-drop file upload support in FileUploadButton
- [x] Frontend: FileChips showing attached files (filename + type icon + remove button) above input
- [x] Frontend: Display attached files in MessageBubble (clickable links to S3 with file/image icons)
- [x] Frontend: Upload progress indicator (isUploading state)
- [x] Frontend: Support PDF, DOCX, TXT, PPTX, PNG, JPG, WEBP, GIF, PPT, DOC
- [x] Frontend: File size limit (10MB per file, max 5 files per message)
- [x] Frontend: api.ts uploadChatFiles + getChatFiles methods
- [x] Write vitest tests for file extraction and constants (23 new tests — 937 total passing)
- [x] Verified: TXT upload → S3 → text extraction → ready status

### 🐛 Bug Fix: New empty chat sessions created repeatedly on every page load ✅

- [x] Root cause: ChatPage useEffect called createSession() on every /chat navigation (no ID)
- [x] Fix: Don't auto-create session on /chat — show empty state instead
- [x] Fix: Create session lazily on first message (pendingMessageRef pattern)
- [x] Fix: Added resetSession() to useSSEChat to clear state without DB call
- [x] Fix: handleNewChat and new_presentation action navigate to /chat instead of creating session
- [x] Cleaned up 19 orphan empty sessions from DB
- [x] 914 tests passing

### 🐛 Bug Fix: Presentation generation hangs after selecting Quick mode ✅

- [x] Root cause: SSE connection drops due to proxy timeout (~60s) while generation takes 3-4 minutes
- [x] Generation actually completes on server, but client doesn't see the result
- [x] Fix: Added polling fallback in useSSEChat — when SSE drops during generation (progress > 0, no done event), polls session status every 5s
- [x] Fix: When polling detects phase change to "completed", reloads full session messages and shows result
- [x] Fix: loadSession auto-starts polling if session is in "generating" phase (handles page reload)
- [x] Fix: Added visual indicator "Соединение восстанавливается..." with amber pulse dot
- [x] Verified: generation completes on server, polling detects completion, 914 tests passing

### 🐛 Bug Fix: Viewer shows empty slides (URL not found) ✅

- [x] Root cause: chatOrchestrator didn't upload HTML to S3 (resultUrls was null)
- [x] Root cause: legacy presentations stored layout_id instead of layoutId
- [x] Fix: Added S3 HTML upload in chatOrchestrator for both quick and step-by-step modes
- [x] Fix: Added fallbackRenderFromSlides in Viewer.tsx — renders slides individually from /slides API when result_urls is null
- [x] Fix: Background reassemble triggered to fix missing result_urls for future visits
- [x] Fix: Added normalizeSlides helper in slideEditRoutes to handle legacy layout_id → layoutId migration
- [x] Verified: K0mPVkDoWhkxYUnJ now renders correctly via fallback + reassemble

### 🐛 Bug Fix: Chat names should auto-generate from topic ✅

- [x] LLM-based title generation in chatOrchestrator (generateSessionTitle function)
- [x] Title sent via SSE title_update event to update sidebar in real-time
- [x] PATCH /api/v1/chat/sessions/:id/title endpoint for inline editing
- [x] ChatSidebar supports inline title editing (pencil icon on hover)
- [x] Verified: "сделай презентацию про качество воды в мире" → "Качество воды в мире"

### 🐛 Bug Fix: Mode auto-starts without user selecting ✅

- [x] Removed auto-trigger of mode from ChatPage handleSend (was setTimeout + triggerAction)
- [x] Mode buttons now shown in chat for user to click explicitly
- [x] Removed mode selection from settings panel (only theme + slide count remain)
- [x] Verified: phase stays mode_selection until user clicks a mode button

### 🐛 Bug Fix: Text messages during awaiting_approval treated as approval ✅

- [x] Fix chatOrchestrator: text messages in step_structure phase are now edit requests, not approval
- [x] Only the explicit "approve_structure" action button triggers generation
- [x] LLM modifies existing outline based on user feedback (using json_schema response_format)
- [x] Test: "удали последний слайд" → 12→11 slides, phase stays step_structure, buttons shown
- [x] 894 vitest tests passing

### ✨ Task 3: Light Theme Redesign + Settings in Input Area ✅

- [x] Switch from dark to light theme (update index.css, ThemeProvider)
- [x] Redesign color palette for light mode (clean, modern)
- [x] Remove mode/theme selectors from Home page form
- [x] Add settings popover/toolbar near chat input (like Manus/ChatGPT style)
- [x] Move generation mode toggle to input settings
- [x] Move theme preset selector to input settings
- [x] Move slide count to input settings
- [x] Clean up Home page to redirect to /chat (chat-first)
- [x] Remove dark-specific CSS (section-number, swiss-divider, glow-*, font-heading)
- [x] Update all pages for light theme (History, Generate, Viewer, Interactive, NotFound)
- [x] Test full flow with new design — 894 tests passed

### ✨ Task 2: Step-by-step Slide Preview in Chat ✅

- [x] After structure approval, show slide previews inline in chat messages
- [x] Render slide thumbnails using existing preview-slide API
- [x] Show slide number and title alongside preview
- [x] Clickable previews to open fullscreen (expand/collapse)
- [x] Test step-by-step flow with previews
- [x] Send all slide previews at completion (both quick and step-by-step modes)
- [x] SlidePreviewsGallery with horizontal scrolling

### ✨ Task 1: Chat History Sidebar ✅

- [x] Add sidebar panel to ChatPage with list of previous chat sessions
- [x] Show session topic, date, message count in sidebar items
- [x] Click to switch between sessions (navigate to /chat/:id)
- [x] Add "New chat" button at top of sidebar
- [x] Add delete session button with confirmation
- [x] Responsive: collapsible sidebar on mobile
- [x] Test in browser

### ✨ SSE Streaming Responses ✅

- [x] Server: Create SSE endpoint for chat message streaming (/api/v1/chat/:id/message + /api/v1/chat/:id/action)
- [x] Server: Update chatOrchestrator to yield tokens incrementally via direct fetch streaming
- [x] Server: Stream structured events (token, actions, progress, presentation_link, done, error)
- [x] Frontend: useSSEChat hook with fetch + ReadableStream for SSE parsing
- [x] Frontend: Render tokens incrementally in AI message bubble with blinking cursor
- [x] Frontend: Handle action buttons and presentation links arriving at end of stream
- [x] Frontend: Graceful error handling with retry and error messages
- [x] Server: chatDb.ts — CRUD operations for chat_sessions table (create, get, list, update, append, delete)
- [x] Server: chatOrchestrator.ts — LLM-driven state machine (idle → mode_selection → generating → completed)
- [x] Server: chatRoutes.ts — Express REST + SSE endpoints registered in _core/index.ts
- [x] Server: Quick mode — full pipeline with real-time progress streaming (12% → 24% → 30% → ... → 100%)
- [x] Server: Step-by-step mode — structure generation with approve/regenerate actions
- [x] Frontend: ChatPage.tsx — full chat interface with message bubbles, action buttons, progress bar
- [x] Frontend: useSSEChat.ts — SSE client hook with ReadableStream parsing
- [x] Frontend: Chat navigation added to AppLayout (02 Чат)
- [x] Frontend: Auto-create session and redirect to /chat/:id
- [x] DB: chat_sessions table with messages JSON, phase, mode, presentationId, metadata columns
- [x] Tests: 22 vitest tests for chat SSE (CRUD, streaming, actions, state machine, SSE format)

### 🧪 Test Generation Results & Fixes ✅

- [x] Test 1: "Инвестиционный проект" — auto-theme selected executive_navy_red (LLM), timeline-horizontal and scenario-cards used
- [x] Test 2: "Анализ рынка электромобилей" — auto-theme selected data_navy_blue (keyword), 6 SVG charts rendered
- [x] Chart layout fixup working: 5 slides auto-switched to chart-capable layouts (stats-chart, chart-text, chart-slide)
- [x] Strengthen Layout Agent prompt: limit text-slide to 1, image-text to 2, mandatory layout selection rules, diversity requirements for 10+ slide presentations
- [x] All 872 tests pass after prompt improvements

### 🚀 Sprint 6: Remaining Layouts (dual-chart + risk-matrix) ✅

- [x] Implement "dual-chart" layout template — two SVG charts side by side with titles, subtitles, insights, placeholders
- [x] Implement "risk-matrix" layout template — 3x3 heatmap grid + color-coded cells + mitigation cards with priority badges + legend
- [x] Update LAYOUT_SYSTEM prompt with new layout descriptions
- [x] Update htmlComposer prompt with layout schemas for dual-chart and risk-matrix
- [x] Update QA agent validation rules for new layouts
- [x] Update autoDensity height estimates for new layouts
- [x] Update computeDensity cases for new layouts
- [x] Update generator fallback data for new layouts
- [x] Update dataVizAgent CHART_LAYOUTS for dual-chart
- [x] Update injectChartIntoSlideData for dual-chart (leftChartSvg/rightChartSvg)
- [x] Write vitest tests for both new layouts — 22 new tests (872 total pass)

### 🎨 Auto-Theme Selection (AI-based) ✅

- [x] Create theme classification mapping (topic → theme) — 12 themes with keyword rules + regex patterns
- [x] Implement themeSelector agent with LLM-based analysis — structured JSON output with theme_id + reason
- [x] Add keyword-based fast matching (no LLM needed for obvious cases) — instant scoring with confidence levels
- [x] Integrate auto-selection into batch generation pipeline (generator.ts)
- [x] Integrate auto-selection into interactive generation pipeline (interactiveRoutes.ts)
- [x] Add "auto" option to frontend theme selector with Wand2 icon and description
- [x] Set "auto" as default theme selection mode
- [x] Write vitest tests for theme selection logic — 51 new tests (850 total pass)

### 🚀 Manus-Style Design Improvements (Design Diversity) ✅

- [x] Add Navy+Red theme preset (executive_navy_red)
- [x] Add Navy+Red+Blue theme preset (data_navy_blue)
- [x] Create "stats-chart" layout — left stat cards + right SVG chart
- [x] Create "chart-text" layout — left text/bullets + right chart
- [x] Create "hero-stat" layout — accent panel with giant stat + supporting stats
- [x] Create "scenario-cards" layout — color-coded scenario cards with probability
- [x] Create "numbered-steps-v2" layout — circle-numbered vertical steps with connectors
- [x] Create "timeline-horizontal" layout — horizontal timeline with alternating events
- [x] Create "text-with-callout" layout — bullets + callout bar + source citation
- [x] Update layout agent prompts with new layout schemas
- [x] Update QA agent with validation for new layouts
- [x] Update dataVizAgent CHART_LAYOUTS for stats-chart and chart-text
- [x] Update autoDensity height estimates for all new layouts
- [x] Update generator fallback data for all new layouts
- [x] Write vitest tests for all new layouts and themes (799 tests pass)
- [x] Create "dual-chart" layout — two charts side by side (implemented in Sprint 6)
- [x] Create "risk-matrix" layout — 3x3 heatmap + mitigation cards (implemented in Sprint 6)

### ✨ Auto-Expanding Text Boxes in Inline Editing ✅

- [x] Analyze how slide templates constrain text box sizes (fixed height, overflow hidden, line-clamp, text-overflow)
- [x] Remove overflow restrictions during inline editing mode (CSS !important overrides)
- [x] Make text containers auto-expand when content grows (height:auto, min-height, overflow:visible)
- [x] Ensure adjacent elements reflow/shift when a text box expands (flex/grid auto-sizing)
- [x] Handle slide container overflow gracefully (iframe dynamic height via postMessage + MutationObserver)
- [x] Test across all slide layouts (title-slide, two-column, text-slide, image-text, final-slide)
- [x] Write/update vitest tests (8 new auto-expand tests)

### ✨ Inline Image Editing ✅

- [x] Analyze current image upload/replace architecture (slideEditRoutes, InlineEditableSlide, templateEngine)
- [x] Add image overlay in iframe: detect img + gradient placeholder elements, show hover overlay with "Replace/Add image" button
- [x] Implement file picker dialog triggered by clicking on image overlay
- [x] Implement drag-and-drop support for image replacement on slides
- [x] Upload new image via existing POST /presentations/:id/slides/:index/image endpoint
- [x] Auto-reassemble slide after image replacement (reuse auto-save debounce)
- [x] Update thumbnail after image change
- [x] Handle image validation (file type, size limit 5MB)
- [x] Test inline image editing across slide types (title-slide, image-text, image-fullscreen)
- [x] Write/update vitest tests (7 new image editing tests added)

### ✨ Auto-Save for Inline Editing ✅

- [x] Analyze current manual save flow (pendingChanges, handleSaveAll)
- [x] Implement debounced auto-save with 2s debounce + auto-reassemble
- [x] Replace manual "Save all changes" button with auto-save status indicator
- [x] Show save status: pending → reassembling → saved → idle (or error)
- [x] Handle save errors gracefully with toast notification + auto-reset
- [x] Test auto-save across multiple edits and slide switches
- [x] Write/update vitest tests (11 tests in autoSave.test.ts)

### 🐛 Bug Fix — Inline Editing Only Works for Title ✅

- [x] Diagnose why non-title fields (description, bullets, etc.) are not editable in inline mode
- [x] Fix inlineFieldInjector to properly mark all text fields as contentEditable
- [x] Test inline editing across multiple slide layouts (title-slide, text-slide, two-column, etc.)
- [x] Write/update vitest tests

### ✨ Auto-Density Fallback ✅

- [x] Studied density system: computeDensity → autoDensity → renderSlide pipeline
- [x] Created server/pipeline/autoDensity.ts with estimateContentHeight() for 16 layout types
- [x] Implemented auto-density escalation: normal → compact → dense based on estimated height vs 622px available
- [x] Height estimation uses per-density CSS params (font sizes, padding, gaps, line clamps)
- [x] Integrated into renderSlide: computeDensity → autoDensity → injectDensityClass
- [x] Console logging when density is escalated (for debugging)
- [x] Write vitest tests: 20 tests (10 estimateContentHeight + 10 autoDensity), all passing
- [x] All 684 tests passing

### 🐛 Bug Fix — Metrics Slide Overflow ✅

- [x] Diagnosed: icons-numbers template grid cards overflowed 720px with 4+ metrics + descriptions
- [x] Fixed: added grid-template-rows, max-height:100%, overflow:hidden on grid; reduced card padding/gaps/icon sizes
- [x] Reduced description -webkit-line-clamp from 3 to 2 to save vertical space
- [x] Checked all 26 templates — no other overflow or div-balance issues found
- [x] All 664 tests passing

### ✨ Retry Button on Generation Error ✅

- [x] Backend: POST /api/v1/presentations/:id/retry endpoint to restart failed pipeline
- [x] Backend: Reset presentation status, clear error info, re-run generatePresentation
- [x] Backend: Validate only "failed" status can be retried (400 for other statuses)
- [x] Frontend: Show "Повторить" button in both left panel and right preview area on error
- [x] Frontend: handleRetry resets all UI state, reconnects WS, restarts polling
- [x] Frontend: Loading state with spinner during retry
- [x] Frontend: "Новая презентация" button as alternative to retry
- [x] API client: api.retryPresentation() method added
- [x] Write vitest tests for retry endpoint (11 tests, all passing)
- [x] All 664 tests passing

### ✨ Retry Logic for Image Generation ✅

- [x] Created generic withRetry() utility with exponential backoff + jitter (server/_core/retry.ts)
- [x] Applied retry to generateImage(): 2 retries, 2s initial delay, retryable on timeout/network/5xx/429
- [x] Applied retry to LLM callApi(): 2 retries, 2s initial delay, retryable on timeout/network/5xx/429
- [x] Non-retryable errors (4xx client errors, usage exhausted) fail immediately
- [x] Log retry attempts with warning messages including attempt count and delay
- [x] Write vitest tests for retry behavior (11 tests: success, retry-then-succeed, exhaust, non-retryable, backoff, cap)
- [x] All 653 tests passing

### 🐛 Bug Fix — Generation Hangs at Image Generation Step ✅

- [x] Diagnosed: generateImage() and callApi() had no timeouts — fetch could hang indefinitely
- [x] Added 60s AbortController timeout to generateImage() in _core/imageGeneration.ts
- [x] Added 120s AbortController timeout to callApi() in _core/llm.ts
- [x] Added 10-minute overall pipeline timeout via Promise.race in presentationRoutes.ts
- [x] Added per-image error logging in generateSlideImages() (warns but continues)
- [x] Reset stuck presentation jp_mAkyYccX17ipm to failed status
- [x] All 642 tests passing

### ✨ Drag & Drop Slide Reordering in Viewer ✅

- [x] Backend: POST /api/v1/presentations/:id/reorder endpoint (accepts new slide order array)
- [x] Backend: Reorder slideData, finalHtmlSlides, and reassemble full HTML
- [x] Frontend: Add @dnd-kit DnD to Viewer sidebar thumbnails (SortableSlideThumb component)
- [x] Frontend: Visual feedback during drag (opacity, shadow, ring highlight, GripVertical handle)
- [x] Frontend: Call reorder API after drop, optimistic update with rollback on error
- [x] Frontend: Toast notification after reorder ("Слайд X → Y")
- [x] Frontend: Loading indicator during backend save
- [x] Frontend: Current slide follows the dragged slide
- [x] Write vitest tests for reorder validation and execution (19 tests, all passing)
- [x] All 642 tests passing

### 🐛 Bug Fix — Viewer Layout Broken ✅

- [x] Root cause: image-text template had unclosed </div> in bullet loop (5 unclosed divs per slide)
- [x] Fix template: added missing closing tag on line 143 of templateEngine.ts
- [x] Fix parseSlides: replaced DOM-based querySelectorAll with regex-based splitting on raw HTML
- [x] Verified all 26 templates have balanced div tags (automated Python checker)
- [x] Verified all 8 slides render correctly in Viewer (visual inspection)
- [x] All 623 tests passing

### 🚀 Sprint 6 — Inline Editing in Viewer ✅

- [x] Add data-field attributes to rendered slide HTML via post-processing (inlineFieldInjector.ts)
- [x] Create new API endpoint for inline field updates (PATCH single field)
- [x] Create GET editable slide endpoint (returns HTML with inline editing script)
- [x] Create InlineEditableSlide component with contentEditable + postMessage
- [x] Integrate inline editing into Viewer (toggle between sidebar and inline modes)
- [x] Add inline editing CSS styles (hover highlights, focus outlines, save indicators)
- [x] Write vitest tests for inline editing (30 tests, all passing)
- [x] Add API client methods (getEditableSlide, patchSlideField)

### 🚀 Sprint 9: Inline Slide Editing in Viewer 🔴 0/12

- [ ] Study Viewer architecture (SlideFrame, parseSlides, iframe rendering)
- [ ] Design inline editing approach (contentEditable in iframe vs overlay editor)
- [ ] Add backend API endpoint: PATCH /api/presentations/:id/slides/:index to update slide HTML
- [ ] Add backend logic: update individual slide HTML in full presentation HTML
- [ ] Implement edit mode toggle in Viewer toolbar
- [ ] Implement contentEditable injection into slide iframes when edit mode is active
- [ ] Add visual indicators for editable elements (hover highlight, cursor change)
- [ ] Implement text change detection and save mechanism
- [ ] Add undo/redo support for edits
- [ ] Persist changes to database via API call
- [ ] Write vitest tests for slide update API
- [ ] End-to-end browser testing of inline editing flow

### 🚀 Sprint 8: Interactive Mode Testing & Fixes ✅

- [x] Analyze existing interactive mode implementation (interactiveRoutes.ts + Interactive.tsx)
- [x] End-to-end test: create presentation in interactive mode via browser
- [x] Fix title-slide description overflow — truncate to 150 chars in buildPreviewData
- [x] Fix title-slide template — add line-clamp-3 on description
- [x] Fix chart rendering in Viewer — include Chart.js scripts in parseSlides for canvas slides
- [x] Fix batch pipeline — add same title/final-slide description truncation post-processing
- [x] Verify interactive mode flow: structure → content → assembly → view (all working)
- [x] All 593 tests passing, no regressions

### 🚀 Sprint 7: Adaptive Typography ✅

- [x] Design adaptive typography system (CSS variables + density classes: normal/compact/dense)
- [x] Implement CSS utility classes (.density-compact, .density-dense) with scaled CSS variables
- [x] Implement computeDensity() function — analyzes item count, text length, title length
- [x] Implement injectDensityClass() — adds density class to root div of rendered HTML
- [x] Apply adaptive typography to text-slide (var(--at-title-size), var(--at-body-size), etc.)
- [x] Apply adaptive typography to two-column (var(--at-card-padding), var(--at-small-size))
- [x] Apply adaptive typography to comparison (var(--at-title-size), var(--at-small-size))
- [x] Apply adaptive typography to timeline (var(--at-title-size), var(--at-small-size))
- [x] Apply adaptive typography to process-steps (var(--at-title-size), var(--at-small-size))
- [x] Apply adaptive typography to icons-numbers (var(--at-value-size), var(--at-label-size))
- [x] Apply adaptive typography to team-profiles (var(--at-title-size), var(--at-small-size))
- [x] Apply adaptive typography to agenda-table-of-contents (var(--at-title-size))
- [x] Apply adaptive typography to swot-analysis (var(--at-title-size), var(--at-bullet-clamp))
- [x] Apply adaptive typography to checklist (var(--at-title-size), var(--at-small-size))
- [x] Apply adaptive typography to pros-cons (var(--at-title-size), var(--at-small-size))
- [x] Apply adaptive typography to funnel (var(--at-title-size))
- [x] Apply adaptive typography to roadmap (var(--at-title-size))
- [x] Apply adaptive typography to table-slide, chart-slide, logo-grid, waterfall, pyramid, matrix-2x2
- [x] Apply adaptive typography to highlight-stats (var(--at-value-size), var(--at-label-size))
- [x] Write 73 vitest tests for adaptive typography (adaptiveTypography.test.ts)
- [x] Visual testing: 30 slides at 3 density levels, 0/30 overflow, all readable
- [x] All 593 tests passing, no regressions

### 🚀 Sprint 6.1: Visual Overflow Testing & Engine Fixes ✅

- [x] Generate visual test HTML with all 23 templates using long content
- [x] Inspect all 27 slides in browser for overflow issues
- [x] Fix roadmap template: raw Jinja2 syntax was rendering as text
- [x] Fix template engine: add arithmetic operators (%, *, /, +, -) to evalExpression
- [x] Fix template engine: rewrite processIfBlocks for nested if/else/endif support (inside-out processing)
- [x] Fix template engine: improve dot notation with proper bracket handling
- [x] Verify roadmap renders alternating top/bottom milestones correctly
- [x] All 520 tests passing, no regressions

### 🚀 Sprint 6: Template Overflow Audit ✅

- [x] Audit all 23 templates for overflow vulnerabilities (documented in TEMPLATE_AUDIT.md)
- [x] Fix title overflow: all titles now have max font-size 36px, line-clamp 2, text-overflow ellipsis
- [x] Fix content overflow: add overflow:hidden to all main containers
- [x] Fix card/item overflow: add text-clamp to descriptions in all card-based templates
- [x] Fix padding consistency: standardize to 36px 48px 32px outer padding
- [x] Fix font-size consistency: standardize heading/body/label sizes
- [x] Fix dynamic grid capping: process-steps, team-profiles, roadmap capped at 5 columns
- [x] Fix table-slide: overflow:auto on table wrapper for scrollable tables
- [x] Fix quote-slide: line-clamp 5 on blockquote text
- [x] Fix template engine: add Jinja2 ternary expression support (x if condition else y)
- [x] Write 85 new overflow tests (templateOverflow.test.ts)
- [x] Run all 520 tests — all passing, no regressions

### 🐛 Bug Fixes ✅

- [x] Fix icons-numbers template: content overflows slide, cards too large, title cut off

### 🚀 Sprint 5: Data Visualization Agent ✅

- [x] Create svgChartEngine.ts with pure SVG chart rendering (5 chart types)
- [x] Implement vertical bar chart with labels, values, grid lines, animations
- [x] Implement horizontal bar chart for comparison data
- [x] Implement line chart with data points, gradient fill, smooth curves
- [x] Implement pie chart with segments, labels, and legend
- [x] Implement donut chart with center metric
- [x] Add theme-aware color palettes (CSS variables)
- [x] Add responsive sizing with viewBox
- [x] Create dataVizAgent.ts with data extraction from slide content
- [x] Implement data extraction from data_points and text patterns
- [x] Implement chart type recommendation (recommendChartType) based on data patterns
- [x] Implement LLM-based data detection for complex slides
- [x] Add chart SVG injection into slide HTML (injectChartIntoSlideData)
- [x] Add triple-brace {{{ }}} raw HTML support in template engine
- [x] Integrate into pipeline after Speaker Coach, before HTML Composer
- [x] Update frontend constants with data_viz step
- [x] Update chart-slide template to support SVG alongside canvas
- [x] Write vitest tests for SVG generators (56 tests, 435 total)
- [x] Write vitest tests for Data Visualization Agent
- [x] Verify end-to-end generation with charts

### 🚀 Sprint 4: Research Agent ✅

- [x] Create researchAgent.ts with LLM-based research capabilities
- [x] Implement search query generation from outline topics (8 research focus categories)
- [x] Implement fact extraction and data enrichment via LLM structured output
- [x] Add source citation tracking (source_hint, year, confidence level)
- [x] Fix regex priority order for research focus detection (competitive/challenge before technology)
- [x] Add research context injection into Writer prompts (<research_data> tags)
- [x] Integrate into pipeline between Outline Critic and Writer
- [x] Update frontend constants with new agent step (research)
- [x] Write vitest tests for Research Agent (32 tests, 379 total)
- [x] Verify end-to-end generation works with Research Agent

### 🚀 Sprint 3: New Layout Templates ✅

- [x] Waterfall Chart — каскадная диаграмма для финансовых данных (рост/падение)
- [x] SWOT Analysis — четырёхквадрантная матрица (Strengths, Weaknesses, Opportunities, Threats)
- [x] Funnel — воронка для маркетинга/продаж (этапы конверсии)
- [x] Roadmap — горизонтальная timeline с этапами и милестоунами
- [x] Pyramid — иерархическая пирамида (3-5 уровней)
- [x] Matrix 2x2 — матрица для позиционирования/приоритизации
- [x] Pros & Cons — два столбца за/против с иконками
- [x] Checklist — список задач с чекбоксами и статусами
- [x] Highlight Stats — hero-метрика с поддерживающими статистиками (вместо Agenda, т.к. agenda уже есть)
- [x] Register all new layouts in layout selector and prompts (27 layouts total)
- [x] Fix template engine: balanced matching for nested for-loops
- [x] Write vitest tests for all new templates (25 tests, 347 total)
- [x] Verify end-to-end generation with new layouts

### 🚀 Sprint 2: Design Critic Agent ✅

- [x] Create designCriticAgent.ts with visual quality validation
- [x] Implement contrast checker (WCAG AA compliance for text/background)
- [x] Implement text overflow detection (content exceeding slide bounds)
- [x] Implement layout balance validation (vertical centering, spacing)
- [x] Implement color harmony checker (theme consistency across slides)
- [x] Implement font sizing validator (readability at presentation distance)
- [x] Implement whitespace and content density validator
- [x] Implement cross-slide consistency checker (layout variety)
- [x] Add auto-fix capabilities — CSS overrides for contrast, overflow, font issues
- [x] Integrate into pipeline after HTML Composer, before final assembly
- [x] Update frontend constants with new agent step (design_critic)
- [x] Write vitest tests for all validators (62 tests, 322 total)
- [x] Verify end-to-end generation works with Design Critic

### 🚀 Sprint 1: Agent Architecture Improvements ✅

- [x] Create storytellingAgent.ts with action titles enforcement
- [x] Add narrative coherence check (logical transitions between slides)
- [x] Add transition phrases generation for speaker flow
- [x] Integrate into pipeline after Writer, before Layout
- [x] Write vitest tests for Storytelling Agent (17 tests, 219 total)
- [x] Verify end-to-end generation works with Storytelling Agent
- [x] Create outlineCritic.ts with structure validation
- [x] Check Pyramid Principle compliance
- [x] Check MECE structure of arguments
- [x] Check slide type balance and variety
- [x] Integrate into pipeline after Outline Agent with retry loop
- [x] Write vitest tests for Outline Critic (19 tests, 238 total)
- [x] Verify end-to-end generation works with Outline Critic
- [x] Create speakerCoachAgent.ts with professional notes generation
- [x] Generate talking points (not slide text repetition)
- [x] Add transition phrases between slides
- [x] Add timing hints per slide + audience engagement cues + delivery tips
- [x] Integrate into pipeline after image generation, before HTML composition
- [x] Write vitest tests for Speaker Coach (22 tests, 260 total)
- [x] Verify end-to-end generation works with Speaker Coach

### 🚀 Quality Improvement Round 3: Outline, Footers, Markdown, Transitions, Images ✅

- [x] Enhanced Outline Agent: Add few-shot examples for better slide structure
- [x] Enhanced Outline Agent: Add narrative arc examples (business, educational, technical)
- [x] Slide footers: Add slide numbers and presentation title to every slide
- [x] Slide footers: Style footer with subtle design (small text, muted color, bottom bar)
- [x] Markdown support: Parse **bold** and *italic* in bullet descriptions
- [x] Markdown support: Render inline markdown as <strong> and <em> in templates
- [x] Viewer transitions: Add smooth CSS transitions when navigating between slides
- [x] Viewer transitions: Fade or slide animation on slide change
- [x] Image generation: Increase auto-image limit from 3 to 5 slides
- [x] Image generation: Improve image prompt generation for better quality
- [x] Write vitest tests for all new improvements (32 tests added, 202 total passing)
- [x] Test end-to-end generation with all improvements

### 🚀 Quality Improvement: QA Agent + Writer Context + Adaptive Fonts ✅

- [x] QA Agent: Create validation logic for HTML Composer output (check all required fields, content density, icon format)
- [x] QA Agent: Add QA prompt that reviews slide data and returns pass/fail with specific issues
- [x] QA Agent: Integrate QA step into pipeline with retry (max 1 retry per slide)
- [x] QA Agent: Add QA step to interactive mode assemble endpoint
- [x] Writer Context: Pass key messages from previous slides to each Writer call
- [x] Writer Context: Add "avoid repeating" instruction with previous slide summaries
- [x] Writer Context: Update writerSystem prompt to accept and use context from prior slides
- [x] Adaptive Fonts: Analyze content density per slide (bullet count, text length)
- [x] Adaptive Fonts: Generate CSS overrides for font-size, gap, padding based on density
- [x] Adaptive Fonts: Apply adaptive styles inline in renderSlide output
- [x] Adaptive Fonts: Handle all layout types (text-slide, two-column, icons-numbers, process-steps, timeline, comparison)
- [x] Write vitest tests for QA validation logic (42 new tests — 170 total passing)
- [x] Write vitest tests for writer context building
- [x] Write vitest tests for adaptive font sizing
- [x] Test end-to-end generation — 13 slides, all centered, rich content, no repetition, QA step visible

### 🚀 Quality Overhaul: Slide Templates & Content ✅

- [x] Audit all templates for vertical centering issues
- [x] Fix image-text: text content must be vertically centered alongside image, not pushed to bottom
- [x] Fix two-column: content cards must be vertically centered, not top-aligned with empty bottom half
- [x] Fix section-header: content only in top 40%, bottom 60% empty — must fill entire slide
- [x] Add display:flex + align-items:center to ALL slide containers for proper vertical centering (all 18 templates rewritten with inline styles)
- [x] Add missing CSS utility classes to BASE_CSS (h-full, w-full, h-2, w-2, w-10, h-10, w-20, h-20, h-80, mt-2)
- [x] Improve Writer Agent prompt: require 4-5 bullet points with title+description, specific numbers/facts
- [x] Improve Layout Agent prompt: content-matching rules, better diversity, avoid image layouts without images
- [x] Improve HTML Composer prompt: minimum content density per layout type (4-5 bullets, 3-4 metrics, 4-5 steps)
- [x] Fix fallback data builder: use proper icon objects instead of emoji strings
- [x] Write vitest tests for template vertical centering (11 new tests — 128 total passing)
- [x] Test with multiple topics and verify visual quality — 11 slides generated, all properly centered, content fills slides well

### ✨ OpenAI API Fallback ✅

- [x] Add OPENAI_API_KEY secret to project
- [x] Implement fallback in LLM helper: try built-in API first, fall back to OpenAI on failure (gpt-4o model)
- [x] Test slide generation with OpenAI fallback (36 sec, 9 slides)
- [x] Verify slide rendering fixes visually with new generation — all 3 critical issues confirmed fixed

### 🐛 Bug Fix: Slide rendering issues (Round 3) ✅

- [x] Fix section-header template: added decorative elements (divider line, section number), improved vertical centering
- [x] Fix icons-numbers template: replaced emoji icons with styled numbered circles, redesigned description boxes (no more progress bars)
- [x] Fix HTML Composer prompt: updated instructions for icons-numbers layout data generation
- [x] Fix Viewer: slides now centered — viewport-locked layout with overflow-hidden, no page scrolling
- [x] Test with new generation and visual verification — confirmed all fixes working via OpenAI fallback

### ✨ Post-Assembly Slide Editing (Edit text/images without full regeneration) ✅

- [x] Backend: Store individual slide data (content, layout, theme, image) per slide in DB (slideData JSON column)
- [x] Backend: GET /api/v1/presentations/:id/slides — return all slides with editable data
- [x] Backend: PUT /api/v1/presentations/:id/slides/:slideIndex — update slide text content
- [x] Backend: POST /api/v1/presentations/:id/slides/:slideIndex/upload-image — upload new image
- [x] Backend: DELETE /api/v1/presentations/:id/slides/:slideIndex/image — remove slide image
- [x] Backend: POST /api/v1/presentations/:id/slides/:slideIndex/render — re-render single slide HTML
- [x] Backend: POST /api/v1/presentations/:id/reassemble — reassemble full presentation HTML from edited slides
- [x] Frontend: Edit mode toggle in Viewer page ("Редактировать" / "Закрыть редактор")
- [x] Frontend: Slide text editor panel (title, subtitle, description, bullet points by layout type)
- [x] Frontend: Image management (upload, replace, remove) per slide with drag-and-drop
- [x] Frontend: Save changes button with re-render and reassemble ("Сохранить все изменения")
- [x] Frontend: Visual feedback during save/re-render (toast notifications, loading states)
- [x] Write vitest tests for editing endpoints (15 new tests — 99 total passing)
- [x] End-to-end testing: all 5 visual tests passed (editor open, text edit, navigation, image controls, reassemble)

### 🐛 Bug Fix: Slides rendering incorrectly ✅

- [x] Investigate slide generation pipeline (templates, HTML composer, layout)
- [x] Test end-to-end generation and identify specific rendering issues
- [x] Fix: Layout fixup — remap image-requiring layouts (image-text, image-fullscreen, quote-slide) to text alternatives when no image available
- [x] Fix: Title-slide template — decorative gradient instead of ugly SVG placeholder when no image
- [x] Fix: Image-text template — gradient fallback instead of broken placeholder icon
- [x] Fix: HTML Composer prompt — added explicit layout schemas for all 14 layout types
- [x] Fix: Layout Agent prompt — discourage image-text/image-fullscreen for non-image slides
- [x] Fix: Applied same layout fixup to interactive mode assemble endpoint
- [x] Verify fixes with tests (84 tests passing) and visual inspection (15 slides, all rendering correctly)

### ✨ Custom Image Upload on Step 2 ✅

- [x] Backend: POST /api/v1/interactive/:id/upload-image endpoint (multipart/form-data)
- [x] Backend: Upload image to S3 via storagePut, store URL in pipelineState.images
- [x] Backend: Validate file type (jpg, png, webp, gif) and size limit (5MB)
- [x] Frontend: Upload button alongside AI-generate button in image panel
- [x] Frontend: Drag-and-drop zone for image upload
- [x] Frontend: File picker with image type filter
- [x] Frontend: Upload progress indicator
- [x] Frontend: Preview uploaded image with replace/remove options
- [x] Write vitest tests for upload endpoint (10 new tests — 84 total passing)

### ✨ Auto Image Generation in Batch Mode ✅

- [x] Backend: selectSlidesForImages — LLM picks 2-3 slides eligible for illustrations
- [x] Backend: generateSlideImages — parallel image generation (max 3 concurrent)
- [x] Backend: SKIP_IMAGE_LAYOUTS filter (title, final, chart, table, icons, agenda excluded)
- [x] Backend: Image step integrated into pipeline between Layout and HTML Composer
- [x] Backend: Layout override to "image-text" for slides with images
- [x] Backend: Image data injected into slide data (image.url, backgroundImage.url)
- [x] Backend: WebSocket progress events for image generation step
- [x] Backend: Graceful failure handling — pipeline continues without images on error
- [x] Frontend: enableImages toggle on Home.tsx (enabled by default)
- [x] Frontend: Updated GENERATION_STEPS with "Генерация иллюстраций" label
- [x] Frontend: enable_images passed through API config
- [x] Write vitest tests for batch image generation logic (11 new tests — 75 total passing)

### ✨ AI Image Generation for Slides ✅

- [x] Backend: POST /api/v1/interactive/:id/generate-image endpoint
- [x] Backend: POST /api/v1/interactive/:id/suggest-image-prompt — LLM suggests prompt from slide content
- [x] Backend: DELETE /api/v1/interactive/:id/remove-image — remove image from slide
- [x] Backend: Store image URLs in pipelineState.images map (slide_number → {url, prompt})
- [x] Backend: Update preview-slide to use image-text layout when image exists
- [x] Backend: Update assemble to inject image URLs into HTML composition
- [x] Backend: Return images in content endpoint response
- [x] Frontend: Image generation panel in Step 2 content cards
- [x] Frontend: "Подсказать промпт" button that calls LLM for image description
- [x] Frontend: "Сгенерировать" button with loading state
- [x] Frontend: Image preview thumbnail with remove button
- [x] Frontend: Image indicator badge in slide header
- [x] Write vitest tests for image generation logic (10 new tests — 64 total passing)

### ✨ Regenerate Single Slide on Step 2 ✅

- [x] Backend: API endpoint POST /api/v1/interactive/:id/regenerate-slide calling runWriterSingle
- [x] Backend: Update pipelineState content array with regenerated slide, preserve slide_number
- [x] Frontend: "Перегенерировать" button with RotateCcw icon on each slide card (accent styling)
- [x] Frontend: Loading overlay with blur + spinner during regeneration, border highlight
- [x] Frontend: Update local content state with new AI-generated text, exit edit mode
- [x] Frontend: Auto-refresh preview after regeneration (previewRefreshKey)
- [x] Write vitest tests for regeneration (7 new tests — 54 total passing)

### ✨ Drag-and-Drop Slide Reordering on Step 1 ✅

- [x] Install @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities
- [x] Replace up/down arrow buttons with drag handle + DnD SortableContext
- [x] Add visual feedback during drag (ghost opacity, DragOverlay with accent border/shadow)
- [x] Auto-renumber slides after reorder (arrayMove + map renumber)
- [x] Keep expand/collapse and edit functionality working with DnD (SortableSlideCard component)
- [x] Write vitest tests for reorder logic (5 new DnD tests — 48 total passing)

### ✨ Real-time Slide Preview on Step 2 ✅

- [x] Backend: API endpoint to render single slide HTML from content + theme + layout (preview-slide)
- [x] Backend: Heuristic layout picker (no LLM call = instant preview)
- [x] Backend: Direct data builder for all layout types (title, bullet, metrics, quote, etc.)
- [x] Frontend: SlidePreview component with scaled iframe rendering (1280x720 → 480x270)
- [x] Frontend: Fullscreen modal for detailed preview
- [x] Frontend: Integrate preview panel into Interactive.tsx Step 2 (two-column: editor + preview)
- [x] Frontend: Auto-refresh preview when user saves edits (previewRefreshKey)
- [x] Frontend: Loading state, error handling, show/hide toggle for preview
- [x] Write vitest tests for preview (13 new tests: layout picker + data builder) — 43 total passing

### ✨ Interactive Mode — Step-by-step Approval UI ✅

- [x] Backend: Split pipeline into steps (plan → outline → content → theme → assembly)
- [x] Backend: API endpoints for each interactive step (start, approve-outline, get-content, update-slide, assemble)
- [x] Backend: Store intermediate state in DB (pipelineState with outline, content, status)
- [x] Frontend: Interactive generation page with step wizard UI
- [x] Frontend: Step 1 — Outline review/edit (reorder slides, edit titles/purpose/key_points, add/remove slides)
- [x] Frontend: Step 2 — Content review/edit (per-slide content editing with save)
- [x] Frontend: Step 3 — Final assembly with progress via WebSocket
- [x] Frontend: Navigation between steps with back/forward
- [x] Connect interactive frontend to backend API (api.ts methods + routes)
- [x] Write vitest tests for interactive endpoints (11 tests passing)

### 🚀 Improve Slide Design ✅

- [x] Add new color themes with gradient backgrounds (10 themes total)
- [x] Improve base slide CSS: better typography, spacing, shadows
- [x] Add gradient overlays and decorative elements to slide templates
- [x] Update frontend theme selector with visual gradient grid
- [x] Update constants.ts with new theme list
- [x] Create predefined theme presets (server/pipeline/themes.ts)
- [x] Skip LLM theme generation when preset is selected (faster generation)
- [x] Update section-header and final-slide to use accent gradient backgrounds
- [x] Test generation with new themes
- [x] Write vitest tests for theme system (10 tests passing)

### 🐛 Critical Bug Fixes Round 2 ✅

- [x] Fix Viewer: slides show as black screen in main area (iframe not rendering)
- [x] Fix Viewer: thumbnails are tiny and not properly scaled
- [x] Verify slide count slider is removed in deployed version

### 🐛 Bug Fixes: Viewer + Home Page ✅

- [x] Fix Viewer: main slide iframe not displaying content (black/empty area)
- [x] Fix Viewer: thumbnails not scaling properly (too small, cropped, wrong proportions)
- [x] Remove slide count slider from Home page form
- [x] Update pipeline to auto-determine slide count based on content ("one slide = one idea")
- [x] Update API schema to make slide_count optional

### 🏗️ Rewrite Backend in Node.js (integrated into Manus project) ✅

- [x] Study Python backend pipeline, prompts, templates
- [x] Create Drizzle schema for presentations table
- [x] Build presentation generation pipeline with invokeLLM
- [x] Create API endpoints (create, list, get, delete presentations)
- [x] Add WebSocket support for real-time progress
- [x] Port HTML slide templates from Python to Node.js
- [x] Connect frontend to new tRPC/Express endpoints
- [x] Write vitest tests for backend
- [x] Test full end-to-end flow

### 🐛 Bug Fix: POST /presentations 500 error on deployed version ✅

- [x] Resolve conflicts from web-db-user upgrade (keep existing pages)
- [x] Add Express proxy routes for /api/v1/* and /ws/* to forward to FastAPI backend
- [x] Configure VITE_BACKEND_URL secret for FastAPI backend URL
- [x] Test full cycle on deployed version

### 🏗️ Phase 6: Polish ✅

- [x] Fix any issues found during testing
- [x] Improve error messages
- [x] Add loading states

### 🏗️ Phase 5: Docker Compose ✅

- [x] Add frontend Dockerfile
- [x] Add frontend service to docker-compose.yml
- [x] Configure nginx or reverse proxy
- [x] Test unified deployment

### 🏗️ Phase 4: Test Full Cycle ✅

- [x] Start backend server
- [x] Create presentation via frontend form
- [x] Verify WebSocket progress events
- [x] View completed presentation in Viewer
- [x] Test History page with real data

### 🏗️ Phase 3: Update API Client ✅

- [x] Handle real backend response formats
- [x] Add error handling for network failures
- [x] Fix WebSocket reconnection logic
- [x] Handle presentation HTML fetching from result_urls

### 🏗️ Phase 2: Configure Connection ✅

- [x] Add .env file with API_BASE_URL and WS_BASE_URL
- [x] Configure Vite proxy for API requests (dev mode)
- [x] Handle CORS if needed

### 🏗️ Phase 1: Review ✅

- [x] Check backend API routes and base URL
- [x] Check WebSocket endpoint format
- [x] Review current frontend API client

---

## By Category

### ✨ New Features (36 sections, 308/308 tasks)

- **Interactive Mode — Step-by-step Approval UI** — ✅
- **Real-time Slide Preview on Step 2** — ✅
- **Drag-and-Drop Slide Reordering on Step 1** — ✅
- **Regenerate Single Slide on Step 2** — ✅
- **AI Image Generation for Slides** — ✅
- **Auto Image Generation in Batch Mode** — ✅
- **Custom Image Upload on Step 2** — ✅
- **Post-Assembly Slide Editing (Edit text/images without full regeneration)** — ✅
- **OpenAI API Fallback** — ✅
- **Drag & Drop Slide Reordering in Viewer** — ✅
- **Retry Logic for Image Generation** — ✅
- **Retry Button on Generation Error** — ✅
- **Auto-Density Fallback** — ✅
- **Auto-Save for Inline Editing** — ✅
- **Inline Image Editing** — ✅
- **Auto-Expanding Text Boxes in Inline Editing** — ✅
- **SSE Streaming Responses** — ✅
- **Task 1: Chat History Sidebar** — ✅
- **Task 2: Step-by-step Slide Preview in Chat** — ✅
- **Task 3: Light Theme Redesign + Settings in Input Area** — ✅
- **Feature: File Upload for Presentation Creation** — ✅
- **Custom Template Upload Feature** — ✅
- **Typing Indicator Animation** — ✅
- **Navigation: Back from presentation viewer → originating chat** — ✅
- **Auto-save Settings in localStorage** — ✅
- **Paste-to-attach & File chips inside input area** — ✅
- **Fix: Chart axis labels and units** — ✅
- **Task: Fix TS errors in chatRoutes.ts** — ✅
- **Task: Add radar chart support** — ✅
- **Task: Improve Design Critique scoring** — ✅
- **Task: Comprehensive product testing** — ✅
- **Task: PPTX Export** — ✅
- **Task: Share by Link** — ✅
- **Task: Template Gallery** — ✅
- **Task: Version History** — ✅
- **Task: PDF Export** — ✅

### 🚀 Improvements (65 sections, 767/779 tasks)

- **Improve Slide Design** — ✅
- **Quality Overhaul: Slide Templates & Content** — ✅
- **Quality Improvement: QA Agent + Writer Context + Adaptive Fonts** — ✅
- **Quality Improvement Round 3: Outline, Footers, Markdown, Transitions, Images** — ✅
- **Sprint 1: Agent Architecture Improvements** — ✅
- **Sprint 2: Design Critic Agent** — ✅
- **Sprint 3: New Layout Templates** — ✅
- **Sprint 4: Research Agent** — ✅
- **Sprint 5: Data Visualization Agent** — ✅
- **Sprint 6: Template Overflow Audit** — ✅
- **Sprint 6.1: Visual Overflow Testing & Engine Fixes** — ✅
- **Sprint 7: Adaptive Typography** — ✅
- **Sprint 8: Interactive Mode Testing & Fixes** — ✅
- **Sprint 9: Inline Slide Editing in Viewer** — 0/12
- **Sprint 6 — Inline Editing in Viewer** — ✅
- **Manus-Style Design Improvements (Design Diversity)** — ✅
- **Sprint 6: Remaining Layouts (dual-chart + risk-matrix)** — ✅
- **Deep Quality Improvement: Presentation Generation Pipeline** — ✅
- **Round 4: New Templates + Design Critic + Test Generation** — ✅
- **Round 5: HTML Composer Mapping Improvement** — ✅
- **Round 6: New Templates + Composer Validation + Test Generation** — ✅
- **Round 7: Test Generation + Kanban Board + LLM Validation** — ✅
- **Round 8: DataViz Fix + Design Critique + Org-Chart + Prompt Fix** — ✅
- **Round 9: Codebase Audit & Refactoring** — ✅
- **Round 10: Deep Refactoring — THEME_PRESETS, autoFixSlideData, REST→tRPC** — ✅
- **Round 11: Project Documentation** — ✅
- **Round 12: README Audit & Corrections** — ✅
- **Round 13: Developer Tools — Auto-README, Swagger, CHANGELOG** — ✅
- **Round 14: CI/CD, Analytics Dashboard, Postman Collection** — ✅
- **Round 15: Analytics Export, Error Notifications, Theme A/B Metrics** — ✅
- **Round 16: Pipeline Audit & Quality Improvement Report** — ✅
- **Round 17: Development Plan for Pipeline Quality Improvements** — ✅
- **Round 18: Phase 1 Quick Wins Implementation** — ✅
- **Round 19: Phase 2 Evaluator-Optimizer Implementation** — ✅
- **Round 20: Phase 3 Visual Review + Composer Few-Shot** — ✅
- **Round 21: Phase 4 Advanced Implementation** — ✅
- **Round 22: Comprehensive Quality Testing & Validation** — ✅
- **Round 23: Fact-Checking in Final Review + Chart Label Fix** — ✅
- **Round 24: Fix PPTX Export Quality** — ✅
- **Round 25: Fix card-grid layout issues** — ✅
- **Round 26: Image-based structure recognition from uploaded screenshots** — ✅
- **Round 27: Fix card-grid layout — old presentations with broken grid CSS** — ✅
- **Round 28: Implement true slide-by-slide step-by-step mode** — ✅
- **Round 29: Slide progress bar in chat UI** — ✅
- **Round 32: BSPB Brand Template & Business Copywriter Skill** — ✅
- **Round 32b: BSPB Logo Integration** — ✅
- **Round 32c: Visual Test of BSPB Theme** — ✅
- **Round 32d: Full UI Flow Test** — ✅
- **Round 33: Fix card/column blocks vertical centering on slides** — ✅
- **Round 34: Fix slide editing mode — text not editable on click** — ✅
- **Round 35: Advanced inline editing improvements** — ✅
- **Round 36: Advanced inline editor UX improvements** — ✅
- **Round 37: BSPB Title Slide from Original Presentation** — ✅
- **Round 38: Fix Interactive Mode Bugs (SQL error + repeated mode selection)** — ✅
- **Round 39: Fix BSPB Theme (white bg, no circles) + Design Feedback Not Applied** — ✅
- **Round 40: Fix Title Slide Text Overflow** — ✅
- **Round 41: Fix BSPB Theme Not Applied + Preview Overflow + Design Feedback** — ✅
- **Round 42: BSPB Theme Test + Post-Generation Theme Switching + Fullscreen Preview** — ✅
- **Round 43: Persist Slide Previews + Theme Preview + PPTX Export Verification** — ✅
- **Round 44: Fix User Chat Bubble Text Color** — ✅
- **Round 45: Comments on Messages + Comments on Slides + Copy Any Message** — ✅
- **Round 46: Quote-Reply + Inline Annotations** — ✅
- **Round 47: Quote Context in AI Prompts** — ✅
- **Round 48: Annotation Highlights, Apply Changes, Slide Quoting** — ✅
- **Round 49: Research-First Pipeline Refactoring** — ✅

### 🎨 Design (1 sections, 8/8 tasks)

- **Auto-Theme Selection (AI-based)** — ✅

### 🐛 Bug Fixes (24 sections, 125/125 tasks)

- **Bug Fix: POST /presentations 500 error on deployed version** — ✅
- **Bug Fixes: Viewer + Home Page** — ✅
- **Critical Bug Fixes Round 2** — ✅
- **Bug Fix: Slides rendering incorrectly** — ✅
- **Bug Fix: Slide rendering issues (Round 3)** — ✅
- **Bug Fixes** — ✅
- **Bug Fix — Viewer Layout Broken** — ✅
- **Bug Fix — Generation Hangs at Image Generation Step** — ✅
- **Bug Fix — Metrics Slide Overflow** — ✅
- **Bug Fix — Inline Editing Only Works for Title** — ✅
- **Bug Fix: Text messages during awaiting_approval treated as approval** — ✅
- **Bug Fix: Mode auto-starts without user selecting** — ✅
- **Bug Fix: Chat names should auto-generate from topic** — ✅
- **Bug Fix: Viewer shows empty slides (URL not found)** — ✅
- **Bug Fix: Presentation generation hangs after selecting Quick mode** — ✅
- **Bug Fix: New empty chat sessions created repeatedly on every page load** — ✅
- **Bug Fix: Empty 'Новый чат' sessions STILL being created (persistent)** — ✅
- **Bug Fix: Chat UI doesn't update after sending message** — ✅
- **Bug Fix: Chat resets to empty after sending message with attached file** — ✅
- **Bug Fix: Pressing Enter with attached file does nothing** — ✅
- **Bug Fixes from CJM Testing** — ✅
- **Bug Fix: Sidebar Scroll in Viewer** — ✅
- **Round 30: Bug fixes — slide preview clipping + design feedback not working** — ✅
- **Round 31: Bug fix — empty slide preview in step-by-step mode** — ✅

### 🏗️ Infrastructure (7 sections, 31/31 tasks)

- **Phase 1: Review** — ✅
- **Phase 2: Configure Connection** — ✅
- **Phase 3: Update API Client** — ✅
- **Phase 4: Test Full Cycle** — ✅
- **Phase 5: Docker Compose** — ✅
- **Phase 6: Polish** — ✅
- **Rewrite Backend in Node.js (integrated into Manus project)** — ✅

### 🧪 Testing (1 sections, 5/5 tasks)

- **Test Generation Results & Fixes** — ✅
