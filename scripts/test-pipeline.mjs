/**
 * Test Pipeline Script — runs 3 presentations through the API and collects quality metrics.
 * Usage: node scripts/test-pipeline.mjs
 */

const BASE_URL = "http://localhost:3000";
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 10 * 60 * 1000; // 10 minutes

const TEST_TOPICS = [
  {
    id: "topic_1",
    prompt: "Тренды искусственного интеллекта в 2026 году: от генеративных моделей до автономных агентов",
    config: { slide_count: 8, theme_preset: "corporate_blue" },
    description: "Технологическая тема — проверяет research глубину и актуальность данных",
  },
  {
    id: "topic_2",
    prompt: "Стратегия выхода на рынок электромобилей в России: анализ конкурентов, барьеры и возможности",
    config: { slide_count: 10, theme_preset: "emerald_growth" },
    description: "Бизнес-стратегия — проверяет аналитическую глубину и структуру аргументации",
  },
  {
    id: "topic_3",
    prompt: "Влияние удалённой работы на продуктивность и корпоративную культуру: данные исследований 2024-2026",
    config: { slide_count: 7, theme_preset: "warm_sunset" },
    description: "HR/менеджмент — проверяет использование статистики и нарративную связность",
  },
];

// ── Helpers ──────────────────────────────────────────────

async function createPresentation(topic) {
  const res = await fetch(`${BASE_URL}/api/v1/presentations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: topic.prompt,
      mode: "batch",
      config: topic.config,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function pollStatus(presentationId) {
  const start = Date.now();
  let lastStep = "";
  let lastPercent = 0;

  while (Date.now() - start < MAX_WAIT_MS) {
    const res = await fetch(`${BASE_URL}/api/v1/presentations/${presentationId}`);
    if (!res.ok) {
      console.error(`  Poll failed (${res.status})`);
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    const data = await res.json();
    const status = data.status;
    const step = data.current_step || "";
    const percent = data.progress_percentage || 0;

    if (step !== lastStep || percent !== lastPercent) {
      console.log(`  [${presentationId}] ${percent}% — ${step}`);
      lastStep = step;
      lastPercent = percent;
    }

    if (status === "completed") {
      return { ...data, elapsed_ms: Date.now() - start };
    }
    if (status === "failed") {
      return { ...data, elapsed_ms: Date.now() - start, error: true };
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return { error: true, elapsed_ms: Date.now() - start, timeout: true };
}

async function getSlides(presentationId) {
  const res = await fetch(`${BASE_URL}/api/v1/presentations/${presentationId}/html`);
  if (!res.ok) return null;
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Quality Analysis ──────────────────────────────────────

function analyzeContent(slides, html) {
  const metrics = {
    slide_count: 0,
    avg_content_length: 0,
    has_statistics: false,
    statistics_count: 0,
    has_sources: false,
    source_count: 0,
    has_data_viz: false,
    data_viz_count: 0,
    unique_shapes: new Set(),
    title_quality: { action_titles: 0, generic_titles: 0 },
    narrative_markers: 0,
    total_chars: 0,
  };

  if (!slides || !Array.isArray(slides)) return metrics;

  metrics.slide_count = slides.length;

  for (const slide of slides) {
    const data = slide.data || {};
    const dataStr = JSON.stringify(data);

    // Content length
    metrics.total_chars += dataStr.length;

    // Statistics detection (numbers with %, $, digits with units)
    const statMatches = dataStr.match(/\d+[\.,]?\d*\s*(%|млн|млрд|тыс|USD|\$|€|руб)/gi) || [];
    metrics.statistics_count += statMatches.length;
    if (statMatches.length > 0) metrics.has_statistics = true;

    // Source/citation detection
    const sourceMatches = dataStr.match(/(источник|исследовани|по данным|согласно|McKinsey|Gartner|Deloitte|Forbes|Harvard|Stanford|MIT|PwC|BCG|Statista)/gi) || [];
    metrics.source_count += sourceMatches.length;
    if (sourceMatches.length > 0) metrics.has_sources = true;

    // Data viz detection
    if (dataStr.includes("chart") || dataStr.includes("svg") || dataStr.includes("graph")) {
      metrics.has_data_viz = true;
      metrics.data_viz_count++;
    }

    // Layout/shape diversity
    if (slide.layoutId) metrics.unique_shapes.add(slide.layoutId);

    // Title quality — action titles vs generic
    const title = data.title || data.heading || "";
    if (title && /[а-яА-Я]/.test(title)) {
      // Action titles typically contain verbs or specific claims
      const isAction = /(\d|%|рост|снижен|увелич|трансформ|определ|обеспеч|создаёт|формиру|достиг|превыша)/i.test(title);
      if (isAction) metrics.title_quality.action_titles++;
      else metrics.title_quality.generic_titles++;
    }

    // Narrative markers (transitions, connectors)
    const narrativeMarkers = dataStr.match(/(однако|при этом|в результате|следовательно|таким образом|кроме того|вместе с тем|в свою очередь|между тем|ключевой вывод)/gi) || [];
    metrics.narrative_markers += narrativeMarkers.length;
  }

  metrics.avg_content_length = metrics.slide_count > 0 ? Math.round(metrics.total_chars / metrics.slide_count) : 0;
  metrics.unique_shapes = metrics.unique_shapes.size;

  return metrics;
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  RESEARCH-FIRST PIPELINE TEST — 3 Topics");
  console.log("═══════════════════════════════════════════════════════\n");

  const results = [];

  for (let i = 0; i < TEST_TOPICS.length; i++) {
    const topic = TEST_TOPICS[i];
    console.log(`\n── Topic ${i + 1}/${TEST_TOPICS.length}: ${topic.id} ──`);
    console.log(`  "${topic.prompt}"`);
    console.log(`  ${topic.description}\n`);

    try {
      // Create
      console.log("  Creating presentation...");
      const created = await createPresentation(topic);
      const pid = created.presentation_id;
      console.log(`  Created: ${pid}`);

      // Poll
      console.log("  Waiting for generation...");
      const status = await pollStatus(pid);

      if (status.error) {
        console.error(`  ❌ FAILED: ${status.error_info?.error_message || "timeout"}`);
        results.push({
          topic_id: topic.id,
          prompt: topic.prompt,
          status: "failed",
          error: status.error_info?.error_message || "timeout",
          elapsed_ms: status.elapsed_ms,
        });
        continue;
      }

      // Get slides
      const slidesData = await getSlides(pid);
      const slides = slidesData?.slides || [];

      // Analyze
      const metrics = analyzeContent(slides, slidesData?.full_html);

      const result = {
        topic_id: topic.id,
        prompt: topic.prompt,
        description: topic.description,
        presentation_id: pid,
        status: "completed",
        elapsed_ms: status.elapsed_ms,
        elapsed_sec: Math.round(status.elapsed_ms / 1000),
        title: status.title,
        slide_count: status.slide_count || metrics.slide_count,
        metrics,
      };

      results.push(result);

      console.log(`\n  ✅ COMPLETED in ${result.elapsed_sec}s`);
      console.log(`  Title: "${result.title}"`);
      console.log(`  Slides: ${result.slide_count}`);
      console.log(`  Statistics found: ${metrics.statistics_count}`);
      console.log(`  Sources/citations: ${metrics.source_count}`);
      console.log(`  Data viz: ${metrics.data_viz_count}`);
      console.log(`  Unique layouts: ${metrics.unique_shapes}`);
      console.log(`  Action titles: ${metrics.title_quality.action_titles}/${metrics.title_quality.action_titles + metrics.title_quality.generic_titles}`);
      console.log(`  Narrative markers: ${metrics.narrative_markers}`);
      console.log(`  Avg content/slide: ${metrics.avg_content_length} chars`);
    } catch (err) {
      console.error(`  ❌ ERROR: ${err.message}`);
      results.push({
        topic_id: topic.id,
        prompt: topic.prompt,
        status: "error",
        error: err.message,
      });
    }
  }

  // ── Summary ──────────────────────────────────────────────
  console.log("\n\n═══════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════\n");

  const completed = results.filter((r) => r.status === "completed");
  const failed = results.filter((r) => r.status !== "completed");

  console.log(`Completed: ${completed.length}/${results.length}`);
  if (failed.length > 0) {
    console.log(`Failed: ${failed.map((f) => f.topic_id).join(", ")}`);
  }

  if (completed.length > 0) {
    const avgTime = Math.round(completed.reduce((s, r) => s + r.elapsed_sec, 0) / completed.length);
    const avgStats = Math.round(completed.reduce((s, r) => s + r.metrics.statistics_count, 0) / completed.length);
    const avgSources = Math.round(completed.reduce((s, r) => s + r.metrics.source_count, 0) / completed.length);
    const avgNarrative = Math.round(completed.reduce((s, r) => s + r.metrics.narrative_markers, 0) / completed.length);
    const avgContent = Math.round(completed.reduce((s, r) => s + r.metrics.avg_content_length, 0) / completed.length);
    const totalActionTitles = completed.reduce((s, r) => s + r.metrics.title_quality.action_titles, 0);
    const totalTitles = completed.reduce((s, r) => s + r.metrics.title_quality.action_titles + r.metrics.title_quality.generic_titles, 0);

    console.log(`\nAvg generation time: ${avgTime}s`);
    console.log(`Avg statistics/presentation: ${avgStats}`);
    console.log(`Avg sources/presentation: ${avgSources}`);
    console.log(`Avg narrative markers: ${avgNarrative}`);
    console.log(`Avg content/slide: ${avgContent} chars`);
    console.log(`Action title ratio: ${totalActionTitles}/${totalTitles} (${totalTitles > 0 ? Math.round(100 * totalActionTitles / totalTitles) : 0}%)`);
  }

  // Save results to file
  const outputPath = "scripts/test-pipeline-results.json";
  const fs = await import("fs");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
