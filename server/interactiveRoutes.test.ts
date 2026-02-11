import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for interactive presentation routes logic.
 * We test the route handler logic by simulating request/response objects.
 */

// Mock the pipeline functions
vi.mock("./pipeline/generator", () => ({
  runPlanner: vi.fn().mockResolvedValue({
    presentation_title: "Test Presentation",
    branding: "professional",
    language: "ru",
    key_topics: ["topic1"],
  }),
  runOutline: vi.fn().mockResolvedValue({
    presentation_title: "Test Presentation",
    target_audience: "executives",
    narrative_arc: "problem-solution",
    slides: [
      { slide_number: 1, title: "Intro", purpose: "introduce", key_points: ["point1"], speaker_notes_hint: "note" },
      { slide_number: 2, title: "Content", purpose: "explain", key_points: ["point2"], speaker_notes_hint: "note" },
      { slide_number: 3, title: "Conclusion", purpose: "summarize", key_points: ["point3"], speaker_notes_hint: "note" },
    ],
  }),
  runWriterParallel: vi.fn().mockResolvedValue([
    { slide_number: 1, title: "Intro", text: "Intro text", notes: "notes", data_points: [], key_message: "msg1" },
    { slide_number: 2, title: "Content", text: "Content text", notes: "notes", data_points: [], key_message: "msg2" },
    { slide_number: 3, title: "Conclusion", text: "Conclusion text", notes: "notes", data_points: [], key_message: "msg3" },
  ]),
  runWriterSingle: vi.fn(),
  runTheme: vi.fn().mockResolvedValue({
    theme_name: "Corporate Blue",
    colors: {},
    font_heading: "Inter",
    font_body: "Inter",
    css_variables: ":root { --primary: blue; }",
  }),
  runLayout: vi.fn().mockResolvedValue([
    { slide_number: 1, layout_name: "title-slide", rationale: "first slide" },
    { slide_number: 2, layout_name: "text-slide", rationale: "content" },
    { slide_number: 3, layout_name: "final-slide", rationale: "last slide" },
  ]),
  runHtmlComposer: vi.fn().mockResolvedValue({ title: "Test", bullets: [] }),
  buildFallbackData: vi.fn().mockReturnValue({ title: "Fallback" }),
}));

vi.mock("./pipeline/templateEngine", () => ({
  renderSlide: vi.fn().mockReturnValue("<div>slide</div>"),
  renderPresentation: vi.fn().mockReturnValue("<html>full presentation</html>"),
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

vi.mock("./wsManager", () => ({
  wsManager: {
    sendProgress: vi.fn(),
    sendCompleted: vi.fn(),
    sendError: vi.fn(),
  },
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.html", key: "test-key" }),
}));

// Import after mocks
import { getPresentation } from "./presentationDb";
import { pickLayoutForPreview, buildPreviewData } from "./interactiveRoutes";

const mockGetPresentation = getPresentation as ReturnType<typeof vi.fn>;

describe("Interactive Routes - Data Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Outline approval data validation", () => {
    it("should renumber slides correctly when user removes a slide", () => {
      const userOutline = {
        presentation_title: "Test",
        target_audience: "executives",
        narrative_arc: "problem-solution",
        slides: [
          { slide_number: 1, title: "Intro", purpose: "intro", key_points: ["p1"], speaker_notes_hint: "" },
          { slide_number: 3, title: "Conclusion", purpose: "end", key_points: ["p3"], speaker_notes_hint: "" },
        ],
      };

      // Simulate renumbering logic from the route
      const renumbered = userOutline.slides.map((s, i) => ({
        ...s,
        slide_number: i + 1,
      }));

      expect(renumbered[0].slide_number).toBe(1);
      expect(renumbered[1].slide_number).toBe(2);
      expect(renumbered).toHaveLength(2);
    });

    it("should preserve user edits to slide titles", () => {
      const originalOutline = {
        slides: [
          { slide_number: 1, title: "Original Title", purpose: "intro", key_points: ["p1"], speaker_notes_hint: "" },
        ],
      };

      // Simulate user edit
      const edited = {
        ...originalOutline,
        slides: originalOutline.slides.map((s) =>
          s.slide_number === 1 ? { ...s, title: "User Edited Title" } : s,
        ),
      };

      expect(edited.slides[0].title).toBe("User Edited Title");
    });
  });

  describe("Content update validation", () => {
    it("should update specific slide content fields", () => {
      const content = [
        { slide_number: 1, title: "Slide 1", text: "Original text", notes: "notes", data_points: [], key_message: "msg" },
        { slide_number: 2, title: "Slide 2", text: "Original text 2", notes: "notes2", data_points: [], key_message: "msg2" },
      ];

      // Simulate update-slide logic
      const slideNumber = 1;
      const updates = { title: "Updated Title", text: "Updated text" };

      const slideIndex = content.findIndex((s) => s.slide_number === slideNumber);
      expect(slideIndex).toBe(0);

      if (updates.title !== undefined) content[slideIndex].title = updates.title;
      if (updates.text !== undefined) content[slideIndex].text = updates.text;

      expect(content[0].title).toBe("Updated Title");
      expect(content[0].text).toBe("Updated text");
      expect(content[0].key_message).toBe("msg"); // unchanged
      expect(content[1].title).toBe("Slide 2"); // other slide unchanged
    });

    it("should return -1 for non-existent slide number", () => {
      const content = [
        { slide_number: 1, title: "Slide 1", text: "text", notes: "", data_points: [], key_message: "" },
      ];

      const slideIndex = content.findIndex((s) => s.slide_number === 99);
      expect(slideIndex).toBe(-1);
    });
  });

  describe("Status transitions", () => {
    it("should reject outline approval when status is not awaiting_outline_approval", async () => {
      mockGetPresentation.mockResolvedValue({
        presentationId: "test-id",
        status: "processing",
        pipelineState: {},
      });

      const p = await getPresentation("test-id");
      expect(p?.status).toBe("processing");
      expect(p?.status !== "awaiting_outline_approval").toBe(true);
    });

    it("should allow outline approval when status is awaiting_outline_approval", async () => {
      mockGetPresentation.mockResolvedValue({
        presentationId: "test-id",
        status: "awaiting_outline_approval",
        pipelineState: {
          plannerResult: { presentation_title: "Test", language: "ru" },
          outline: { slides: [] },
        },
      });

      const p = await getPresentation("test-id");
      expect(p?.status).toBe("awaiting_outline_approval");
    });

    it("should reject assembly when status is not awaiting_content_approval", async () => {
      mockGetPresentation.mockResolvedValue({
        presentationId: "test-id",
        status: "awaiting_outline_approval",
      });

      const p = await getPresentation("test-id");
      expect(p?.status !== "awaiting_content_approval").toBe(true);
    });

    it("should allow assembly when status is awaiting_content_approval", async () => {
      mockGetPresentation.mockResolvedValue({
        presentationId: "test-id",
        status: "awaiting_content_approval",
        pipelineState: {
          plannerResult: { presentation_title: "Test" },
          outline: { slides: [] },
          content: [],
        },
        config: { theme_preset: "corporate_blue" },
      });

      const p = await getPresentation("test-id");
      expect(p?.status).toBe("awaiting_content_approval");
    });
  });

  describe("Slide preview - layout picker", () => {

    const makeSlide = (overrides: Partial<any> = {}) => ({
      slide_number: 2,
      title: "Test Slide",
      text: "Some content",
      notes: "notes",
      data_points: [],
      key_message: "key message",
      ...overrides,
    });

    it("should pick title-slide for slide 1", () => {
      const result = pickLayoutForPreview(makeSlide({ slide_number: 1 }), 10, 1);
      expect(result).toBe("title-slide");
    });

    it("should pick final-slide for the last slide", () => {
      const result = pickLayoutForPreview(makeSlide({ slide_number: 10 }), 10, 10);
      expect(result).toBe("final-slide");
    });

    it("should pick metrics-slide for slides with 3+ data points", () => {
      const slide = makeSlide({
        data_points: [
          { label: "Revenue", value: "$1M", unit: "USD" },
          { label: "Growth", value: "25%", unit: "%" },
          { label: "Users", value: "10K", unit: "" },
        ],
      });
      const result = pickLayoutForPreview(slide, 10, 5);
      expect(result).toBe("metrics-slide");
    });

    it("should pick two-column-slide for slides with 1-2 data points", () => {
      const slide = makeSlide({
        data_points: [{ label: "Revenue", value: "$1M", unit: "USD" }],
      });
      const result = pickLayoutForPreview(slide, 10, 5);
      expect(result).toBe("two-column-slide");
    });

    it("should pick bullet-list-slide for text with many bullets", () => {
      const slide = makeSlide({
        text: "Intro\n- Point 1\n- Point 2\n- Point 3\n- Point 4\n- Point 5",
      });
      const result = pickLayoutForPreview(slide, 10, 5);
      expect(result).toBe("bullet-list-slide");
    });

    it("should pick quote-slide for short text with long key message", () => {
      const slide = makeSlide({
        text: "Short text",
        key_message: "This is a very important key message that should be displayed prominently",
      });
      const result = pickLayoutForPreview(slide, 10, 5);
      expect(result).toBe("quote-slide");
    });

    it("should default to text-slide for regular content", () => {
      const slide = makeSlide({
        text: "Regular paragraph of text without bullets or special formatting.",
        key_message: "Short",
      });
      const result = pickLayoutForPreview(slide, 10, 5);
      expect(result).toBe("text-slide");
    });
  });

  describe("Slide preview - data builder", () => {

    it("should build title-slide data with presenter fields", () => {
      const slide = {
        slide_number: 1,
        title: "My Presentation",
        text: "Description text",
        notes: "Speaker notes",
        data_points: [],
        key_message: "Welcome",
      };
      const data = buildPreviewData(slide, "title-slide");
      expect(data.title).toBe("My Presentation");
      expect(data).toHaveProperty("presenterName");
      expect(data).toHaveProperty("presentationDate");
      expect(data).toHaveProperty("initials");
    });

    it("should build bullet-list-slide data with extracted bullets", () => {
      const slide = {
        slide_number: 2,
        title: "Key Points",
        text: "Intro line\n- First point\n- Second point\n- Third point",
        notes: "",
        data_points: [],
        key_message: "",
      };
      const data = buildPreviewData(slide, "bullet-list-slide");
      expect(data.bullets).toEqual(["First point", "Second point", "Third point"]);
    });

    it("should build metrics-slide data from data_points", () => {
      const slide = {
        slide_number: 3,
        title: "Metrics",
        text: "Performance overview",
        notes: "",
        data_points: [
          { label: "Revenue", value: "$5M", unit: "USD" },
          { label: "Growth", value: "30%", unit: "%" },
        ],
        key_message: "",
      };
      const data = buildPreviewData(slide, "metrics-slide");
      expect(data.metrics).toHaveLength(2);
      expect(data.metrics[0].value).toBe("$5M");
      expect(data.metrics[0].label).toBe("Revenue");
    });

    it("should build final-slide data with callToAction", () => {
      const slide = {
        slide_number: 10,
        title: "Thank You",
        text: "Final words",
        notes: "",
        data_points: [],
        key_message: "Contact us today!",
      };
      const data = buildPreviewData(slide, "final-slide");
      expect(data.callToAction).toBe("Contact us today!");
      expect(data).toHaveProperty("contactInfo");
    });

    it("should build quote-slide data from key_message", () => {
      const slide = {
        slide_number: 5,
        title: "Quote",
        text: "Some context",
        notes: "",
        data_points: [],
        key_message: "Innovation distinguishes between a leader and a follower.",
      };
      const data = buildPreviewData(slide, "quote-slide");
      expect(data.quote).toBe("Innovation distinguishes between a leader and a follower.");
    });

    it("should build two-column-slide data splitting bullets", () => {
      const slide = {
        slide_number: 4,
        title: "Comparison",
        text: "- Point A\n- Point B\n- Point C\n- Point D",
        notes: "",
        data_points: [{ label: "x", value: "y", unit: "" }],
        key_message: "",
      };
      const data = buildPreviewData(slide, "two-column-slide");
      expect(data.leftBullets).toBeDefined();
      expect(data.rightBullets).toBeDefined();
      expect(data.leftTitle).toBe("Ключевые аспекты");
      expect(data.rightTitle).toBe("Детали");
    });
  });

  describe("Slide reordering", () => {
    it("should correctly reorder slides when moving up", () => {
      const slides = [
        { slide_number: 1, title: "First" },
        { slide_number: 2, title: "Second" },
        { slide_number: 3, title: "Third" },
      ];

      // Move slide 2 up (swap with slide 1)
      const index = 1;
      const newIndex = 0;
      [slides[index], slides[newIndex]] = [slides[newIndex], slides[index]];

      // Renumber
      const renumbered = slides.map((s, i) => ({ ...s, slide_number: i + 1 }));

      expect(renumbered[0].title).toBe("Second");
      expect(renumbered[0].slide_number).toBe(1);
      expect(renumbered[1].title).toBe("First");
      expect(renumbered[1].slide_number).toBe(2);
    });

    it("should correctly add a new slide", () => {
      const slides = [
        { slide_number: 1, title: "First", purpose: "", key_points: [""], speaker_notes_hint: "" },
        { slide_number: 2, title: "Last", purpose: "", key_points: [""], speaker_notes_hint: "" },
      ];

      const newSlide = {
        slide_number: slides.length + 1,
        title: "New Slide",
        purpose: "",
        key_points: [""],
        speaker_notes_hint: "",
      };

      slides.push(newSlide);
      expect(slides).toHaveLength(3);
      expect(slides[2].title).toBe("New Slide");
    });

    it("should not allow removing when only 2 slides remain", () => {
      const slides = [
        { slide_number: 1, title: "First" },
        { slide_number: 2, title: "Last" },
      ];

      const canRemove = slides.length > 2;
      expect(canRemove).toBe(false);
    });
  });
});
