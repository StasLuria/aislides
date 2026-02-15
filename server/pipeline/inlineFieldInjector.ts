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
  if (!data) data = {};

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
      if (data.optionA?.title) {
        fields.push({ key: "optionA.title", label: "Вариант A", selector: "COMPARISON_OPTION_TITLE", matchIndex: 0, multiline: false });
      }
      if (data.optionB?.title) {
        fields.push({ key: "optionB.title", label: "Вариант B", selector: "COMPARISON_OPTION_TITLE", matchIndex: 1, multiline: false });
      }
      const compPoints = data.optionA?.points || [];
      for (let i = 0; i < compPoints.length; i++) {
        fields.push({ key: `optionA.points.${i}`, label: `A пункт ${i + 1}`, selector: "COMPARISON_POINT_A", matchIndex: i, multiline: false });
      }
      const compPointsB = data.optionB?.points || [];
      for (let i = 0; i < compPointsB.length; i++) {
        fields.push({ key: `optionB.points.${i}`, label: `B пункт ${i + 1}`, selector: "COMPARISON_POINT_B", matchIndex: i, multiline: false });
      }
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
      if (data.companyDescription) {
        fields.push({ key: "companyDescription", label: "Описание", selector: "p", multiline: true });
      }
      const members = data.members || [];
      for (let i = 0; i < members.length; i++) {
        if (members[i].name) {
          fields.push({ key: `members.${i}.name`, label: `Имя ${i + 1}`, selector: "GENERIC_CARD_TITLE", matchIndex: i, multiline: false });
        }
        if (members[i].role) {
          fields.push({ key: `members.${i}.role`, label: `Роль ${i + 1}`, selector: "TEAM_ROLE", matchIndex: i, multiline: false });
        }
        if (members[i].description) {
          fields.push({ key: `members.${i}.description`, label: `Описание ${i + 1}`, selector: "GENERIC_CARD_DESC", matchIndex: i, multiline: true });
        }
      }
      break;
    }

    case "logo-grid":
    case "video-embed": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      break;
    }

    case "checklist": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      const checkItems = data.items || [];
      for (let i = 0; i < checkItems.length; i++) {
        if (checkItems[i].title) {
          fields.push({ key: `items.${i}.title`, label: `Пункт ${i + 1}`, selector: "CHECKLIST_ITEM_TITLE", matchIndex: i, multiline: false });
        }
        if (checkItems[i].description) {
          fields.push({ key: `items.${i}.description`, label: `Описание ${i + 1}`, selector: "CHECKLIST_ITEM_DESC", matchIndex: i, multiline: true });
        }
      }
      break;
    }

    case "swot-analysis": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const swotSections = ["strengths", "weaknesses", "opportunities", "threats"] as const;
      const swotLabels = ["Сильные стороны", "Слабые стороны", "Возможности", "Угрозы"];
      for (let s = 0; s < swotSections.length; s++) {
        const section = data[swotSections[s]];
        if (section?.title) {
          fields.push({ key: `${swotSections[s]}.title`, label: swotLabels[s], selector: "SWOT_SECTION_TITLE", matchIndex: s, multiline: false });
        }
        const items = section?.items || [];
        for (let i = 0; i < items.length; i++) {
          fields.push({ key: `${swotSections[s]}.items.${i}`, label: `${swotLabels[s]} ${i + 1}`, selector: "SWOT_ITEM", matchIndex: s * 100 + i, multiline: false });
        }
      }
      break;
    }

    case "funnel": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const stages = data.stages || [];
      for (let i = 0; i < stages.length; i++) {
        if (stages[i].value) {
          fields.push({
            key: `stages.${i}.value`,
            label: `Значение ${i + 1}`,
            selector: "FUNNEL_VALUE",
            matchIndex: i,
            multiline: false,
          });
        }
        if (stages[i].title) {
          fields.push({
            key: `stages.${i}.title`,
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
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      const milestones = data.milestones || [];
      for (let i = 0; i < milestones.length; i++) {
        if (milestones[i].date) {
          fields.push({ key: `milestones.${i}.date`, label: `Дата ${i + 1}`, selector: "ROADMAP_DATE", matchIndex: i, multiline: false });
        }
        if (milestones[i].title) {
          fields.push({ key: `milestones.${i}.title`, label: `Этап ${i + 1}`, selector: "ROADMAP_TITLE", matchIndex: i, multiline: false });
        }
        if (milestones[i].description) {
          fields.push({ key: `milestones.${i}.description`, label: `Описание ${i + 1}`, selector: "ROADMAP_DESC", matchIndex: i, multiline: true });
        }
      }
      break;
    }

    case "pyramid": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      const levels = data.levels || [];
      for (let i = 0; i < levels.length; i++) {
        if (levels[i].title) {
          fields.push({ key: `levels.${i}.title`, label: `Уровень ${i + 1}`, selector: "PYRAMID_TITLE", matchIndex: i, multiline: false });
        }
        if (levels[i].description) {
          fields.push({ key: `levels.${i}.description`, label: `Описание ${i + 1}`, selector: "PYRAMID_DESC", matchIndex: i, multiline: true });
        }
      }
      break;
    }

    case "matrix-2x2": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.axisX) {
        fields.push({ key: "axisX", label: "Ось X", selector: "MATRIX_AXIS_X", multiline: false });
      }
      if (data.axisY) {
        fields.push({ key: "axisY", label: "Ось Y", selector: "MATRIX_AXIS_Y", multiline: false });
      }
      const quadrants = data.quadrants || [];
      for (let i = 0; i < quadrants.length; i++) {
        if (quadrants[i].title) {
          fields.push({ key: `quadrants.${i}.title`, label: `Квадрант ${i + 1}`, selector: "GENERIC_CARD_TITLE", matchIndex: i, multiline: false });
        }
        if (quadrants[i].description) {
          fields.push({ key: `quadrants.${i}.description`, label: `Описание ${i + 1}`, selector: "GENERIC_CARD_DESC", matchIndex: i, multiline: true });
        }
      }
      break;
    }

    case "pros-cons": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.pros?.title) {
        fields.push({ key: "pros.title", label: "Заголовок плюсов", selector: "PROS_CONS_TITLE", matchIndex: 0, multiline: false });
      }
      if (data.cons?.title) {
        fields.push({ key: "cons.title", label: "Заголовок минусов", selector: "PROS_CONS_TITLE", matchIndex: 1, multiline: false });
      }
      const prosItems = data.pros?.items || [];
      for (let i = 0; i < prosItems.length; i++) {
        fields.push({ key: `pros.items.${i}`, label: `Плюс ${i + 1}`, selector: "PROS_ITEM", matchIndex: i, multiline: false });
      }
      const consItems = data.cons?.items || [];
      for (let i = 0; i < consItems.length; i++) {
        fields.push({ key: `cons.items.${i}`, label: `Минус ${i + 1}`, selector: "CONS_ITEM", matchIndex: i, multiline: false });
      }
      break;
    }

    // ═══════════════════════════════════════════════════════
    // MISSING LAYOUTS — added for full inline editing support
    // ═══════════════════════════════════════════════════════

    case "risk-matrix": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      // Matrix column headers
      const rmCols = data.matrixColumns || [];
      for (let i = 0; i < rmCols.length; i++) {
        fields.push({ key: `matrixColumns.${i}`, label: `Столбец ${i + 1}`, selector: "RISK_COL_HEADER", matchIndex: i, multiline: false });
      }
      // Matrix row labels and cells
      const rmRows = data.matrixRows || [];
      for (let ri = 0; ri < rmRows.length; ri++) {
        if (rmRows[ri].label) {
          fields.push({ key: `matrixRows.${ri}.label`, label: `Строка ${ri + 1}`, selector: "RISK_ROW_LABEL", matchIndex: ri, multiline: false });
        }
        const rmCells = rmRows[ri].cells || [];
        for (let ci = 0; ci < rmCells.length; ci++) {
          if (!rmCells[ci]) continue; // skip null cells
          if (rmCells[ci].label) {
            fields.push({ key: `matrixRows.${ri}.cells.${ci}.label`, label: `Ячейка ${ri + 1}.${ci + 1}`, selector: "RISK_CELL_LABEL", matchIndex: ri * 100 + ci, multiline: false });
          }
          if (rmCells[ci].value) {
            fields.push({ key: `matrixRows.${ri}.cells.${ci}.value`, label: `Знач. ${ri + 1}.${ci + 1}`, selector: "RISK_CELL_VALUE", matchIndex: ri * 100 + ci, multiline: false });
          }
        }
      }
      // Legend labels
      const rmLegend = data.matrixLegend || [];
      for (let i = 0; i < rmLegend.length; i++) {
        if (rmLegend[i].label) {
          fields.push({ key: `matrixLegend.${i}.label`, label: `Легенда ${i + 1}`, selector: "RISK_LEGEND_LABEL", matchIndex: i, multiline: false });
        }
      }
      if (data.mitigationTitle) {
        fields.push({ key: "mitigationTitle", label: "Заголовок мер", selector: "MITIGATION_TITLE", multiline: false });
      }
      const mitigations = data.mitigations || [];
      for (let i = 0; i < mitigations.length; i++) {
        if (mitigations[i].title) {
          fields.push({ key: `mitigations.${i}.title`, label: `Мера ${i + 1}`, selector: "GENERIC_CARD_TITLE", matchIndex: i, multiline: false });
        }
        if (mitigations[i].description) {
          fields.push({ key: `mitigations.${i}.description`, label: `Описание ${i + 1}`, selector: "GENERIC_CARD_DESC", matchIndex: i, multiline: true });
        }
      }
      break;
    }

    case "card-grid": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      const cards = data.cards || [];
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].title) {
          fields.push({ key: `cards.${i}.title`, label: `Карточка ${i + 1}`, selector: "GENERIC_CARD_TITLE", matchIndex: i, multiline: false });
        }
        if (cards[i].description) {
          fields.push({ key: `cards.${i}.description`, label: `Описание ${i + 1}`, selector: "GENERIC_CARD_DESC", matchIndex: i, multiline: true });
        }
      }
      break;
    }

    case "vertical-timeline": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      const vtEvents = data.events || [];
      for (let i = 0; i < vtEvents.length; i++) {
        if (vtEvents[i].date) {
          fields.push({ key: `events.${i}.date`, label: `Дата ${i + 1}`, selector: "VT_EVENT_DATE", matchIndex: i, multiline: false });
        }
        if (vtEvents[i].title) {
          fields.push({ key: `events.${i}.title`, label: `Событие ${i + 1}`, selector: "VT_EVENT_TITLE", matchIndex: i, multiline: false });
        }
        if (vtEvents[i].description) {
          fields.push({ key: `events.${i}.description`, label: `Описание ${i + 1}`, selector: "VT_EVENT_DESC", matchIndex: i, multiline: true });
        }
      }
      break;
    }

    case "comparison-table": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      const ctColumns = data.columns || [];
      for (let i = 0; i < ctColumns.length; i++) {
        if (ctColumns[i].name) {
          fields.push({ key: `columns.${i}.name`, label: `Колонка ${i + 1}`, selector: "CT_COL_NAME", matchIndex: i, multiline: false });
        }
      }
      const ctFeatures = data.features || [];
      for (let i = 0; i < ctFeatures.length; i++) {
        if (ctFeatures[i].name) {
          fields.push({ key: `features.${i}.name`, label: `Параметр ${i + 1}`, selector: "CT_FEATURE_NAME", matchIndex: i, multiline: false });
        }
        const vals = ctFeatures[i].values || [];
        for (let j = 0; j < vals.length; j++) {
          fields.push({ key: `features.${i}.values.${j}`, label: `Знач. ${i + 1}.${j + 1}`, selector: "CT_FEATURE_VALUE", matchIndex: i * 100 + j, multiline: false });
        }
      }
      break;
    }

    case "big-statement": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.subtitle) {
        fields.push({ key: "subtitle", label: "Подзаголовок", selector: "p", multiline: true });
      }
      if (data.bigNumber) {
        fields.push({ key: "bigNumber", label: "Число", selector: "BIG_NUMBER", multiline: false });
      }
      if (data.label) {
        fields.push({ key: "label", label: "Метка", selector: "BIG_LABEL", multiline: false });
      }
      break;
    }

    case "verdict-analysis": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.verdictTitle) {
        fields.push({ key: "verdictTitle", label: "Заголовок вердикта", selector: "VERDICT_TITLE", multiline: false });
      }
      if (data.verdictText) {
        fields.push({ key: "verdictText", label: "Текст вердикта", selector: "VERDICT_TEXT", multiline: true });
      }
      const criteria = data.criteria || [];
      for (let i = 0; i < criteria.length; i++) {
        if (criteria[i].label) {
          fields.push({ key: `criteria.${i}.label`, label: `Критерий ${i + 1}`, selector: "CRITERIA_LABEL", matchIndex: i, multiline: false });
        }
        if (criteria[i].value) {
          fields.push({ key: `criteria.${i}.value`, label: `Значение ${i + 1}`, selector: "CRITERIA_VALUE", matchIndex: i, multiline: false });
        }
      }
      break;
    }

    case "quote-highlight": {
      fields.push({ key: "quote", label: "Цитата", selector: "blockquote", multiline: true });
      if (data.author) {
        fields.push({ key: "author", label: "Автор", selector: "QUOTE_AUTHOR", multiline: false });
      }
      if (data.role) {
        fields.push({ key: "role", label: "Роль", selector: "QUOTE_ROLE", multiline: false });
      }
      if (data.context) {
        fields.push({ key: "context", label: "Контекст", selector: "QUOTE_CONTEXT", multiline: true });
      }
      break;
    }

    case "financial-formula": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      break;
    }

    case "chart-text": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      const ctBullets = data.bullets || [];
      for (let i = 0; i < ctBullets.length; i++) {
        if (typeof ctBullets[i] === "object" && ctBullets[i].title) {
          fields.push({ key: `bullets.${i}.title`, label: `Пункт ${i + 1}`, selector: "GENERIC_CARD_TITLE", matchIndex: i, multiline: false });
          if (ctBullets[i].description) {
            fields.push({ key: `bullets.${i}.description`, label: `Описание ${i + 1}`, selector: "GENERIC_CARD_DESC", matchIndex: i, multiline: true });
          }
        }
      }
      break;
    }

    case "stats-chart":
    case "hero-stat": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      break;
    }

    case "scenario-cards": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      const scenarios = data.scenarios || [];
      for (let i = 0; i < scenarios.length; i++) {
        if (scenarios[i].label) {
          fields.push({ key: `scenarios.${i}.label`, label: `Метка ${i + 1}`, selector: "SCENARIO_LABEL", matchIndex: i, multiline: false });
        }
        if (scenarios[i].title) {
          fields.push({ key: `scenarios.${i}.title`, label: `Сценарий ${i + 1}`, selector: "SCENARIO_TITLE", matchIndex: i, multiline: false });
        }
        if (scenarios[i].value) {
          fields.push({ key: `scenarios.${i}.value`, label: `Значение ${i + 1}`, selector: "SCENARIO_VALUE", matchIndex: i, multiline: false });
        }
        if (scenarios[i].description) {
          fields.push({ key: `scenarios.${i}.description`, label: `Описание ${i + 1}`, selector: "SCENARIO_DESC", matchIndex: i, multiline: true });
        }
        const scPoints = scenarios[i].points || [];
        for (let j = 0; j < scPoints.length; j++) {
          fields.push({ key: `scenarios.${i}.points.${j}`, label: `Пункт ${i + 1}.${j + 1}`, selector: "SCENARIO_POINT", matchIndex: i * 100 + j, multiline: false });
        }
      }
      break;
    }

    case "numbered-steps-v2": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const nsSteps = data.steps || [];
      for (let i = 0; i < nsSteps.length; i++) {
        if (nsSteps[i].title) {
          fields.push({ key: `steps.${i}.title`, label: `Шаг ${i + 1}`, selector: "GENERIC_CARD_TITLE", matchIndex: i, multiline: false });
        }
        if (nsSteps[i].description) {
          fields.push({ key: `steps.${i}.description`, label: `Описание ${i + 1}`, selector: "GENERIC_CARD_DESC", matchIndex: i, multiline: true });
        }
      }
      break;
    }

    case "timeline-horizontal": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      const thEvents = data.events || [];
      for (let i = 0; i < thEvents.length; i++) {
        if (thEvents[i].title) {
          fields.push({ key: `events.${i}.title`, label: `Событие ${i + 1}`, selector: "GENERIC_CARD_TITLE", matchIndex: i, multiline: false });
        }
        if (thEvents[i].description) {
          fields.push({ key: `events.${i}.description`, label: `Описание ${i + 1}`, selector: "GENERIC_CARD_DESC", matchIndex: i, multiline: true });
        }
      }
      break;
    }

    case "text-with-callout": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.callout) {
        fields.push({ key: "callout", label: "Выноска", selector: "CALLOUT_TEXT", multiline: true });
      }
      const twcBullets = data.bullets || [];
      for (let i = 0; i < twcBullets.length; i++) {
        if (typeof twcBullets[i] === "object" && twcBullets[i].title) {
          fields.push({ key: `bullets.${i}.title`, label: `Пункт ${i + 1}`, selector: "GENERIC_CARD_TITLE", matchIndex: i, multiline: false });
          if (twcBullets[i].description) {
            fields.push({ key: `bullets.${i}.description`, label: `Описание ${i + 1}`, selector: "GENERIC_CARD_DESC", matchIndex: i, multiline: true });
          }
        }
      }
      break;
    }

    case "kanban-board": {
      fields.push({ key: "title", label: "Заголовок", selector: "h2", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      const kbColumns = data.columns || [];
      for (let ci = 0; ci < kbColumns.length; ci++) {
        if (kbColumns[ci].title) {
          fields.push({ key: `columns.${ci}.title`, label: `Колонка ${ci + 1}`, selector: "KANBAN_COL_TITLE", matchIndex: ci, multiline: false });
        }
        const kbCards = kbColumns[ci].cards || [];
        for (let ki = 0; ki < kbCards.length; ki++) {
          if (kbCards[ki].title) {
            fields.push({ key: `columns.${ci}.cards.${ki}.title`, label: `Карточка ${ci + 1}.${ki + 1}`, selector: "KANBAN_CARD_TITLE", matchIndex: ci * 100 + ki, multiline: false });
          }
          if (kbCards[ki].description) {
            fields.push({ key: `columns.${ci}.cards.${ki}.description`, label: `Описание ${ci + 1}.${ki + 1}`, selector: "KANBAN_CARD_DESC", matchIndex: ci * 100 + ki, multiline: true });
          }
        }
      }
      break;
    }

    case "org-chart": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      break;
    }

    case "dual-chart": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      break;
    }

    default: {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      if (data.subtitle) {
        fields.push({ key: "subtitle", label: "Подзаголовок", selector: "p", multiline: false });
      }
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
    /* ═══ Slide container: allow expansion during editing ═══ */
    .slide {
      height: auto !important;
      min-height: 720px !important;
      overflow: visible !important;
    }

    /* ═══ Remove all text clamping and overflow restrictions on editable fields ═══ */
    [data-field] {
      cursor: text;
      transition: outline 0.15s ease, background 0.15s ease;
      outline: 2px solid transparent;
      outline-offset: 2px;
      border-radius: 4px;
      /* Override clamp/ellipsis */
      overflow: visible !important;
      text-overflow: unset !important;
      -webkit-line-clamp: unset !important;
      -webkit-box-orient: unset !important;
      display: block !important;
      max-height: none !important;
      white-space: pre-wrap !important;
      word-wrap: break-word !important;
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

    /* ═══ Remove overflow restrictions on parent containers of editable fields ═══ */
    .card, .bullet-row,
    div[style*="overflow: hidden"] {
      overflow: visible !important;
      max-height: none !important;
    }
    /* Allow flex containers to grow */
    div[style*="flex: 1"],
    div[style*="flex:1"] {
      flex-shrink: 0 !important;
      min-height: auto !important;
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

  // ═══════════════════════════════════════════════════════
  // UNDO / REDO SYSTEM
  // ═══════════════════════════════════════════════════════
  var undoStack = [];  // Array of { field, oldValue, newValue, element }
  var redoStack = [];
  var MAX_HISTORY = 50;

  function pushUndo(entry) {
    undoStack.push(entry);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    // Any new edit clears the redo stack
    redoStack.length = 0;
    notifyUndoRedoState();
  }

  function performUndo() {
    if (undoStack.length === 0) return;
    var entry = undoStack.pop();
    redoStack.push(entry);
    // Restore old value in DOM
    if (entry.element) {
      entry.element.innerText = entry.oldValue;
      entry.element._originalText = entry.oldValue;
    }
    // Notify parent to save the reverted value
    window.parent.postMessage({
      type: 'inline-edit-change',
      field: entry.field,
      value: entry.oldValue,
      label: entry.label || entry.field,
      isUndo: true
    }, '*');
    notifyUndoRedoState();
  }

  function performRedo() {
    if (redoStack.length === 0) return;
    var entry = redoStack.pop();
    undoStack.push(entry);
    // Restore new value in DOM
    if (entry.element) {
      entry.element.innerText = entry.newValue;
      entry.element._originalText = entry.newValue;
    }
    // Notify parent to save the re-applied value
    window.parent.postMessage({
      type: 'inline-edit-change',
      field: entry.field,
      value: entry.newValue,
      label: entry.label || entry.field,
      isRedo: true
    }, '*');
    notifyUndoRedoState();
  }

  function notifyUndoRedoState() {
    window.parent.postMessage({
      type: 'inline-edit-undo-state',
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoCount: undoStack.length,
      redoCount: redoStack.length
    }, '*');
  }

  // Global keyboard handler for Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
  document.addEventListener('keydown', function(e) {
    var isCtrl = e.ctrlKey || e.metaKey;
    if (!isCtrl) return;

    if (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я') {
      if (e.shiftKey) {
        // Ctrl+Shift+Z = Redo
        e.preventDefault();
        e.stopPropagation();
        performRedo();
      } else {
        // Ctrl+Z = Undo
        e.preventDefault();
        e.stopPropagation();
        performUndo();
      }
      return;
    }
    if (e.key === 'y' || e.key === 'Y' || e.key === 'н' || e.key === 'Н') {
      // Ctrl+Y = Redo
      e.preventDefault();
      e.stopPropagation();
      performRedo();
      return;
    }
  }, true); // Use capture phase to intercept before contentEditable default

  // Listen for undo/redo commands from parent
  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'inline-edit-undo') performUndo();
    if (e.data.type === 'inline-edit-redo') performRedo();
  });

  // Report initial undo/redo state
  notifyUndoRedoState();

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

    if (sel === 'FUNNEL_VALUE' || sel === 'FUNNEL_LABEL') {
      // Funnel stages: each stage is a div with border-radius+padding containing:
      //   - A value div (font-weight: 700, font-size: 24px) — the number
      //   - A label div (font-weight: 600, font-size: 14px) — the stage title
      var funnelContent = slide.querySelectorAll('div[style*="border-radius"][style*="padding"]');
      var funnelStages = [];
      for (var fi = 0; fi < funnelContent.length; fi++) {
        var fc = funnelContent[fi];
        if (fc.closest('.slide-footer') || fc.closest('[data-field]')) continue;
        // A funnel stage has both a value (700) and a label (600) element
        var hasValue = fc.querySelector('div[style*="font-weight: 700"], div[style*="font-weight:700"]');
        var hasLabel = fc.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"]');
        if (hasValue || hasLabel) funnelStages.push(fc);
      }
      var fStage = funnelStages[idx];
      if (!fStage) return null;
      if (sel === 'FUNNEL_VALUE') {
        return fStage.querySelector('div[style*="font-weight: 700"], div[style*="font-weight:700"]');
      } else {
        return fStage.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"]');
      }
    }

    // ═══ ROADMAP_DATE / ROADMAP_TITLE / ROADMAP_DESC ═══
    if (sel === 'ROADMAP_DATE' || sel === 'ROADMAP_TITLE' || sel === 'ROADMAP_DESC') {
      // Roadmap milestones are grid columns, each containing date/title/desc in a content div
      var rmGrid = slide.querySelector('div[style*="grid-template-columns"]');
      if (!rmGrid) return null;
      var rmMilestones = rmGrid.children;
      var rmMilestone = rmMilestones[idx];
      if (!rmMilestone) return null;
      // Each milestone has a content div with date, title, and description
      // Date: font-size: 11px, font-weight: 600, text-transform: uppercase, primary accent color
      // Title: font-size: 13px, font-weight: 600, heading color
      // Description: font-size: 11px, text-body-color
      if (sel === 'ROADMAP_DATE') {
        return rmMilestone.querySelector('div[style*="text-transform: uppercase"][style*="font-weight: 600"]');
      } else if (sel === 'ROADMAP_TITLE') {
        return rmMilestone.querySelector('div[style*="font-size: 13px"][style*="font-weight: 600"]');
      } else {
        return rmMilestone.querySelector('div[style*="font-size: 11px"][style*="text-body-color"], div[style*="font-size: 11px"][style*="#4b5563"]');
      }
    }

    // ═══ PYRAMID_TITLE / PYRAMID_DESC ═══
    if (sel === 'PYRAMID_TITLE' || sel === 'PYRAMID_DESC') {
      // Pyramid has two columns: left = shapes, right = descriptions
      // Right column has bullet rows with title (font-weight: 600) and description
      var pyContainer = slide.querySelector('div[style*="max-width: 1000px"]');
      if (!pyContainer) return null;
      // Right column is the second child
      var pyRight = pyContainer.children[1];
      if (!pyRight) return null;
      var pyRows = pyRight.children;
      var pyRow = pyRows[idx];
      if (!pyRow) return null;
      if (sel === 'PYRAMID_TITLE') {
        return pyRow.querySelector('div[style*="font-weight: 600"][style*="font-size: 14px"], div[style*="font-weight: 600"]');
      } else {
        return pyRow.querySelector('div[style*="font-size: 12px"][style*="text-body-color"], div[style*="font-size: 12px"][style*="#4b5563"]');
      }
    }

    // ═══ CHECKLIST_TITLE / CHECKLIST_DESC ═══
    if (sel === 'CHECKLIST_ITEM_TITLE' || sel === 'CHECKLIST_ITEM_DESC') {
      // Checklist items are in a 2-column grid
      var clGrid = slide.querySelector('div[style*="grid-template-columns: repeat(2"]');
      if (!clGrid) return null;
      var clItem = clGrid.children[idx];
      if (!clItem) return null;
      // Title and description are inside div[style*="flex: 1"]
      var clContent = clItem.querySelector('div[style*="flex: 1"]');
      if (!clContent) return null;
      if (sel === 'CHECKLIST_ITEM_TITLE') {
        return clContent.querySelector('div[style*="font-weight: 600"]');
      } else {
        return clContent.querySelector('div[style*="font-size: 12px"]');
      }
    }

    // ═══ KANBAN_COL_TITLE / KANBAN_CARD_TITLE / KANBAN_CARD_DESC ═══
    if (sel === 'KANBAN_COL_TITLE' || sel === 'KANBAN_CARD_TITLE' || sel === 'KANBAN_CARD_DESC') {
      // Kanban columns are flex children of the main flex container
      var kbFlex = slide.querySelector('div[style*="display: flex"][style*="gap: 16px"][style*="flex: 1"]');
      if (!kbFlex) return null;
      if (sel === 'KANBAN_COL_TITLE') {
        var kbCol = kbFlex.children[idx];
        if (!kbCol) return null;
        return kbCol.querySelector('span[style*="font-weight: 700"][style*="text-transform: uppercase"]');
      }
      // For cards: matchIndex = colIdx * 100 + cardIdx
      var kbColIdx = Math.floor(idx / 100);
      var kbCardIdx = idx % 100;
      var kbColumn = kbFlex.children[kbColIdx];
      if (!kbColumn) return null;
      // Cards container is the second child (after header)
      var kbCardsContainer = kbColumn.querySelector('div[style*="flex: 1"][style*="padding: 10px"]');
      if (!kbCardsContainer) return null;
      var kbCards = kbCardsContainer.children;
      var kbCard = kbCards[kbCardIdx];
      if (!kbCard) return null;
      if (sel === 'KANBAN_CARD_TITLE') {
        return kbCard.querySelector('div[style*="font-weight: 600"]');
      } else {
        return kbCard.querySelector('div[style*="font-size: 11px"][style*="text-body-color"], div[style*="font-size: 11px"][style*="#6b7280"]');
      }
    }

    // ═══ VT_EVENT_DATE / VT_EVENT_TITLE / VT_EVENT_DESC ═══
    if (sel === 'VT_EVENT_DATE' || sel === 'VT_EVENT_TITLE' || sel === 'VT_EVENT_DESC') {
      // Vertical timeline events are .card elements
      var vtCards = slide.querySelectorAll('.card');
      var vtCard = vtCards[idx];
      if (!vtCard) return null;
      if (sel === 'VT_EVENT_DATE') {
        return vtCard.querySelector('span[style*="text-transform: uppercase"][style*="font-weight: 600"]');
      } else if (sel === 'VT_EVENT_TITLE') {
        return vtCard.querySelector('div[style*="font-weight: 600"][style*="line-height: 1.3"]');
      } else {
        return vtCard.querySelector('div[style*="text-body-color"][style*="margin-top: 4px"], div[style*="#4b5563"][style*="margin-top: 4px"]');
      }
    }

    // ═══ CT_COL_NAME / CT_FEATURE_NAME / CT_FEATURE_VALUE ═══
    if (sel === 'CT_COL_NAME' || sel === 'CT_FEATURE_NAME' || sel === 'CT_FEATURE_VALUE') {
      var ctTable = slide.querySelector('table');
      if (!ctTable) return null;
      if (sel === 'CT_COL_NAME') {
        // Column headers are th elements in thead, skip first (feature label)
        var ctHeaders = ctTable.querySelectorAll('thead th');
        // idx 0 = first column (skip the feature label th at position 0)
        return ctHeaders[idx + 1] || null;
      }
      if (sel === 'CT_FEATURE_NAME') {
        // Feature names are first td in each tbody tr
        var ctRows = ctTable.querySelectorAll('tbody tr');
        var ctRow = ctRows[idx];
        if (!ctRow) return null;
        return ctRow.querySelector('td');
      }
      if (sel === 'CT_FEATURE_VALUE') {
        // matchIndex = featureIdx * 100 + colIdx
        var ctFeatIdx = Math.floor(idx / 100);
        var ctColIdx = idx % 100;
        var ctBodyRows = ctTable.querySelectorAll('tbody tr');
        var ctFeatRow = ctBodyRows[ctFeatIdx];
        if (!ctFeatRow) return null;
        // Skip first td (feature name), so value column is at index colIdx + 1
        var ctCells = ctFeatRow.querySelectorAll('td');
        var ctCell = ctCells[ctColIdx + 1];
        if (!ctCell) return null;
        // If cell contains a span with text, return that span; otherwise return the td itself
        var ctSpan = ctCell.querySelector('span[style*="font-weight: 500"]');
        return ctSpan || ctCell;
      }
    }

    // ═══ SCENARIO_LABEL / SCENARIO_TITLE / SCENARIO_VALUE / SCENARIO_DESC / SCENARIO_POINT ═══
    if (sel === 'SCENARIO_LABEL' || sel === 'SCENARIO_TITLE' || sel === 'SCENARIO_VALUE' || sel === 'SCENARIO_DESC' || sel === 'SCENARIO_POINT') {
      var scCards = slide.querySelectorAll('.card');
      if (sel === 'SCENARIO_POINT') {
        // matchIndex = scenarioIdx * 100 + pointIdx
        var scIdx = Math.floor(idx / 100);
        var scPtIdx = idx % 100;
        var scCard = scCards[scIdx];
        if (!scCard) return null;
        var scPointSpans = scCard.querySelectorAll('span[style*="text-body-color"], span[style*="#4b5563"]');
        return scPointSpans[scPtIdx] || null;
      }
      var scCard2 = scCards[idx];
      if (!scCard2) return null;
      if (sel === 'SCENARIO_LABEL') {
        return scCard2.querySelector('div[style*="text-transform: uppercase"][style*="font-weight: 700"]');
      } else if (sel === 'SCENARIO_TITLE') {
        return scCard2.querySelector('div[style*="font-weight: 700"]:not([style*="text-transform"])');
      } else if (sel === 'SCENARIO_VALUE') {
        return scCard2.querySelector('div[style*="font-size: 28px"][style*="font-weight: 800"]');
      } else {
        // SCENARIO_DESC - description after value
        return scCard2.querySelector('div[style*="text-body-color"], div[style*="#4b5563"]');
      }
    }

    // ═══ RISK_COL_HEADER / RISK_ROW_LABEL / RISK_CELL_LABEL / RISK_CELL_VALUE / RISK_LEGEND_LABEL ═══
    if (sel === 'RISK_COL_HEADER' || sel === 'RISK_ROW_LABEL' || sel === 'RISK_CELL_LABEL' || sel === 'RISK_CELL_VALUE' || sel === 'RISK_LEGEND_LABEL') {
      // Risk matrix has a left panel (matrix) and right panel (mitigations)
      // The matrix is in the first child of the main grid
      var rmMainGrid = slide.querySelector('div[style*="grid-template-columns: 1.2fr 0.8fr"]');
      if (!rmMainGrid) return null;
      var rmMatrixPanel = rmMainGrid.children[0];
      if (!rmMatrixPanel) return null;

      if (sel === 'RISK_COL_HEADER') {
        // Column headers are in the first row (display: flex; margin-bottom: 4px)
        var rmHeaderRow = rmMatrixPanel.querySelector('div[style*="margin-bottom: 4px"]');
        if (!rmHeaderRow) return null;
        // Skip the first child (spacer div width: 28px)
        var rmHeaders = [];
        for (var rhi = 0; rhi < rmHeaderRow.children.length; rhi++) {
          var rhChild = rmHeaderRow.children[rhi];
          var rhStyle = rhChild.getAttribute('style') || '';
          if (rhStyle.indexOf('flex: 1') !== -1) rmHeaders.push(rhChild);
        }
        return rmHeaders[idx] || null;
      }

      if (sel === 'RISK_ROW_LABEL') {
        // Row labels are div[style*="writing-mode: vertical-lr"] inside each row
        var rmRowLabels = rmMatrixPanel.querySelectorAll('div[style*="writing-mode: vertical-lr"]');
        return rmRowLabels[idx] || null;
      }

      if (sel === 'RISK_CELL_LABEL' || sel === 'RISK_CELL_VALUE') {
        // matchIndex = rowIdx * 100 + cellIdx
        var rmRowIdx = Math.floor(idx / 100);
        var rmCellIdx = idx % 100;
        // Find matrix rows (display: flex; flex: 1; min-height: 0)
        var rmAllRows = rmMatrixPanel.querySelectorAll('div[style*="display: flex"][style*="flex: 1"][style*="min-height: 0"]');
        var rmRow = rmAllRows[rmRowIdx];
        if (!rmRow) return null;
        // Cells are children with border-radius: 8px
        var rmCells = rmRow.querySelectorAll('div[style*="border-radius: 8px"]');
        var rmCell = rmCells[rmCellIdx];
        if (!rmCell) return null;
        if (sel === 'RISK_CELL_LABEL') {
          return rmCell.querySelector('div[style*="font-weight: 700"]');
        } else {
          return rmCell.querySelector('div[style*="opacity: 0.8"]');
        }
      }

      if (sel === 'RISK_LEGEND_LABEL') {
        // Legend items are at the bottom of the matrix panel
        var rmLegendSpans = rmMatrixPanel.querySelectorAll('span[style*="font-size: 10px"]');
        return rmLegendSpans[idx] || null;
      }
    }

    // ═══ GENERIC_CARD_TITLE / GENERIC_CARD_DESC ═══
    // Universal selectors for cards in any layout (risk-matrix mitigations, card-grid, roadmap, etc.)
    if (sel === 'GENERIC_CARD_TITLE' || sel === 'GENERIC_CARD_DESC') {
      // Strategy: find card-like containers in order of specificity
      var allCards = slide.querySelectorAll('.card');

      if (allCards.length === 0) {
        // Fallback 1: grid children with background/padding (matrix-2x2, checklist, etc.)
        var gridEl = slide.querySelector('div[style*="grid-template"]');
        if (gridEl) {
          allCards = [];
          var kids = gridEl.children;
          for (var ci = 0; ci < kids.length; ci++) {
            var kidStyle = kids[ci].getAttribute('style') || '';
            if (kidStyle.indexOf('padding') !== -1 || kidStyle.indexOf('border-radius') !== -1 || kidStyle.indexOf('background') !== -1) {
              allCards.push(kids[ci]);
            }
          }
        }
      }

      if (allCards.length === 0) {
        // Fallback 2: flex children with titles (pyramid levels, funnel stages)
        // Look for repeated flex items that each contain a title-like element
        var flexContainers = slide.querySelectorAll('div[style*="flex-direction: column"], div[style*="flex-direction:column"]');
        for (var fci = 0; fci < flexContainers.length; fci++) {
          var fc = flexContainers[fci];
          if (fc.closest('.slide-footer')) continue;
          var flexKids = fc.children;
          var cardCandidates = [];
          for (var fki = 0; fki < flexKids.length; fki++) {
            var fk = flexKids[fki];
            var fkStyle = fk.getAttribute('style') || '';
            // Each card candidate should have a title element inside
            var hasTitle = fk.querySelector('div[style*="font-weight: 6"], div[style*="font-weight:6"]');
            if (hasTitle && (fkStyle.indexOf('flex') !== -1 || fkStyle.indexOf('gap') !== -1 || fkStyle.indexOf('align') !== -1)) {
              cardCandidates.push(fk);
            }
          }
          if (cardCandidates.length >= 2) {
            allCards = cardCandidates;
            break;
          }
        }
      }

      if (allCards.length === 0) {
        // Fallback 3: border-left styled cards (mitigation cards in risk-matrix)
        allCards = slide.querySelectorAll('div[style*="border-left"][style*="padding"]');
      }

      var targetCard = allCards[idx];
      if (!targetCard) return null;
      if (sel === 'GENERIC_CARD_TITLE') {
        return targetCard.querySelector('div[style*="font-weight: 7"], div[style*="font-weight:7"], div[style*="font-weight: 6"], div[style*="font-weight:6"], span[style*="font-weight: 6"], span[style*="font-weight:6"], h3');
      } else {
        var descEl = targetCard.querySelector('div[style*="text-body-color"], div[style*="#4b5563"], div[style*="#9ca3af"]');
        if (!descEl) {
          // Fallback: look for font-size: 12 element (common for descriptions)
          descEl = targetCard.querySelector('div[style*="font-size: 12"], div[style*="font-size:12"]');
        }
        if (!descEl) {
          // Fallback: second text element in the card
          var textEls = targetCard.querySelectorAll('div[style*="font-size"]');
          if (textEls.length > 1) descEl = textEls[1];
        }
        return descEl;
      }
    }

    // ═══ MITIGATION_TITLE ═══
    if (sel === 'MITIGATION_TITLE') {
      // The mitigation section title in risk-matrix
      var mitTitles = slide.querySelectorAll('div[style*="font-weight: 700"][style*="font-size"]');
      for (var mi = 0; mi < mitTitles.length; mi++) {
        var mt = mitTitles[mi];
        if (!mt.closest('.card') && !mt.closest('.slide-footer') && mt.textContent.trim().length > 0) {
          return mt;
        }
      }
      return null;
    }

    // ═══ BIG_NUMBER / BIG_LABEL ═══
    if (sel === 'BIG_NUMBER') {
      return slide.querySelector('div[style*="font-size: 6"], div[style*="font-size: 7"], div[style*="font-size: 8"], div[style*="font-size:6"], div[style*="font-size:7"], div[style*="font-size:8"]');
    }
    if (sel === 'BIG_LABEL') {
      var bigNum = slide.querySelector('div[style*="font-size: 6"], div[style*="font-size: 7"], div[style*="font-size: 8"]');
      if (bigNum && bigNum.nextElementSibling) return bigNum.nextElementSibling;
      return null;
    }

    // ═══ VERDICT_TITLE / VERDICT_TEXT ═══
    if (sel === 'VERDICT_TITLE') {
      var verdictCard = slide.querySelector('div[style*="border-radius"][style*="background"]');
      if (verdictCard) return verdictCard.querySelector('div[style*="font-weight: 7"], div[style*="font-weight:7"], div[style*="font-size: 2"]');
      return null;
    }
    if (sel === 'VERDICT_TEXT') {
      var verdictCard2 = slide.querySelector('div[style*="border-radius"][style*="background"]');
      if (verdictCard2) return verdictCard2.querySelector('div[style*="text-body-color"], div[style*="#4b5563"]');
      return null;
    }

    // ═══ CRITERIA_LABEL / CRITERIA_VALUE ═══
    if (sel === 'CRITERIA_LABEL' || sel === 'CRITERIA_VALUE') {
      var criteriaRows = slide.querySelectorAll('div[style*="display: flex"][style*="justify-content"]');
      var filteredCriteria = [];
      for (var cri = 0; cri < criteriaRows.length; cri++) {
        var cr = criteriaRows[cri];
        if (cr.children.length >= 2 && !cr.closest('.slide-footer')) {
          filteredCriteria.push(cr);
        }
      }
      var criteriaRow = filteredCriteria[idx];
      if (!criteriaRow) return null;
      if (sel === 'CRITERIA_LABEL') return criteriaRow.children[0];
      return criteriaRow.children[criteriaRow.children.length - 1];
    }

    // ═══ QUOTE_AUTHOR / QUOTE_ROLE / QUOTE_CONTEXT ═══
    if (sel === 'QUOTE_AUTHOR') {
      return slide.querySelector('div[style*="font-weight: 6"], div[style*="font-weight:6"], p[style*="font-weight: 6"]');
    }
    if (sel === 'QUOTE_ROLE') {
      var authorEl = slide.querySelector('div[style*="font-weight: 6"], p[style*="font-weight: 6"]');
      if (authorEl && authorEl.nextElementSibling) return authorEl.nextElementSibling;
      return null;
    }
    if (sel === 'QUOTE_CONTEXT') {
      return slide.querySelector('div[style*="font-style: italic"], p[style*="font-style"]');
    }

    // ═══ CALLOUT_TEXT ═══
    if (sel === 'CALLOUT_TEXT') {
      var calloutBox = slide.querySelector('div[style*="border-left"][style*="padding"]');
      if (calloutBox) return calloutBox;
      return null;
    }

    // ═══ SWOT_SECTION_TITLE / SWOT_ITEM ═══
    if (sel === 'SWOT_SECTION_TITLE') {
      // SWOT uses a 2x2 grid — find grid container, then its direct children as quadrants
      var swotGrid = slide.querySelector('div[style*="grid-template-columns"][style*="grid-template-rows"]');
      var swotQuadrants = swotGrid ? swotGrid.children : slide.querySelectorAll('.card');
      var swotQuadrant = swotQuadrants[idx];
      if (!swotQuadrant) return null;
      return swotQuadrant.querySelector('h2, h3, div[style*="font-weight: 7"], div[style*="font-weight:7"]');
    }
    if (sel === 'SWOT_ITEM') {
      // matchIndex encodes section*100 + itemIndex
      var sectionIdx = Math.floor(idx / 100);
      var itemIdx = idx % 100;
      var swotGrid2 = slide.querySelector('div[style*="grid-template-columns"][style*="grid-template-rows"]');
      var swotQuadrants2 = swotGrid2 ? swotGrid2.children : slide.querySelectorAll('.card');
      var swotQuadrant2 = swotQuadrants2[sectionIdx];
      if (!swotQuadrant2) return null;
      // Items are span elements inside the quadrant (not in the header area)
      var allSpans = swotQuadrant2.querySelectorAll('span');
      var filteredSwotItems = [];
      for (var si = 0; si < allSpans.length; si++) {
        if (allSpans[si].textContent.trim().length > 0 && !allSpans[si].closest('[data-field]')) {
          filteredSwotItems.push(allSpans[si]);
        }
      }
      return filteredSwotItems[itemIdx] || null;
    }

    // ═══ COMPARISON_OPTION_TITLE ═══
    if (sel === 'COMPARISON_OPTION_TITLE') {
      var optionHeaders = slide.querySelectorAll('h2, div[style*="font-size: 2"][style*="font-weight"]');
      var filtered2 = [];
      for (var oi = 0; oi < optionHeaders.length; oi++) {
        if (!optionHeaders[oi].closest('.slide-footer')) filtered2.push(optionHeaders[oi]);
      }
      return filtered2[idx] || null;
    }

    // ═══ COMPARISON_POINT_A / COMPARISON_POINT_B ═══
    if (sel === 'COMPARISON_POINT_A' || sel === 'COMPARISON_POINT_B') {
      var compCards = slide.querySelectorAll('.card');
      var compCardIdx = (sel === 'COMPARISON_POINT_A') ? 0 : 1;
      var compCard = compCards[compCardIdx];
      if (!compCard) return null;
      var compSpans = compCard.querySelectorAll('span[style*="text-body-color"], span[style*="#4b5563"], span');
      var filteredSpans = [];
      for (var csi = 0; csi < compSpans.length; csi++) {
        if (compSpans[csi].textContent.trim().length > 0) filteredSpans.push(compSpans[csi]);
      }
      return filteredSpans[idx] || null;
    }

    // ═══ PROS_CONS_TITLE / PROS_ITEM / CONS_ITEM ═══
    if (sel === 'PROS_CONS_TITLE') {
      var pcCards = slide.querySelectorAll('.card');
      var pcCard = pcCards[idx];
      if (!pcCard) return null;
      return pcCard.querySelector('h2, div[style*="font-weight: 7"], div[style*="font-weight:7"]');
    }
    if (sel === 'PROS_ITEM' || sel === 'CONS_ITEM') {
      var pcCards2 = slide.querySelectorAll('.card');
      var pcCardIdx = (sel === 'PROS_ITEM') ? 0 : 1;
      var pcCard2 = pcCards2[pcCardIdx];
      if (!pcCard2) return null;
      var pcSpans = pcCard2.querySelectorAll('span[style*="text-body-color"], span[style*="#4b5563"], span');
      var filteredPcSpans = [];
      for (var psi = 0; psi < pcSpans.length; psi++) {
        if (pcSpans[psi].textContent.trim().length > 0) filteredPcSpans.push(pcSpans[psi]);
      }
      return filteredPcSpans[idx] || null;
    }

    // ═══ TEAM_ROLE ═══
    if (sel === 'TEAM_ROLE') {
      var teamCards = slide.querySelectorAll('.card');
      var teamCard = teamCards[idx];
      if (!teamCard) return null;
      // Role is typically a smaller text after the name
      var roleEls = teamCard.querySelectorAll('div[style*="text-body-color"], div[style*="#4b5563"]');
      return roleEls[0] || null;
    }

    // ═══ MATRIX_AXIS_X / MATRIX_AXIS_Y ═══
    if (sel === 'MATRIX_AXIS_X' || sel === 'MATRIX_AXIS_Y') {
      // Axis labels are div[style*="font-weight: 600"][style*="font-size: 13"] positioned outside the grid
      var axisLabels = slide.querySelectorAll('div[style*="font-weight: 600"][style*="font-size: 13"], div[style*="font-weight:600"][style*="font-size:13"]');
      if (axisLabels.length === 0) {
        // Fallback: look for text-align center with font-weight
        axisLabels = slide.querySelectorAll('div[style*="text-align: center"][style*="font-weight"]');
      }
      // Filter out elements inside cards or footer
      var filteredAxis = [];
      for (var ai = 0; ai < axisLabels.length; ai++) {
        if (!axisLabels[ai].closest('.card') && !axisLabels[ai].closest('.slide-footer') && !axisLabels[ai].closest('[data-field]')) {
          filteredAxis.push(axisLabels[ai]);
        }
      }
      if (sel === 'MATRIX_AXIS_X') return filteredAxis[0] || null;
      return filteredAxis[1] || null;
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

    // Store original text — use innerText to preserve line breaks
    el._originalText = el.innerText;

    // On focus
    el.addEventListener('focus', function() {
      window.parent.postMessage({
        type: 'inline-edit-focus',
        field: field.key,
        label: field.label
      }, '*');
    });

    // On blur — send updated text to parent (innerText preserves line breaks)
    el.addEventListener('blur', function() {
      var newText = el.innerText.trim();
      if (newText !== el._originalText) {
        // Push to undo stack before updating _originalText
        pushUndo({
          field: field.key,
          label: field.label,
          oldValue: el._originalText,
          newValue: newText,
          element: el
        });
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
        el.innerText = el._originalText;
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

  // ═══════════════════════════════════════════════════════
  // HEIGHT REPORTING — notify parent when content height changes
  // ═══════════════════════════════════════════════════════
  var lastReportedHeight = 720;
  function reportHeight() {
    var slideEl = document.querySelector('.slide');
    if (!slideEl) return;
    var newHeight = Math.max(720, slideEl.scrollHeight);
    if (newHeight !== lastReportedHeight) {
      lastReportedHeight = newHeight;
      window.parent.postMessage({
        type: 'inline-slide-resize',
        height: newHeight
      }, '*');
    }
  }

  // Observe DOM mutations for height changes (text editing, content changes)
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function() {
      requestAnimationFrame(reportHeight);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });
  }

  // Also report on input events (for contentEditable)
  document.body.addEventListener('input', function() {
    requestAnimationFrame(reportHeight);
  });

  // Initial height report
  requestAnimationFrame(reportHeight);

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
