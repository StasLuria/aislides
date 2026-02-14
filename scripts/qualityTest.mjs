/**
 * Quality Testing Script — runs 5 test generations across different presentation types
 * and collects metrics: timing, slide count, layout diversity, Design Critic scores.
 * 
 * Usage: node scripts/qualityTest.mjs
 */

const BASE_URL = "http://localhost:3000";

const TEST_CASES = [
  {
    id: "business_strategy",
    type: "Business Strategy",
    prompt: "Стратегия выхода на рынок Юго-Восточной Азии для SaaS-компании: анализ рынка, конкуренты, ценообразование, каналы продаж, локализация продукта, партнёрства, финансовые прогнозы на 3 года",
    config: { theme_preset: "auto", enable_images: true },
  },
  {
    id: "product_pitch",
    type: "Product Pitch",
    prompt: "Презентация нового AI-ассистента для юристов: автоматизация анализа контрактов, выявление рисков, сравнение условий, интеграция с CRM, экономия 40% времени, кейсы клиентов",
    config: { theme_preset: "auto", enable_images: true },
  },
  {
    id: "investor_deck",
    type: "Investor Deck",
    prompt: "Инвестиционный раунд Series B: платформа для управления цепочками поставок с AI-оптимизацией, GMV $50M, рост 3x YoY, юнит-экономика, команда, конкурентные преимущества, запрос $15M",
    config: { theme_preset: "auto", enable_images: true },
  },
  {
    id: "educational",
    type: "Educational",
    prompt: "Основы машинного обучения: от линейной регрессии до нейронных сетей, supervised vs unsupervised learning, метрики качества, примеры применения в бизнесе, инструменты и фреймворки",
    config: { theme_preset: "auto", enable_images: true },
  },
  {
    id: "quarterly_review",
    type: "Quarterly Review",
    prompt: "Итоги Q4 2025: выручка 850M руб (+32% YoY), EBITDA margin 18%, NPS 72, churn rate 4.2%, новые клиенты 340, ключевые проекты, проблемы и планы на Q1 2026",
    config: { theme_preset: "auto", enable_images: true },
  },
];

const results = [];

async function createPresentation(testCase) {
  const res = await fetch(`${BASE_URL}/api/v1/presentations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: testCase.prompt,
      mode: "batch",
      config: testCase.config,
    }),
  });
  if (!res.ok) {
    throw new Error(`Create failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

async function pollPresentation(id, maxWaitMs = 600000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${BASE_URL}/api/v1/presentations/${id}`);
    const data = await res.json();
    
    if (data.status === "completed") return data;
    if (data.status === "failed") throw new Error(`Generation failed: ${JSON.stringify(data.error_info)}`);
    
    // Log progress
    process.stdout.write(`\r  [${data.current_step || "..."}] ${data.progress_percent || 0}%   `);
    
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error("Timeout waiting for generation");
}

async function getSlides(id) {
  const res = await fetch(`${BASE_URL}/api/v1/presentations/${id}/slides`);
  if (!res.ok) return null;
  return await res.json();
}

function analyzeLayoutDiversity(slides) {
  if (!slides || !Array.isArray(slides)) return { unique: 0, total: 0, layouts: {}, diversity: 0 };
  
  const layouts = {};
  for (const s of slides) {
    const layout = s.layoutId || s.layout_id || "unknown";
    layouts[layout] = (layouts[layout] || 0) + 1;
  }
  
  const unique = Object.keys(layouts).length;
  const total = slides.length;
  const diversity = total > 0 ? (unique / total * 100).toFixed(1) : 0;
  
  return { unique, total, layouts, diversity: parseFloat(diversity) };
}

function analyzeContentShapes(slides) {
  if (!slides || !Array.isArray(slides)) return { unique: 0, shapes: {} };
  
  const shapes = {};
  for (const s of slides) {
    const data = s.slideData || s.data || {};
    const shape = data.content_shape || "unknown";
    shapes[shape] = (shapes[shape] || 0) + 1;
  }
  
  return { unique: Object.keys(shapes).length, shapes };
}

async function runTest(testCase, index) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`TEST ${index + 1}/${TEST_CASES.length}: ${testCase.type}`);
  console.log(`Prompt: ${testCase.prompt.substring(0, 80)}...`);
  console.log(`${"═".repeat(70)}`);
  
  const startTime = Date.now();
  
  try {
    // Create
    console.log("  Creating presentation...");
    const created = await createPresentation(testCase);
    const presId = created.presentation_id;
    console.log(`  ID: ${presId}`);
    
    // Poll until done
    console.log("  Generating...");
    const completed = await pollPresentation(presId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n  ✅ Completed in ${elapsed}s — ${completed.slide_count} slides`);
    
    // Get slides for analysis
    const slides = await getSlides(presId);
    const layoutAnalysis = analyzeLayoutDiversity(slides?.slides || []);
    const shapeAnalysis = analyzeContentShapes(slides?.slides || []);
    
    const result = {
      testCase: testCase.type,
      testId: testCase.id,
      presentationId: presId,
      status: "completed",
      timeSeconds: parseFloat(elapsed),
      slideCount: completed.slide_count,
      title: completed.title,
      layoutDiversity: layoutAnalysis,
      contentShapes: shapeAnalysis,
      resultUrls: completed.result_urls,
      config: completed.config,
    };
    
    // Print layout summary
    console.log(`  Layouts (${layoutAnalysis.unique} unique / ${layoutAnalysis.total} total = ${layoutAnalysis.diversity}%):`);
    for (const [layout, count] of Object.entries(layoutAnalysis.layouts)) {
      console.log(`    ${layout}: ${count}`);
    }
    
    results.push(result);
    return result;
    
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n  ❌ FAILED after ${elapsed}s: ${error.message}`);
    
    results.push({
      testCase: testCase.type,
      testId: testCase.id,
      status: "failed",
      timeSeconds: parseFloat(elapsed),
      error: error.message,
    });
    return null;
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║           QUALITY TESTING — 5 Presentation Types                    ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Server: ${BASE_URL}`);
  
  // Check server health
  try {
    const health = await fetch(`${BASE_URL}/health`);
    const h = await health.json();
    console.log(`Server health: ${h.status}`);
  } catch (e) {
    console.error("Server not reachable:", e.message);
    process.exit(1);
  }
  
  // Run tests sequentially
  for (let i = 0; i < TEST_CASES.length; i++) {
    await runTest(TEST_CASES[i], i);
  }
  
  // Summary
  console.log("\n\n" + "═".repeat(70));
  console.log("SUMMARY");
  console.log("═".repeat(70));
  
  const completed = results.filter(r => r.status === "completed");
  const failed = results.filter(r => r.status === "failed");
  
  console.log(`\nTotal: ${results.length} | Completed: ${completed.length} | Failed: ${failed.length}`);
  
  if (completed.length > 0) {
    const avgTime = (completed.reduce((s, r) => s + r.timeSeconds, 0) / completed.length).toFixed(1);
    const avgSlides = (completed.reduce((s, r) => s + r.slideCount, 0) / completed.length).toFixed(1);
    const avgDiversity = (completed.reduce((s, r) => s + r.layoutDiversity.diversity, 0) / completed.length).toFixed(1);
    
    console.log(`\nAvg time: ${avgTime}s`);
    console.log(`Avg slides: ${avgSlides}`);
    console.log(`Avg layout diversity: ${avgDiversity}%`);
    
    console.log("\n┌─────────────────────┬──────────┬────────┬──────────────┬───────────┐");
    console.log("│ Type                │ Time (s) │ Slides │ Layouts (u/t)│ Diversity │");
    console.log("├─────────────────────┼──────────┼────────┼──────────────┼───────────┤");
    for (const r of completed) {
      const type = r.testCase.padEnd(19);
      const time = String(r.timeSeconds).padStart(8);
      const slides = String(r.slideCount).padStart(6);
      const layouts = `${r.layoutDiversity.unique}/${r.layoutDiversity.total}`.padStart(12);
      const diversity = `${r.layoutDiversity.diversity}%`.padStart(9);
      console.log(`│ ${type} │ ${time} │ ${slides} │ ${layouts} │ ${diversity} │`);
    }
    console.log("└─────────────────────┴──────────┴────────┴──────────────┴───────────┘");
  }
  
  if (failed.length > 0) {
    console.log("\nFailed tests:");
    for (const r of failed) {
      console.log(`  ❌ ${r.testCase}: ${r.error}`);
    }
  }
  
  // Save results to JSON
  const fs = await import("fs");
  const outputPath = "/home/ubuntu/presentation-frontend/scripts/quality_results.json";
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
  
  console.log(`\nFinished at: ${new Date().toISOString()}`);
}

main().catch(console.error);
