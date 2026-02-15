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
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
      }
      const milestones = data.milestones || [];
      for (let i = 0; i < milestones.length; i++) {
        if (milestones[i].title) {
          fields.push({ key: `milestones.${i}.title`, label: `Этап ${i + 1}`, selector: "GENERIC_CARD_TITLE", matchIndex: i, multiline: false });
        }
        if (milestones[i].description) {
          fields.push({ key: `milestones.${i}.description`, label: `Описание ${i + 1}`, selector: "GENERIC_CARD_DESC", matchIndex: i, multiline: true });
        }
      }
      break;
    }

    case "pyramid": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const levels = data.levels || [];
      for (let i = 0; i < levels.length; i++) {
        if (levels[i].title) {
          fields.push({ key: `levels.${i}.title`, label: `Уровень ${i + 1}`, selector: "GENERIC_CARD_TITLE", matchIndex: i, multiline: false });
        }
        if (levels[i].description) {
          fields.push({ key: `levels.${i}.description`, label: `Описание ${i + 1}`, selector: "GENERIC_CARD_DESC", matchIndex: i, multiline: true });
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
        if (vtEvents[i].title) {
          fields.push({ key: `events.${i}.title`, label: `Событие ${i + 1}`, selector: "GENERIC_CARD_TITLE", matchIndex: i, multiline: false });
        }
        if (vtEvents[i].description) {
          fields.push({ key: `events.${i}.description`, label: `Описание ${i + 1}`, selector: "GENERIC_CARD_DESC", matchIndex: i, multiline: true });
        }
      }
      break;
    }

    case "comparison-table": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
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
        if (scenarios[i].title) {
          fields.push({ key: `scenarios.${i}.title`, label: `Сценарий ${i + 1}`, selector: "GENERIC_CARD_TITLE", matchIndex: i, multiline: false });
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
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "p", multiline: true });
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

    // ═══ GENERIC_CARD_TITLE / GENERIC_CARD_DESC ═══
    // Universal selectors for cards in any layout (risk-matrix mitigations, card-grid, roadmap, etc.)
    if (sel === 'GENERIC_CARD_TITLE' || sel === 'GENERIC_CARD_DESC') {
      // Find all .card elements, or fallback to grid/flex children with padding
      var allCards = slide.querySelectorAll('.card');
      if (allCards.length === 0) {
        // Fallback: look for styled containers that look like cards
        var gridEl = slide.querySelector('div[style*="grid"], div[style*="gap"]');
        if (gridEl) {
          allCards = [];
          var kids = gridEl.children;
          for (var ci = 0; ci < kids.length; ci++) {
            var kidStyle = kids[ci].getAttribute('style') || '';
            if (kidStyle.indexOf('padding') !== -1 || kidStyle.indexOf('border') !== -1) {
              allCards.push(kids[ci]);
            }
          }
        }
      }
      // Also check for border-left styled cards (mitigation cards in risk-matrix)
      if (allCards.length === 0) {
        allCards = slide.querySelectorAll('div[style*="border-left"][style*="padding"]');
      }
      var targetCard = allCards[idx];
      if (!targetCard) return null;
      if (sel === 'GENERIC_CARD_TITLE') {
        return targetCard.querySelector('div[style*="font-weight: 6"], div[style*="font-weight:6"], span[style*="font-weight: 6"], span[style*="font-weight:6"], h3');
      } else {
        var descEl = targetCard.querySelector('div[style*="text-body-color"], div[style*="#4b5563"], div[style*="#9ca3af"]');
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
      var swotCards = slide.querySelectorAll('.card');
      var swotCard = swotCards[idx];
      if (!swotCard) return null;
      return swotCard.querySelector('div[style*="font-weight: 7"], div[style*="font-weight:7"], h3');
    }
    if (sel === 'SWOT_ITEM') {
      // matchIndex encodes section*100 + itemIndex
      var sectionIdx = Math.floor(idx / 100);
      var itemIdx = idx % 100;
      var swotCards2 = slide.querySelectorAll('.card');
      var swotCard2 = swotCards2[sectionIdx];
      if (!swotCard2) return null;
      var swotItems = swotCard2.querySelectorAll('span[style*="text-body-color"], span[style*="#4b5563"], span');
      var filteredSwotItems = [];
      for (var si = 0; si < swotItems.length; si++) {
        if (swotItems[si].textContent.trim().length > 0 && !swotItems[si].closest('[data-field]')) {
          filteredSwotItems.push(swotItems[si]);
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
      var axisLabels = slide.querySelectorAll('div[style*="text-align: center"][style*="font-weight"]');
      if (sel === 'MATRIX_AXIS_X') return axisLabels[0] || null;
      return axisLabels[1] || null;
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
