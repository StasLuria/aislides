# Frontend ↔ Backend Integration

## Phase 1: Review
- [ ] Check backend API routes and base URL
- [ ] Check WebSocket endpoint format
- [ ] Review current frontend API client

## Phase 2: Configure Connection
- [ ] Add .env file with API_BASE_URL and WS_BASE_URL
- [ ] Configure Vite proxy for API requests (dev mode)
- [ ] Handle CORS if needed

## Phase 3: Update API Client
- [ ] Handle real backend response formats
- [ ] Add error handling for network failures
- [ ] Fix WebSocket reconnection logic
- [ ] Handle presentation HTML fetching from result_urls

## Phase 4: Test Full Cycle
- [ ] Start backend server
- [ ] Create presentation via frontend form
- [ ] Verify WebSocket progress events
- [ ] View completed presentation in Viewer
- [ ] Test History page with real data

## Phase 5: Docker Compose
- [ ] Add frontend Dockerfile
- [ ] Add frontend service to docker-compose.yml
- [ ] Configure nginx or reverse proxy
- [ ] Test unified deployment

## Phase 6: Polish
- [ ] Fix any issues found during testing
- [ ] Improve error messages
- [ ] Add loading states
