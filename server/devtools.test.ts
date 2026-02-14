import { describe, expect, it } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

describe("generate-readme.mjs", () => {
  it("runs in dry-run mode and outputs metrics summary", () => {
    const output = execSync("node scripts/generate-readme.mjs --dry-run --skip-tests", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });

    // Should contain the metrics summary header
    expect(output).toContain("Codebase Metrics Summary");
    expect(output).toContain("Pipeline steps:");
    expect(output).toContain("Layouts (total):");
    expect(output).toContain("REST endpoints:");
    expect(output).toContain("DB tables:");
    expect(output).toContain("Dry run");
  });

  it("detects correct pipeline step count (15)", () => {
    const output = execSync("node scripts/generate-readme.mjs --dry-run --skip-tests", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });

    const match = output.match(/Pipeline steps:\s+(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(15);
  });

  it("detects correct layout count (45)", () => {
    const output = execSync("node scripts/generate-readme.mjs --dry-run --skip-tests", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });

    const match = output.match(/Layouts \(total\):\s+(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(45);
  });

  it("detects correct theme count (12)", () => {
    const output = execSync("node scripts/generate-readme.mjs --dry-run --skip-tests", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });

    const match = output.match(/Themes:\s+(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(12);
  });

  it("detects at least 50 REST endpoints", () => {
    const output = execSync("node scripts/generate-readme.mjs --dry-run --skip-tests", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });

    const match = output.match(/REST endpoints:\s+(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(50);
  });

  it("updates README.md when run without --dry-run", () => {
    // Save original README
    const readmePath = path.join(ROOT, "README.md");
    const original = fs.readFileSync(readmePath, "utf-8");

    try {
      execSync("node scripts/generate-readme.mjs --skip-tests", {
        cwd: ROOT,
        encoding: "utf-8",
        timeout: 30_000,
      });

      const updated = fs.readFileSync(readmePath, "utf-8");
      // The README should contain updated metrics from the script
      expect(updated).toContain("15-этапный мультиагентный пайплайн");
      expect(updated).toContain("45 HTML-макетов");
      expect(updated).toContain("54 REST API endpoints");
    } finally {
      // Restore original README
      fs.writeFileSync(readmePath, original, "utf-8");
    }
  });
});

describe("generate-changelog.mjs", () => {
  it("generates CHANGELOG.md from todo.md", () => {
    const output = execSync("node scripts/generate-changelog.mjs", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 15_000,
    });

    expect(output).toContain("CHANGELOG.md generated");

    const changelogPath = path.join(ROOT, "CHANGELOG.md");
    expect(fs.existsSync(changelogPath)).toBe(true);

    const content = fs.readFileSync(changelogPath, "utf-8");
    expect(content).toContain("# CHANGELOG");
    expect(content).toContain("## Summary");
    expect(content).toContain("## Detailed Changelog");
    expect(content).toContain("## By Category");
  });

  it("dry-run mode does not modify files", () => {
    const changelogPath = path.join(ROOT, "CHANGELOG.md");

    // Remove CHANGELOG if it exists
    if (fs.existsSync(changelogPath)) {
      fs.unlinkSync(changelogPath);
    }

    const output = execSync("node scripts/generate-changelog.mjs --dry-run", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 15_000,
    });

    expect(output).toContain("Dry run");
    expect(output).toContain("# CHANGELOG");

    // File should not exist after dry run
    expect(fs.existsSync(changelogPath)).toBe(false);

    // Regenerate for other tests
    execSync("node scripts/generate-changelog.mjs", { cwd: ROOT, encoding: "utf-8" });
  });

  it("parses correct number of sections from todo.md", () => {
    const output = execSync("node scripts/generate-changelog.mjs", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 15_000,
    });

    const match = output.match(/(\d+) sections/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(90);
  });

  it("includes task completion statistics", () => {
    const changelogPath = path.join(ROOT, "CHANGELOG.md");
    const content = fs.readFileSync(changelogPath, "utf-8");

    // Should have the summary table
    expect(content).toMatch(/Total tasks \| \d+/);
    expect(content).toMatch(/Completed \| \d+/);
    expect(content).toMatch(/Pending \| \d+/);
  });
});

describe("Swagger/OpenAPI docs", () => {
  it("swagger spec file exists and is valid TypeScript", () => {
    const swaggerPath = path.join(ROOT, "server", "swagger.ts");
    expect(fs.existsSync(swaggerPath)).toBe(true);

    const content = fs.readFileSync(swaggerPath, "utf-8");
    expect(content).toContain("openapi");
    expect(content).toContain("3.0.3");
    expect(content).toContain("registerSwaggerDocs");
  });

  it("swagger spec covers all API tag groups", () => {
    const swaggerPath = path.join(ROOT, "server", "swagger.ts");
    const content = fs.readFileSync(swaggerPath, "utf-8");

    const expectedTags = [
      "Health",
      "Presentations",
      "Sharing",
      "Export",
      "Slide Editing",
      "Slide Versions",
      "Interactive Mode",
      "Chat",
      "Templates",
    ];

    for (const tag of expectedTags) {
      expect(content).toContain(`"${tag}"`);
    }
  });

  it("swagger spec includes all major endpoints", () => {
    const swaggerPath = path.join(ROOT, "server", "swagger.ts");
    const content = fs.readFileSync(swaggerPath, "utf-8");

    const expectedPaths = [
      "/health",
      "/api/v1/presentations",
      "/api/v1/presentations/{id}",
      "/api/v1/presentations/{id}/html",
      "/api/v1/presentations/{id}/slides",
      "/api/v1/presentations/{id}/export/pptx",
      "/api/v1/presentations/{id}/export/pdf",
      "/api/v1/shared/{token}",
      "/api/v1/interactive/start",
      "/api/v1/chat/sessions",
      "/api/v1/templates",
    ];

    for (const p of expectedPaths) {
      expect(content).toContain(`"${p}"`);
    }
  });

  it("swagger spec defines request/response schemas", () => {
    const swaggerPath = path.join(ROOT, "server", "swagger.ts");
    const content = fs.readFileSync(swaggerPath, "utf-8");

    expect(content).toContain("CreatePresentationRequest");
    expect(content).toContain("PresentationSummary");
    expect(content).toContain("Presentation");
    expect(content).toContain("Slide");
    expect(content).toContain("SlideUpdateRequest");
  });

  it("swagger is registered in the server entry", () => {
    const indexPath = path.join(ROOT, "server", "_core", "index.ts");
    const content = fs.readFileSync(indexPath, "utf-8");

    expect(content).toContain("registerSwaggerDocs");
    expect(content).toContain("swagger");
  });
});

describe("package.json scripts", () => {
  it("has readme script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts.readme).toBe("node scripts/generate-readme.mjs");
  });

  it("has readme:dry script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts["readme:dry"]).toBe("node scripts/generate-readme.mjs --dry-run --skip-tests");
  });

  it("has changelog script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts.changelog).toBe("node scripts/generate-changelog.mjs");
  });
});
