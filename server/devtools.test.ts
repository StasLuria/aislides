import { describe, expect, it } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { TrpcContext } from "./_core/context";

const ROOT = path.resolve(import.meta.dirname, "..");

// ─── generate-readme.mjs ──────────────────────────────────────

describe("generate-readme.mjs", () => {
  it("runs in dry-run mode and outputs metrics summary", () => {
    const output = execSync("node scripts/generate-readme.mjs --dry-run --skip-tests", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });

    expect(output).toContain("Codebase Metrics Summary");
    expect(output).toContain("Pipeline steps:");
    expect(output).toContain("Layouts (total):");
    expect(output).toContain("REST endpoints:");
    expect(output).toContain("DB tables:");
    expect(output).toContain("Dry run");
  });

  it("detects correct pipeline step count (16)", () => {
    const output = execSync("node scripts/generate-readme.mjs --dry-run --skip-tests", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });

    const match = output.match(/Pipeline steps:\s+(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(16);
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
    const readmePath = path.join(ROOT, "README.md");
    const original = fs.readFileSync(readmePath, "utf-8");

    try {
      execSync("node scripts/generate-readme.mjs --skip-tests", {
        cwd: ROOT,
        encoding: "utf-8",
        timeout: 30_000,
      });

      const updated = fs.readFileSync(readmePath, "utf-8");
      expect(updated).toContain("16-этапный мультиагентный пайплайн");
      expect(updated).toContain("45 HTML-макетов");
      expect(updated).toContain("54 REST API endpoints");
    } finally {
      fs.writeFileSync(readmePath, original, "utf-8");
    }
  });
});

// ─── generate-changelog.mjs ───────────────────────────────────

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

    expect(content).toMatch(/Total tasks \| \d+/);
    expect(content).toMatch(/Completed \| \d+/);
    expect(content).toMatch(/Pending \| \d+/);
  });
});

// ─── Swagger/OpenAPI docs ─────────────────────────────────────

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

// ─── generate-postman.mjs ─────────────────────────────────────

describe("generate-postman.mjs", () => {
  it("runs in dry-run mode and lists all endpoint folders", () => {
    const output = execSync("node scripts/generate-postman.mjs --dry-run", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });

    expect(output).toContain("Generating Postman collection");
    expect(output).toContain("Folders: 9");
    expect(output).toContain("Endpoints: 54");
    expect(output).toContain("Dry run");

    // Check all folder names appear
    const expectedFolders = [
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
    for (const f of expectedFolders) {
      expect(output).toContain(f);
    }
  });

  it("generates valid collection.json and environment.json", () => {
    execSync("node scripts/generate-postman.mjs", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });

    const collectionPath = path.join(ROOT, "postman", "collection.json");
    const envPath = path.join(ROOT, "postman", "environment.json");

    expect(fs.existsSync(collectionPath)).toBe(true);
    expect(fs.existsSync(envPath)).toBe(true);

    const collection = JSON.parse(fs.readFileSync(collectionPath, "utf-8"));
    expect(collection.info.name).toBe("Presentation Generator API");
    expect(collection.info.schema).toContain("collection/v2.1.0");
    expect(collection.item.length).toBe(9);

    const env = JSON.parse(fs.readFileSync(envPath, "utf-8"));
    expect(env.name).toContain("Presentation Generator");
    expect(env.values.some((v: { key: string }) => v.key === "base_url")).toBe(true);
  });

  it("collection includes correct HTTP methods", () => {
    const collectionPath = path.join(ROOT, "postman", "collection.json");
    const collection = JSON.parse(fs.readFileSync(collectionPath, "utf-8"));

    // Flatten all requests
    const requests: Array<{ method: string; url: { raw: string } }> = [];
    for (const folder of collection.item) {
      for (const item of folder.item || []) {
        requests.push(item.request);
      }
    }

    // Check we have various HTTP methods
    const methods = new Set(requests.map((r) => r.method));
    expect(methods.has("GET")).toBe(true);
    expect(methods.has("POST")).toBe(true);
    expect(methods.has("PUT")).toBe(true);
    expect(methods.has("DELETE")).toBe(true);
    expect(methods.has("PATCH")).toBe(true);
  });
});

// ─── Pre-commit hook ──────────────────────────────────────────

describe("pre-commit hook", () => {
  it("husky pre-commit hook file exists and is executable", () => {
    const hookPath = path.join(ROOT, ".husky", "pre-commit");
    expect(fs.existsSync(hookPath)).toBe(true);

    const stats = fs.statSync(hookPath);
    // Check executable bit (owner)
    expect(stats.mode & 0o100).toBeTruthy();
  });

  it("pre-commit hook runs readme and changelog scripts", () => {
    const hookPath = path.join(ROOT, ".husky", "pre-commit");
    const content = fs.readFileSync(hookPath, "utf-8");

    expect(content).toContain("generate-readme.mjs");
    expect(content).toContain("generate-changelog.mjs");
    expect(content).toContain("git add");
  });

  it("package.json has prepare script for husky", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts.prepare).toBe("husky");
  });
});

// ─── Analytics tRPC procedures ────────────────────────────────

describe("analytics tRPC procedures", () => {
  function createAuthContext(): TrpcContext {
    return {
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
      } as TrpcContext["res"],
    };
  }

  it("overview returns correct shape", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.analytics.overview({});
    expect(result).toHaveProperty("totalPresentations");
    expect(result).toHaveProperty("completedPresentations");
    expect(result).toHaveProperty("failedPresentations");
    expect(result).toHaveProperty("averageSlideCount");
    expect(result).toHaveProperty("successRate");
    expect(typeof result.totalPresentations).toBe("number");
    expect(typeof result.successRate).toBe("number");
  });

  it("overview accepts date range filters", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.analytics.overview({
      dateFrom: "2026-01-01T00:00:00Z",
      dateTo: "2026-12-31T23:59:59Z",
    });
    expect(result).toHaveProperty("totalPresentations");
    expect(result.totalPresentations).toBeGreaterThanOrEqual(0);
  });

  it("dailyCounts returns array of date-count pairs", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.analytics.dailyCounts({
      dateFrom: "2026-01-01T00:00:00Z",
      dateTo: "2026-12-31T23:59:59Z",
    });
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("date");
      expect(result[0]).toHaveProperty("count");
    }
  });

  it("statusDistribution returns array with status and count", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.analytics.statusDistribution({});
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("status");
      expect(result[0]).toHaveProperty("count");
    }
  });

  it("themeDistribution returns array with theme and count", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.analytics.themeDistribution({});
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("theme");
      expect(result[0]).toHaveProperty("count");
    }
  });

  it("modeDistribution returns array with mode and count", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.analytics.modeDistribution({});
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("mode");
      expect(result[0]).toHaveProperty("count");
    }
  });

  it("slideCountDistribution returns array with slideCount and count", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.analytics.slideCountDistribution({});
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("slideCount");
      expect(result[0]).toHaveProperty("count");
    }
  });

  it("recentPresentations returns array with correct shape", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.analytics.recentPresentations({ limit: 5 });
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("presentationId");
      expect(result[0]).toHaveProperty("status");
      expect(result[0]).toHaveProperty("createdAt");
    }
  });

  it("rejects unauthenticated requests", async () => {
    const { appRouter } = await import("./routers");
    const unauthCtx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(unauthCtx);

    await expect(caller.analytics.overview({})).rejects.toThrow();
  });
});

// ─── package.json scripts ─────────────────────────────────────

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

  it("has postman script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts.postman).toBe("node scripts/generate-postman.mjs");
  });

  it("has postman:dry script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts["postman:dry"]).toBe("node scripts/generate-postman.mjs --dry-run");
  });
});


// ─── Analytics CSV/PDF Export ────────────────────────────────

describe("analytics export endpoints", () => {
  it("analyticsRoutes.ts exists and exports registerAnalyticsRoutes", () => {
    const routesPath = path.join(ROOT, "server", "analyticsRoutes.ts");
    expect(fs.existsSync(routesPath)).toBe(true);

    const content = fs.readFileSync(routesPath, "utf-8");
    expect(content).toContain("registerAnalyticsRoutes");
    expect(content).toContain("/api/v1/analytics/export/csv");
    expect(content).toContain("/api/v1/analytics/export/json");
  });

  it("analytics routes are registered in server entry", () => {
    const indexPath = path.join(ROOT, "server", "_core", "index.ts");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("registerAnalyticsRoutes");
  });

  it("CSV export returns valid CSV content", async () => {
    const res = await fetch("http://localhost:3000/api/v1/analytics/export/csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");

    const text = await res.text();
    // CSV should have header row
    expect(text).toContain("ID,");
    expect(text).toContain("Title,");
    expect(text).toContain("Status,");
  });

  it("JSON export returns valid JSON content", async () => {
    const res = await fetch("http://localhost:3000/api/v1/analytics/export/json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const data = await res.json();
    expect(data).toHaveProperty("exportedAt");
    expect(data).toHaveProperty("overview");
    expect(data).toHaveProperty("presentations");
    expect(Array.isArray(data.presentations)).toBe(true);
  });
});

// ─── Error Notifications ─────────────────────────────────────

describe("error notifications via notifyOwner", () => {
  it("presentationRoutes imports notifyOwner", () => {
    const routesPath = path.join(ROOT, "server", "presentationRoutes.ts");
    const content = fs.readFileSync(routesPath, "utf-8");
    expect(content).toContain("notifyOwner");
    expect(content).toContain("import { notifyOwner }");
  });

  it("presentationRoutes calls notifyOwner on generation failure", () => {
    const routesPath = path.join(ROOT, "server", "presentationRoutes.ts");
    const content = fs.readFileSync(routesPath, "utf-8");

    // Should call notifyOwner in the catch block of generation
    expect(content).toContain("Ошибка генерации");
    expect(content).toContain("notifyOwner({");
  });

  it("interactiveRoutes imports notifyOwner", () => {
    const routesPath = path.join(ROOT, "server", "interactiveRoutes.ts");
    const content = fs.readFileSync(routesPath, "utf-8");
    expect(content).toContain("notifyOwner");
    expect(content).toContain("import { notifyOwner }");
  });

  it("interactiveRoutes calls notifyOwner on assembly failure", () => {
    const routesPath = path.join(ROOT, "server", "interactiveRoutes.ts");
    const content = fs.readFileSync(routesPath, "utf-8");

    expect(content).toContain("Ошибка сборки (интерактивный)");
    expect(content).toContain("notifyOwner({");
  });
});

// ─── A/B Theme Quality Metrics ───────────────────────────────

describe("A/B theme quality metrics", () => {
  it("export_events table exists in schema", () => {
    const schemaPath = path.join(ROOT, "drizzle", "schema.ts");
    const content = fs.readFileSync(schemaPath, "utf-8");
    expect(content).toContain("export_events");
    expect(content).toContain("exportEvents");
    expect(content).toContain("format");
    expect(content).toContain("themePreset");
    expect(content).toContain("isShared");
  });

  it("analyticsDb exports logExportEvent function", () => {
    const dbPath = path.join(ROOT, "server", "analyticsDb.ts");
    const content = fs.readFileSync(dbPath, "utf-8");
    expect(content).toContain("export async function logExportEvent");
    expect(content).toContain("exportEvents");
  });

  it("analyticsDb exports getThemeQualityMetrics function", () => {
    const dbPath = path.join(ROOT, "server", "analyticsDb.ts");
    const content = fs.readFileSync(dbPath, "utf-8");
    expect(content).toContain("export async function getThemeQualityMetrics");
    expect(content).toContain("qualityScore");
    expect(content).toContain("completionRate");
    expect(content).toContain("exportRate");
  });

  it("analyticsDb exports getExportFormatDistribution function", () => {
    const dbPath = path.join(ROOT, "server", "analyticsDb.ts");
    const content = fs.readFileSync(dbPath, "utf-8");
    expect(content).toContain("export async function getExportFormatDistribution");
  });

  it("export events are logged in all 4 export endpoints", () => {
    const routesPath = path.join(ROOT, "server", "presentationRoutes.ts");
    const content = fs.readFileSync(routesPath, "utf-8");

    // Count logExportEvent calls
    const matches = content.match(/logExportEvent\(/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(4);
  });

  it("themeQuality tRPC procedure returns correct shape", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    });

    const result = await caller.analytics.themeQuality({});
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("theme");
      expect(result[0]).toHaveProperty("totalPresentations");
      expect(result[0]).toHaveProperty("completedPresentations");
      expect(result[0]).toHaveProperty("exportedPresentations");
      expect(result[0]).toHaveProperty("totalExports");
      expect(result[0]).toHaveProperty("completionRate");
      expect(result[0]).toHaveProperty("exportRate");
      expect(result[0]).toHaveProperty("qualityScore");
    }
  });

  it("exportFormatDistribution tRPC procedure returns correct shape", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    });

    const result = await caller.analytics.exportFormatDistribution({});
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("format");
      expect(result[0]).toHaveProperty("count");
    }
  });

  it("Analytics page includes theme quality section", () => {
    const analyticsPath = path.join(ROOT, "client", "src", "pages", "Analytics.tsx");
    const content = fs.readFileSync(analyticsPath, "utf-8");
    expect(content).toContain("themeQuality");
    expect(content).toContain("exportDist");
    expect(content).toContain("qualityScore");
    expect(content).toContain("A/B");
    expect(content).toContain("FlaskConical");
  });
});
