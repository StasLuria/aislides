# End-to-End Test Results

## Test: Create Presentation via Integrated Backend
- **POST /api/v1/presentations** → 200 OK, returned `presentation_id: 8jzOrHf1VG46nUIC`
- **Status progression**: pending → processing (writing, 25%) → completed (100%)
- **Total time**: ~31 seconds for 5 slides
- **Title extracted**: "Искусственный интеллект" (from LLM)
- **HTML uploaded to S3**: CloudFront URL returned in `result_urls.html_preview`
- **HTML renders correctly**: 5 slides with proper layouts (title-image, two-column, icon-grid, comparison, text-center)

## API Endpoints Working:
- `GET /health` → 200
- `POST /api/v1/presentations` → 200 (creates + starts pipeline)
- `GET /api/v1/presentations` → 200 (list)
- `GET /api/v1/presentations/:id` → 200 (detail)
- WebSocket `/ws/:id` → registered

## Pipeline Agents Executed:
1. Planner (outline generation)
2. Writer (slide content)
3. Layout Selector (layout assignment)
4. Theme Designer (CSS generation)
5. Assembler (HTML rendering + S3 upload)
