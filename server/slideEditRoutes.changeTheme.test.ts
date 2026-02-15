/**
 * Tests for POST /api/v1/presentations/:id/change-theme
 * Verifies theme switching re-renders all slides with new theme CSS.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    url: "https://cdn.example.com/presentations/test-id/presentation-theme-new.html",
    key: "presentations/test-id/presentation-theme-new.html",
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
vi.mock("./pipeline/templateEngine", () => ({
  renderSlide: vi.fn().mockReturnValue("<div class='slide'>rendered</div>"),
  renderPresentation: vi.fn().mockReturnValue("<!DOCTYPE html><html><body>full presentation</body></html>"),
  renderSlidePreview: vi.fn().mockReturnValue("<!DOCTYPE html><html><body>preview</body></html>"),
  BASE_CSS: "/* base css */",
}));

// Mock themes
vi.mock("./pipeline/themes", () => ({
  getThemePreset: vi.fn().mockImplementation((id: string) => {
    if (id === "unknown_theme") throw new Error("Unknown theme");
    return {
      id,
      name: id === "bspb_white" ? "БСПБ Белый" : "Corporate Blue",
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
    { layoutId: "title_center", data: { title: "Slide 1" }, html: "<div>1</div>" },
    { layoutId: "two_columns", data: { title: "Slide 2" }, html: "<div>2</div>" },
  ],
};

describe("POST /api/v1/presentations/:id/change-theme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPresentation.mockResolvedValue(COMPLETED_PRESENTATION);
  });

  it("should change theme and return new HTML URL", async () => {
    const res = await request(app)
      .post("/api/v1/presentations/test-id/change-theme")
      .send({ theme_preset_id: "bspb_white" });

    expect(res.status).toBe(200);
    expect(res.body.presentation_id).toBe("test-id");
    expect(res.body.theme_preset_id).toBe("bspb_white");
    expect(res.body.theme_name).toBe("БСПБ Белый");
    expect(res.body.html_url).toContain("cdn.example.com");
    expect(res.body.slide_count).toBe(2);
  });

  it("should update config with new theme_preset", async () => {
    await request(app)
      .post("/api/v1/presentations/test-id/change-theme")
      .send({ theme_preset_id: "bspb_white" });

    expect(mockUpdatePresentationProgress).toHaveBeenCalledWith(
      "test-id",
      expect.objectContaining({
        config: expect.objectContaining({ theme_preset: "bspb_white" }),
        themeCss: expect.stringContaining("bspb_white"),
      }),
    );
  });

  it("should return 400 if theme_preset_id is missing", async () => {
    const res = await request(app)
      .post("/api/v1/presentations/test-id/change-theme")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("theme_preset_id");
  });

  it("should return 404 if presentation not found", async () => {
    mockGetPresentation.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/v1/presentations/nonexistent/change-theme")
      .send({ theme_preset_id: "bspb_white" });

    expect(res.status).toBe(404);
  });

  it("should return 400 if presentation is not completed", async () => {
    mockGetPresentation.mockResolvedValue({ ...COMPLETED_PRESENTATION, status: "generating" });

    const res = await request(app)
      .post("/api/v1/presentations/test-id/change-theme")
      .send({ theme_preset_id: "bspb_white" });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("not completed");
  });

  it("should return 400 for unknown theme", async () => {
    const res = await request(app)
      .post("/api/v1/presentations/test-id/change-theme")
      .send({ theme_preset_id: "unknown_theme" });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("Unknown theme");
  });

  it("should return 400 if no slides exist", async () => {
    mockGetPresentation.mockResolvedValue({
      ...COMPLETED_PRESENTATION,
      finalHtmlSlides: [],
    });

    const res = await request(app)
      .post("/api/v1/presentations/test-id/change-theme")
      .send({ theme_preset_id: "bspb_white" });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("No slides");
  });
});
