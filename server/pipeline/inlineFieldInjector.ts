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

// ═══════════════════════════════════════════════════════
// HELPER: add bullet-style fields (title + description)
// ═══════════════════════════════════════════════════════

function addBulletFields(
  fields: EditableFieldDef[],
  bullets: any[],
  prefix: string,
  selectorTitle: string,
  selectorDesc: string,
  labelPrefix: string,
): void {
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (typeof b === "object" && b.title) {
      fields.push({
        key: `${prefix}.${i}.title`,
        label: `${labelPrefix} ${i + 1}`,
        selector: selectorTitle,
        matchIndex: i,
        multiline: false,
      });
      if (b.description) {
        fields.push({
          key: `${prefix}.${i}.description`,
          label: `Описание ${i + 1}`,
          selector: selectorDesc,
          matchIndex: i,
          multiline: true,
        });
      }
    } else if (typeof b === "string") {
      fields.push({
        key: `${prefix}.${i}`,
        label: `${labelPrefix} ${i + 1}`,
        selector: selectorTitle,
        matchIndex: i,
        multiline: false,
      });
    }
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
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "SLIDE_DESCRIPTION", matchIndex: 0, multiline: true });
      }
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
      // Option A
      if (data.optionA) {
        if (data.optionA.title) {
          fields.push({ key: "optionA.title", label: "Вариант A", selector: "COMPARISON_A_TITLE", matchIndex: 0, multiline: false });
        }
        const aPoints = data.optionA.points || [];
        for (let i = 0; i < aPoints.length; i++) {
          fields.push({
            key: `optionA.points.${i}`,
            label: `A: пункт ${i + 1}`,
            selector: "COMPARISON_A_POINT",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      // Option B
      if (data.optionB) {
        if (data.optionB.title) {
          fields.push({ key: "optionB.title", label: "Вариант B", selector: "COMPARISON_B_TITLE", matchIndex: 0, multiline: false });
        }
        const bPoints = data.optionB.points || [];
        for (let i = 0; i < bPoints.length; i++) {
          fields.push({
            key: `optionB.points.${i}`,
            label: `B: пункт ${i + 1}`,
            selector: "COMPARISON_B_POINT",
            matchIndex: i,
            multiline: false,
          });
        }
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
      const members = data.teamMembers || [];
      for (let i = 0; i < members.length; i++) {
        if (members[i].name) {
          fields.push({
            key: `teamMembers.${i}.name`,
            label: `Имя ${i + 1}`,
            selector: "TEAM_NAME",
            matchIndex: i,
            multiline: false,
          });
        }
        if (members[i].role) {
          fields.push({
            key: `teamMembers.${i}.role`,
            label: `Роль ${i + 1}`,
            selector: "TEAM_ROLE",
            matchIndex: i,
            multiline: false,
          });
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
        fields.push({ key: "description", label: "Описание", selector: "SLIDE_DESCRIPTION", matchIndex: 0, multiline: true });
      }
      // Checklist items
      const items = data.items || [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].title) {
          fields.push({
            key: `items.${i}.title`,
            label: `Пункт ${i + 1}`,
            selector: "CHECKLIST_TITLE",
            matchIndex: i,
            multiline: false,
          });
        }
        if (items[i].description) {
          fields.push({
            key: `items.${i}.description`,
            label: `Описание ${i + 1}`,
            selector: "CHECKLIST_DESC",
            matchIndex: i,
            multiline: true,
          });
        }
        if (items[i].status) {
          fields.push({
            key: `items.${i}.status`,
            label: `Статус ${i + 1}`,
            selector: "CHECKLIST_STATUS",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      break;
    }

    case "swot-analysis": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      // SWOT quadrants: strengths, weaknesses, opportunities, threats
      const quadrants = ["strengths", "weaknesses", "opportunities", "threats"];
      const quadrantLabels = ["Сильные", "Слабые", "Возможности", "Угрозы"];
      for (let q = 0; q < quadrants.length; q++) {
        const qData = data[quadrants[q]];
        if (!qData) continue;
        if (qData.title) {
          fields.push({
            key: `${quadrants[q]}.title`,
            label: quadrantLabels[q],
            selector: "SWOT_TITLE",
            matchIndex: q,
            multiline: false,
          });
        }
        const qItems = qData.items || [];
        for (let i = 0; i < qItems.length; i++) {
          fields.push({
            key: `${quadrants[q]}.items.${i}`,
            label: `${quadrantLabels[q]} ${i + 1}`,
            selector: "SWOT_ITEM",
            matchIndex: q * 100 + i, // encode quadrant + item index
            multiline: false,
          });
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
        if (stages[i].title && !stages[i].label) {
          fields.push({
            key: `stages.${i}.title`,
            label: `Этап ${i + 1}`,
            selector: "FUNNEL_TITLE",
            matchIndex: i,
            multiline: false,
          });
        }
        if (stages[i].value) {
          fields.push({
            key: `stages.${i}.value`,
            label: `Значение ${i + 1}`,
            selector: "FUNNEL_VALUE",
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
        fields.push({ key: "description", label: "Описание", selector: "SLIDE_DESCRIPTION", matchIndex: 0, multiline: true });
      }
      const milestones = data.milestones || [];
      for (let i = 0; i < milestones.length; i++) {
        if (milestones[i].title) {
          fields.push({
            key: `milestones.${i}.title`,
            label: `Этап ${i + 1}`,
            selector: "ROADMAP_TITLE",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      break;
    }

    case "pyramid": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const levels = data.levels || [];
      for (let i = 0; i < levels.length; i++) {
        if (levels[i].label) {
          fields.push({
            key: `levels.${i}.label`,
            label: `Уровень ${i + 1}`,
            selector: "PYRAMID_LABEL",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      break;
    }

    case "matrix-2x2": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      // 4 quadrants
      const quadrantKeys = ["topLeft", "topRight", "bottomLeft", "bottomRight"];
      const quadrantLabelsM = ["Верх-лево", "Верх-право", "Низ-лево", "Низ-право"];
      for (let q = 0; q < quadrantKeys.length; q++) {
        const qData = data[quadrantKeys[q]];
        if (!qData) continue;
        if (qData.title) {
          fields.push({
            key: `${quadrantKeys[q]}.title`,
            label: quadrantLabelsM[q],
            selector: "MATRIX_TITLE",
            matchIndex: q,
            multiline: false,
          });
        }
      }
      break;
    }

    case "pros-cons": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      // Pros
      if (data.pros) {
        if (data.pros.title) {
          fields.push({ key: "pros.title", label: "Плюсы", selector: "PROSCONS_TITLE", matchIndex: 0, multiline: false });
        }
        const prosItems = data.pros.items || [];
        for (let i = 0; i < prosItems.length; i++) {
          fields.push({
            key: `pros.items.${i}`,
            label: `Плюс ${i + 1}`,
            selector: "PROSCONS_ITEM",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      // Cons
      if (data.cons) {
        if (data.cons.title) {
          fields.push({ key: "cons.title", label: "Минусы", selector: "PROSCONS_TITLE", matchIndex: 1, multiline: false });
        }
        const consItems = data.cons.items || [];
        for (let i = 0; i < consItems.length; i++) {
          fields.push({
            key: `cons.items.${i}`,
            label: `Минус ${i + 1}`,
            selector: "PROSCONS_CON_ITEM",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      break;
    }

    // ═══════════════════════════════════════════════════════
    // MANUS-STYLE LAYOUTS (Sprint 4)
    // ═══════════════════════════════════════════════════════

    case "stats-chart": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const stats = data.stats || [];
      for (let i = 0; i < stats.length; i++) {
        if (stats[i].value) {
          fields.push({
            key: `stats.${i}.value`,
            label: `Значение ${i + 1}`,
            selector: "STATS_VALUE",
            matchIndex: i,
            multiline: false,
          });
        }
        if (stats[i].label) {
          fields.push({
            key: `stats.${i}.label`,
            label: `Метка ${i + 1}`,
            selector: "STATS_LABEL",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      if (data.source) {
        fields.push({ key: "source", label: "Источник", selector: "SLIDE_SOURCE", matchIndex: 0, multiline: false });
      }
      break;
    }

    case "chart-text": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "SLIDE_DESCRIPTION", matchIndex: 0, multiline: true });
      }
      const ctBullets = data.bullets || [];
      addBulletFields(fields, ctBullets, "bullets", "CHARTTEXT_BULLET_TITLE", "CHARTTEXT_BULLET_DESC", "Пункт");
      if (data.source) {
        fields.push({ key: "source", label: "Источник", selector: "SLIDE_SOURCE", matchIndex: 0, multiline: false });
      }
      break;
    }

    case "hero-stat": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.mainStat) {
        if (data.mainStat.value) {
          fields.push({ key: "mainStat.value", label: "Главное значение", selector: "HEROSTAT_MAIN_VALUE", matchIndex: 0, multiline: false });
        }
        if (data.mainStat.label) {
          fields.push({ key: "mainStat.label", label: "Главная метка", selector: "HEROSTAT_MAIN_LABEL", matchIndex: 0, multiline: false });
        }
      }
      const suppStats = data.supportingStats || [];
      for (let i = 0; i < suppStats.length; i++) {
        if (suppStats[i].value) {
          fields.push({
            key: `supportingStats.${i}.value`,
            label: `Доп. значение ${i + 1}`,
            selector: "HEROSTAT_SUPP_VALUE",
            matchIndex: i,
            multiline: false,
          });
        }
        if (suppStats[i].label) {
          fields.push({
            key: `supportingStats.${i}.label`,
            label: `Доп. метка ${i + 1}`,
            selector: "HEROSTAT_SUPP_LABEL",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      break;
    }

    case "scenario-cards": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "SLIDE_DESCRIPTION", matchIndex: 0, multiline: true });
      }
      const scenarios = data.scenarios || [];
      for (let i = 0; i < scenarios.length; i++) {
        if (scenarios[i].title) {
          fields.push({
            key: `scenarios.${i}.title`,
            label: `Сценарий ${i + 1}`,
            selector: "SCENARIO_TITLE",
            matchIndex: i,
            multiline: false,
          });
        }
        if (scenarios[i].label) {
          fields.push({
            key: `scenarios.${i}.label`,
            label: `Метка ${i + 1}`,
            selector: "SCENARIO_LABEL",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      break;
    }

    case "numbered-steps-v2": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const steps2 = data.steps || [];
      for (let i = 0; i < steps2.length; i++) {
        if (steps2[i].title) {
          fields.push({
            key: `steps.${i}.title`,
            label: `Шаг ${i + 1}`,
            selector: "NSTEP_TITLE",
            matchIndex: i,
            multiline: false,
          });
        }
        if (steps2[i].description) {
          fields.push({
            key: `steps.${i}.description`,
            label: `Описание ${i + 1}`,
            selector: "NSTEP_DESC",
            matchIndex: i,
            multiline: true,
          });
        }
      }
      break;
    }

    case "timeline-horizontal": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      if (data.description) {
        fields.push({ key: "description", label: "Описание", selector: "SLIDE_DESCRIPTION", matchIndex: 0, multiline: true });
      }
      const thEvents = data.events || [];
      for (let i = 0; i < thEvents.length; i++) {
        if (thEvents[i].title) {
          fields.push({
            key: `events.${i}.title`,
            label: `Событие ${i + 1}`,
            selector: "HTIMELINE_TITLE",
            matchIndex: i,
            multiline: false,
          });
        }
        if (thEvents[i].date) {
          fields.push({
            key: `events.${i}.date`,
            label: `Дата ${i + 1}`,
            selector: "HTIMELINE_DATE",
            matchIndex: i,
            multiline: false,
          });
        }
      }
      break;
    }

    case "text-with-callout": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const twcBullets = data.bullets || [];
      addBulletFields(fields, twcBullets, "bullets", "BULLET_TITLE", "BULLET_DESC", "Пункт");
      if (data.callout) {
        fields.push({ key: "callout", label: "Вывод", selector: "CALLOUT_TEXT", matchIndex: 0, multiline: true });
      }
      break;
    }

    case "dual-chart": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      // Left chart title
      if (data.leftChart?.title) {
        fields.push({ key: "leftChart.title", label: "Левый график", selector: "DUALCHART_TITLE", matchIndex: 0, multiline: false });
      }
      // Right chart title
      if (data.rightChart?.title) {
        fields.push({ key: "rightChart.title", label: "Правый график", selector: "DUALCHART_TITLE", matchIndex: 1, multiline: false });
      }
      break;
    }

    case "risk-matrix": {
      fields.push({ key: "title", label: "Заголовок", selector: "h1", multiline: false });
      const mitigations = data.mitigations || [];
      for (let i = 0; i < mitigations.length; i++) {
        if (mitigations[i].title) {
          fields.push({
            key: `mitigations.${i}.title`,
            label: `Мера ${i + 1}`,
            selector: "MITIGATION_TITLE",
            matchIndex: i,
            multiline: false,
          });
        }
      }
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
  // HELPER: find grid/card items in a slide
  // ═══════════════════════════════════════════════════════
  function findGridCards() {
    // Find cards in grid layout (used by checklist, scenario-cards, etc.)
    var cards = slide.querySelectorAll('div[style*="grid"] > div[style*="display: flex"]');
    if (cards.length === 0) {
      // Fallback: look for .card elements
      cards = slide.querySelectorAll('.card');
    }
    return cards;
  }

  // ═══════════════════════════════════════════════════════
  // HELPER: find SWOT quadrants (4 colored grid cells)
  // ═══════════════════════════════════════════════════════
  function findSwotQuadrants() {
    var grid = slide.querySelector('div[style*="grid-template-columns: 1fr 1fr"][style*="grid-template-rows"]');
    if (!grid) return [];
    return Array.from(grid.children);
  }

  // ═══════════════════════════════════════════════════════
  // HELPER: find columns in comparison/pros-cons layout
  // ═══════════════════════════════════════════════════════
  function findComparisonCards() {
    var cards = slide.querySelectorAll('.card');
    if (cards.length >= 2) return cards;
    // Fallback: grid children
    var grid = slide.querySelector('div[style*="grid-template-columns"]');
    if (grid) return grid.children;
    return [];
  }

  /**
   * Find the element for a field using its selector and matchIndex.
   * Handles special selectors for bullet items, metrics, etc.
   */
  function findElement(field) {
    var sel = field.selector;
    var idx = field.matchIndex || 0;

    // ═══ SLIDE_DESCRIPTION: first <p> after accent-line ═══
    if (sel === 'SLIDE_DESCRIPTION') {
      var ps = slide.querySelectorAll('p');
      var filtered = [];
      for (var pi = 0; pi < ps.length; pi++) {
        if (!ps[pi].closest('.slide-footer')) filtered.push(ps[pi]);
      }
      return filtered[idx] || null;
    }

    // ═══ SLIDE_SOURCE: source text at bottom ═══
    if (sel === 'SLIDE_SOURCE') {
      var sourceEls = slide.querySelectorAll('div[style*="font-size: 11px"], div[style*="font-size:11px"], span[style*="font-size: 11px"]');
      for (var si = 0; si < sourceEls.length; si++) {
        var txt = sourceEls[si].textContent || '';
        if (txt.indexOf('Источник') !== -1 || txt.indexOf('Source') !== -1) return sourceEls[si];
      }
      return null;
    }

    // ═══ CALLOUT_TEXT: callout bar at bottom ═══
    if (sel === 'CALLOUT_TEXT') {
      var calloutBar = slide.querySelector('div[style*="border-radius"][style*="background"][style*="padding"]');
      if (!calloutBar) return null;
      // Find the text element inside the callout (not the icon)
      var calloutTexts = calloutBar.querySelectorAll('div[style*="flex: 1"], span');
      for (var ci = 0; ci < calloutTexts.length; ci++) {
        if (calloutTexts[ci].textContent && calloutTexts[ci].textContent.trim().length > 10) return calloutTexts[ci];
      }
      return calloutBar;
    }

    // ═══ BULLET_TITLE / BULLET_DESC ═══
    if (sel === 'BULLET_TITLE' || sel === 'BULLET_DESC') {
      var bulletRows = slide.querySelectorAll('.bullet-row');
      if (bulletRows.length === 0) {
        var allDivs = slide.querySelectorAll('div[style*="display: flex"][style*="align-items"]');
        var bulletContainers = [];
        allDivs.forEach(function(d) {
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
        var titleEl = row.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"]');
        if (!titleEl) titleEl = row.querySelector('span[style*="font-weight: 600"], span[style*="font-weight:600"]');
        return titleEl;
      } else {
        var descEl = row.querySelector('div[style*="text-body-color"], div[style*="#4b5563"]');
        if (!descEl) {
          var contentDiv = row.querySelector('div[style*="flex: 1"]');
          if (contentDiv && contentDiv.children.length > 1) {
            descEl = contentDiv.children[1];
          }
        }
        return descEl;
      }
    }

    // ═══ CHARTTEXT_BULLET_TITLE / CHARTTEXT_BULLET_DESC ═══
    if (sel === 'CHARTTEXT_BULLET_TITLE' || sel === 'CHARTTEXT_BULLET_DESC') {
      // chart-text: bullets are in the right panel
      var panels = slide.querySelectorAll('div[style*="flex: 1"]');
      var rightPanel = panels.length >= 2 ? panels[panels.length - 1] : slide;
      var bulletDivs = rightPanel.querySelectorAll('div[style*="display: flex"][style*="align-items"]');
      var bulletItems = [];
      bulletDivs.forEach(function(d) {
        if (d.children.length >= 2) {
          var first = d.children[0];
          if (first.style && (first.style.borderRadius === '50%' || parseInt(first.style.width) <= 12)) {
            bulletItems.push(d);
          }
        }
      });
      var bItem = bulletItems[idx];
      if (!bItem) return null;
      if (sel === 'CHARTTEXT_BULLET_TITLE') {
        return bItem.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"]');
      } else {
        var bd = bItem.querySelector('div[style*="text-body-color"], div[style*="#4b5563"]');
        if (!bd) {
          var cd = bItem.querySelector('div[style*="flex: 1"]');
          if (cd && cd.children.length > 1) bd = cd.children[1];
        }
        return bd;
      }
    }

    // ═══ CHECKLIST_TITLE / CHECKLIST_DESC / CHECKLIST_STATUS ═══
    if (sel === 'CHECKLIST_TITLE' || sel === 'CHECKLIST_DESC' || sel === 'CHECKLIST_STATUS') {
      var gridEl = slide.querySelector('div[style*="grid-template-columns"]');
      if (!gridEl) return null;
      var checkItems = gridEl.children;
      var item = checkItems[idx];
      if (!item) return null;

      if (sel === 'CHECKLIST_TITLE') {
        // Title: first div with font-weight: 600 inside the flex:1 content area
        var contentArea = item.querySelector('div[style*="flex: 1"]');
        if (contentArea) {
          return contentArea.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"]');
        }
        return null;
      }
      if (sel === 'CHECKLIST_DESC') {
        var contentArea2 = item.querySelector('div[style*="flex: 1"]');
        if (contentArea2 && contentArea2.children.length > 1) {
          return contentArea2.children[1]; // Second child is description
        }
        return null;
      }
      if (sel === 'CHECKLIST_STATUS') {
        // Status badge: div with border-radius: 20px (pill shape)
        return item.querySelector('div[style*="border-radius: 20px"]');
      }
      return null;
    }

    // ═══ METRIC_VALUE / METRIC_LABEL ═══
    if (sel === 'METRIC_VALUE' || sel === 'METRIC_LABEL') {
      var cards = slide.querySelectorAll('.card, div[style*="text-align: center"]');
      if (cards.length === 0) {
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

    // ═══ STATS_VALUE / STATS_LABEL (stats-chart) ═══
    if (sel === 'STATS_VALUE' || sel === 'STATS_LABEL') {
      var statCards = slide.querySelectorAll('.card');
      var sc = statCards[idx];
      if (!sc) return null;
      if (sel === 'STATS_VALUE') {
        return sc.querySelector('div[style*="font-size: 2"], div[style*="font-weight: 700"], div[style*="font-weight:700"]');
      } else {
        return sc.querySelector('div[style*="text-body-color"], div[style*="#4b5563"], div[style*="font-size: 12"], div[style*="font-size: 13"]');
      }
    }

    // ═══ HEROSTAT_MAIN_VALUE / HEROSTAT_MAIN_LABEL ═══
    if (sel === 'HEROSTAT_MAIN_VALUE') {
      // Big stat on accent panel
      var accentPanel = slide.querySelector('div[style*="background: var(--slide-bg-accent"], div[style*="background:var(--slide-bg-accent"]');
      if (!accentPanel) accentPanel = slide.querySelector('div[style*="background: var(--primary-accent"]');
      if (!accentPanel) return null;
      return accentPanel.querySelector('div[style*="font-size: 5"], div[style*="font-size: 6"], div[style*="font-size:5"]');
    }
    if (sel === 'HEROSTAT_MAIN_LABEL') {
      var accentPanel2 = slide.querySelector('div[style*="background: var(--slide-bg-accent"], div[style*="background:var(--slide-bg-accent"]');
      if (!accentPanel2) accentPanel2 = slide.querySelector('div[style*="background: var(--primary-accent"]');
      if (!accentPanel2) return null;
      return accentPanel2.querySelector('div[style*="font-size: 16"], div[style*="font-size: 18"], div[style*="font-weight: 600"]');
    }

    // ═══ HEROSTAT_SUPP_VALUE / HEROSTAT_SUPP_LABEL ═══
    if (sel === 'HEROSTAT_SUPP_VALUE' || sel === 'HEROSTAT_SUPP_LABEL') {
      var suppCards = slide.querySelectorAll('.card');
      var suppCard = suppCards[idx];
      if (!suppCard) return null;
      if (sel === 'HEROSTAT_SUPP_VALUE') {
        return suppCard.querySelector('div[style*="font-size: 2"], div[style*="font-weight: 700"]');
      } else {
        return suppCard.querySelector('div[style*="font-weight: 600"][style*="font-size: 14"], div[style*="font-weight: 600"][style*="font-size: 15"]');
      }
    }

    // ═══ SCENARIO_TITLE / SCENARIO_LABEL ═══
    if (sel === 'SCENARIO_TITLE' || sel === 'SCENARIO_LABEL') {
      var scenarioCards = slide.querySelectorAll('.card');
      if (scenarioCards.length === 0) {
        var scGrid = slide.querySelector('div[style*="grid"]');
        if (scGrid) scenarioCards = scGrid.children;
      }
      var scCard = scenarioCards[idx];
      if (!scCard) return null;
      if (sel === 'SCENARIO_TITLE') {
        return scCard.querySelector('h2, div[style*="font-weight: 600"][style*="font-size: 1"]');
      } else {
        return scCard.querySelector('div[style*="border-radius"][style*="font-weight: 600"], div[style*="font-size: 12"][style*="font-weight"]');
      }
    }

    // ═══ NSTEP_TITLE / NSTEP_DESC (numbered-steps-v2) ═══
    if (sel === 'NSTEP_TITLE' || sel === 'NSTEP_DESC') {
      // Steps are flex rows with circle numbers
      var stepRows = slide.querySelectorAll('div[style*="display: flex"][style*="gap"]');
      var stepContainers = [];
      stepRows.forEach(function(r) {
        // Look for rows with a circle number (border-radius: 50% child)
        var circle = r.querySelector('div[style*="border-radius: 50%"][style*="width: 4"], div[style*="border-radius: 50%"][style*="width: 3"]');
        if (circle) stepContainers.push(r);
      });
      var stepItem = stepContainers[idx];
      if (!stepItem) return null;
      if (sel === 'NSTEP_TITLE') {
        return stepItem.querySelector('div[style*="font-weight: 600"], div[style*="font-weight: 700"]');
      } else {
        return stepItem.querySelector('div[style*="text-body-color"], div[style*="#4b5563"]');
      }
    }

    // ═══ HTIMELINE_TITLE / HTIMELINE_DATE ═══
    if (sel === 'HTIMELINE_TITLE' || sel === 'HTIMELINE_DATE') {
      // Horizontal timeline: columns with content above/below the line
      var timelineCols = slide.querySelectorAll('div[style*="display: flex"][style*="flex-direction: column"][style*="align-items: center"]');
      if (timelineCols.length === 0) {
        var tlGrid = slide.querySelector('div[style*="grid"]');
        if (tlGrid) timelineCols = tlGrid.children;
      }
      var tlCol = timelineCols[idx];
      if (!tlCol) return null;
      if (sel === 'HTIMELINE_TITLE') {
        return tlCol.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"]');
      } else {
        return tlCol.querySelector('div[style*="font-size: 11"], div[style*="font-size: 12"], div[style*="font-weight: 700"]');
      }
    }

    // ═══ DUALCHART_TITLE ═══
    if (sel === 'DUALCHART_TITLE') {
      var chartCards = slide.querySelectorAll('.card');
      var chartCard = chartCards[idx];
      if (!chartCard) return null;
      return chartCard.querySelector('h2, div[style*="font-weight: 600"][style*="font-size: 1"]');
    }

    // ═══ MITIGATION_TITLE (risk-matrix) ═══
    if (sel === 'MITIGATION_TITLE') {
      // Mitigations are numbered cards on the right side
      var mitigCards = slide.querySelectorAll('div[style*="display: flex"][style*="gap"][style*="padding"]');
      var mitigItems = [];
      mitigCards.forEach(function(mc) {
        // Look for items with a number circle
        var numCircle = mc.querySelector('div[style*="border-radius: 50%"][style*="width: 2"]');
        if (numCircle) mitigItems.push(mc);
      });
      var mitigItem = mitigItems[idx];
      if (!mitigItem) return null;
      return mitigItem.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"]');
    }

    // ═══ COMPARISON_A_TITLE / COMPARISON_A_POINT / COMPARISON_B_TITLE / COMPARISON_B_POINT ═══
    if (sel === 'COMPARISON_A_TITLE' || sel === 'COMPARISON_A_POINT' || sel === 'COMPARISON_B_TITLE' || sel === 'COMPARISON_B_POINT') {
      var compCards = findComparisonCards();
      var isA = sel.indexOf('_A_') !== -1;
      var targetCard = isA ? compCards[0] : compCards[1];
      if (!targetCard) return null;
      if (sel.indexOf('_TITLE') !== -1) {
        return targetCard.querySelector('h2');
      } else {
        var spans = targetCard.querySelectorAll('span');
        return spans[idx] || null;
      }
    }

    // ═══ PROSCONS_TITLE / PROSCONS_ITEM / PROSCONS_CON_ITEM ═══
    if (sel === 'PROSCONS_TITLE' || sel === 'PROSCONS_ITEM' || sel === 'PROSCONS_CON_ITEM') {
      var pcCards = findComparisonCards();
      if (sel === 'PROSCONS_TITLE') {
        var pcCard = pcCards[idx];
        if (!pcCard) return null;
        return pcCard.querySelector('h2');
      }
      if (sel === 'PROSCONS_ITEM') {
        var prosCard = pcCards[0];
        if (!prosCard) return null;
        var prosSpans = prosCard.querySelectorAll('span');
        return prosSpans[idx] || null;
      }
      if (sel === 'PROSCONS_CON_ITEM') {
        var consCard = pcCards[1];
        if (!consCard) return null;
        var consSpans = consCard.querySelectorAll('span');
        return consSpans[idx] || null;
      }
    }

    // ═══ SWOT_TITLE / SWOT_ITEM ═══
    if (sel === 'SWOT_TITLE' || sel === 'SWOT_ITEM') {
      var swotQuads = findSwotQuadrants();
      if (sel === 'SWOT_TITLE') {
        var quad = swotQuads[idx];
        if (!quad) return null;
        return quad.querySelector('h2');
      }
      if (sel === 'SWOT_ITEM') {
        // Decode: quadrant index = Math.floor(idx/100), item index = idx % 100
        var qIdx = Math.floor(idx / 100);
        var iIdx = idx % 100;
        var swotQuad = swotQuads[qIdx];
        if (!swotQuad) return null;
        var swotSpans = swotQuad.querySelectorAll('span');
        return swotSpans[iIdx] || null;
      }
    }

    // ═══ FUNNEL_TITLE / FUNNEL_VALUE ═══
    if (sel === 'FUNNEL_TITLE' || sel === 'FUNNEL_VALUE') {
      var funnelStages = slide.querySelectorAll('div[style*="border-radius: 10px"][style*="background"]');
      var fStage = funnelStages[idx];
      if (!fStage) return null;
      if (sel === 'FUNNEL_TITLE') {
        return fStage.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"]');
      } else {
        return fStage.querySelector('div[style*="font-size: 24"], div[style*="font-weight: 700"]');
      }
    }

    // ═══ ROADMAP_TITLE ═══
    if (sel === 'ROADMAP_TITLE') {
      var milestoneCards = slide.querySelectorAll('.card');
      var msCard = milestoneCards[idx];
      if (!msCard) return null;
      return msCard.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"], h3');
    }

    // ═══ PYRAMID_LABEL ═══
    if (sel === 'PYRAMID_LABEL') {
      var pyramidLevels = slide.querySelectorAll('div[style*="border-radius"][style*="background"][style*="display: flex"][style*="align-items: center"]');
      var pLevel = pyramidLevels[idx];
      if (!pLevel) return null;
      return pLevel.querySelector('div[style*="font-weight: 600"], div[style*="font-weight: 700"], span[style*="font-weight"]');
    }

    // ═══ MATRIX_TITLE ═══
    if (sel === 'MATRIX_TITLE') {
      var matrixGrid = slide.querySelector('div[style*="grid-template-columns: 1fr 1fr"][style*="grid-template-rows"]');
      if (!matrixGrid) matrixGrid = slide.querySelector('div[style*="grid-template-columns"][style*="grid-template-rows"]');
      if (!matrixGrid) return null;
      var matrixCell = matrixGrid.children[idx];
      if (!matrixCell) return null;
      return matrixCell.querySelector('h2, div[style*="font-weight: 600"], div[style*="font-weight: 700"]');
    }

    // ═══ TEAM_NAME / TEAM_ROLE ═══
    if (sel === 'TEAM_NAME' || sel === 'TEAM_ROLE') {
      var teamCards = slide.querySelectorAll('.card');
      var tCard = teamCards[idx];
      if (!tCard) return null;
      if (sel === 'TEAM_NAME') {
        return tCard.querySelector('div[style*="font-weight: 600"][style*="font-size: 14"]');
      } else {
        return tCard.querySelector('div[style*="primary-accent-color"][style*="font-size: 12"]');
      }
    }

    // ═══ TIMELINE_TITLE / TIMELINE_DESC ═══
    if (sel === 'TIMELINE_TITLE' || sel === 'TIMELINE_DESC') {
      var timelineItems = slide.querySelectorAll('.card, div[style*="border-radius"][style*="padding"]');
      var tlItem = timelineItems[idx];
      if (!tlItem) return null;
      if (sel === 'TIMELINE_TITLE') {
        return tlItem.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"], h3');
      } else {
        return tlItem.querySelector('div[style*="text-body-color"], div[style*="#4b5563"]');
      }
    }

    // ═══ STEP_TITLE / STEP_DESC ═══
    if (sel === 'STEP_TITLE' || sel === 'STEP_DESC') {
      var stepItems2 = slide.querySelectorAll('.card, div[style*="border-radius"][style*="background"]');
      var step2 = stepItems2[idx];
      if (!step2) return null;
      if (sel === 'STEP_TITLE') {
        return step2.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"], h3');
      } else {
        return step2.querySelector('div[style*="text-body-color"], div[style*="#4b5563"]');
      }
    }

    // ═══ SECTION_TITLE ═══
    if (sel === 'SECTION_TITLE') {
      var sectionRows = slide.querySelectorAll('div[style*="border-radius"][style*="background"]');
      var section = sectionRows[idx];
      if (!section) return null;
      return section.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"]');
    }

    // ═══ FUNNEL_LABEL (legacy) ═══
    if (sel === 'FUNNEL_LABEL') {
      var funnelStages2 = slide.querySelectorAll('div[style*="border-radius"]');
      var stage2 = funnelStages2[idx];
      if (!stage2) return null;
      return stage2.querySelector('span, div[style*="font-weight"]');
    }

    // ═══ .bullet-row selector (text-slide with matchIndex) ═══
    if (sel === '.bullet-row') {
      var rows = slide.querySelectorAll('.bullet-row');
      var targetRow = rows[idx];
      if (!targetRow) return null;
      if (field.key.endsWith('.title') || !field.key.includes('.description')) {
        var t = targetRow.querySelector('div[style*="font-weight: 600"], div[style*="font-weight:600"]');
        if (t) return t;
        return targetRow.querySelector('span');
      } else {
        var d = targetRow.querySelector('div[style*="text-body-color"], div[style*="#4b5563"]');
        if (!d) {
          var contentArea3 = targetRow.querySelector('div[style*="flex: 1"]');
          if (contentArea3 && contentArea3.children.length > 1) d = contentArea3.children[1];
        }
        return d;
      }
    }

    // ═══ Standard CSS selector ═══
    try {
      var elements = slide.querySelectorAll(sel);
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
  var allDivs = slide.querySelectorAll('div');
  allDivs.forEach(function(div) {
    var style = div.getAttribute('style') || '';
    if (style.indexOf('linear-gradient') === -1) return;
    var parent = div.parentElement;
    if (!parent) return;
    var parentStyle = parent.getAttribute('style') || '';
    if (parentStyle.indexOf('overflow') === -1 || parentStyle.indexOf('border-radius') === -1) return;
    var rect = div.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return;
    if (div.querySelector('.img-edit-overlay')) return;
    if (div.closest('.img-edit-wrapper')) return;
    if (div.closest('.slide-footer')) return;
    var parentRect = parent.getBoundingClientRect();
    if (parentRect.width < 100 || parentRect.height < 100) return;

    imageCount++;
    var myIdx = imageCount - 1;

    parent.classList.add('img-edit-wrapper');
    parent.style.position = 'relative';

    var overlay = document.createElement('div');
    overlay.className = 'img-edit-overlay';
    overlay.style.opacity = '1';
    overlay.style.background = 'rgba(0, 0, 0, 0.25)';
    overlay.innerHTML = addPlaceholderBtnHtml;
    parent.appendChild(overlay);

    attachClickHandler(overlay, myIdx, function() { return ''; });
    attachDragHandlers(overlay, myIdx, addPlaceholderBtnHtml, function(dataUrl) {
      var newImg = document.createElement('img');
      newImg.src = dataUrl;
      newImg.style.width = '100%';
      newImg.style.height = '100%';
      newImg.style.objectFit = 'cover';
      parent.replaceChild(newImg, div);
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
