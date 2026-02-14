/**
 * Visual Review Agent — Step 3.2
 *
 * Renders individual slides to PNG using Puppeteer, then sends screenshots
 * to a Vision LLM (GPT-4o) for holistic visual quality assessment.
 *
 * Evaluates: readability, visual balance, content density, professionalism.
 * If score < 6, returns CSS fix suggestions for a re-render (max 2 iterations).
 */

import puppeteer from "puppeteer";
import { invokeLLM } from "../_core/llm";

export interface VisualScore {
  readability: number;     // 1-10
  balance: number;         // 1-10
  density: number;         // 1-10
  professionalism: number; // 1-10
  average: number;         // computed
}

export interface VisualReviewResult {
  slideNumber: number;
  score: VisualScore;
  passed: boolean;
  cssSuggestions: string;
  feedback: string;
  iterations: number;
}

const PASS_THRESHOLD = 6.0;
const MAX_ITERATIONS = 2;
const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;

/**
 * Render a single slide's HTML to a base64 PNG image.
 */
export async function renderSlideToImage(
  slideHtml: string,
  themeCss: string,
): Promise<string> {
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: ${SLIDE_WIDTH}px; height: ${SLIDE_HEIGHT}px; overflow: hidden; }
${themeCss}
</style>
</head>
<body>${slideHtml}</body>
</html>`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
      executablePath: "/usr/bin/chromium-browser",
    });

    const page = await browser.newPage();
    await page.setViewport({ width: SLIDE_WIDTH, height: SLIDE_HEIGHT });
    await page.setContent(fullHtml, { waitUntil: "networkidle0", timeout: 10000 });

    // Wait a bit for fonts and CSS to render
    await new Promise((r) => setTimeout(r, 500));

    const screenshot = await page.screenshot({
      encoding: "base64",
      type: "png",
      fullPage: false,
    });

    return screenshot as string;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Send a slide screenshot to Vision LLM for quality assessment.
 */
export async function evaluateSlideVisually(
  base64Image: string,
  slideNumber: number,
  layoutName: string,
  slideTitle: string,
): Promise<{ score: VisualScore; feedback: string; cssSuggestions: string }> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a professional presentation design reviewer. Analyze the slide screenshot and evaluate its visual quality.

Score each criterion from 1-10:
- READABILITY: Can all text be easily read? Good font sizes, contrast, no overlap?
- BALANCE: Is the layout visually balanced? Good use of whitespace? Not cramped or empty?
- DENSITY: Is the content density appropriate? Not too sparse, not too cluttered?
- PROFESSIONALISM: Does it look polished and professional? Consistent styling?

If any score is below 6, provide specific CSS fixes to improve it.

Respond in JSON: {
  "readability": 8,
  "balance": 7,
  "density": 8,
  "professionalism": 9,
  "feedback": "Brief overall assessment",
  "css_suggestions": "CSS rules to fix issues, or empty string if none needed"
}`,
      },
      {
        role: "user",
        content: [
          {
            type: "text" as const,
            text: `Evaluate slide ${slideNumber} (layout: ${layoutName}, title: "${slideTitle}"):`,
          },
          {
            type: "image_url" as const,
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
              detail: "high" as const,
            },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "visual_review",
        strict: true,
        schema: {
          type: "object",
          properties: {
            readability: { type: "number" },
            balance: { type: "number" },
            density: { type: "number" },
            professionalism: { type: "number" },
            feedback: { type: "string" },
            css_suggestions: { type: "string" },
          },
          required: ["readability", "balance", "density", "professionalism", "feedback", "css_suggestions"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return {
      score: { readability: 7, balance: 7, density: 7, professionalism: 7, average: 7 },
      feedback: "Unable to evaluate",
      cssSuggestions: "",
    };
  }

  const parsed = JSON.parse(content);
  const score: VisualScore = {
    readability: clamp(parsed.readability, 1, 10),
    balance: clamp(parsed.balance, 1, 10),
    density: clamp(parsed.density, 1, 10),
    professionalism: clamp(parsed.professionalism, 1, 10),
    average: 0,
  };
  score.average = (score.readability + score.balance + score.density + score.professionalism) / 4;

  return {
    score,
    feedback: parsed.feedback || "",
    cssSuggestions: parsed.css_suggestions || "",
  };
}

/**
 * Run visual review on a set of slides with iterative improvement.
 *
 * For efficiency, only reviews a sample of slides (every 3rd + first + last).
 */
export async function runVisualReview(
  slides: Array<{
    slideNumber: number;
    layoutId: string;
    title: string;
    html: string;
  }>,
  themeCss: string,
): Promise<{
  results: VisualReviewResult[];
  averageScore: number;
  cssPatches: Map<number, string>;
}> {
  // Sample slides for review: first, last, and every 3rd
  const sampleIndices = new Set<number>();
  sampleIndices.add(0); // first
  sampleIndices.add(slides.length - 1); // last
  for (let i = 2; i < slides.length - 1; i += 3) {
    sampleIndices.add(i);
  }

  const sampled = Array.from(sampleIndices)
    .sort((a, b) => a - b)
    .map((i) => slides[i])
    .filter(Boolean);

  console.log(`[Visual Review] Reviewing ${sampled.length}/${slides.length} slides`);

  const results: VisualReviewResult[] = [];
  const cssPatches = new Map<number, string>();

  for (const slide of sampled) {
    let currentHtml = slide.html;
    let iteration = 0;
    let lastResult: { score: VisualScore; feedback: string; cssSuggestions: string } | null = null;

    while (iteration < MAX_ITERATIONS) {
      iteration++;

      try {
        const base64 = await renderSlideToImage(currentHtml, themeCss);
        const evaluation = await evaluateSlideVisually(
          base64,
          slide.slideNumber,
          slide.layoutId,
          slide.title,
        );

        lastResult = evaluation;

        if (evaluation.score.average >= PASS_THRESHOLD || iteration >= MAX_ITERATIONS) {
          break;
        }

        // Apply CSS suggestions and re-render
        if (evaluation.cssSuggestions.trim()) {
          currentHtml = `<style>${evaluation.cssSuggestions}</style>${currentHtml}`;
          console.log(`[Visual Review] Slide ${slide.slideNumber}: score ${evaluation.score.average.toFixed(1)}/10, applying CSS fix (iteration ${iteration})`);
        } else {
          break; // No suggestions, can't improve
        }
      } catch (err) {
        console.error(`[Visual Review] Slide ${slide.slideNumber} failed:`, err);
        break;
      }
    }

    if (lastResult) {
      const passed = lastResult.score.average >= PASS_THRESHOLD;
      results.push({
        slideNumber: slide.slideNumber,
        score: lastResult.score,
        passed,
        cssSuggestions: lastResult.cssSuggestions,
        feedback: lastResult.feedback,
        iterations: iteration,
      });

      // Collect CSS patches for slides that needed fixes
      if (currentHtml !== slide.html) {
        const patchMatch = currentHtml.match(/<style>([\s\S]*?)<\/style>/);
        if (patchMatch) {
          cssPatches.set(slide.slideNumber, patchMatch[1]);
        }
      }
    }
  }

  const averageScore =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.score.average, 0) / results.length
      : 7;

  console.log(
    `[Visual Review] Average score: ${averageScore.toFixed(1)}/10, ` +
    `${results.filter((r) => r.passed).length}/${results.length} passed, ` +
    `${cssPatches.size} CSS patches generated`,
  );

  return { results, averageScore, cssPatches };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
