/**
 * Inline Field Injector — Adds data-field attributes to rendered slide HTML
 * so the frontend can identify and make text elements contentEditable.
 *
 * Strategy: After renderSlide produces HTML, we inject a small JS script
 * into the slide preview HTML that marks editable elements with data-field
 * attributes based on text content matching against the slide data.
 *
 * This avoids modifying the 26 Nunjucks templates directly.
 */

// ═══════════════════════════════════════════════════════
// FIELD MAPPING — which data fields are editable per layout
// ═══════════════════════════════════════════════════════

export interface EditableFieldDef {
  key: string;           // data key path (e.g., "title", "subtitle", "quote")
  label: string;         // human-readable label
  tag: string;           // HTML tag to search for (h1, p, blockquote, span)
  multiline?: boolean;   // allow multiline editing
}

/**
 * Maps layout IDs to their editable top-level text fields.
 * We focus on the main title, subtitle, description — fields that are
 * simple strings (not arrays like bullets or metrics).
 */
export const LAYOUT_EDITABLE_FIELDS: Record<string, EditableFieldDef[]> = {
  "title-slide": [
    { key: "title", label: "Заголовок", tag: "h1" },
    { key: "description", label: "Описание", tag: "p", multiline: true },
  ],
  "section-header": [
    { key: "title", label: "Заголовок", tag: "h1" },
    { key: "subtitle", label: "Подзаголовок", tag: "p" },
  ],
  "text-slide": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "two-column": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "image-text": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "image-fullscreen": [
    { key: "title", label: "Заголовок", tag: "h1" },
    { key: "subtitle", label: "Подзаголовок", tag: "p" },
  ],
  "quote-slide": [
    { key: "quote", label: "Цитата", tag: "blockquote", multiline: true },
  ],
  "chart-slide": [
    { key: "title", label: "Заголовок", tag: "h1" },
    { key: "description", label: "Описание", tag: "p", multiline: true },
  ],
  "table-slide": [
    { key: "title", label: "Заголовок", tag: "h1" },
    { key: "description", label: "Описание", tag: "p", multiline: true },
  ],
  "icons-numbers": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "timeline": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "process-steps": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "comparison": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "final-slide": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "agenda-table-of-contents": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "team-profiles": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "logo-grid": [
    { key: "title", label: "Заголовок", tag: "h1" },
    { key: "description", label: "Описание", tag: "p", multiline: true },
  ],
  "video-embed": [
    { key: "title", label: "Заголовок", tag: "h1" },
    { key: "description", label: "Описание", tag: "p", multiline: true },
  ],
  "waterfall-chart": [
    { key: "title", label: "Заголовок", tag: "h1" },
    { key: "description", label: "Описание", tag: "p", multiline: true },
  ],
  "swot-analysis": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "funnel": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "roadmap": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "pyramid": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "matrix-2x2": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "pros-cons": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
  "checklist": [
    { key: "title", label: "Заголовок", tag: "h1" },
    { key: "description", label: "Описание", tag: "p", multiline: true },
  ],
  "highlight-stats": [
    { key: "title", label: "Заголовок", tag: "h1" },
  ],
};

// Default fields for unknown layouts
const DEFAULT_EDITABLE_FIELDS: EditableFieldDef[] = [
  { key: "title", label: "Заголовок", tag: "h1" },
];

/**
 * Get editable fields for a layout.
 */
export function getEditableFields(layoutId: string): EditableFieldDef[] {
  return LAYOUT_EDITABLE_FIELDS[layoutId] || DEFAULT_EDITABLE_FIELDS;
}

/**
 * Generate the inline editing script that gets injected into the slide iframe.
 * This script:
 * 1. Finds editable elements by tag + text matching
 * 2. Adds data-field attributes and contenteditable
 * 3. Adds hover/focus visual styles
 * 4. Sends postMessage to parent on blur (text changed)
 */
export function generateInlineEditScript(
  layoutId: string,
  slideData: Record<string, any>,
): string {
  const fields = getEditableFields(layoutId);

  // Build field config for the script
  const fieldConfig = fields
    .filter((f) => {
      const val = slideData[f.key];
      return val && typeof val === "string" && val.trim().length > 0;
    })
    .map((f) => ({
      key: f.key,
      label: f.label,
      tag: f.tag,
      value: slideData[f.key]?.trim().substring(0, 80) || "",
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
  \`;
  document.head.appendChild(style);

  // Find and mark editable elements
  fields.forEach(function(field) {
    var elements = slide.querySelectorAll(field.tag);
    var found = false;
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (found) break;
      // Skip elements already marked
      if (el.hasAttribute('data-field')) continue;
      // Skip footer elements
      if (el.closest('.slide-footer')) continue;

      // Match by text content (first 40 chars)
      var elText = el.textContent.trim().substring(0, 40);
      var fieldText = field.value.substring(0, 40);
      
      // Use normalized comparison (strip HTML tags from field value)
      var tempDiv = document.createElement('div');
      tempDiv.innerHTML = fieldText;
      var cleanFieldText = tempDiv.textContent.trim().substring(0, 40);

      if (elText && cleanFieldText && elText.indexOf(cleanFieldText) === 0) {
        el.setAttribute('data-field', field.key);
        el.setAttribute('data-field-label', field.label);
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'false');

        // Store original text
        el._originalText = el.textContent;

        // On focus — select all text for easy replacement
        el.addEventListener('focus', function() {
          // Notify parent about focus
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
          // Stop propagation to prevent parent keyboard shortcuts
          e.stopPropagation();
        });

        // Prevent default drag behavior
        el.addEventListener('dragstart', function(e) { e.preventDefault(); });

        found = true;
      }
    }
  });

  // Notify parent that inline editing is ready
  window.parent.postMessage({
    type: 'inline-edit-ready',
    fieldCount: document.querySelectorAll('[data-field]').length
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
