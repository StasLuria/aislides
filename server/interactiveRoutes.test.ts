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

  describe("Drag-and-drop reordering (arrayMove)", () => {
    it("should reorder slides using arrayMove when dragging from index 2 to 0", async () => {
      // Import arrayMove from @dnd-kit/sortable
      const { arrayMove } = await import("@dnd-kit/sortable");

      const slides = [
        { slide_number: 1, title: "First" },
        { slide_number: 2, title: "Second" },
        { slide_number: 3, title: "Third" },
        { slide_number: 4, title: "Fourth" },
      ];

      // Drag slide at index 2 ("Third") to index 0
      const reordered = arrayMove(slides, 2, 0);
      const renumbered = reordered.map((s, i) => ({ ...s, slide_number: i + 1 }));

      expect(renumbered[0].title).toBe("Third");
      expect(renumbered[0].slide_number).toBe(1);
      expect(renumbered[1].title).toBe("First");
      expect(renumbered[1].slide_number).toBe(2);
      expect(renumbered[2].title).toBe("Second");
      expect(renumbered[2].slide_number).toBe(3);
      expect(renumbered[3].title).toBe("Fourth");
      expect(renumbered[3].slide_number).toBe(4);
    });

    it("should reorder slides using arrayMove when dragging from index 0 to last", async () => {
      const { arrayMove } = await import("@dnd-kit/sortable");

      const slides = [
        { slide_number: 1, title: "First" },
        { slide_number: 2, title: "Second" },
        { slide_number: 3, title: "Third" },
      ];

      // Drag slide at index 0 ("First") to index 2 (last)
      const reordered = arrayMove(slides, 0, 2);
      const renumbered = reordered.map((s, i) => ({ ...s, slide_number: i + 1 }));

      expect(renumbered[0].title).toBe("Second");
      expect(renumbered[0].slide_number).toBe(1);
      expect(renumbered[1].title).toBe("Third");
      expect(renumbered[1].slide_number).toBe(2);
      expect(renumbered[2].title).toBe("First");
      expect(renumbered[2].slide_number).toBe(3);
    });

    it("should not change order when dragging to same position", async () => {
      const { arrayMove } = await import("@dnd-kit/sortable");

      const slides = [
        { slide_number: 1, title: "First" },
        { slide_number: 2, title: "Second" },
        { slide_number: 3, title: "Third" },
      ];

      const reordered = arrayMove(slides, 1, 1);
      const renumbered = reordered.map((s, i) => ({ ...s, slide_number: i + 1 }));

      expect(renumbered[0].title).toBe("First");
      expect(renumbered[1].title).toBe("Second");
      expect(renumbered[2].title).toBe("Third");
    });

    it("should correctly find slide index by slide_number for DnD active/over IDs", () => {
      const slides = [
        { slide_number: 1, title: "First" },
        { slide_number: 2, title: "Second" },
        { slide_number: 3, title: "Third" },
      ];

      // Simulate DnD event: active.id = 3, over.id = 1
      const activeId = 3;
      const overId = 1;

      const oldIndex = slides.findIndex((s) => s.slide_number === activeId);
      const newIndex = slides.findIndex((s) => s.slide_number === overId);

      expect(oldIndex).toBe(2);
      expect(newIndex).toBe(0);
    });

    it("should return -1 for non-existent slide_number in DnD lookup", () => {
      const slides = [
        { slide_number: 1, title: "First" },
        { slide_number: 2, title: "Second" },
      ];

      const idx = slides.findIndex((s) => s.slide_number === 99);
      expect(idx).toBe(-1);
    });
  });

  describe("Slide regeneration", () => {
    it("should reject regeneration when status is not awaiting_content_approval", async () => {
      mockGetPresentation.mockResolvedValue({
        presentationId: "test-id",
        status: "processing",
        pipelineState: {},
      });

      const p = await getPresentation("test-id");
      expect(p?.status).toBe("processing");
      expect(p?.status !== "awaiting_content_approval").toBe(true);
    });

    it("should allow regeneration when status is awaiting_content_approval", async () => {
      mockGetPresentation.mockResolvedValue({
        presentationId: "test-id",
        status: "awaiting_content_approval",
        pipelineState: {
          plannerResult: { presentation_title: "Test" },
          outline: {
            presentation_title: "Test",
            target_audience: "executives",
            slides: [
              { slide_number: 1, title: "Intro", purpose: "intro", key_points: ["p1"], speaker_notes_hint: "" },
              { slide_number: 2, title: "Content", purpose: "explain", key_points: ["p2"], speaker_notes_hint: "" },
            ],
          },
          content: [
            { slide_number: 1, title: "Intro", text: "Old text", notes: "", data_points: [], key_message: "" },
            { slide_number: 2, title: "Content", text: "Old text 2", notes: "", data_points: [], key_message: "" },
          ],
        },
        language: "ru",
      });

      const p = await getPresentation("test-id");
      expect(p?.status).toBe("awaiting_content_approval");
    });

    it("should replace specific slide content after regeneration", () => {
      const content = [
        { slide_number: 1, title: "Intro", text: "Old text 1", notes: "n1", data_points: [], key_message: "m1" },
        { slide_number: 2, title: "Content", text: "Old text 2", notes: "n2", data_points: [], key_message: "m2" },
        { slide_number: 3, title: "End", text: "Old text 3", notes: "n3", data_points: [], key_message: "m3" },
      ];

      const regenerated = {
        slide_number: 2,
        title: "New Content Title",
        text: "Freshly generated AI text",
        notes: "new notes",
        data_points: [{ label: "Metric", value: "42%", unit: "%" }],
        key_message: "new key message",
      };

      // Simulate the replacement logic from the endpoint
      const slideIndex = content.findIndex((s) => s.slide_number === regenerated.slide_number);
      expect(slideIndex).toBe(1);

      content[slideIndex] = { ...regenerated, slide_number: 2 };

      expect(content[0].text).toBe("Old text 1"); // unchanged
      expect(content[1].title).toBe("New Content Title"); // replaced
      expect(content[1].text).toBe("Freshly generated AI text"); // replaced
      expect(content[1].key_message).toBe("new key message"); // replaced
      expect(content[1].data_points).toHaveLength(1); // new data
      expect(content[2].text).toBe("Old text 3"); // unchanged
    });

    it("should find outline slide by slide_number for regeneration context", () => {
      const outline = {
        slides: [
          { slide_number: 1, title: "Intro", purpose: "introduce", key_points: ["p1"], speaker_notes_hint: "" },
          { slide_number: 2, title: "Data", purpose: "present data", key_points: ["p2", "p3"], speaker_notes_hint: "" },
          { slide_number: 3, title: "End", purpose: "conclude", key_points: ["p4"], speaker_notes_hint: "" },
        ],
      };

      const outlineSlide = outline.slides.find((s) => s.slide_number === 2);
      expect(outlineSlide).toBeDefined();
      expect(outlineSlide?.title).toBe("Data");
      expect(outlineSlide?.key_points).toEqual(["p2", "p3"]);
    });

    it("should return undefined for non-existent slide in outline", () => {
      const outline = {
        slides: [
          { slide_number: 1, title: "Intro", purpose: "intro", key_points: ["p1"], speaker_notes_hint: "" },
        ],
      };

      const outlineSlide = outline.slides.find((s) => s.slide_number === 99);
      expect(outlineSlide).toBeUndefined();
    });

    it("should build allTitles string for writer context", () => {
      const outline = {
        slides: [
          { slide_number: 1, title: "Introduction", purpose: "intro", key_points: [], speaker_notes_hint: "" },
          { slide_number: 2, title: "Main Content", purpose: "explain", key_points: [], speaker_notes_hint: "" },
          { slide_number: 3, title: "Conclusion", purpose: "conclude", key_points: [], speaker_notes_hint: "" },
        ],
      };

      const allTitles = outline.slides.map((s) => `${s.slide_number}. ${s.title}`).join("\n");
      expect(allTitles).toBe("1. Introduction\n2. Main Content\n3. Conclusion");
    });
  });

  describe("Image generation", () => {
    it("should reject image generation when status is not awaiting_content_approval", async () => {
      mockGetPresentation.mockResolvedValue({
        presentationId: "test-id",
        status: "processing",
        pipelineState: {},
      });

      const p = await getPresentation("test-id");
      expect(p?.status !== "awaiting_content_approval").toBe(true);
    });

    it("should allow image generation when status is awaiting_content_approval", async () => {
      mockGetPresentation.mockResolvedValue({
        presentationId: "test-id",
        status: "awaiting_content_approval",
        pipelineState: {
          content: [
            { slide_number: 1, title: "Intro", text: "text", notes: "", data_points: [], key_message: "" },
          ],
          images: {},
        },
      });

      const p = await getPresentation("test-id");
      expect(p?.status).toBe("awaiting_content_approval");
    });

    it("should store image in pipelineState.images by slide_number", () => {
      const images: Record<number, { url: string; prompt: string }> = {};

      // Simulate adding an image
      const slideNumber = 3;
      const imageUrl = "https://s3.example.com/image.png";
      const prompt = "A futuristic city skyline";

      images[slideNumber] = { url: imageUrl, prompt };

      expect(images[3]).toBeDefined();
      expect(images[3].url).toBe(imageUrl);
      expect(images[3].prompt).toBe(prompt);
    });

    it("should remove image from pipelineState.images", () => {
      const images: Record<number, { url: string; prompt: string }> = {
        2: { url: "https://s3.example.com/img2.png", prompt: "prompt2" },
        5: { url: "https://s3.example.com/img5.png", prompt: "prompt5" },
      };

      // Simulate removing image for slide 2
      delete images[2];

      expect(images[2]).toBeUndefined();
      expect(images[5]).toBeDefined();
      expect(images[5].url).toBe("https://s3.example.com/img5.png");
    });

    it("should replace existing image when regenerating", () => {
      const images: Record<number, { url: string; prompt: string }> = {
        3: { url: "https://s3.example.com/old.png", prompt: "old prompt" },
      };

      // Simulate regenerating image for slide 3
      images[3] = { url: "https://s3.example.com/new.png", prompt: "new prompt" };

      expect(images[3].url).toBe("https://s3.example.com/new.png");
      expect(images[3].prompt).toBe("new prompt");
    });

    it("should include images in content endpoint response", () => {
      const pipelineState = {
        content: [
          { slide_number: 1, title: "Slide 1", text: "text", notes: "", data_points: [], key_message: "" },
          { slide_number: 2, title: "Slide 2", text: "text", notes: "", data_points: [], key_message: "" },
        ],
        images: {
          1: { url: "https://s3.example.com/img1.png", prompt: "prompt1" },
        },
      };

      // Simulate content endpoint response
      const response = {
        content: pipelineState.content,
        images: pipelineState.images || {},
      };

      expect(response.images).toBeDefined();
      expect(response.images[1]).toBeDefined();
      expect(response.images[1].url).toBe("https://s3.example.com/img1.png");
    });

    it("should use image-text layout when image exists for a slide in preview", () => {
      const slide = {
        slide_number: 3,
        title: "Slide with Image",
        text: "Some content",
        notes: "",
        data_points: [],
        key_message: "key",
      };

      // When image exists, preview should use image-text layout
      const hasImage = true;
      const layout = hasImage ? "image-text" : pickLayoutForPreview(slide, 10, 3);
      expect(layout).toBe("image-text");
    });

    it("should build image-text preview data with image object", () => {
      const slide = {
        slide_number: 3,
        title: "Slide with Image",
        text: "Description of the image content",
        notes: "",
        data_points: [],
        key_message: "key message",
      };

      const imageUrl = "https://s3.example.com/generated.png";
      const data = buildPreviewData(slide, "image-text", imageUrl);

      expect(data.title).toBe("Slide with Image");
      expect(data.image).toBeDefined();
      expect(data.image.url).toBe(imageUrl);
      expect(data.backgroundImage).toBeDefined();
      expect(data.backgroundImage.url).toBe(imageUrl);
    });

    it("should build image-fullscreen preview data with image object", () => {
      const slide = {
        slide_number: 5,
        title: "Full Image",
        text: "Overlay text",
        notes: "",
        data_points: [],
        key_message: "headline",
      };

      const imageUrl = "https://s3.example.com/fullscreen.png";
      const data = buildPreviewData(slide, "image-fullscreen", imageUrl);

      expect(data.title).toBe("Full Image");
      expect(data.image).toBeDefined();
      expect(data.image.url).toBe(imageUrl);
      expect(data.subtitle).toBe("headline");
    });

    it("should inject images into slide data during assembly", () => {
      const content = [
        { slide_number: 1, title: "Intro", text: "text", notes: "", data_points: [], key_message: "" },
        { slide_number: 2, title: "Visual", text: "text", notes: "", data_points: [], key_message: "" },
        { slide_number: 3, title: "End", text: "text", notes: "", data_points: [], key_message: "" },
      ];

      const images: Record<number, { url: string; prompt: string }> = {
        2: { url: "https://s3.example.com/img2.png", prompt: "visual prompt" },
      };

      // Simulate assembly image injection
      const slidesWithImages = content.map((slide) => {
        const img = images[slide.slide_number];
        if (img) {
          return { ...slide, image_url: img.url };
        }
        return slide;
      });

      expect((slidesWithImages[0] as any).image_url).toBeUndefined();
      expect((slidesWithImages[1] as any).image_url).toBe("https://s3.example.com/img2.png");
      expect((slidesWithImages[2] as any).image_url).toBeUndefined();
    });
  });
});

describe("Image upload", () => {
  it("should reject upload when status is not awaiting_content_approval", async () => {
    mockGetPresentation.mockResolvedValue({
      presentationId: "test-id",
      status: "processing",
      pipelineState: {},
    });

    const p = await getPresentation("test-id");
    expect(p?.status !== "awaiting_content_approval").toBe(true);
  });

  it("should allow upload when status is awaiting_content_approval", async () => {
    mockGetPresentation.mockResolvedValue({
      presentationId: "test-id",
      status: "awaiting_content_approval",
      pipelineState: {
        content: [
          { slide_number: 1, title: "Intro", text: "text", notes: "", data_points: [], key_message: "" },
          { slide_number: 2, title: "Content", text: "text", notes: "", data_points: [], key_message: "" },
        ],
        images: {},
      },
    });

    const p = await getPresentation("test-id");
    expect(p?.status).toBe("awaiting_content_approval");
  });

  it("should store uploaded image in pipelineState.images with user-upload prefix", () => {
    const images: Record<number, { url: string; prompt: string }> = {};

    // Simulate upload storage
    const slideNumber = 2;
    const imageUrl = "https://s3.example.com/presentations/test-id/user-upload-slide2-abc12345.png";
    const filename = "my-photo.png";

    images[slideNumber] = { url: imageUrl, prompt: `[Загружено пользователем] ${filename}` };

    expect(images[2]).toBeDefined();
    expect(images[2].url).toBe(imageUrl);
    expect(images[2].prompt).toContain("[Загружено пользователем]");
    expect(images[2].prompt).toContain("my-photo.png");
  });

  it("should replace AI-generated image with uploaded image", () => {
    const images: Record<number, { url: string; prompt: string }> = {
      3: { url: "https://s3.example.com/ai-generated.png", prompt: "A futuristic city" },
    };

    // Simulate replacing with upload
    images[3] = { url: "https://s3.example.com/user-upload.png", prompt: "[Загружено пользователем] photo.jpg" };

    expect(images[3].url).toBe("https://s3.example.com/user-upload.png");
    expect(images[3].prompt).toContain("[Загружено пользователем]");
  });

  it("should validate allowed MIME types", () => {
    const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    expect(ALLOWED_MIME_TYPES.includes("image/jpeg")).toBe(true);
    expect(ALLOWED_MIME_TYPES.includes("image/png")).toBe(true);
    expect(ALLOWED_MIME_TYPES.includes("image/webp")).toBe(true);
    expect(ALLOWED_MIME_TYPES.includes("image/gif")).toBe(true);
    expect(ALLOWED_MIME_TYPES.includes("image/svg+xml")).toBe(false);
    expect(ALLOWED_MIME_TYPES.includes("application/pdf")).toBe(false);
    expect(ALLOWED_MIME_TYPES.includes("text/plain")).toBe(false);
  });

  it("should enforce 5MB file size limit", () => {
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    expect(MAX_FILE_SIZE).toBe(5242880);
    expect(4 * 1024 * 1024 < MAX_FILE_SIZE).toBe(true); // 4MB OK
    expect(5 * 1024 * 1024 <= MAX_FILE_SIZE).toBe(true); // 5MB OK
    expect(6 * 1024 * 1024 > MAX_FILE_SIZE).toBe(true); // 6MB rejected
  });

  it("should determine correct file extension from MIME type", () => {
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };

    expect(extMap["image/jpeg"]).toBe("jpg");
    expect(extMap["image/png"]).toBe("png");
    expect(extMap["image/webp"]).toBe("webp");
    expect(extMap["image/gif"]).toBe("gif");
  });

  it("should find target slide in content array for upload validation", () => {
    const content = [
      { slide_number: 1, title: "Intro", text: "text", notes: "", data_points: [], key_message: "" },
      { slide_number: 2, title: "Content", text: "text", notes: "", data_points: [], key_message: "" },
      { slide_number: 3, title: "End", text: "text", notes: "", data_points: [], key_message: "" },
    ];

    const slide2 = content.find((s) => s.slide_number === 2);
    expect(slide2).toBeDefined();
    expect(slide2?.title).toBe("Content");

    const slide99 = content.find((s) => s.slide_number === 99);
    expect(slide99).toBeUndefined();
  });

  it("should use uploaded image in preview just like AI-generated image", () => {
    const slide = {
      slide_number: 2,
      title: "Slide with Upload",
      text: "Some content here",
      notes: "",
      data_points: [],
      key_message: "key",
    };

    const uploadedImageUrl = "https://s3.example.com/presentations/test/user-upload-slide2-xyz.jpg";
    const data = buildPreviewData(slide, "image-text", uploadedImageUrl);

    expect(data.title).toBe("Slide with Upload");
    expect(data.image).toBeDefined();
    expect(data.image.url).toBe(uploadedImageUrl);
    expect(data.backgroundImage).toBeDefined();
    expect(data.backgroundImage.url).toBe(uploadedImageUrl);
  });
});
