/**
 * Speaker Coach Agent — generates professional speaker notes for each slide.
 *
 * Responsibilities:
 * 1. Generate talking points that EXPAND on slide content (not repeat it)
 * 2. Add transition phrases between slides
 * 3. Suggest timing hints per slide
 * 4. Include audience engagement cues (questions, pauses, emphasis)
 * 5. Provide delivery tips (tone, pace, gestures)
 *
 * Runs AFTER HTML composition (final step before assembly).
 * Input: SlideContent[] + layoutMap
 * Output: Enhanced speaker notes per slide
 */

import { invokeLLM } from "../_core/llm";
import type { SlideContent } from "./generator";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface SpeakerNote {
  slide_number: number;
  /** Main talking points (3-5 bullet points expanding on slide content) */
  talking_points: string[];
  /** Transition phrase to the NEXT slide */
  transition_to_next: string;
  /** Suggested time in seconds for this slide */
  timing_seconds: number;
  /** Audience engagement cue (question, pause, poll, etc.) */
  engagement_cue: string;
  /** Delivery tip (tone, pace, emphasis) */
  delivery_tip: string;
}

export interface SpeakerCoachResult {
  notes: SpeakerNote[];
  total_estimated_minutes: number;
  /** Overall presentation delivery advice */
  general_advice: string;
}

// ═══════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════

const SPEAKER_COACH_SYSTEM = `You are Speaker Coach Agent — a professional presentation coach who prepares speakers for confident, engaging delivery.

<role>
You create detailed speaker notes that help the presenter deliver a compelling talk. Your notes go BEYOND what's on the slide — they provide context, stories, data interpretation, and audience engagement techniques.
</role>

<talking_points_rules>
1. NEVER repeat the slide text verbatim — expand, explain, and contextualize
2. Each talking point should be 1-2 sentences that the speaker can say naturally
3. Include specific examples, analogies, or stories that illustrate the slide's point
4. Reference data with interpretation: "This 40% growth means we're outpacing the market by 2x"
5. For data-heavy slides: explain what the numbers MEAN, not just what they ARE
6. For concept slides: provide real-world examples or case studies
7. Write in the same language as the slide content
</talking_points_rules>

<transition_rules>
1. Each transition should bridge the current slide's conclusion to the next slide's opening
2. Use natural bridging phrases: "This brings us to...", "Building on this foundation...", "Now let's look at how..."
3. For section transitions: create a brief pause moment: "Let me shift gears and talk about..."
4. The last slide's transition should be empty (no next slide)
</transition_rules>

<timing_rules>
1. Title slide: 30-45 seconds
2. Section header: 15-30 seconds
3. Content slide (text, bullets): 60-90 seconds
4. Data slide (charts, metrics): 90-120 seconds
5. Final slide: 30-60 seconds
6. Total should be reasonable for the slide count (roughly 2 min per content slide)
</timing_rules>

<engagement_rules>
1. Every 3-4 slides, suggest an audience interaction:
   - Rhetorical question: "How many of you have experienced this?"
   - Pause for reflection: "Take a moment to think about..."
   - Show of hands: "Raise your hand if..."
   - Direct question: "What do you think is the biggest challenge here?"
2. For data slides: "Let that number sink in for a moment"
3. For problem slides: "I'm sure many of you can relate to this"
4. Not every slide needs an engagement cue — use them strategically
</engagement_rules>

<delivery_tips_rules>
1. Vary the advice: tone (confident, empathetic, energetic), pace (slow down, speed up, pause), emphasis (key words to stress)
2. For opening: "Start with energy and eye contact"
3. For data: "Slow down here, let the audience process the numbers"
4. For stories: "Use a conversational tone, make eye contact"
5. For conclusions: "Speak with conviction, this is your call to action"
</delivery_tips_rules>

<output_format>
Return JSON with:
- notes: array of {slide_number, talking_points, transition_to_next, timing_seconds, engagement_cue, delivery_tip}
- total_estimated_minutes: total presentation time in minutes (rounded)
- general_advice: 2-3 sentences of overall delivery advice for this specific presentation
</output_format>`;

// ═══════════════════════════════════════════════════════
// USER PROMPT BUILDER
// ═══════════════════════════════════════════════════════

function buildSpeakerCoachUserPrompt(
  content: SlideContent[],
  presentationTitle: string,
  targetAudience: string,
  layoutMap?: Map<number, string>,
): string {
  const slideSummaries = content
    .map((s) => {
      const layout = layoutMap?.get(s.slide_number) || "unknown";
      return `Slide ${s.slide_number} [${layout}]: "${s.title}"
  Content: ${s.text.substring(0, 300)}
  Key message: ${s.key_message}
  Data points: ${s.data_points.map((d) => `${d.label}: ${d.value}${d.unit}`).join(", ") || "none"}
  Existing notes: ${s.notes.substring(0, 150) || "none"}`;
    })
    .join("\n\n");

  return `<presentation>
Title: ${presentationTitle}
Target audience: ${targetAudience}
Total slides: ${content.length}
</presentation>

<slides>
${slideSummaries}
</slides>

Create professional speaker notes for each slide. Remember:
- Talking points must EXPAND on the content, not repeat it
- Include transitions between slides
- Suggest realistic timing
- Add engagement cues every 3-4 slides
- Write in the same language as the slide content`;
}

// ═══════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════

/**
 * Run the Speaker Coach Agent to generate professional speaker notes.
 *
 * @param content - SlideContent array (after Storytelling enhancement)
 * @param presentationTitle - Title of the presentation
 * @param targetAudience - Target audience description
 * @param layoutMap - Optional map of slide_number → layout_name
 * @returns SpeakerCoachResult with notes per slide
 */
export async function runSpeakerCoach(
  content: SlideContent[],
  presentationTitle: string,
  targetAudience: string,
  layoutMap?: Map<number, string>,
): Promise<SpeakerCoachResult> {
  const userPrompt = buildSpeakerCoachUserPrompt(
    content,
    presentationTitle,
    targetAudience,
    layoutMap,
  );

  const response = await invokeLLM({
    messages: [
      { role: "system", content: SPEAKER_COACH_SYSTEM },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "SpeakerCoachOutput",
        strict: true,
        schema: {
          type: "object",
          properties: {
            notes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slide_number: { type: "integer" },
                  talking_points: {
                    type: "array",
                    items: { type: "string" },
                  },
                  transition_to_next: { type: "string" },
                  timing_seconds: { type: "integer" },
                  engagement_cue: { type: "string" },
                  delivery_tip: { type: "string" },
                },
                required: [
                  "slide_number",
                  "talking_points",
                  "transition_to_next",
                  "timing_seconds",
                  "engagement_cue",
                  "delivery_tip",
                ],
                additionalProperties: false,
              },
            },
            total_estimated_minutes: { type: "integer" },
            general_advice: { type: "string" },
          },
          required: ["notes", "total_estimated_minutes", "general_advice"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) {
    console.warn("[SpeakerCoach] Empty LLM response, generating basic notes");
    return generateBasicNotes(content);
  }

  const textContent = typeof raw === "string" ? raw : JSON.stringify(raw);

  try {
    const result: SpeakerCoachResult = JSON.parse(textContent);
    return result;
  } catch {
    console.warn("[SpeakerCoach] Failed to parse LLM response, generating basic notes");
    return generateBasicNotes(content);
  }
}

/**
 * Apply speaker notes to slide content, enriching the notes field.
 */
export function applySpeakerNotes(
  content: SlideContent[],
  coachResult: SpeakerCoachResult,
): SlideContent[] {
  const notesMap = new Map(coachResult.notes.map((n) => [n.slide_number, n]));

  return content.map((slide) => {
    const note = notesMap.get(slide.slide_number);
    if (!note) return slide;

    const enhanced = { ...slide };

    // Build rich speaker notes
    const parts: string[] = [];

    // Timing
    const minutes = Math.floor(note.timing_seconds / 60);
    const seconds = note.timing_seconds % 60;
    const timeStr = minutes > 0
      ? `${minutes} мин ${seconds > 0 ? seconds + " сек" : ""}`
      : `${seconds} сек`;
    parts.push(`⏱ ${timeStr}`);

    // Delivery tip
    if (note.delivery_tip) {
      parts.push(`💡 ${note.delivery_tip}`);
    }

    // Talking points
    if (note.talking_points.length > 0) {
      parts.push("");
      parts.push("📝 Ключевые тезисы:");
      note.talking_points.forEach((tp, i) => {
        parts.push(`${i + 1}. ${tp}`);
      });
    }

    // Engagement cue
    if (note.engagement_cue) {
      parts.push("");
      parts.push(`🎯 ${note.engagement_cue}`);
    }

    // Transition
    if (note.transition_to_next) {
      parts.push("");
      parts.push(`➡️ Переход: ${note.transition_to_next}`);
    }

    // Merge with existing notes (storytelling transitions etc.)
    const existingNotes = enhanced.notes.trim();
    if (existingNotes) {
      enhanced.notes = `${existingNotes}\n\n---\n\n${parts.join("\n")}`;
    } else {
      enhanced.notes = parts.join("\n");
    }

    return enhanced;
  });
}

// ═══════════════════════════════════════════════════════
// FALLBACK: Basic notes without LLM
// ═══════════════════════════════════════════════════════

function generateBasicNotes(content: SlideContent[]): SpeakerCoachResult {
  const notes: SpeakerNote[] = content.map((slide, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === content.length - 1;

    let timing = 60; // default 1 minute
    if (isFirst) timing = 30;
    if (isLast) timing = 30;
    if (slide.data_points.length > 0) timing = 90;

    return {
      slide_number: slide.slide_number,
      talking_points: [
        `Основная мысль: ${slide.key_message || slide.title}`,
        ...(slide.text
          .split("\n")
          .filter((l) => l.trim())
          .slice(0, 3)
          .map((l) => `Раскройте: ${l.replace(/^[•\-\*]\s*/, "").substring(0, 100)}`)),
      ],
      transition_to_next: isLast
        ? ""
        : `Переходим к следующему слайду: "${content[idx + 1]?.title || ""}"`,
      timing_seconds: timing,
      engagement_cue: idx % 3 === 1 ? "Задайте вопрос аудитории по этой теме" : "",
      delivery_tip: isFirst
        ? "Начните уверенно, установите зрительный контакт"
        : isLast
          ? "Говорите с убеждением — это ваш призыв к действию"
          : "Поддерживайте энергичный темп",
    };
  });

  const totalSeconds = notes.reduce((sum, n) => sum + n.timing_seconds, 0);

  return {
    notes,
    total_estimated_minutes: Math.round(totalSeconds / 60),
    general_advice: "Репетируйте презентацию вслух минимум 2 раза. Следите за временем и делайте паузы после ключевых тезисов.",
  };
}

// ═══════════════════════════════════════════════════════
// VALIDATION HELPERS (for testing)
// ═══════════════════════════════════════════════════════

/**
 * Validate that speaker notes are not just repeating slide text.
 * Returns a similarity score (0-1) where 0 = completely different, 1 = identical.
 */
export function calculateNoteSimilarity(slideText: string, noteText: string): number {
  if (!slideText || !noteText) return 0;

  const slideWords = new Set(
    slideText
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
  const noteWords = noteText
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (noteWords.length === 0) return 0;

  let overlap = 0;
  for (const word of noteWords) {
    if (slideWords.has(word)) overlap++;
  }

  return overlap / noteWords.length;
}

/**
 * Validate timing distribution across slides.
 * Returns issues if timing seems unreasonable.
 */
export function validateTiming(notes: SpeakerNote[]): string[] {
  const issues: string[] = [];

  for (const note of notes) {
    if (note.timing_seconds < 10) {
      issues.push(`Slide ${note.slide_number}: timing too short (${note.timing_seconds}s)`);
    }
    if (note.timing_seconds > 300) {
      issues.push(`Slide ${note.slide_number}: timing too long (${note.timing_seconds}s) — consider splitting`);
    }
  }

  const totalMinutes = notes.reduce((sum, n) => sum + n.timing_seconds, 0) / 60;
  if (totalMinutes > notes.length * 3) {
    issues.push(`Total time (${Math.round(totalMinutes)} min) seems too long for ${notes.length} slides`);
  }
  if (totalMinutes < notes.length * 0.3) {
    issues.push(`Total time (${Math.round(totalMinutes)} min) seems too short for ${notes.length} slides`);
  }

  return issues;
}
