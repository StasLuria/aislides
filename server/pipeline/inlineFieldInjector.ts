/**
 * Inline Field Injector — Adds data-field attributes to rendered slide HTML
 * so the frontend can identify and make text elements contentEditable.
 *
 * Strategy: After renderSlide produces HTML, we inject a small JS script
 * into the slide preview HTML that marks editable elements with data-field
 * attributes based on CSS selectors and text content matching.
 *
 * Supports:
 * - Simple top-level fields (title, description, subtitle)
 * - Nested object fields (leftColumn.title, rightColumn.title)
 * - Array item fields (bullets.0.title, bullets.1.description)
 * - Simple string arrays (leftColumn.bullets.0, rightColumn.bullets.1)
 */

// ═══════════════════════════════════════════════════════
// FIELD MAPPING — which data fields are editable per layout
// ═══════════════════════════════════════════════════════

export interface EditableFieldDef {
  key: string;           // data key path (e.g., "title", "leftColumn.title", "bullets.0.title")
  label: string;         // human-readable label
  selector: string;      // CSS selector to find the element within .slide
  matchIndex?: number;   // which match of the selector to use (0-based, default 0)
  multiline?: boolean;   // allow multiline editing
}

/**
 * Resolve a dot-notation path to a value in a nested object.
 * Supports: "title", "leftColumn.title", "bullets.0.title", "leftColumn.bullets.0"
 */
function resolveFieldValue(data: Record<string, any>, path: string): string | undefined {
  const parts = path.split(".");
  let current: any = data;
  for (const part of parts) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const idx = parseInt(part);
      if (isNaN(idx)) return undefined;
      current = current[idx];
    } else if (typeof current === "object") {
      current = current[part];
    } else {
      return undefined;
    }
  }
  if (typeof current === "string") return current;
  return undefined;
}

/**
 * Set a value at a dot-notation path in a nested object.
 * Creates intermediate objects/arrays as needed.
 */
export function setFieldValue(data: Record<string, any>, path: string, value: string): void {
  const parts = path.split(".");
  let current: any = data;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const nextIsIndex = !isNaN(parseInt(nextPart));

    if (Array.isArray(current)) {
      const idx = parseInt(part);
      if (current[idx] == null) {
        current[idx] = nextIsIndex ? [] : {};
      }
      current = current[idx];
    } else {
      if (current[part] == null) {
        current[part] = nextIsIndex ? [] : {};
      }
      current = current[part];
    }
  }

  const lastPart = parts[parts.length - 1];
  if (Array.isArray(current)) {
    current[parseInt(lastPart)] = value;
  } else {
    current[lastPart] = value;
  }
}

/**
 * Build editable field definitions dynamically based on layout and actual data.
 * This generates fields for all text content that can be edited.
 */
function buildEditableFieldsFromData(layoutId: string, data: Record<string, any>): EditableFieldDef[] {
  const fields: EditableFieldDef[] = [];

  switch (layoutId) {
    case "title-slide": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      break;
    }

    case "section-header": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.subtitle) {
        fields.push({ key: "subtitle", label: "Подзаголовок", selector: "p", multiline: false });
      }
      break;
    }

    case "text-slide": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const bullets = data.bullets || [];
      for (let i = 0; i < bullets.length; i++) {
        const b = bullets[i];
        if (typeof b === "object" && b.title) {
          fields.push({
            key: `bullets.${i}.title`,
            label: `Пункт ${i + 1}`,
            selector: ".bullet-row",
            matchIndex: i,
            multiline: false,
            // We'll use a special sub-selector approach in the script
          });
          if (b.description) {
            fields.push({
              key: `bullets.${i}.description`,
              label: `Описание ${i + 1}`,
              selector: ".bullet-row",
              matchIndex: i,
              multiline: true,
            });
          }
        } else if (typeof b === "string") {
          fields.push({
            key: `bullets.${i}`,
            label: `Пункт ${i + 1}`,
            selector: ".bullet-row",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      break;
    }

    case "two-column": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      // Left column
      if (data.leftColumn) {
        if (data.leftColumn.title) {
          fields.push({ key: "leftColumn.title", label: "Левая колонка", selector: ".card h2", matchIndex: 0, multiline: false });
        }
        const lBullets = data.leftColumn.bullets || [];
        for (let i = 0; i < lBullets.length; i++) {
          fields.push({
            key: `leftColumn.bullets.${i}`,
            label: `Л. пункт ${i + 1}`,
            selector: ".card:first-child span",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      // Right column
      if (data.rightColumn) {
        if (data.rightColumn.title) {
          fields.push({ key: "rightColumn.title", label: "Правая колонка", selector: ".card:last-child h2", matchIndex: 0, multiline: false });
        }
        const rBullets = data.rightColumn.bullets || [];
        for (let i = 0; i < rBullets.length; i++) {
          fields.push({
            key: `rightColumn.bullets.${i}`,
            label: `П. пункт ${i + 1}`,
            selector: ".card:last-child span",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      break;
    }

    case "image-text": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const bullets = data.bullets || [];
      for (let i = 0; i < bullets.length; i++) {
        const b = bullets[i];
        if (typeof b === "object" && b.title) {
          fields.push({
            key: `bullets.${i}.title`,
            label: `Пункт ${i + 1}`,
            // image-text uses non-classed bullet rows
            selector: "BULLET_TITLE",
            matchIndex: i,
            multiline: false,
          });
          if (b.description) {
            fields.push({
              key: `bullets.${i}.description`,
              label: `Описание ${i + 1}`,
              selector: "BULLET_DESC",
              matchIndex: i,
              multiline: true,
            });
          }
        }
      }
      break;
    }

    case "image-fullscreen": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.subtitle) {
        fields.push({ key: "subtitle", label: "Подзаголовок", selector: "p", multiline: false });
      }
      break;
    }

    case "quote-slide": {
      fields.push({ key: "quote", label: "Цитата", selector: "blockquote", multiline: true });
      if (data.author) {
        fields.push({ key: "author", label: "Автор", selector: "p", matchIndex: 0, multiline: false });
      }
      break;
    }

    case "chart-slide":
    case "table-slide":
    case "waterfall-chart": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      break;
    }

    case "final-slide": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.thankYouText) {
        fields.push({ key: "thankYouText", label: "Текст", selector: "p", matchIndex: data.subtitle ? 1 : 0, multiline: true });
      }
      if (data.subtitle) {
        fields.push({ key: "subtitle", label: "Подзаголовок", selector: "p", matchIndex: 0, multiline: false });
      }
      break;
    }

    case "icons-numbers":
    case "highlight-stats": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      // Metrics items
      const metrics = data.metrics || data.items || [];
      for (let i = 0; i < metrics.length; i++) {
        if (metrics[i].value) {
          fields.push({
            key: `${data.metrics ? "metrics" : "items"}.${i}.value`,
            label: `Значение ${i + 1}`,
            selector: "METRIC_VALUE",
            matchIndex: i,
            multiline: false,
          });
        }
        if (metrics[i].label) {
          fields.push({
            key: `${data.metrics ? "metrics" : "items"}.${i}.label`,
            label: `Метка ${i + 1}`,
            selector: "METRIC_LABEL",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      break;
    }

    case "timeline": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const events = data.events || [];
      for (let i = 0; i < events.length; i++) {
        if (events[i].title) {
          fields.push({
            key: `events.${i}.title`,
            label: `Событие ${i + 1}`,
            selector: "TIMELINE_TITLE",
            matchIndex: i,
            multiline: false,
          });
        }
        if (events[i].description) {
          fields.push({
            key: `events.${i}.description`,
            label: `Описание ${i + 1}`,
            selector: "TIMELINE_DESC",
            matchIndex: i,
            multiline: true,
          });
        }
      }
      break;
    }

    case "process-steps": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const steps = data.steps || [];
      for (let i = 0; i < steps.length; i++) {
        if (steps[i].title) {
          fields.push({
            key: `steps.${i}.title`,
            label: `Шаг ${i + 1}`,
            selector: "STEP_TITLE",
            matchIndex: i,
            multiline: false,
          });
        }
        if (steps[i].description) {
          fields.push({
            key: `steps.${i}.description`,
            label: `Описание ${i + 1}`,
            selector: "STEP_DESC",
            matchIndex: i,
            multiline: true,
          });
        }
      }
      break;
    }

    case "comparison": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      break;
    }

    case "agenda-table-of-contents": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const sections = data.sections || [];
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].title) {
          fields.push({
            key: `sections.${i}.title`,
            label: `Раздел ${i + 1}`,
            selector: "SECTION_TITLE",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      break;
    }

    case "team-profiles": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      break;
    }

    case "logo-grid":
    case "video-embed":
    case "checklist": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      break;
    }

    case "swot-analysis": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      break;
    }

    case "funnel": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const stages = data.stages || [];
      for (let i = 0; i < stages.length; i++) {
        if (stages[i].label) {
          fields.push({
            key: `stages.${i}.label`,
            label: `Этап ${i + 1}`,
            selector: "FUNNEL_LABEL",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      break;
    }

    case "roadmap": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      break;
    }

    case "pyramid": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      break;
    }

    case "matrix-2x2": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      break;
    }

    case "pros-cons": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      break;
    }

    default: {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      break;
    }
  }

  // Filter out fields whose values don't exist in data
  return fields.filter((f) => {
    const val = resolveFieldValue(data, f.key);
    return val != null && val.trim().length > 0;
  });
}

/**
 * Get editable fields for a layout with data context.
 * Returns simplified field info for the API response.
 */
export function getEditableFields(layoutId: string, data?: Record<string, any>): { key: string; label: string; multiline: boolean }[] {
  if (data) {
    return buildEditableFieldsFromData(layoutId, data).map((f) => ({
      key: f.key,
      label: f.label,
      multiline: !!f.multiline,
    }));
  }
  // Fallback: just title
  return [{ key: "title", label: "Заголовок", multiline: false }];
}

/**
 * Generate the inline editing script that gets injected into the slide iframe.
 * This script:
 * 1. Finds editable elements using a combination of CSS selectors and text matching
 * 2. Adds data-field attributes and contenteditable
 * 3. Adds hover/focus visual styles
 * 4. Sends postMessage to parent on blur (text changed)
 */
export function generateInlineEditScript(
  layoutId: string,
  slideData: Record<string, any>,
): string {
  const fields = buildEditableFieldsFromData(layoutId, slideData);

  // Build field config for the script
  const fieldConfig = fields.map((f) => ({
    key: f.key,
    label: f.label,
    selector: f.selector,
    matchIndex: f.matchIndex ?? 0,
    value: (resolveFieldValue(slideData, f.key) || "").trim().substring(0, 80),
    multiline: !!f.multiline,
  }));

  return `
<script>
(function() {
  var fields = ${JSON.stringify(fieldConfig)};
  var slide = document.querySelector('.slide');
  if (!slide) return;

  // Add inline editing styles
  var style = document.createElement('style');
  style.textContent = \`
    [data-field] {
      cursor: text;
      transition: outline 0.15s ease, background 0.15s ease;
      outline: 2px solid transparent;
      outline-offset: 2px;
      border-radius: 4px;
    }
    [data-field]:hover {
      outline: 2px dashed rgba(99, 102, 241, 0.5);
      background: rgba(99, 102, 241, 0.04);
    }
    [data-field]:focus {
      outline: 2px solid rgba(99, 102, 241, 0.8);
      background: rgba(99, 102, 241, 0.06);
    }
    [data-field]::after {
      content: attr(data-field-label);
      position: absolute;
      top: -20px;
      left: 4px;
      font-size: 10px;
      font-weight: 600;
      color: #6366f1;
      background: rgba(255,255,255,0.95);
      padding: 1px 6px;
      border-radius: 3px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
      font-family: 'Inter', sans-serif;
      z-index: 100;
      white-space: nowrap;
    }
    [data-field]:hover::after,
    [data-field]:focus::after {
      opacity: 1;
    }
    [data-field] {
      position: relative;
    }

    /* Image editing overlay styles */
    .img-edit-wrapper {
      position: relative;
      display: inline-block;
    }
    .img-edit-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.45);
      opacity: 0;
      transition: opacity 0.2s ease;
      cursor: pointer;
      border-radius: 4px;
      z-index: 50;
    }
    .img-edit-wrapper:hover .img-edit-overlay,
    .img-edit-overlay.drag-over {
      opacity: 1;
    }
    .img-edit-overlay.drag-over {
      background: rgba(99, 102, 241, 0.55);
      outline: 3px dashed #6366f1;
      outline-offset: -3px;
    }
    .img-edit-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: rgba(255,255,255,0.95);
      color: #1f2937;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .img-edit-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .img-edit-hint {
      margin-top: 8px;
      font-size: 11px;
      color: rgba(255,255,255,0.8);
      font-family: 'Inter', sans-serif;
    }
    .img-edit-drag-hint {
      font-size: 15px;
      font-weight: 600;
      color: white;
      font-family: 'Inter', sans-serif;
    }
  \`;
  document.head.appendChild(style);

  /**
   * Find the element for a field using its selector and matchIndex.
   * Handles special selectors for bullet items, metrics, etc.
   */
  function findElement(field) {
    var sel = field.selector;
    var idx = field.matchIndex || 0;

    // Special selectors for structured content
    if (sel === 'BULLET_TITLE' || sel === 'BULLET_DESC') {
      // For text-slide and image-text: find bullet rows by structure
      var bulletRows = slide.querySelectorAll('.bullet-row');
      if (bulletRows.length === 0) {
        // image-text doesn't use .bullet-row class — find bullet containers by structure
        // Look for containers with a dot marker + content div
        var allDivs = slide.querySelectorAll('div[style*="display: flex"][style*="align-items"]');
        var bulletContainers = [];
        allDivs.forEach(function(d) {
          // Check if it has a dot marker child and a content child
          var children = d.children;
          if (children.length >= 2) {
            var firstChild = children[0];
            var hasMarker = firstChild.style && (
              firstChild.style.borderRadius === '50%' ||
              firstChild.style.background ||
              firstChild.style.backgroundColor
            ) && parseInt(firstChild.style.width) <= 12;
            if (hasMarker) {
              bulletContainers.push(d);
            }
          }
        });
        bulletRows = bulletContainers;
      }
      var row = bulletRows[idx];
      if (!row) return null;

      if (sel === 'BULLET_TITLE') {
        // Find the bold/heading text in the bullet
        var titleEl = row.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"]');
        if (!titleEl) titleEl = row.querySelector('span[style*="font-weight: 600"], span[style*="font-weight:600"]');
        return titleEl;
      } else {
        // Find the description text (lighter color, after the title)
        var descEl = row.querySelector('div[style*="text-body-color"], div[style*="#4b5563"]');
        if (!descEl) {
          // Fallback: second div inside the content area
          var contentDiv = row.querySelector('div[style*="flex: 1"]');
          if (contentDiv && contentDiv.children.length > 1) {
            descEl = contentDiv.children[1];
          }
        }
        return descEl;
      }
    }

    if (sel === 'METRIC_VALUE' || sel === 'METRIC_LABEL') {
      // Find metric/stat cards
      var cards = slide.querySelectorAll('.card, div[style*="text-align: center"]');
      if (cards.length === 0) {
        // Fallback: look for grid items
        var grid = slide.querySelector('div[style*="grid"]');
        if (grid) cards = grid.children;
      }
      var card = cards[idx];
      if (!card) return null;
      if (sel === 'METRIC_VALUE') {
        return card.querySelector('div[style*="font-size: 3"], div[style*="font-size:3"], span[style*="font-size: 3"], div[style*="font-weight: 700"]');
      } else {
        return card.querySelector('div[style*="text-body-color"], span[style*="text-body-color"], div[style*="#4b5563"]');
      }
    }

    if (sel === 'TIMELINE_TITLE' || sel === 'TIMELINE_DESC') {
      var timelineItems = slide.querySelectorAll('.card, div[style*="border-radius"][style*="padding"]');
      var item = timelineItems[idx];
      if (!item) return null;
      if (sel === 'TIMELINE_TITLE') {
        return item.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"], h3');
      } else {
        return item.querySelector('div[style*="text-body-color"], div[style*="#4b5563"]');
      }
    }

    if (sel === 'STEP_TITLE' || sel === 'STEP_DESC') {
      var stepItems = slide.querySelectorAll('.card, div[style*="border-radius"][style*="background"]');
      var step = stepItems[idx];
      if (!step) return null;
      if (sel === 'STEP_TITLE') {
        return step.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"], h3');
      } else {
        return step.querySelector('div[style*="text-body-color"], div[style*="#4b5563"]');
      }
    }

    if (sel === 'SECTION_TITLE') {
      // Agenda sections
      var sectionRows = slide.querySelectorAll('div[style*="border-radius"][style*="background"]');
      var section = sectionRows[idx];
      if (!section) return null;
      return section.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"]');
    }

    if (sel === 'FUNNEL_LABEL') {
      var funnelStages = slide.querySelectorAll('div[style*="border-radius"]');
      var stage = funnelStages[idx];
      if (!stage) return null;
      return stage.querySelector('span, div[style*="font-weight"]');
    }

    // For .bullet-row selector (text-slide with matchIndex)
    if (sel === '.bullet-row') {
      var rows = slide.querySelectorAll('.bullet-row');
      var targetRow = rows[idx];
      if (!targetRow) return null;
      // Determine if we want title or description based on field key
      if (field.key.endsWith('.title') || !field.key.includes('.description')) {
        var t = targetRow.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"]');
        if (t) return t;
        // For simple string bullets, return the span
        return targetRow.querySelector('span');
      } else {
        var d = targetRow.querySelector('div[style*="text-body-color"], div[style*="#4b5563"]');
        if (!d) {
          var contentArea = targetRow.querySelector('div[style*="flex: 1"]');
          if (contentArea && contentArea.children.length > 1) d = contentArea.children[1];
        }
        return d;
      }
    }

    // Standard CSS selector
    try {
      var elements = slide.querySelectorAll(sel);
      // Skip elements in footer
      var filtered = [];
      for (var i = 0; i < elements.length; i++) {
        if (!elements[i].closest('.slide-footer')) {
          filtered.push(elements[i]);
        }
      }
      return filtered[idx] || null;
    } catch(e) {
      return null;
    }
  }

  // Find and mark editable elements
  fields.forEach(function(field) {
    var el = findElement(field);
    if (!el) return;
    if (el.hasAttribute('data-field')) return;

    el.setAttribute('data-field', field.key);
    el.setAttribute('data-field-label', field.label);
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');

    // Store original text
    el._originalText = el.textContent;

    // On focus
    el.addEventListener('focus', function() {
      window.parent.postMessage({
        type: 'inline-edit-focus',
        field: field.key,
        label: field.label
      }, '*');
    });

    // On blur — send updated text to parent
    el.addEventListener('blur', function() {
      var newText = el.textContent.trim();
      if (newText !== el._originalText) {
        el._originalText = newText;
        window.parent.postMessage({
          type: 'inline-edit-change',
          field: field.key,
          value: newText,
          label: field.label
        }, '*');
      }
      window.parent.postMessage({
        type: 'inline-edit-blur',
        field: field.key
      }, '*');
    });

    // On keydown — Enter to confirm (non-multiline), Escape to cancel
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !field.multiline) {
        e.preventDefault();
        el.blur();
      }
      if (e.key === 'Escape') {
        el.textContent = el._originalText;
        el.blur();
      }
      e.stopPropagation();
    });

    // Prevent default drag behavior
    el.addEventListener('dragstart', function(e) { e.preventDefault(); });
  });

  // ═══════════════════════════════════════════════════════
  // IMAGE EDITING — overlay on <img> elements AND placeholder divs
  // ═══════════════════════════════════════════════════════
  var imageCount = 0;

  // Helper: standard overlay button HTML
  var overlayBtnHtml = '<button class="img-edit-btn">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
    'Заменить изображение</button>' +
    '<div class="img-edit-hint">или перетащите файл сюда</div>';

  var addPlaceholderBtnHtml = '<button class="img-edit-btn">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
    'Добавить изображение</button>' +
    '<div class="img-edit-hint">или перетащите файл сюда</div>';

  // Helper: validate file type and size
  function validateImageFile(file) {
    var validTypes = ['image/jpeg','image/png','image/webp','image/gif'];
    if (validTypes.indexOf(file.type) === -1) {
      window.parent.postMessage({ type: 'inline-image-error', message: 'Поддерживаются только JPEG, PNG, WebP и GIF' }, '*');
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      window.parent.postMessage({ type: 'inline-image-error', message: 'Файл слишком большой (макс. 5 МБ)' }, '*');
      return false;
    }
    return true;
  }

  // Helper: attach click handler to overlay button
  function attachClickHandler(overlay, idx, getCurrentSrc) {
    var btn = overlay.querySelector('.img-edit-btn');
    if (btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        window.parent.postMessage({ type: 'inline-image-click', imageIndex: idx, currentSrc: getCurrentSrc() }, '*');
      });
    }
  }

  // Helper: attach drag-and-drop handlers to overlay
  function attachDragHandlers(overlay, idx, btnHtml, onPreview) {
    overlay.addEventListener('dragenter', function(e) {
      e.preventDefault(); e.stopPropagation();
      overlay.classList.add('drag-over');
      overlay.innerHTML = '<div class="img-edit-drag-hint">Отпустите для замены</div>';
    });
    overlay.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); });
    overlay.addEventListener('dragleave', function(e) {
      e.preventDefault(); e.stopPropagation();
      if (!overlay.contains(e.relatedTarget)) {
        overlay.classList.remove('drag-over');
        overlay.innerHTML = btnHtml;
        attachClickHandler(overlay, idx, function() { return ''; });
      }
    });
    overlay.addEventListener('drop', function(e) {
      e.preventDefault(); e.stopPropagation();
      overlay.classList.remove('drag-over');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        var file = files[0];
        if (!validateImageFile(file)) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          if (onPreview) onPreview(ev.target.result);
          overlay.innerHTML = overlayBtnHtml;
          attachClickHandler(overlay, idx, function() { return ''; });
          window.parent.postMessage({ type: 'inline-image-drop', imageIndex: idx, fileName: file.name, fileType: file.type, fileSize: file.size, dataUrl: ev.target.result }, '*');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // 1) Real <img> elements
  var images = slide.querySelectorAll('img');
  images.forEach(function(img, imgIdx) {
    if (img.closest('.slide-footer')) return;
    var rect = img.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;

    imageCount++;
    var myIdx = imageCount - 1;

    var wrapper = document.createElement('div');
    wrapper.className = 'img-edit-wrapper';
    var imgStyle = window.getComputedStyle(img);
    wrapper.style.width = imgStyle.width;
    wrapper.style.height = imgStyle.height;
    if (img.style.borderRadius) wrapper.style.borderRadius = img.style.borderRadius;
    wrapper.style.overflow = 'hidden';
    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);

    var overlay = document.createElement('div');
    overlay.className = 'img-edit-overlay';
    overlay.innerHTML = overlayBtnHtml;
    wrapper.appendChild(overlay);

    attachClickHandler(overlay, myIdx, function() { return img.src; });
    attachDragHandlers(overlay, myIdx, overlayBtnHtml, function(dataUrl) { img.src = dataUrl; });
  });

  // 2) Placeholder divs (gradient containers used when no image URL is set)
  //    These are divs with linear-gradient background inside a container with border-radius and overflow:hidden
  //    Typically: parent has border-radius >= 12px, overflow: hidden, and child has linear-gradient
  var allDivs = slide.querySelectorAll('div');
  allDivs.forEach(function(div) {
    // Check if this div has a linear-gradient background and is large enough to be an image placeholder
    var style = div.getAttribute('style') || '';
    if (style.indexOf('linear-gradient') === -1) return;
    // Must be inside a container with overflow:hidden and border-radius
    var parent = div.parentElement;
    if (!parent) return;
    var parentStyle = parent.getAttribute('style') || '';
    if (parentStyle.indexOf('overflow') === -1 || parentStyle.indexOf('border-radius') === -1) return;
    // Skip small elements
    var rect = div.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return;
    // Skip if already processed (has img-edit-overlay)
    if (div.querySelector('.img-edit-overlay')) return;
    if (div.closest('.img-edit-wrapper')) return;
    // Skip footer
    if (div.closest('.slide-footer')) return;
    // Check parent dimensions match (should be the main image container)
    var parentRect = parent.getBoundingClientRect();
    if (parentRect.width < 100 || parentRect.height < 100) return;

    imageCount++;
    var myIdx = imageCount - 1;

    // Make the parent the wrapper (it already has position, overflow, border-radius)
    parent.classList.add('img-edit-wrapper');
    parent.style.position = 'relative';

    var overlay = document.createElement('div');
    overlay.className = 'img-edit-overlay';
    overlay.style.opacity = '1'; // Always visible on placeholder
    overlay.style.background = 'rgba(0, 0, 0, 0.25)';
    overlay.innerHTML = addPlaceholderBtnHtml;
    parent.appendChild(overlay);

    attachClickHandler(overlay, myIdx, function() { return ''; });
    attachDragHandlers(overlay, myIdx, addPlaceholderBtnHtml, function(dataUrl) {
      // Replace the gradient placeholder with an img element
      var newImg = document.createElement('img');
      newImg.src = dataUrl;
      newImg.style.width = '100%';
      newImg.style.height = '100%';
      newImg.style.objectFit = 'cover';
      parent.replaceChild(newImg, div);
      // Update overlay to show "replace" instead of "add"
      overlay.innerHTML = overlayBtnHtml;
      overlay.style.opacity = '';
      overlay.style.background = '';
      attachClickHandler(overlay, myIdx, function() { return newImg.src; });
    });
  });

  // Also handle drag events on the whole slide body to prevent browser defaults
  document.body.addEventListener('dragover', function(e) { e.preventDefault(); });
  document.body.addEventListener('drop', function(e) { e.preventDefault(); });

  // Notify parent that inline editing is ready
  window.parent.postMessage({
    type: 'inline-edit-ready',
    fieldCount: document.querySelectorAll('[data-field]').length,
    imageCount: imageCount
  }, '*');
})();
<\/script>`;
}

/**
 * Build a slide preview HTML with inline editing support.
 * This wraps the slide HTML in a full HTML document with the editing script.
 */
export function buildEditableSlideHtml(
  slideHtml: string,
  themeCss: string,
  fontsUrl: string,
  language: string,
  layoutId: string,
  slideData: Record<string, any>,
  baseCss: string,
): string {
  const editScript = generateInlineEditScript(layoutId, slideData);

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1280" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${fontsUrl}" rel="stylesheet" />
  <style>${baseCss}</style>
  <style>${themeCss}</style>
  <style>
    body { margin: 0; padding: 0; background: transparent; display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div class="slide" style="width:1280px; height:720px; overflow:hidden;">
    ${slideHtml}
  </div>
  ${editScript}
</body>
</html>`;
}
