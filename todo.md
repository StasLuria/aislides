# Frontend ↔ Backend Integration

## Phase 1: Review
- [x] Check backend API routes and base URL
- [x] Check WebSocket endpoint format
- [x] Review current frontend API client

## Phase 2: Configure Connection
- [x] Add .env file with API_BASE_URL and WS_BASE_URL
- [x] Configure Vite proxy for API requests (dev mode)
- [x] Handle CORS if needed

## Phase 3: Update API Client
- [x] Handle real backend response formats
- [x] Add error handling for network failures
- [x] Fix WebSocket reconnection logic
- [x] Handle presentation HTML fetching from result_urls

## Phase 4: Test Full Cycle
- [x] Start backend server
- [x] Create presentation via frontend form
- [x] Verify WebSocket progress events
- [x] View completed presentation in Viewer
- [x] Test History page with real data

## Phase 5: Docker Compose
- [x] Add frontend Dockerfile
- [x] Add frontend service to docker-compose.yml
- [x] Configure nginx or reverse proxy
- [x] Test unified deployment

## Phase 6: Polish
- [x] Fix any issues found during testing
- [x] Improve error messages
- [x] Add loading states

## Bug Fix: POST /presentations 500 error on deployed version
- [x] Resolve conflicts from web-db-user upgrade (keep existing pages)
- [x] Add Express proxy routes for /api/v1/* and /ws/* to forward to FastAPI backend
- [x] Configure VITE_BACKEND_URL secret for FastAPI backend URL
- [x] Test full cycle on deployed version

## Rewrite Backend in Node.js (integrated into Manus project)
- [x] Study Python backend pipeline, prompts, templates
- [x] Create Drizzle schema for presentations table
- [x] Build presentation generation pipeline with invokeLLM
- [x] Create API endpoints (create, list, get, delete presentations)
- [x] Add WebSocket support for real-time progress
- [x] Port HTML slide templates from Python to Node.js
- [x] Connect frontend to new tRPC/Express endpoints
- [x] Write vitest tests for backend
- [x] Test full end-to-end flow

## Bug Fixes: Viewer + Home Page
- [x] Fix Viewer: main slide iframe not displaying content (black/empty area)
- [x] Fix Viewer: thumbnails not scaling properly (too small, cropped, wrong proportions)
- [x] Remove slide count slider from Home page form
- [x] Update pipeline to auto-determine slide count based on content ("one slide = one idea")
- [x] Update API schema to make slide_count optional

## Critical Bug Fixes Round 2
- [x] Fix Viewer: slides show as black screen in main area (iframe not rendering)
- [x] Fix Viewer: thumbnails are tiny and not properly scaled
- [x] Verify slide count slider is removed in deployed version

## Improve Slide Design
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

## Interactive Mode — Step-by-step Approval UI
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

## Real-time Slide Preview on Step 2
- [x] Backend: API endpoint to render single slide HTML from content + theme + layout (preview-slide)
- [x] Backend: Heuristic layout picker (no LLM call = instant preview)
- [x] Backend: Direct data builder for all layout types (title, bullet, metrics, quote, etc.)
- [x] Frontend: SlidePreview component with scaled iframe rendering (1280x720 → 480x270)
- [x] Frontend: Fullscreen modal for detailed preview
- [x] Frontend: Integrate preview panel into Interactive.tsx Step 2 (two-column: editor + preview)
- [x] Frontend: Auto-refresh preview when user saves edits (previewRefreshKey)
- [x] Frontend: Loading state, error handling, show/hide toggle for preview
- [x] Write vitest tests for preview (13 new tests: layout picker + data builder) — 43 total passing

## Drag-and-Drop Slide Reordering on Step 1
- [x] Install @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities
- [x] Replace up/down arrow buttons with drag handle + DnD SortableContext
- [x] Add visual feedback during drag (ghost opacity, DragOverlay with accent border/shadow)
- [x] Auto-renumber slides after reorder (arrayMove + map renumber)
- [x] Keep expand/collapse and edit functionality working with DnD (SortableSlideCard component)
- [x] Write vitest tests for reorder logic (5 new DnD tests — 48 total passing)

## Regenerate Single Slide on Step 2
- [x] Backend: API endpoint POST /api/v1/interactive/:id/regenerate-slide calling runWriterSingle
- [x] Backend: Update pipelineState content array with regenerated slide, preserve slide_number
- [x] Frontend: "Перегенерировать" button with RotateCcw icon on each slide card (accent styling)
- [x] Frontend: Loading overlay with blur + spinner during regeneration, border highlight
- [x] Frontend: Update local content state with new AI-generated text, exit edit mode
- [x] Frontend: Auto-refresh preview after regeneration (previewRefreshKey)
- [x] Write vitest tests for regeneration (7 new tests — 54 total passing)

## AI Image Generation for Slides
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

## Auto Image Generation in Batch Mode
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

## Custom Image Upload on Step 2
- [x] Backend: POST /api/v1/interactive/:id/upload-image endpoint (multipart/form-data)
- [x] Backend: Upload image to S3 via storagePut, store URL in pipelineState.images
- [x] Backend: Validate file type (jpg, png, webp, gif) and size limit (5MB)
- [x] Frontend: Upload button alongside AI-generate button in image panel
- [x] Frontend: Drag-and-drop zone for image upload
- [x] Frontend: File picker with image type filter
- [x] Frontend: Upload progress indicator
- [x] Frontend: Preview uploaded image with replace/remove options
- [x] Write vitest tests for upload endpoint (10 new tests — 84 total passing)

## Bug Fix: Slides rendering incorrectly
- [x] Investigate slide generation pipeline (templates, HTML composer, layout)
- [x] Test end-to-end generation and identify specific rendering issues
- [x] Fix: Layout fixup — remap image-requiring layouts (image-text, image-fullscreen, quote-slide) to text alternatives when no image available
- [x] Fix: Title-slide template — decorative gradient instead of ugly SVG placeholder when no image
- [x] Fix: Image-text template — gradient fallback instead of broken placeholder icon
- [x] Fix: HTML Composer prompt — added explicit layout schemas for all 14 layout types
- [x] Fix: Layout Agent prompt — discourage image-text/image-fullscreen for non-image slides
- [x] Fix: Applied same layout fixup to interactive mode assemble endpoint
- [x] Verify fixes with tests (84 tests passing) and visual inspection (15 slides, all rendering correctly)

## Post-Assembly Slide Editing (Edit text/images without full regeneration)
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

## Bug Fix: Slide rendering issues (Round 3)
- [x] Fix section-header template: added decorative elements (divider line, section number), improved vertical centering
- [x] Fix icons-numbers template: replaced emoji icons with styled numbered circles, redesigned description boxes (no more progress bars)
- [x] Fix HTML Composer prompt: updated instructions for icons-numbers layout data generation
- [x] Fix Viewer: slides now centered — viewport-locked layout with overflow-hidden, no page scrolling
- [x] Test with new generation and visual verification — confirmed all fixes working via OpenAI fallback

## OpenAI API Fallback
- [x] Add OPENAI_API_KEY secret to project
- [x] Implement fallback in LLM helper: try built-in API first, fall back to OpenAI on failure (gpt-4o model)
- [x] Test slide generation with OpenAI fallback (36 sec, 9 slides)
- [x] Verify slide rendering fixes visually with new generation — all 3 critical issues confirmed fixed

## Quality Overhaul: Slide Templates & Content
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

## Quality Improvement: QA Agent + Writer Context + Adaptive Fonts
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

## Quality Improvement Round 3: Outline, Footers, Markdown, Transitions, Images
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

## Sprint 1: Agent Architecture Improvements

### Task 1: Storytelling Agent
- [x] Create storytellingAgent.ts with action titles enforcement
- [x] Add narrative coherence check (logical transitions between slides)
- [x] Add transition phrases generation for speaker flow
- [x] Integrate into pipeline after Writer, before Layout
- [x] Write vitest tests for Storytelling Agent (17 tests, 219 total)
- [x] Verify end-to-end generation works with Storytelling Agent

### Task 2: Outline Critic Agent
- [x] Create outlineCritic.ts with structure validation
- [x] Check Pyramid Principle compliance
- [x] Check MECE structure of arguments
- [x] Check slide type balance and variety
- [x] Integrate into pipeline after Outline Agent with retry loop
- [x] Write vitest tests for Outline Critic (19 tests, 238 total)
- [x] Verify end-to-end generation works with Outline Critic

### Task 3: Speaker Coach Agent
- [x] Create speakerCoachAgent.ts with professional notes generation
- [x] Generate talking points (not slide text repetition)
- [x] Add transition phrases between slides
- [x] Add timing hints per slide + audience engagement cues + delivery tips
- [x] Integrate into pipeline after image generation, before HTML composition
- [x] Write vitest tests for Speaker Coach (22 tests, 260 total)
- [x] Verify end-to-end generation works with Speaker Coach

## Sprint 2: Design Critic Agent

### Design Critic Agent
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

## Sprint 3: New Layout Templates

### New Layouts (8-10 templates)
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

## Sprint 4: Research Agent

### Research Agent — Fact & Statistics Enrichment
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

## Sprint 5: Data Visualization Agent

### SVG Chart Generators
- [x] Create svgChartEngine.ts with pure SVG chart rendering (5 chart types)
- [x] Implement vertical bar chart with labels, values, grid lines, animations
- [x] Implement horizontal bar chart for comparison data
- [x] Implement line chart with data points, gradient fill, smooth curves
- [x] Implement pie chart with segments, labels, and legend
- [x] Implement donut chart with center metric
- [x] Add theme-aware color palettes (CSS variables)
- [x] Add responsive sizing with viewBox

### Data Visualization Agent
- [x] Create dataVizAgent.ts with data extraction from slide content
- [x] Implement data extraction from data_points and text patterns
- [x] Implement chart type recommendation (recommendChartType) based on data patterns
- [x] Implement LLM-based data detection for complex slides
- [x] Add chart SVG injection into slide HTML (injectChartIntoSlideData)
- [x] Add triple-brace {{{ }}} raw HTML support in template engine

### Pipeline Integration
- [x] Integrate into pipeline after Speaker Coach, before HTML Composer
- [x] Update frontend constants with data_viz step
- [x] Update chart-slide template to support SVG alongside canvas
- [x] Write vitest tests for SVG generators (56 tests, 435 total)
- [x] Write vitest tests for Data Visualization Agent
- [x] Verify end-to-end generation with charts

## Bug Fixes

- [x] Fix icons-numbers template: content overflows slide, cards too large, title cut off
  - Reduced title font-size 42→30px with 2-line clamp
  - Reduced card padding 28→16px, gap 32→16px, value font 42→28px
  - Added smart column count: ≤3 items = 1 row, 4 items = 2x2 grid
  - Added overflow: hidden and text-overflow: ellipsis on descriptions (3-line clamp)
  - Reduced icon container 48→36px

## Sprint 6: Template Overflow Audit

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

## Sprint 6.1: Visual Overflow Testing & Engine Fixes

- [x] Generate visual test HTML with all 23 templates using long content
- [x] Inspect all 27 slides in browser for overflow issues
- [x] Fix roadmap template: raw Jinja2 syntax was rendering as text
- [x] Fix template engine: add arithmetic operators (%, *, /, +, -) to evalExpression
- [x] Fix template engine: rewrite processIfBlocks for nested if/else/endif support (inside-out processing)
- [x] Fix template engine: improve dot notation with proper bracket handling
- [x] Verify roadmap renders alternating top/bottom milestones correctly
- [x] All 520 tests passing, no regressions


## Sprint 7: Adaptive Typography

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

## Sprint 8: Interactive Mode Testing & Fixes

- [x] Analyze existing interactive mode implementation (interactiveRoutes.ts + Interactive.tsx)
- [x] End-to-end test: create presentation in interactive mode via browser
- [x] Fix title-slide description overflow — truncate to 150 chars in buildPreviewData
- [x] Fix title-slide template — add line-clamp-3 on description
- [x] Fix chart rendering in Viewer — include Chart.js scripts in parseSlides for canvas slides
- [x] Fix batch pipeline — add same title/final-slide description truncation post-processing
- [x] Verify interactive mode flow: structure → content → assembly → view (all working)
- [x] All 593 tests passing, no regressions

## Sprint 9: Inline Slide Editing in Viewer

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

## Sprint 6 — Inline Editing in Viewer
- [x] Add data-field attributes to rendered slide HTML via post-processing (inlineFieldInjector.ts)
- [x] Create new API endpoint for inline field updates (PATCH single field)
- [x] Create GET editable slide endpoint (returns HTML with inline editing script)
- [x] Create InlineEditableSlide component with contentEditable + postMessage
- [x] Integrate inline editing into Viewer (toggle between sidebar and inline modes)
- [x] Add inline editing CSS styles (hover highlights, focus outlines, save indicators)
- [x] Write vitest tests for inline editing (30 tests, all passing)
- [x] Add API client methods (getEditableSlide, patchSlideField)

## Bug Fix — Viewer Layout Broken
- [x] Root cause: image-text template had unclosed </div> in bullet loop (5 unclosed divs per slide)
- [x] Fix template: added missing closing tag on line 143 of templateEngine.ts
- [x] Fix parseSlides: replaced DOM-based querySelectorAll with regex-based splitting on raw HTML
- [x] Verified all 26 templates have balanced div tags (automated Python checker)
- [x] Verified all 8 slides render correctly in Viewer (visual inspection)
- [x] All 623 tests passing

## Drag & Drop Slide Reordering in Viewer
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

## Bug Fix — Generation Hangs at Image Generation Step
- [x] Diagnosed: generateImage() and callApi() had no timeouts — fetch could hang indefinitely
- [x] Added 60s AbortController timeout to generateImage() in _core/imageGeneration.ts
- [x] Added 120s AbortController timeout to callApi() in _core/llm.ts
- [x] Added 10-minute overall pipeline timeout via Promise.race in presentationRoutes.ts
- [x] Added per-image error logging in generateSlideImages() (warns but continues)
- [x] Reset stuck presentation jp_mAkyYccX17ipm to failed status
- [x] All 642 tests passing

## Retry Logic for Image Generation
- [x] Created generic withRetry() utility with exponential backoff + jitter (server/_core/retry.ts)
- [x] Applied retry to generateImage(): 2 retries, 2s initial delay, retryable on timeout/network/5xx/429
- [x] Applied retry to LLM callApi(): 2 retries, 2s initial delay, retryable on timeout/network/5xx/429
- [x] Non-retryable errors (4xx client errors, usage exhausted) fail immediately
- [x] Log retry attempts with warning messages including attempt count and delay
- [x] Write vitest tests for retry behavior (11 tests: success, retry-then-succeed, exhaust, non-retryable, backoff, cap)
- [x] All 653 tests passing

## Retry Button on Generation Error
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

## Bug Fix — Metrics Slide Overflow
- [x] Diagnosed: icons-numbers template grid cards overflowed 720px with 4+ metrics + descriptions
- [x] Fixed: added grid-template-rows, max-height:100%, overflow:hidden on grid; reduced card padding/gaps/icon sizes
- [x] Reduced description -webkit-line-clamp from 3 to 2 to save vertical space
- [x] Checked all 26 templates — no other overflow or div-balance issues found
- [x] All 664 tests passing

## Auto-Density Fallback
- [x] Studied density system: computeDensity → autoDensity → renderSlide pipeline
- [x] Created server/pipeline/autoDensity.ts with estimateContentHeight() for 16 layout types
- [x] Implemented auto-density escalation: normal → compact → dense based on estimated height vs 622px available
- [x] Height estimation uses per-density CSS params (font sizes, padding, gaps, line clamps)
- [x] Integrated into renderSlide: computeDensity → autoDensity → injectDensityClass
- [x] Console logging when density is escalated (for debugging)
- [x] Write vitest tests: 20 tests (10 estimateContentHeight + 10 autoDensity), all passing
- [x] All 684 tests passing

## Bug Fix — Inline Editing Only Works for Title
- [x] Diagnose why non-title fields (description, bullets, etc.) are not editable in inline mode
- [x] Fix inlineFieldInjector to properly mark all text fields as contentEditable
- [x] Test inline editing across multiple slide layouts (title-slide, text-slide, two-column, etc.)
- [x] Write/update vitest tests

## Auto-Save for Inline Editing
- [x] Analyze current manual save flow (pendingChanges, handleSaveAll)
- [x] Implement debounced auto-save with 2s debounce + auto-reassemble
- [x] Replace manual "Save all changes" button with auto-save status indicator
- [x] Show save status: pending → reassembling → saved → idle (or error)
- [x] Handle save errors gracefully with toast notification + auto-reset
- [x] Test auto-save across multiple edits and slide switches
- [x] Write/update vitest tests (11 tests in autoSave.test.ts)

## Inline Image Editing
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

## Auto-Expanding Text Boxes in Inline Editing
- [x] Analyze how slide templates constrain text box sizes (fixed height, overflow hidden, line-clamp, text-overflow)
- [x] Remove overflow restrictions during inline editing mode (CSS !important overrides)
- [x] Make text containers auto-expand when content grows (height:auto, min-height, overflow:visible)
- [x] Ensure adjacent elements reflow/shift when a text box expands (flex/grid auto-sizing)
- [x] Handle slide container overflow gracefully (iframe dynamic height via postMessage + MutationObserver)
- [x] Test across all slide layouts (title-slide, two-column, text-slide, image-text, final-slide)
- [x] Write/update vitest tests (8 new auto-expand tests)

## Manus-Style Design Improvements (Design Diversity)
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

## Auto-Theme Selection (AI-based)
- [x] Create theme classification mapping (topic → theme) — 12 themes with keyword rules + regex patterns
- [x] Implement themeSelector agent with LLM-based analysis — structured JSON output with theme_id + reason
- [x] Add keyword-based fast matching (no LLM needed for obvious cases) — instant scoring with confidence levels
- [x] Integrate auto-selection into batch generation pipeline (generator.ts)
- [x] Integrate auto-selection into interactive generation pipeline (interactiveRoutes.ts)
- [x] Add "auto" option to frontend theme selector with Wand2 icon and description
- [x] Set "auto" as default theme selection mode
- [x] Write vitest tests for theme selection logic — 51 new tests (850 total pass)

## Sprint 6: Remaining Layouts (dual-chart + risk-matrix)
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

## Test Generation Results & Fixes
- [x] Test 1: "Инвестиционный проект" — auto-theme selected executive_navy_red (LLM), timeline-horizontal and scenario-cards used
- [x] Test 2: "Анализ рынка электромобилей" — auto-theme selected data_navy_blue (keyword), 6 SVG charts rendered
- [x] Chart layout fixup working: 5 slides auto-switched to chart-capable layouts (stats-chart, chart-text, chart-slide)
- [x] Strengthen Layout Agent prompt: limit text-slide to 1, image-text to 2, mandatory layout selection rules, diversity requirements for 10+ slide presentations
- [x] All 872 tests pass after prompt improvements

## File Upload as Source Material for Presentations
- [x] Backend: POST /api/v1/upload-source-file endpoint (multipart/form-data via multer)
- [x] Backend: Text extraction from PDF (pdf-parse v2 PDFParse class)
- [x] Backend: Text extraction from DOCX (mammoth extractRawText)
- [x] Backend: Text extraction from TXT/MD/CSV (direct Buffer.toString)
- [x] Backend: Text extraction from PPTX (jszip + XML regex parsing)
- [x] Backend: Upload original file to S3 via storagePut, return s3_url
- [x] Backend: Content summarization for large files (LLM-based summarizeExtractedContent)
- [x] Backend: Pass extracted text as sourceContent to Planner, Outline, and Writer agents
- [x] Backend: Update presentation creation API to accept source_file object
- [x] Backend: DB schema updated with sourceFileUrl, sourceFileName, sourceFileType, sourceContent columns
- [x] Frontend: File upload zone on Home.tsx with drag-and-drop + click (Paperclip icon)
- [x] Frontend: File type validation (PDF, DOCX, TXT, PPTX, MD, CSV) and size limit (10MB)
- [x] Frontend: Upload progress indicator with spinner
- [x] Frontend: Show uploaded file info (name, type, word count) with remove option
- [x] Frontend: Pass source_file object to API on presentation creation
- [x] Write vitest tests for file extraction — 32 new tests (904 total pass)

## Bug Fixes
- [x] Fix slide thumbnail sidebar not scrolling past slide 7 in Viewer page (added overflow-hidden to parent + flex-1 min-h-0 to ScrollArea)

## Bug Fix: Text Truncation with Ellipsis
- [x] Fix text-slide/image-text templates: descriptions truncated with "..." instead of showing full text
- [x] Fix title truncation: long titles cut off with "..." instead of wrapping
- [x] Fix stats-chart/chart-text: stat descriptions truncated
- [x] Review all templates for text-overflow: ellipsis and line-clamp that cause content loss
- [x] Ensure autoDensity properly escalates when content overflows (increased line-clamp defaults)
- [x] Writer Agent: generate shorter, more concise bullet descriptions (2 lines max)

## Bug Fix: Layout Diversity (Too Many Identical Slide Types)
- [x] Layout Agent uses too many image-text layouts — fixed: images no longer force layout override to image-text
- [x] Strengthen layout selection: max 1 of each layout type per presentation
- [x] Add layout usage tracking to prevent repetition (IMAGE_NATIVE_LAYOUTS set preserves original layouts)
- [x] Ensure diverse mix: text-slide, two-column, stats-chart, timeline, process-steps, etc.
