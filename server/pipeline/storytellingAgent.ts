/**
 * Storytelling Agent — transforms Writer output into McKinsey-quality narrative.
 *
 * Responsibilities:
 * 1. Convert descriptive titles → action titles (e.g., "Market Overview" → "Market Growth Accelerates to $4.2B")
 * 2. Ensure narrative coherence: each slide builds on the previous one
 * 3. Add transition phrases that connect slides logically
 * 4. Verify the "one slide = one message" principle
 *
 * Runs AFTER Writer (parallel), BEFORE Layout.
 * Input: SlideContent[] from Writer
 * Output: Enhanced SlideContent[] with improved titles, coherence, and transitions
 */

import { invokeLLM } from "../_core/llm";
import type { SlideContent, OutlineResult } from "./generator";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface StorytellingEnhancement {
  slide_number: number;
  /** New action title (verb-first or insight-driven) */
  action_title: string;
  /** Transition phrase from previous slide (empty for slide 1) */
  transition_from_previous: string;
  /** One-sentence key takeaway that audience should remember */
  audience_takeaway: string;
  /** Narrative role: hook | context | evidence | insight | action | conclusion */
  narrative_role: string;
}

export interface StorytellingResult {
  narrative_thread: string;
  enhancements: StorytellingEnhancement[];
}

// ═══════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════

const STORYTELLING_SYSTEM = `You are Storytelling Agent — a McKinsey-trained presentation narrative architect.

<role>
You transform good slide content into a compelling story. Your job is to ensure every slide title is an ACTION TITLE (communicates the key insight, not just the topic), and that slides flow as a coherent narrative.
</role>

<action_title_rules>
Action titles are the #1 differentiator between amateur and professional presentations.

BAD (descriptive/topic titles):
- "Market Overview" → just names the topic
- "Our Solution" → vague, says nothing
- "Financial Results" → no insight
- "Team Structure" → boring label

GOOD (action/insight titles):
- "Market Growth Accelerates to $4.2B by 2027" → states the finding
- "AI-Powered Platform Reduces Costs by 40%" → communicates the value
- "Revenue Doubled While Costs Dropped 15%" → tells the story
- "Cross-Functional Teams Drive 3x Faster Delivery" → reveals the insight

Rules for action titles:
1. Each title must communicate the CONCLUSION, not the topic
2. Include specific numbers, percentages, or outcomes when available
3. Use active verbs: "drives", "accelerates", "enables", "reduces", "transforms"
4. The audience should understand the slide's message from the title ALONE
5. STRICT LENGTH LIMIT: Maximum 50 characters for Russian titles, 60 characters for English titles. This is a HARD limit — titles WILL be truncated if longer. Count characters carefully.
6. Prefer short, punchy titles: 4-8 words. If you need more words, you're being too descriptive.
7. For section headers: use a short provocative question or bold 3-5 word statement (max 35 characters)
8. Title slide and final slide can keep their original format but must also respect the 50-char limit
9. NEVER use colons (:) to combine two ideas in one title — pick the stronger idea
10. NEVER use "и" / "and" to chain multiple concepts — focus on ONE insight per title
</action_title_rules>

<copywriting_guidelines>
Правила бизнес-копирайтинга для заголовков:
- Заголовок = вывод: Не «Результаты исследования», а «70% клиентов готовы платить больше за качество».
- Простые слова: «Улучшить» вместо «оптимизировать», «Сделать» вместо «осуществить».
- Без канцелярита: Избегайте «в целях», «в рамках», «по итогам проведённого анализа».
- Без иностранных слов: «Пример» вместо «кейс», «Вывод» вместо «инсайт», «Задача» вместо «челлендж».
- Конкретика: «Рост на 25%» вместо «значительный рост».
- Превращайте данные в истории: Не «рост на 30%», а «каждый третий клиент стал покупать больше».
</copywriting_guidelines>

<narrative_coherence_rules>
1. Each slide must logically follow the previous one
2. The presentation should tell a STORY, not just list information
3. Transitions should use bridging phrases: "Building on this...", "This leads to...", "The evidence shows...", "Given these challenges..."
4. Every slide must have a clear NARRATIVE ROLE:
   - hook: Grabs attention (slide 1-2)
   - context: Sets the stage with background/problem
   - evidence: Provides data, facts, proof
   - insight: Reveals a key finding or analysis
   - action: Proposes solutions or next steps
   - conclusion: Summarizes and calls to action
5. Avoid two consecutive slides with the same narrative role
6. The narrative should build tension/interest, then resolve it
</narrative_coherence_rules>

<output_format>
Return JSON with:
- narrative_thread: A 1-2 sentence description of the overall story arc
- enhancements: Array of objects with slide_number, action_title, transition_from_previous, audience_takeaway, narrative_role
</output_format>`;

// ═══════════════════════════════════════════════════════
// USER PROMPT BUILDER
// ═══════════════════════════════════════════════════════

function buildStorytellingUserPrompt(
  content: SlideContent[],
  outline: OutlineResult,
): string {
  const slideSummaries = content
    .map(
      (s) =>
        `Slide ${s.slide_number}: "${s.title}"
  Key message: ${s.key_message}
  Content summary: ${s.text.substring(0, 200)}
  Data points: ${s.data_points.map((d) => `${d.label}: ${d.value}${d.unit}`).join(", ") || "none"}`,
    )
    .join("\n\n");

  return `<presentation>
Title: ${outline.presentation_title}
Target audience: ${outline.target_audience}
Narrative arc: ${outline.narrative_arc}
Total slides: ${content.length}
</presentation>

<slides>
${slideSummaries}
</slides>

Transform each slide title into an action title and ensure narrative coherence across all slides. 
Use the content's data points and key messages to craft specific, insight-driven titles.
Generate transition phrases that connect each slide to the previous one.
Assign a narrative role to each slide.
Write in the same language as the slide content.`;
}

// ═══════════════════════════════════════════════════════
// TITLE TRUNCATION
// ═══════════════════════════════════════════════════════

/**
 * Hard-truncate a title to maxChars. Tries to break at a word boundary.
 * If the title is already short enough, returns it unchanged.
 */
export function truncateTitle(title: string, maxChars: number): string {
  if (!title || title.length <= maxChars) return title;

  // Try to break at last space before the limit
  const truncated = title.substring(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxChars * 0.6) {
    return truncated.substring(0, lastSpace);
  }

  // No good word boundary — just cut
  return truncated;
}

// ═══════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════

/**
 * Run the Storytelling Agent to enhance slide content with action titles
 * and narrative coherence.
 *
 * @param content - SlideContent array from Writer
 * @param outline - OutlineResult for context
 * @returns Enhanced SlideContent[] with improved titles and added transitions
 */
export async function runStorytellingAgent(
  content: SlideContent[],
  outline: OutlineResult,
): Promise<{ enhancedContent: SlideContent[]; narrativeThread: string }> {
  const userPrompt = buildStorytellingUserPrompt(content, outline);

  const response = await invokeLLM({
    messages: [
      { role: "system", content: STORYTELLING_SYSTEM },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "StorytellingOutput",
        strict: true,
        schema: {
          type: "object",
          properties: {
            narrative_thread: {
              type: "string",
              description: "Overall story arc description",
            },
            enhancements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slide_number: { type: "integer" },
                  action_title: { type: "string" },
                  transition_from_previous: { type: "string" },
                  audience_takeaway: { type: "string" },
                  narrative_role: { type: "string" },
                },
                required: [
                  "slide_number",
                  "action_title",
                  "transition_from_previous",
                  "audience_takeaway",
                  "narrative_role",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["narrative_thread", "enhancements"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) {
    console.warn("[StorytellingAgent] Empty LLM response, returning original content");
    return { enhancedContent: content, narrativeThread: "" };
  }

  const textContent = typeof raw === "string" ? raw : JSON.stringify(raw);
  let result: StorytellingResult;

  try {
    result = JSON.parse(textContent);
  } catch {
    console.warn("[StorytellingAgent] Failed to parse LLM response, returning original content");
    return { enhancedContent: content, narrativeThread: "" };
  }

  // Apply enhancements to content
  const enhancementMap = new Map(
    result.enhancements.map((e) => [e.slide_number, e]),
  );

  const enhancedContent = content.map((slide) => {
    const enhancement = enhancementMap.get(slide.slide_number);
    if (!enhancement) return slide;

    // Build enhanced slide
    const enhanced = { ...slide };

    // Replace title with action title (but keep original for title-slide format)
    if (enhancement.action_title && enhancement.action_title.trim()) {
      enhanced.title = truncateTitle(enhancement.action_title, 50);
    }

    // Add transition to both speaker notes AND slide content for HTML Composer
    if (enhancement.transition_from_previous && enhancement.transition_from_previous.trim()) {
      const transitionNote = `[Переход] ${enhancement.transition_from_previous}`;
      enhanced.notes = enhanced.notes
        ? `${transitionNote}\n\n${enhanced.notes}`
        : transitionNote;
      // Store transition for HTML Composer to use as subtitle/opening line
      (enhanced as any).transition_phrase = enhancement.transition_from_previous;
    }

    // Add audience takeaway to key_message if it's more specific
    if (
      enhancement.audience_takeaway &&
      enhancement.audience_takeaway.trim() &&
      enhancement.audience_takeaway.length > enhanced.key_message.length
    ) {
      enhanced.key_message = enhancement.audience_takeaway;
    }

    return enhanced;
  });

  return {
    enhancedContent,
    narrativeThread: result.narrative_thread || "",
  };
}

// ═══════════════════════════════════════════════════════
// VALIDATION HELPERS (for testing)
// ═══════════════════════════════════════════════════════

/**
 * Check if a title is an action title (heuristic).
 * Action titles typically contain verbs, numbers, or comparative language.
 */
export function isActionTitle(title: string): boolean {
  if (!title || title.length < 3) return false;

  // Action verbs commonly found in action titles
  const actionVerbs = [
    // English
    "drives", "accelerates", "enables", "reduces", "transforms",
    "increases", "delivers", "achieves", "creates", "improves",
    "doubles", "triples", "grows", "exceeds", "reaches",
    "outperforms", "leads", "powers", "unlocks", "reveals",
    // Russian
    "ускоряет", "обеспечивает", "снижает", "трансформирует",
    "увеличивает", "достигает", "создаёт", "улучшает",
    "удваивает", "превышает", "достигает", "раскрывает",
    "растёт", "выросла", "выросло", "сократил", "повысил",
    "позволяет", "приводит", "формирует", "определяет",
    "составляет", "демонстрирует", "показывает", "требует",
    "открывает", "меняет", "усиливает", "генерирует",
  ];

  const lower = title.toLowerCase();

  // Check for numbers/percentages (strong signal)
  const hasNumbers = /\d+/.test(title);

  // Check for action verbs
  const hasActionVerb = actionVerbs.some((v) => lower.includes(v));

  // Check for comparative language
  const hasComparative = /больше|меньше|быстрее|лучше|выше|ниже|more|less|faster|better|higher|lower|vs\.|than/i.test(title);

  // A title is "action" if it has numbers + verb, or verb + comparative, or is specific enough
  return (hasNumbers && (hasActionVerb || title.length > 20)) ||
    hasActionVerb ||
    hasComparative ||
    (hasNumbers && title.length > 15);
}

/**
 * Validate narrative coherence: check that slides don't have
 * the same narrative role consecutively (except evidence).
 */
export function checkNarrativeCoherence(
  enhancements: StorytellingEnhancement[],
): { coherent: boolean; issues: string[] } {
  const issues: string[] = [];

  for (let i = 1; i < enhancements.length; i++) {
    const prev = enhancements[i - 1];
    const curr = enhancements[i];

    // Allow consecutive "evidence" slides (common in data-heavy presentations)
    if (
      prev.narrative_role === curr.narrative_role &&
      curr.narrative_role !== "evidence" &&
      curr.narrative_role !== "hook"
    ) {
      issues.push(
        `Slides ${prev.slide_number} and ${curr.slide_number} both have role "${curr.narrative_role}"`,
      );
    }

    // Check that transitions exist for non-first slides
    if (curr.slide_number > 1 && !curr.transition_from_previous.trim()) {
      issues.push(`Slide ${curr.slide_number} missing transition from previous`);
    }
  }

  return { coherent: issues.length === 0, issues };
}
