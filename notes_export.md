# Task 10.5: PDF & PPTX Export — Plan

## Architecture

### Backend
1. **ExportService** (`backend/app/services/export_service.py`)
   - `export_pdf(artifacts: list[Artifact]) -> bytes` — combines HTML slides → PDF via WeasyPrint
   - `export_pptx(artifacts: list[Artifact]) -> bytes` — converts HTML slides → PPTX via python-pptx

2. **Export Router** (`backend/app/routers/export.py`)
   - `GET /api/projects/{id}/export/pdf` — returns PDF file
   - `GET /api/projects/{id}/export/pptx` — returns PPTX file
   - Requires auth (get_current_user)
   - Uses StreamingResponse with proper content-type

### Frontend
3. **Export buttons** in ArtifactPanel toolbar
   - "Export PDF" button
   - "Export PPTX" button
   - Both trigger download via fetch + blob

### Key Details
- Artifacts have `content` field (HTML string) and `file_type` (html)
- WeasyPrint can render HTML → PDF directly
- python-pptx: create slides with HTML content rendered as images or simplified text
- For PPTX: use python-pptx to create blank slides, add HTML content as rendered images

### Approach for PPTX
Since HTML→PPTX is complex, use approach:
1. Each slide's HTML content → rendered to image (via WeasyPrint HTML→PNG)
2. Image inserted into PPTX slide as full-page image
OR simpler:
1. Extract text from HTML, create text-based PPTX slides

### Simpler approach (MVP):
- PDF: WeasyPrint renders combined HTML
- PPTX: python-pptx with text extraction from HTML (BeautifulSoup)
