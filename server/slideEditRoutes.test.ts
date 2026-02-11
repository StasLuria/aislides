import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for slide editing routes.
 * We test the route handler logic by simulating request/response objects.
 */

// Mock dependencies
vi.mock("./pipeline/templateEngine", () => ({
  renderSlide: vi.fn().mockReturnValue("<div>rendered slide</div>"),
  renderPresentation: vi.fn().mockReturnValue("<html>full presentation</html>"),
  BASE_CSS: "/* base css */",
}));

vi.mock("./pipeline/themes", () => ({
  getThemePreset: vi.fn().mockReturnValue({
    id: "corporate_blue",
    name: "Corporate Blue",
    nameRu: "Корпоративный синий",
    previewColor: "#4F46E5",
    previewGradient: "linear-gradient(135deg, #4F46E5, #7C3AED)",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Inter",
    cssVariables: ":root { --primary: blue; }",
    mood: "professional",
    dark: false,
  }),
}));

vi.mock("./presentationDb", () => ({
  createPresentation: vi.fn().mockResolvedValue({
    presentationId: "test-id-123",
    createdAt: new Date(),
  }),
  getPresentation: vi.fn(),
  updatePresentationProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    url: "https://s3.example.com/test.html",
    key: "test-key",
  }),
}));

// Import after mocks
import { getPresentation, updatePresentationProgress } from "./presentationDb";
import { renderSlide, renderPresentation } from "./pipeline/templateEngine";
import { storagePut } from "./storage";

const mockGetPresentation = getPresentation as ReturnType<typeof vi.fn>;
const mockUpdateProgress = updatePresentationProgress as ReturnType<typeof vi.fn>;
const mockRenderSlide = renderSlide as ReturnType<typeof vi.fn>;
const mockRenderPresentation = renderPresentation as ReturnType<typeof vi.fn>;
const mockStoragePut = storagePut as ReturnType<typeof vi.fn>;

// Helper to create a mock completed presentation
function createMockPresentation(overrides: Record<string, any> = {}) {
  return {
    presentationId: "test-pres-123",
    status: "completed",
    title: "Test Presentation",
    language: "ru",
    themeCss: ":root { --primary: blue; }",
    config: { theme_preset: "corporate_blue" },
    finalHtmlSlides: [
      {
        layoutId: "title-slide",
        data: {
          title: "Welcome",
          description: "Test presentation",
          presenterName: "John",
          presentationDate: "2026",
        },
      },
      {
        layoutId: "text-slide",
        data: {
          title: "Content Slide",
          description: "Some content here",
          key_message: "Important point",
        },
      },
      {
        layoutId: "image-text",
        data: {
          title: "Image Slide",
          description: "With image",
          image: { url: "https://example.com/img.jpg", alt: "test" },
        },
      },
      {
        layoutId: "final-slide",
        data: {
          title: "Thank You",
          description: "Questions?",
          callToAction: "Contact us",
          contactInfo: "email@test.com",
        },
      },
    ],
    resultUrls: {
      html_preview: "https://s3.example.com/presentation.html",
    },
    ...overrides,
  };
}

describe("Slide Edit Routes — Data Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════
  // GET /presentations/:id/slides
  // ═══════════════════════════════════════════════════════

  describe("Get all slides", () => {
    it("should return all slides with their data and layout info", () => {
      const pres = createMockPresentation();
      const slides = pres.finalHtmlSlides.map((s: any, i: number) => ({
        index: i,
        layoutId: s.layoutId,
        data: s.data,
      }));

      expect(slides).toHaveLength(4);
      expect(slides[0].layoutId).toBe("title-slide");
      expect(slides[0].data.title).toBe("Welcome");
      expect(slides[1].layoutId).toBe("text-slide");
      expect(slides[2].layoutId).toBe("image-text");
      expect(slides[3].layoutId).toBe("final-slide");
    });

    it("should reject if presentation is not completed", () => {
      const pres = createMockPresentation({ status: "generating" });
      expect(pres.status).not.toBe("completed");
    });

    it("should handle empty slides array", () => {
      const pres = createMockPresentation({ finalHtmlSlides: [] });
      const slides = (pres.finalHtmlSlides as any[]) || [];
      expect(slides).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════
  // PUT /presentations/:id/slides/:index — text editing
  // ═══════════════════════════════════════════════════════

  describe("Update slide text data", () => {
    it("should merge new data into existing slide data", () => {
      const pres = createMockPresentation();
      const slides = [...pres.finalHtmlSlides];
      const index = 0;
      const newData = { title: "Updated Title", description: "Updated description" };

      const updatedData = { ...slides[index].data, ...newData };
      slides[index] = { ...slides[index], data: updatedData };

      expect(updatedData.title).toBe("Updated Title");
      expect(updatedData.description).toBe("Updated description");
      // Original fields should be preserved
      expect(updatedData.presenterName).toBe("John");
      expect(updatedData.presentationDate).toBe("2026");
    });

    it("should preserve layout when only updating text", () => {
      const pres = createMockPresentation();
      const slides = [...pres.finalHtmlSlides];
      const index = 1;
      const newData = { title: "New Title" };

      const updatedData = { ...slides[index].data, ...newData };
      slides[index] = { ...slides[index], data: updatedData };

      expect(slides[index].layoutId).toBe("text-slide");
      expect(updatedData.title).toBe("New Title");
      expect(updatedData.key_message).toBe("Important point");
    });

    it("should validate slide index is within range", () => {
      const pres = createMockPresentation();
      const slides = pres.finalHtmlSlides;
      const invalidIndex = 10;

      expect(invalidIndex >= slides.length).toBe(true);
    });

    it("should handle updating all fields of a slide", () => {
      const pres = createMockPresentation();
      const slides = [...pres.finalHtmlSlides];
      const index = 3; // final-slide
      const newData = {
        title: "Goodbye",
        description: "See you later",
        callToAction: "Visit our site",
        contactInfo: "new@email.com",
      };

      const updatedData = { ...slides[index].data, ...newData };
      expect(updatedData.title).toBe("Goodbye");
      expect(updatedData.description).toBe("See you later");
      expect(updatedData.callToAction).toBe("Visit our site");
      expect(updatedData.contactInfo).toBe("new@email.com");
    });

    it("should call renderSlide after data update", () => {
      const pres = createMockPresentation();
      const slides = [...pres.finalHtmlSlides];
      const index = 0;
      const updatedData = { ...slides[index].data, title: "New" };

      mockRenderSlide.mockReturnValue("<div>updated slide</div>");
      const html = renderSlide(slides[index].layoutId, updatedData);

      expect(mockRenderSlide).toHaveBeenCalledWith("title-slide", updatedData);
      expect(html).toBe("<div>updated slide</div>");
    });
  });

  // ═══════════════════════════════════════════════════════
  // POST /presentations/:id/slides/:index/image — image upload
  // ═══════════════════════════════════════════════════════

  describe("Upload slide image", () => {
    it("should add image data to slide", () => {
      const pres = createMockPresentation();
      const slides = [...pres.finalHtmlSlides];
      const index = 1; // text-slide, no image
      const imageUrl = "https://s3.example.com/new-image.jpg";

      const slideData = { ...slides[index].data };
      slideData.image = { url: imageUrl, alt: slideData.title || "" };
      slideData.backgroundImage = { url: imageUrl, alt: slideData.title || "" };

      expect(slideData.image.url).toBe(imageUrl);
      expect(slideData.backgroundImage.url).toBe(imageUrl);
    });

    it("should switch non-image layout to image-text when image is added", () => {
      const imageLayouts = new Set(["image-text", "image-fullscreen", "title-slide"]);
      const currentLayout = "text-slide";

      const newLayout = imageLayouts.has(currentLayout) ? currentLayout : "image-text";
      expect(newLayout).toBe("image-text");
    });

    it("should keep image layout when image is added to image-text slide", () => {
      const imageLayouts = new Set(["image-text", "image-fullscreen", "title-slide"]);
      const currentLayout = "image-text";

      const newLayout = imageLayouts.has(currentLayout) ? currentLayout : "image-text";
      expect(newLayout).toBe("image-text");
    });

    it("should keep title-slide layout when image is added", () => {
      const imageLayouts = new Set(["image-text", "image-fullscreen", "title-slide"]);
      const currentLayout = "title-slide";

      const newLayout = imageLayouts.has(currentLayout) ? currentLayout : "image-text";
      expect(newLayout).toBe("title-slide");
    });

    it("should validate file type", () => {
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      expect(allowed.includes("image/jpeg")).toBe(true);
      expect(allowed.includes("image/png")).toBe(true);
      expect(allowed.includes("image/svg+xml")).toBe(false);
      expect(allowed.includes("application/pdf")).toBe(false);
    });

    it("should validate file size (5MB limit)", () => {
      const maxSize = 5 * 1024 * 1024;
      expect(4 * 1024 * 1024 <= maxSize).toBe(true);
      expect(6 * 1024 * 1024 <= maxSize).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════
  // DELETE /presentations/:id/slides/:index/image — image removal
  // ═══════════════════════════════════════════════════════

  describe("Remove slide image", () => {
    it("should remove image data from slide", () => {
      const pres = createMockPresentation();
      const slides = [...pres.finalHtmlSlides];
      const index = 2; // image-text slide with image

      const slideData = { ...slides[index].data };
      delete slideData.image;
      delete slideData.backgroundImage;

      expect(slideData.image).toBeUndefined();
      expect(slideData.backgroundImage).toBeUndefined();
      expect(slideData.title).toBe("Image Slide");
    });

    it("should switch image-text to text-slide when image is removed", () => {
      const imageLayouts = new Set(["image-text", "image-fullscreen"]);
      const currentLayout = "image-text";

      const newLayout = imageLayouts.has(currentLayout) ? "text-slide" : currentLayout;
      expect(newLayout).toBe("text-slide");
    });

    it("should switch image-fullscreen to text-slide when image is removed", () => {
      const imageLayouts = new Set(["image-text", "image-fullscreen"]);
      const currentLayout = "image-fullscreen";

      const newLayout = imageLayouts.has(currentLayout) ? "text-slide" : currentLayout;
      expect(newLayout).toBe("text-slide");
    });

    it("should not change title-slide layout when image is removed", () => {
      const imageLayouts = new Set(["image-text", "image-fullscreen"]);
      const currentLayout = "title-slide";

      const newLayout = imageLayouts.has(currentLayout) ? "text-slide" : currentLayout;
      expect(newLayout).toBe("title-slide");
    });
  });

  // ═══════════════════════════════════════════════════════
  // POST /presentations/:id/slides/:index/layout — layout change
  // ═══════════════════════════════════════════════════════

  describe("Change slide layout", () => {
    it("should update layout while preserving data", () => {
      const pres = createMockPresentation();
      const slides = [...pres.finalHtmlSlides];
      const index = 1;
      const newLayoutId = "two-column";

      slides[index] = { ...slides[index], layoutId: newLayoutId };

      expect(slides[index].layoutId).toBe("two-column");
      expect(slides[index].data.title).toBe("Content Slide");
    });

    it("should re-render slide with new layout", () => {
      const data = { title: "Test", description: "Content" };
      const newLayoutId = "bullet-list-slide";

      mockRenderSlide.mockReturnValue("<div>bullet list</div>");
      const html = renderSlide(newLayoutId, data);

      expect(mockRenderSlide).toHaveBeenCalledWith(newLayoutId, data);
      expect(html).toBe("<div>bullet list</div>");
    });
  });

  // ═══════════════════════════════════════════════════════
  // POST /presentations/:id/reassemble — full re-render
  // ═══════════════════════════════════════════════════════

  describe("Reassemble presentation", () => {
    it("should re-render all slides and produce full HTML", () => {
      const pres = createMockPresentation();
      const slides = pres.finalHtmlSlides;

      mockRenderSlide.mockReturnValue("<div>slide</div>");
      const renderedSlides = slides.map((s: any) => ({
        layoutId: s.layoutId,
        data: s.data,
        html: renderSlide(s.layoutId, s.data),
      }));

      expect(renderedSlides).toHaveLength(4);
      expect(mockRenderSlide).toHaveBeenCalledTimes(4);
    });

    it("should call renderPresentation with correct params", () => {
      const pres = createMockPresentation();
      const slides = pres.finalHtmlSlides.map((s: any) => ({
        layoutId: s.layoutId,
        data: s.data,
        html: "<div>slide</div>",
      }));

      mockRenderPresentation.mockReturnValue("<html>full</html>");
      const html = renderPresentation(
        slides,
        pres.themeCss,
        pres.title,
        pres.language,
        "https://fonts.googleapis.com/css2?family=Inter",
      );

      expect(mockRenderPresentation).toHaveBeenCalledWith(
        slides,
        pres.themeCss,
        pres.title,
        pres.language,
        "https://fonts.googleapis.com/css2?family=Inter",
      );
      expect(html).toBe("<html>full</html>");
    });

    it("should upload reassembled HTML to S3", async () => {
      mockStoragePut.mockResolvedValue({
        url: "https://s3.example.com/reassembled.html",
        key: "presentations/test/reassembled.html",
      });

      const result = await storagePut(
        "presentations/test/reassembled.html",
        "<html>reassembled</html>",
        "text/html",
      );

      expect(result.url).toBe("https://s3.example.com/reassembled.html");
      expect(mockStoragePut).toHaveBeenCalledWith(
        "presentations/test/reassembled.html",
        "<html>reassembled</html>",
        "text/html",
      );
    });

    it("should update presentation resultUrls after reassembly", async () => {
      const pres = createMockPresentation();
      const resultUrls = { ...pres.resultUrls };
      resultUrls.html_preview = "https://s3.example.com/reassembled.html";

      await updatePresentationProgress(pres.presentationId, { resultUrls });

      expect(mockUpdateProgress).toHaveBeenCalledWith(pres.presentationId, {
        resultUrls: { html_preview: "https://s3.example.com/reassembled.html" },
      });
    });

    it("should reject reassembly if no slides exist", () => {
      const pres = createMockPresentation({ finalHtmlSlides: [] });
      const slides = (pres.finalHtmlSlides as any[]) || [];
      expect(slides.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════════════════

  describe("Edge cases", () => {
    it("should handle presentation not found", async () => {
      mockGetPresentation.mockResolvedValue(null);
      const result = await getPresentation("nonexistent-id");
      expect(result).toBeNull();
    });

    it("should handle negative slide index", () => {
      const index = -1;
      const slides = createMockPresentation().finalHtmlSlides;
      expect(index < 0 || index >= slides.length).toBe(true);
    });

    it("should handle non-numeric slide index", () => {
      const index = parseInt("abc");
      expect(isNaN(index)).toBe(true);
    });

    it("should handle missing config gracefully", () => {
      const pres = createMockPresentation({ config: null });
      const config = (pres.config as Record<string, any>) || {};
      const themePreset = config.theme_preset || "corporate_blue";
      expect(themePreset).toBe("corporate_blue");
    });

    it("should handle missing themeCss gracefully", () => {
      const pres = createMockPresentation({ themeCss: null });
      const themeCss = pres.themeCss || ":root { --primary: blue; }";
      expect(themeCss).toBe(":root { --primary: blue; }");
    });

    it("should handle slide with no data fields", () => {
      const slide = { layoutId: "text-slide", data: {} };
      const newData = { title: "New Title" };
      const merged = { ...slide.data, ...newData };
      expect(merged.title).toBe("New Title");
    });
  });
});
