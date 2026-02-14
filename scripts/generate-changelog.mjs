#!/usr/bin/env node
/**
 * CHANGELOG Generator — parses todo.md and produces a structured CHANGELOG.md
 *
 * Usage:
 *   node scripts/generate-changelog.mjs          # Generate CHANGELOG.md
 *   node scripts/generate-changelog.mjs --dry-run # Preview without writing
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TODO_PATH = path.join(ROOT, "todo.md");
const CHANGELOG_PATH = path.join(ROOT, "CHANGELOG.md");

/**
 * Categorize a section title into a changelog type.
 */
function categorize(title) {
  const lower = title.toLowerCase();
  if (lower.includes("bug fix") || lower.includes("bug fixes")) return "fix";
  if (lower.includes("sprint") || lower.includes("round")) return "improvement";
  if (lower.includes("feature") || lower.includes("task:") || lower.includes("task ")) return "feature";
  if (lower.includes("quality") || lower.includes("audit") || lower.includes("refactor")) return "improvement";
  if (lower.includes("deep") || lower.includes("improvement") || lower.includes("improve")) return "improvement";
  if (lower.includes("design") || lower.includes("theme") || lower.includes("style")) return "design";
  if (lower.includes("rewrite") || lower.includes("phase")) return "infrastructure";
  if (lower.includes("test")) return "testing";
  if (lower.includes("doc") || lower.includes("readme") || lower.includes("changelog")) return "docs";
  return "feature";
}

/**
 * Get emoji for category.
 */
function categoryEmoji(cat) {
  const map = {
    fix: "\u{1F41B}",
    feature: "\u2728",
    improvement: "\u{1F680}",
    design: "\u{1F3A8}",
    infrastructure: "\u{1F3D7}\uFE0F",
    testing: "\u{1F9EA}",
    docs: "\u{1F4DD}",
  };
  return map[cat] || "\u{1F4E6}";
}

/**
 * Get human-readable category name.
 */
function categoryName(cat) {
  const map = {
    fix: "Bug Fixes",
    feature: "New Features",
    improvement: "Improvements",
    design: "Design",
    infrastructure: "Infrastructure",
    testing: "Testing",
    docs: "Documentation",
  };
  return map[cat] || "Other";
}

/**
 * Parse todo.md into sections with their items.
 */
function parseTodo(content) {
  const lines = content.split("\n");
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    // Match section headers: ## Title
    const headerMatch = line.match(/^## (.+)$/);
    if (headerMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        title: headerMatch[1].trim(),
        items: [],
        completed: 0,
        total: 0,
      };
      continue;
    }

    // Match todo items: - [x] or - [ ]
    if (currentSection) {
      const itemMatch = line.match(/^- \[([ x])\] (.+)$/);
      if (itemMatch) {
        const done = itemMatch[1] === "x";
        currentSection.items.push({ text: itemMatch[2].trim(), done });
        currentSection.total++;
        if (done) currentSection.completed++;
      }
    }
  }

  if (currentSection) sections.push(currentSection);
  return sections;
}

/**
 * Generate changelog content from parsed sections.
 */
function generateChangelog(sections) {
  const lines = [];

  lines.push("# CHANGELOG");
  lines.push("");
  lines.push("> Auto-generated from `todo.md` by `pnpm changelog`");
  lines.push(`> Last updated: ${new Date().toISOString().split("T")[0]}`);
  lines.push("");

  // Summary stats
  const totalItems = sections.reduce((s, sec) => s + sec.total, 0);
  const completedItems = sections.reduce((s, sec) => s + sec.completed, 0);
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Total sections | ${sections.length} |`);
  lines.push(`| Total tasks | ${totalItems} |`);
  lines.push(`| Completed | ${completedItems} (${Math.round((completedItems / totalItems) * 100)}%) |`);
  lines.push(`| Pending | ${totalItems - completedItems} |`);
  lines.push("");

  // Group by category
  const grouped = {};
  for (const section of sections) {
    const cat = categorize(section.title);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(section);
  }

  // Category order
  const order = ["feature", "improvement", "design", "fix", "infrastructure", "testing", "docs"];

  lines.push("---");
  lines.push("");

  // Detailed changelog — reverse chronological (newest first)
  lines.push("## Detailed Changelog");
  lines.push("");

  const reversedSections = [...sections].reverse();

  for (const section of reversedSections) {
    const cat = categorize(section.title);
    const emoji = categoryEmoji(cat);
    const status = section.completed === section.total ? "\u2705" : `\u{1F534} ${section.completed}/${section.total}`;

    lines.push(`### ${emoji} ${section.title} ${status}`);
    lines.push("");

    for (const item of section.items) {
      const check = item.done ? "[x]" : "[ ]";
      lines.push(`- ${check} ${item.text}`);
    }

    lines.push("");
  }

  // Category summary
  lines.push("---");
  lines.push("");
  lines.push("## By Category");
  lines.push("");

  for (const cat of order) {
    if (!grouped[cat]) continue;
    const emoji = categoryEmoji(cat);
    const name = categoryName(cat);
    const count = grouped[cat].length;
    const completed = grouped[cat].reduce((s, sec) => s + sec.completed, 0);
    const total = grouped[cat].reduce((s, sec) => s + sec.total, 0);

    lines.push(`### ${emoji} ${name} (${count} sections, ${completed}/${total} tasks)`);
    lines.push("");

    for (const section of grouped[cat]) {
      const status = section.completed === section.total ? "\u2705" : `${section.completed}/${section.total}`;
      lines.push(`- **${section.title}** — ${status}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

// ─── CLI ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

if (!fs.existsSync(TODO_PATH)) {
  console.error("Error: todo.md not found at", TODO_PATH);
  process.exit(1);
}

const todoContent = fs.readFileSync(TODO_PATH, "utf-8");
const sections = parseTodo(todoContent);
const changelog = generateChangelog(sections);

if (isDryRun) {
  console.log(changelog);
  console.log("\n---\n🔍 Dry run — no files modified.");
} else {
  fs.writeFileSync(CHANGELOG_PATH, changelog, "utf-8");
  console.log(`✅ CHANGELOG.md generated with ${sections.length} sections.`);
}
