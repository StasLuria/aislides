#!/usr/bin/env node
/**
 * Auto-README Generator
 * Collects live metrics from the codebase and updates README.md with accurate data.
 *
 * Usage:
 *   node scripts/generate-readme.mjs          # Update README.md in-place
 *   node scripts/generate-readme.mjs --dry-run # Print metrics without writing
 *   node scripts/generate-readme.mjs --json    # Output metrics as JSON
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── Metric Collectors ──────────────────────────────────────────────

/**
 * Count lines of code in files matching a glob pattern (excluding node_modules).
 */
function countLines(pattern) {
  try {
    const result = execSync(
      `find ${ROOT} -path "*/node_modules" -prune -o -name "${pattern}" -print0 | xargs -0 wc -l 2>/dev/null | tail -1`,
      { encoding: "utf-8" }
    ).trim();
    const match = result.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Count lines in top-level files only (maxdepth 1).
 */
function countLinesFlat(dir, extensions = ["ts", "tsx"], excludeTests = false) {
  const extArgs = extensions.map(e => `-name "*.${e}"`).join(" -o ");
  const excludeArg = excludeTests ? '! -name "*.test.*"' : "";
  try {
    const result = execSync(
      `find ${path.join(ROOT, dir)} -maxdepth 1 \\( ${extArgs} \\) ${excludeArg} -print0 2>/dev/null | xargs -0 wc -l 2>/dev/null | tail -1`,
      { encoding: "utf-8" }
    ).trim();
    const match = result.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Count files in top-level directory only (maxdepth 1).
 */
function countFilesFlat(dir, extensions = ["ts", "tsx"], excludeTests = false) {
  const extArgs = extensions.map(e => `-name "*.${e}"`).join(" -o ");
  const excludeArg = excludeTests ? '! -name "*.test.*"' : "";
  try {
    const result = execSync(
      `find ${path.join(ROOT, dir)} -maxdepth 1 \\( ${extArgs} \\) ${excludeArg} 2>/dev/null | wc -l`,
      { encoding: "utf-8" }
    ).trim();
    return parseInt(result, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Count lines in a specific directory (recursive).
 */
function countLinesInDir(dir, extensions = ["ts", "tsx"], excludeTests = false) {
  const extArgs = extensions.map(e => `-name "*.${e}"`).join(" -o ");
  const excludeArg = excludeTests ? '! -name "*.test.*"' : "";
  try {
    const result = execSync(
      `find ${path.join(ROOT, dir)} \\( ${extArgs} \\) ${excludeArg} -print0 2>/dev/null | xargs -0 wc -l 2>/dev/null | tail -1`,
      { encoding: "utf-8" }
    ).trim();
    const match = result.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Count files matching a pattern in a directory.
 */
function countFiles(dir, extensions = ["ts", "tsx"], excludeTests = false) {
  const extArgs = extensions.map(e => `-name "*.${e}"`).join(" -o ");
  const excludeArg = excludeTests ? '! -name "*.test.*"' : "";
  try {
    const result = execSync(
      `find ${path.join(ROOT, dir)} \\( ${extArgs} \\) ${excludeArg} 2>/dev/null | wc -l`,
      { encoding: "utf-8" }
    ).trim();
    return parseInt(result, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Count unique Express route registrations across all route files.
 */
function countEndpoints() {
  const routeFiles = [
    "server/presentationRoutes.ts",
    "server/chatRoutes.ts",
    "server/slideEditRoutes.ts",
    "server/interactiveRoutes.ts",
    "server/templateRoutes.ts",
  ];

  let total = 0;
  for (const file of routeFiles) {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, "utf-8");
    const matches = content.match(/router\.(get|post|put|delete|patch)\(/g);
    total += matches ? matches.length : 0;
  }
  return total;
}

/**
 * Count unique layout templates from templateEngine.ts case statements.
 */
function countLayouts() {
  const filePath = path.join(ROOT, "server/pipeline/templateEngine.ts");
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf-8");
  // Count layout templates defined as object keys: "layout-name": `<template>`
  const matches = content.match(/"([\w-]+)":\s*`/g);
  if (!matches) return 0;
  const unique = new Set(matches.map(m => m.replace(/":\s*`/, "").replace(/"/g, "")));
  return unique.size;
}

/**
 * Count unique layouts from prompts.ts (numbered descriptions).
 */
function countLayoutsFromPrompts() {
  const filePath = path.join(ROOT, "server/pipeline/prompts.ts");
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf-8");
  // Match numbered layout descriptions like "1. title-slide — ..."
  const matches = content.match(/^\d+\.\s+[\w-]+\s+[—–-]/gm);
  return matches ? matches.length : 0;
}

/**
 * Count all unique layouts across templateEngine and prompts.
 */
function countAllUniqueLayouts() {
  const layouts = new Set();

  // From templateEngine.ts — layout templates defined as object keys
  const tePath = path.join(ROOT, "server/pipeline/templateEngine.ts");
  if (fs.existsSync(tePath)) {
    const content = fs.readFileSync(tePath, "utf-8");
    const matches = content.match(/"([\w-]+)":\s*`/g);
    if (matches) {
      matches.forEach(m => layouts.add(m.replace(/":\s*`/, "").replace(/"/g, "")));
    }
  }

  // From prompts.ts
  const promptsPath = path.join(ROOT, "server/pipeline/prompts.ts");
  if (fs.existsSync(promptsPath)) {
    const content = fs.readFileSync(promptsPath, "utf-8");
    const matches = content.match(/^\d+\.\s+([\w-]+)\s+[—–-]/gm);
    if (matches) {
      matches.forEach(m => {
        const name = m.match(/^\d+\.\s+([\w-]+)/);
        if (name) layouts.add(name[1]);
      });
    }
  }

  return layouts.size;
}

/**
 * Count content shapes from prompts.ts.
 */
function countContentShapes() {
  const filePath = path.join(ROOT, "server/pipeline/prompts.ts");
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf-8");
  // Content shapes are numbered items with quoted names
  const matches = content.match(/^\d+\.\s+"[\w_]+"/gm);
  return matches ? matches.length : 0;
}

/**
 * Count theme presets from shared/themes.ts.
 */
function countThemes() {
  const filePath = path.join(ROOT, "shared/themes.ts");
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf-8");
  // Count actual theme presets by matching lines with both id: and gradient:
  const lines = content.split("\n");
  let count = 0;
  for (const line of lines) {
    if (line.includes("gradient:") && line.includes("id:") && !line.startsWith("  gradient")) {
      count++;
    }
  }
  return count;
}

/**
 * Count chart types from svgChartEngine.ts.
 */
function countChartTypes() {
  const filePath = path.join(ROOT, "server/pipeline/svgChartEngine.ts");
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf-8");
  const matches = content.match(/case ['"]([a-z-]+)['"]:/g);
  if (!matches) return 0;
  const unique = new Set(matches.map(m => m.replace(/case ['"]|['"]:/g, "")));
  return unique.size;
}

/**
 * Count pipeline agent steps from generator.ts.
 */
function countPipelineSteps() {
  const filePath = path.join(ROOT, "server/pipeline/generator.ts");
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf-8");
  const matches = content.match(/nodeName:\s*["']([^"']+)["']/g);
  if (!matches) return 0;
  const unique = new Set(matches.map(m => m.replace(/nodeName:\s*['"]|['"]/g, "")));
  // +1 for assembly step
  return unique.size + 1;
}

/**
 * Count test files and extract test count from last vitest run.
 */
function countTests() {
  try {
    const result = execSync("cd " + ROOT + " && pnpm test 2>&1 | tail -5", {
      encoding: "utf-8",
      timeout: 120000,
    });
    const testFileMatch = result.match(/Test Files\s+(\d+)\s+passed/);
    const testCountMatch = result.match(/Tests\s+(\d+)\s+passed/);
    return {
      files: testFileMatch ? parseInt(testFileMatch[1], 10) : 0,
      count: testCountMatch ? parseInt(testCountMatch[1], 10) : 0,
    };
  } catch {
    // Fallback: count test files
    const files = countFiles("server", ["test.ts"]);
    return { files, count: 0 };
  }
}

/**
 * Count PPTX export supported layouts.
 */
function countPptxLayouts() {
  const filePath = path.join(ROOT, "server/pptxExport.ts");
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf-8");
  const matches = content.match(/case ['"]([a-z][\w-]*)['"]:/g);
  if (!matches) return 0;
  const unique = new Set(matches.map(m => m.replace(/case ['"]|['"]:/g, "")));
  return unique.size;
}

/**
 * Count database tables from drizzle schema.
 */
function countDbTables() {
  const filePath = path.join(ROOT, "drizzle/schema.ts");
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf-8");
  const matches = content.match(/export const \w+ = mysqlTable/g);
  return matches ? matches.length : 0;
}

// ─── Main ───────────────────────────────────────────────────────────

function collectMetrics(skipTests = false) {
  const metrics = {};

  // Pipeline
  metrics.pipelineSteps = countPipelineSteps();
  metrics.layouts = countAllUniqueLayouts();
  metrics.layoutsTemplateEngine = countLayouts();
  metrics.layoutsPrompts = countLayoutsFromPrompts();
  metrics.contentShapes = countContentShapes();
  metrics.themes = countThemes();
  metrics.chartTypes = countChartTypes();
  metrics.pptxLayouts = countPptxLayouts();

  // API
  metrics.endpoints = countEndpoints();
  metrics.dbTables = countDbTables();

  // Code size — use precise directory scoping to match README categories
  metrics.pipelineLines = countLinesInDir("server/pipeline", ["ts"], true);
  metrics.pipelineFiles = countFiles("server/pipeline", ["ts"], true);
  // Routes = server/*.ts (top-level only, no pipeline, no _core, no tests)
  metrics.routeLines = countLinesFlat("server", ["ts"], true);
  metrics.routeFiles = countFilesFlat("server", ["ts"], true);
  metrics.clientPageLines = countLinesInDir("client/src/pages", ["tsx"]);
  metrics.clientPageFiles = countFiles("client/src/pages", ["tsx"]);
  metrics.clientComponentLines = countLinesInDir("client/src/components", ["tsx"]);
  metrics.clientComponentFiles = countFiles("client/src/components", ["tsx"]);
  metrics.sharedLines = countLinesInDir("shared", ["ts"]);
  metrics.sharedFiles = countFiles("shared", ["ts"]);
  metrics.testLines = countLinesInDir("server", ["test.ts"]);
  metrics.testFiles = countFiles("server", ["test.ts"]);

  // Total
  metrics.totalLines =
    metrics.pipelineLines +
    metrics.routeLines +
    metrics.clientPageLines +
    metrics.clientComponentLines +
    metrics.sharedLines +
    metrics.testLines;
  metrics.totalFiles =
    metrics.pipelineFiles +
    metrics.routeFiles +
    metrics.clientPageFiles +
    metrics.clientComponentFiles +
    metrics.sharedFiles +
    metrics.testFiles;

  // Tests (slow — run last or skip)
  if (!skipTests) {
    const tests = countTests();
    metrics.testCount = tests.count;
    metrics.testFileCount = tests.files;
  }

  return metrics;
}

function roundToHundred(n) {
  return Math.round(n / 100) * 100;
}

function updateReadme(metrics) {
  const readmePath = path.join(ROOT, "README.md");
  let content = fs.readFileSync(readmePath, "utf-8");

  // ─── Overview table ───
  content = content.replace(
    /\| AI-агенты \| .+ \|/,
    `| AI-агенты | ${metrics.pipelineSteps} этапов пайплайна (${metrics.pipelineSteps - 1} агентов + Assembly) |`
  );
  content = content.replace(
    /\| Шаблоны слайдов \| .+ \|/,
    `| Шаблоны слайдов | ${metrics.layouts} HTML-макетов |`
  );
  content = content.replace(
    /\| Темы оформления \| .+ \|/,
    `| Темы оформления | ${metrics.themes} цветовых тем + авто-подбор |`
  );
  content = content.replace(
    /\| Типы графиков \| .+ \|/,
    `| Типы графиков | ${metrics.chartTypes} типов SVG-диаграмм |`
  );

  // ─── Architecture diagram ───
  content = content.replace(
    /GENERATION PIPELINE \(\d+ (?:agents|stages)\)/,
    `GENERATION PIPELINE (${metrics.pipelineSteps} stages)`
  );

  // ─── Overview text ───
  content = content.replace(
    /\*\*\d+-этапный мультиагентный пайплайн\*\* \(\d+ AI-агентов \+ финальная сборка\)/,
    `**${metrics.pipelineSteps}-этапный мультиагентный пайплайн** (${metrics.pipelineSteps - 1} AI-агентов + финальная сборка)`
  );

  // ─── Feature list ───
  content = content.replace(
    /Мультиагентный AI-пайплайн с \d+ этапами \(\d+ агентов \+ Assembly\)/,
    `Мультиагентный AI-пайплайн с ${metrics.pipelineSteps} этапами (${metrics.pipelineSteps - 1} агентов + Assembly)`
  );
  content = content.replace(
    /\d+ HTML-макетов с адаптивной типографикой/,
    `${metrics.layouts} HTML-макетов с адаптивной типографикой`
  );
  content = content.replace(
    /\d+ тем оформления с AI-подбором/,
    `${metrics.themes} тем оформления с AI-подбором`
  );

  // ─── PPTX export ───
  content = content.replace(
    /поддержка \d+ типов слайдов/,
    `поддержка ${metrics.pptxLayouts} типов слайдов`
  );

  // ─── API section ───
  content = content.replace(
    /\*\*\d+ REST API endpoints\*\*/,
    `**${metrics.endpoints} REST API endpoints**`
  );
  content = content.replace(
    /большинство из \d+ endpoints/,
    `большинство из ${metrics.endpoints} endpoints`
  );

  // ─── Code size table ───
  content = content.replace(
    /\| Pipeline \(агенты\) \| ~[\d,\s]+ \| \d+ \|/,
    `| Pipeline (агенты) | ~${roundToHundred(metrics.pipelineLines).toLocaleString("ru")} | ${metrics.pipelineFiles} |`
  );
  content = content.replace(
    /\| Routes \(API\) \| ~[\d,\s]+ \| \d+ \|/,
    `| Routes (API) | ~${roundToHundred(metrics.routeLines).toLocaleString("ru")} | ${metrics.routeFiles} |`
  );
  content = content.replace(
    /\| Client \(страницы\) \| ~[\d,\s]+ \| \d+ \|/,
    `| Client (страницы) | ~${roundToHundred(metrics.clientPageLines).toLocaleString("ru")} | ${metrics.clientPageFiles} |`
  );
  content = content.replace(
    /\| Client \(компоненты\) \| ~[\d,\s]+ \| \d+ \|/,
    `| Client (компоненты) | ~${roundToHundred(metrics.clientComponentLines).toLocaleString("ru")} | ${metrics.clientComponentFiles} |`
  );
  content = content.replace(
    /\| Shared \| ~[\d,\s]+ \| \d+ \|/,
    `| Shared | ~${roundToHundred(metrics.sharedLines).toLocaleString("ru")} | ${metrics.sharedFiles} |`
  );
  content = content.replace(
    /\| Тесты \| ~[\d,\s]+ \| \d+ \|/,
    `| Тесты | ~${roundToHundred(metrics.testLines).toLocaleString("ru")} | ${metrics.testFiles} |`
  );
  content = content.replace(
    /\| \*\*Итого\*\* \| \*\*~[\d,\s]+\*\* \| \*\*\d+\*\* \|/,
    `| **Итого** | **~${roundToHundred(metrics.totalLines).toLocaleString("ru")}** | **${metrics.totalFiles}** |`
  );

  // ─── Test count in dev section ───
  if (metrics.testCount) {
    content = content.replace(
      /pnpm test\s+# Запуск всех тестов \(\d+ тест[а-я]*/,
      `pnpm test              # Запуск всех тестов (${metrics.testCount} тест${metrics.testCount > 4 ? "ов" : "а"}`
    );
  }

  fs.writeFileSync(readmePath, content, "utf-8");
  return content;
}

// ─── CLI ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isJson = args.includes("--json");
const skipTests = args.includes("--skip-tests");

console.log("📊 Collecting codebase metrics...\n");
const metrics = collectMetrics(skipTests);

if (isJson) {
  console.log(JSON.stringify(metrics, null, 2));
} else {
  console.log("┌─────────────────────────────────────────┐");
  console.log("│         Codebase Metrics Summary         │");
  console.log("├─────────────────────────────────────────┤");
  console.log(`│ Pipeline steps:      ${String(metrics.pipelineSteps).padStart(6)} │`);
  console.log(`│ Layouts (total):     ${String(metrics.layouts).padStart(6)} │`);
  console.log(`│ Content shapes:      ${String(metrics.contentShapes).padStart(6)} │`);
  console.log(`│ Themes:              ${String(metrics.themes).padStart(6)} │`);
  console.log(`│ Chart types:         ${String(metrics.chartTypes).padStart(6)} │`);
  console.log(`│ PPTX layouts:        ${String(metrics.pptxLayouts).padStart(6)} │`);
  console.log(`│ REST endpoints:      ${String(metrics.endpoints).padStart(6)} │`);
  console.log(`│ DB tables:           ${String(metrics.dbTables).padStart(6)} │`);
  console.log("├─────────────────────────────────────────┤");
  console.log(`│ Pipeline code:   ~${String(roundToHundred(metrics.pipelineLines)).padStart(6)} lines │`);
  console.log(`│ Routes code:     ~${String(roundToHundred(metrics.routeLines)).padStart(6)} lines │`);
  console.log(`│ Client pages:    ~${String(roundToHundred(metrics.clientPageLines)).padStart(6)} lines │`);
  console.log(`│ Client comps:    ~${String(roundToHundred(metrics.clientComponentLines)).padStart(6)} lines │`);
  console.log(`│ Shared:          ~${String(roundToHundred(metrics.sharedLines)).padStart(6)} lines │`);
  console.log(`│ Tests:           ~${String(roundToHundred(metrics.testLines)).padStart(6)} lines │`);
  console.log(`│ Total:           ~${String(roundToHundred(metrics.totalLines)).padStart(6)} lines │`);
  console.log("├─────────────────────────────────────────┤");
  if (metrics.testCount) {
    console.log(`│ Tests passing:       ${String(metrics.testCount).padStart(6)} │`);
    console.log(`│ Test files:          ${String(metrics.testFileCount).padStart(6)} │`);
  }
  console.log("└─────────────────────────────────────────┘");

  if (!isDryRun) {
    console.log("\n✏️  Updating README.md...");
    updateReadme(metrics);
    console.log("✅ README.md updated with live metrics.");
  } else {
    console.log("\n🔍 Dry run — no files modified.");
  }
}
