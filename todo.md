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
