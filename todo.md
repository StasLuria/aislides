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
