/**
 * Tests for POST /api/v1/presentations/:id/preview-theme
 * Verifies theme preview renders one slide with new theme CSS without saving.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    url: "https://cdn.example.com/test.html",
    key: "test.html",
  }),
}));

// Mock presentationDb
const mockGetPresentation = vi.fn();
const mockUpdatePresentationProgress = vi.fn().mockResolvedValue(undefined);
vi.mock("./presentationDb", () => ({
  getPresentation: (...args: any[]) => mockGetPresentation(...args),
  updatePresentationProgress: (...args: any[]) => mockUpdatePresentationProgress(...args),
}));

// Mock templateEngine
const mockRenderSlide = vi.fn().mockReturnValue("<div class='slide'>rendered</div>");
vi.mock("./pipeline/templateEngine", () => ({
  renderSlide: (...args: any[]) => mockRenderSlide(...args),
  renderPresentation: vi.fn().mockReturnValue("<!DOCTYPE html><html><body>full</body></html>"),
  renderSlidePreview: vi.fn().mockReturnValue("<!DOCTYPE html><html><body>preview</body></html>"),
  BASE_CSS: "/* base css */",
}));

// Mock themes
vi.mock("./pipeline/themes", () => ({
  getThemePreset: vi.fn().mockImplementation((id: string) => {
    if (id === "unknown_theme") throw new Error("Unknown theme");
    return {
      id,
      name: id === "warm_sunset" ? "Тёплый закат" : "Corporate Blue",
      cssVariables: `:root { --theme: ${id}; }`,
      fontsUrl: "https://fonts.googleapis.com/css2?family=Inter",
    };
  }),
}));

// Mock versionDb
vi.mock("./versionDb", () => ({
  saveSlideVersion: vi.fn().mockResolvedValue(undefined),
  listSlideVersions: vi.fn().mockResolvedValue([]),
  getSlideVersion: vi.fn().mockResolvedValue(null),
}));

// Mock inlineFieldInjector
vi.mock("./pipeline/inlineFieldInjector", () => ({
  buildEditableSlideHtml: vi.fn(),
  getEditableFields: vi.fn(),
  setFieldValue: vi.fn(),
}));

import express from "express";
import request from "supertest";
import { registerSlideEditRoutes } from "./slideEditRoutes";

const app = express();
app.use(express.json());
registerSlideEditRoutes(app);

const COMPLETED_PRESENTATION = {
  presentationId: "test-id",
  status: "completed",
  title: "Test Presentation",
  language: "ru",
  config: { theme_preset: "corporate_blue", slide_count: 3 },
  themeCss: ":root { --theme: corporate_blue; }",
  resultUrls: { html_preview: "https://cdn.example.com/old.html" },
  finalHtmlSlides: [
    { layoutId: "title-slide", data: { title: "Slide 1" }, html: "<div>1</div>" },
    { layoutId: "two-column", data: { title: "Slide 2" }, html: "<div>2</div>" },
    { layoutId: "text-slide", data: { title: "Slide 3" }, html: "<div>3</div>" },
  ],
};

describe("POST /api/v1/presentations/:id/preview-theme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPresentation.mockResolvedValue(COMPLETED_PRESENTATION);
  });

  it("returns 400 if theme_preset_id is missing", async () => {
    const res = await request(app)
      .post("/api/v1/presentations/test-id/preview-theme")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("theme_preset_id");
  });

  it("returns 404 if presentation not found", async () => {
    mockGetPresentation.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/v1/presentations/missing/preview-theme")
      .send({ theme_preset_id: "warm_sunset" });
    expect(res.status).toBe(404);
  });

  it("returns 400 if presentation is not completed", async () => {
    mockGetPresentation.mockResolvedValue({ ...COMPLETED_PRESENTATION, status: "processing" });
    const res = await request(app)
      .post("/api/v1/presentations/test-id/preview-theme")
      .send({ theme_preset_id: "warm_sunset" });
    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("not completed");
  });

  it("returns 400 for unknown theme", async () => {
    const res = await request(app)
      .post("/api/v1/presentations/test-id/preview-theme")
      .send({ theme_preset_id: "unknown_theme" });
    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("Unknown theme");
  });

  it("returns preview HTML for first slide by default", async () => {
    const res = await request(app)
      .post("/api/v1/presentations/test-id/preview-theme")
      .send({ theme_preset_id: "warm_sunset" });
    expect(res.status).toBe(200);
    expect(res.body.theme_preset_id).toBe("warm_sunset");
    expect(res.body.theme_name).toBe("Тёплый закат");
    expect(res.body.slide_index).toBe(0);
    expect(res.body.preview_html).toBeDefined();
    expect(typeof res.body.preview_html).toBe("string");
  });

  it("renders the correct slide when slide_index is specified", async () => {
    const res = await request(app)
      .post("/api/v1/presentations/test-id/preview-theme")
      .send({ theme_preset_id: "warm_sunset", slide_index: 2 });
    expect(res.status).toBe(200);
    expect(res.body.slide_index).toBe(2);
    // renderSlide should be called with the third slide's layout and data
    expect(mockRenderSlide).toHaveBeenCalledWith("text-slide", { title: "Slide 3" });
  });

  it("clamps slide_index to 0 if out of range", async () => {
    const res = await request(app)
      .post("/api/v1/presentations/test-id/preview-theme")
      .send({ theme_preset_id: "warm_sunset", slide_index: 99 });
    expect(res.status).toBe(200);
    expect(res.body.slide_index).toBe(0);
  });

  it("does NOT update the database (preview only)", async () => {
    await request(app)
      .post("/api/v1/presentations/test-id/preview-theme")
      .send({ theme_preset_id: "warm_sunset" });
    expect(mockUpdatePresentationProgress).not.toHaveBeenCalled();
  });

  it("returns 400 if no slides available", async () => {
    mockGetPresentation.mockResolvedValue({
      ...COMPLETED_PRESENTATION,
      finalHtmlSlides: [],
    });
    const res = await request(app)
      .post("/api/v1/presentations/test-id/preview-theme")
      .send({ theme_preset_id: "warm_sunset" });
    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("No slides");
  });
});
