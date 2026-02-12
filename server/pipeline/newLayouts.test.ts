import { describe, it, expect } from "vitest";
import { renderSlide, listLayouts, getLayoutTemplate } from "./templateEngine";

describe("New Layout Templates — Sprint 3", () => {
  // ═══════════════════════════════════════════════════════
  // Registration & Availability
  // ═══════════════════════════════════════════════════════
  describe("Layout Registration", () => {
    const newLayouts = [
      "waterfall-chart",
      "swot-analysis",
      "funnel",
      "roadmap",
      "pyramid",
      "matrix-2x2",
      "pros-cons",
      "checklist",
      "highlight-stats",
    ];

    it("should have all 9 new layouts registered", () => {
      const allLayouts = listLayouts();
      for (const layout of newLayouts) {
        expect(allLayouts).toContain(layout);
      }
    });

    it("should have at least 24 total layouts", () => {
      const allLayouts = listLayouts();
      expect(allLayouts.length).toBeGreaterThanOrEqual(24);
    });

    it("should have non-empty templates for all new layouts", () => {
      for (const layout of newLayouts) {
        const template = getLayoutTemplate(layout);
        expect(template.length).toBeGreaterThan(100);
      }
    });
  });

  // ═══════════════════════════════════════════════════════
  // Waterfall Chart
  // ═══════════════════════════════════════════════════════
  describe("waterfall-chart", () => {
    it("should render with bars data", () => {
      const html = renderSlide("waterfall-chart", {
        title: "Revenue Breakdown",
        description: "Q4 2025 Analysis",
        bars: [
          { label: "Base", value: "$10M", height: 60, color: "#3b82f6" },
          { label: "New Sales", value: "+$3M", height: 80, color: "#22c55e", change: "+30%" },
          { label: "Churn", value: "-$1M", height: 40, color: "#ef4444", change: "-10%" },
          { label: "Upsell", value: "+$2M", height: 70, color: "#22c55e", change: "+20%" },
          { label: "Total", value: "$14M", height: 100, color: "#9333ea" },
        ],
      });
      expect(html).toContain("Revenue Breakdown");
      expect(html).toContain("Q4 2025 Analysis");
      expect(html).toContain("$10M");
      expect(html).toContain("+$3M");
      expect(html).toContain("+30%");
      expect(html).toContain("Base");
      expect(html).toContain("Total");
    });

    it("should render with minimal data", () => {
      const html = renderSlide("waterfall-chart", {
        title: "Cost Analysis",
        bars: [
          { label: "Start", value: "100", height: 50 },
          { label: "End", value: "150", height: 75 },
        ],
      });
      expect(html).toContain("Cost Analysis");
      expect(html).toContain("Start");
      expect(html).toContain("End");
    });
  });

  // ═══════════════════════════════════════════════════════
  // SWOT Analysis
  // ═══════════════════════════════════════════════════════
  describe("swot-analysis", () => {
    it("should render all four quadrants", () => {
      const html = renderSlide("swot-analysis", {
        title: "Strategic SWOT Analysis",
        strengths: {
          title: "Strengths",
          items: ["Strong brand", "Large team", "Market leader"],
        },
        weaknesses: {
          title: "Weaknesses",
          items: ["High costs", "Legacy tech"],
        },
        opportunities: {
          title: "Opportunities",
          items: ["New markets", "AI adoption", "Partnerships"],
        },
        threats: {
          title: "Threats",
          items: ["Competition", "Regulation"],
        },
      });
      expect(html).toContain("Strategic SWOT Analysis");
      expect(html).toContain("Strengths");
      expect(html).toContain("Weaknesses");
      expect(html).toContain("Opportunities");
      expect(html).toContain("Threats");
      expect(html).toContain("Strong brand");
      expect(html).toContain("High costs");
      expect(html).toContain("New markets");
      expect(html).toContain("Competition");
    });

    it("should use correct color coding", () => {
      const html = renderSlide("swot-analysis", {
        title: "SWOT",
        strengths: { title: "S", items: ["a"] },
        weaknesses: { title: "W", items: ["b"] },
        opportunities: { title: "O", items: ["c"] },
        threats: { title: "T", items: ["d"] },
      });
      expect(html).toContain("#22c55e"); // green for strengths
      expect(html).toContain("#ef4444"); // red for weaknesses
      expect(html).toContain("#3b82f6"); // blue for opportunities
      expect(html).toContain("#f59e0b"); // amber for threats
    });
  });

  // ═══════════════════════════════════════════════════════
  // Funnel
  // ═══════════════════════════════════════════════════════
  describe("funnel", () => {
    it("should render funnel stages", () => {
      const html = renderSlide("funnel", {
        title: "Sales Funnel",
        stages: [
          { title: "Awareness", value: "10,000", color: "#3b82f6", conversion: "100%" },
          { title: "Interest", value: "5,000", color: "#6366f1", conversion: "50%" },
          { title: "Decision", value: "1,000", color: "#8b5cf6", conversion: "20%" },
          { title: "Action", value: "500", color: "#9333ea", conversion: "10%" },
        ],
      });
      expect(html).toContain("Sales Funnel");
      expect(html).toContain("Awareness");
      expect(html).toContain("10,000");
      expect(html).toContain("50%");
      expect(html).toContain("Action");
    });

    it("should render stages with descriptions", () => {
      const html = renderSlide("funnel", {
        title: "User Journey",
        stages: [
          { title: "Visit", value: "50K", description: "Monthly visitors", color: "#3b82f6" },
          { title: "Sign Up", value: "5K", description: "Free trial users", color: "#9333ea" },
        ],
      });
      expect(html).toContain("Monthly visitors");
      expect(html).toContain("Free trial users");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Roadmap
  // ═══════════════════════════════════════════════════════
  describe("roadmap", () => {
    it("should render milestones", () => {
      const html = renderSlide("roadmap", {
        title: "Product Roadmap 2026",
        description: "Key milestones",
        milestones: [
          { date: "Q1 2026", title: "Beta Launch", description: "Initial release", color: "#3b82f6" },
          { date: "Q2 2026", title: "GA Release", description: "Full launch", color: "#22c55e" },
          { date: "Q3 2026", title: "Enterprise", description: "Enterprise features", color: "#9333ea" },
          { date: "Q4 2026", title: "Global", description: "International expansion", color: "#f59e0b" },
        ],
      });
      expect(html).toContain("Product Roadmap 2026");
      expect(html).toContain("Q1 2026");
      expect(html).toContain("Beta Launch");
      expect(html).toContain("GA Release");
      expect(html).toContain("Global");
    });

    it("should render without description", () => {
      const html = renderSlide("roadmap", {
        title: "Timeline",
        milestones: [
          { date: "Jan", title: "Start" },
          { date: "Jun", title: "Mid" },
          { date: "Dec", title: "End" },
        ],
      });
      expect(html).toContain("Timeline");
      expect(html).toContain("Jan");
      expect(html).toContain("Start");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Pyramid
  // ═══════════════════════════════════════════════════════
  describe("pyramid", () => {
    it("should render pyramid levels", () => {
      const html = renderSlide("pyramid", {
        title: "Maslow's Hierarchy",
        levels: [
          { title: "Self-Actualization", description: "Reaching full potential", color: "#9333ea" },
          { title: "Esteem", description: "Confidence and achievement", color: "#6366f1" },
          { title: "Love/Belonging", description: "Relationships and community", color: "#3b82f6" },
          { title: "Safety", description: "Security and stability", color: "#22c55e" },
          { title: "Physiological", description: "Basic survival needs", color: "#f59e0b" },
        ],
      });
      // Title is rendered via template, apostrophe may be escaped or not
      expect(html).toContain("Maslow");
      expect(html).toContain("Hierarchy");
      expect(html).toContain("Self-Actualization");
      expect(html).toContain("Physiological");
      expect(html).toContain("Reaching full potential");
    });

    it("should render with minimal levels", () => {
      const html = renderSlide("pyramid", {
        title: "Priority Framework",
        levels: [
          { title: "Critical", color: "#ef4444" },
          { title: "Important", color: "#f59e0b" },
          { title: "Nice to Have", color: "#22c55e" },
        ],
      });
      expect(html).toContain("Critical");
      expect(html).toContain("Nice to Have");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Matrix 2x2
  // ═══════════════════════════════════════════════════════
  describe("matrix-2x2", () => {
    it("should render 4 quadrants with axes", () => {
      const html = renderSlide("matrix-2x2", {
        title: "Effort-Impact Matrix",
        axisX: "EFFORT →",
        axisY: "IMPACT →",
        quadrants: [
          { title: "Quick Wins", description: "High impact, low effort", items: ["Automate reports", "Fix UX bugs"] },
          { title: "Major Projects", description: "High impact, high effort", items: ["Platform rebuild"] },
          { title: "Fill-Ins", description: "Low impact, low effort", items: ["Update docs"] },
          { title: "Thankless Tasks", description: "Low impact, high effort", items: ["Legacy migration"] },
        ],
      });
      expect(html).toContain("Effort-Impact Matrix");
      expect(html).toContain("EFFORT →");
      expect(html).toContain("IMPACT →");
      expect(html).toContain("Quick Wins");
      expect(html).toContain("Thankless Tasks");
      expect(html).toContain("Automate reports");
    });

    it("should render without axes", () => {
      const html = renderSlide("matrix-2x2", {
        title: "Decision Matrix",
        quadrants: [
          { title: "Q1" },
          { title: "Q2" },
          { title: "Q3" },
          { title: "Q4" },
        ],
      });
      expect(html).toContain("Decision Matrix");
      expect(html).toContain("Q1");
      expect(html).toContain("Q4");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Pros-Cons
  // ═══════════════════════════════════════════════════════
  describe("pros-cons", () => {
    it("should render pros and cons columns", () => {
      const html = renderSlide("pros-cons", {
        title: "Cloud vs On-Premise",
        pros: {
          title: "Cloud Advantages",
          items: ["Scalability", "Lower upfront cost", "Automatic updates", "Global access"],
        },
        cons: {
          title: "Cloud Risks",
          items: ["Data sovereignty", "Vendor lock-in", "Recurring costs", "Internet dependency"],
        },
      });
      expect(html).toContain("Cloud vs On-Premise");
      expect(html).toContain("Cloud Advantages");
      expect(html).toContain("Cloud Risks");
      expect(html).toContain("Scalability");
      expect(html).toContain("Vendor lock-in");
    });

    it("should have green and red visual indicators", () => {
      const html = renderSlide("pros-cons", {
        title: "Test",
        pros: { title: "Pros", items: ["Good"] },
        cons: { title: "Cons", items: ["Bad"] },
      });
      expect(html).toContain("#22c55e"); // green for pros
      expect(html).toContain("#ef4444"); // red for cons
    });
  });

  // ═══════════════════════════════════════════════════════
  // Checklist
  // ═══════════════════════════════════════════════════════
  describe("checklist", () => {
    it("should render checklist items with done/pending states", () => {
      const html = renderSlide("checklist", {
        title: "Launch Readiness",
        description: "Pre-launch checklist",
        items: [
          { title: "Security audit", description: "Penetration testing complete", done: true },
          { title: "Load testing", description: "10K concurrent users", done: true },
          { title: "Documentation", description: "API docs and guides", done: false, status: "In Progress" },
          { title: "Marketing", description: "Press release ready", done: false, status: "Pending" },
        ],
      });
      expect(html).toContain("Launch Readiness");
      expect(html).toContain("Pre-launch checklist");
      expect(html).toContain("Security audit");
      expect(html).toContain("In Progress");
      expect(html).toContain("Pending");
    });

    it("should render done items with line-through", () => {
      const html = renderSlide("checklist", {
        title: "Tasks",
        items: [
          { title: "Done task", done: true },
          { title: "Pending task", done: false },
        ],
      });
      expect(html).toContain("line-through");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Highlight Stats
  // ═══════════════════════════════════════════════════════
  describe("highlight-stats", () => {
    it("should render hero stat and supporting stats", () => {
      const html = renderSlide("highlight-stats", {
        title: "Key Achievement",
        mainStat: {
          value: "47%",
          label: "Revenue Growth",
          description: "Year-over-year increase in total revenue",
        },
        supportingStats: [
          { value: "2.3M", label: "New Users", description: "Acquired in Q4" },
          { value: "99.9%", label: "Uptime", description: "Service reliability" },
          { value: "4.8/5", label: "NPS Score", description: "Customer satisfaction" },
        ],
      });
      expect(html).toContain("Key Achievement");
      expect(html).toContain("47%");
      expect(html).toContain("Revenue Growth");
      expect(html).toContain("Year-over-year increase");
      expect(html).toContain("2.3M");
      expect(html).toContain("99.9%");
      expect(html).toContain("4.8/5");
    });

    it("should render without descriptions", () => {
      const html = renderSlide("highlight-stats", {
        title: "Stats",
        mainStat: { value: "100K", label: "Users" },
        supportingStats: [
          { value: "50%", label: "Growth" },
        ],
      });
      expect(html).toContain("100K");
      expect(html).toContain("Users");
      expect(html).toContain("50%");
    });
  });

  // ═══════════════════════════════════════════════════════
  // Footer integration with new layouts
  // ═══════════════════════════════════════════════════════
  describe("Footer integration", () => {
    it("should add footer to new layouts", () => {
      const newLayouts = [
        "waterfall-chart",
        "swot-analysis",
        "funnel",
        "roadmap",
        "pyramid",
        "matrix-2x2",
        "pros-cons",
        "checklist",
        "highlight-stats",
      ];

      for (const layout of newLayouts) {
        const html = renderSlide(layout, {
          title: "Test",
          _slideNumber: 3,
          _totalSlides: 10,
          _presentationTitle: "Test Presentation",
          // Provide minimal data for each layout
          bars: [{ label: "A", value: "1", height: 50 }],
          strengths: { title: "S", items: [] },
          weaknesses: { title: "W", items: [] },
          opportunities: { title: "O", items: [] },
          threats: { title: "T", items: [] },
          stages: [{ title: "A", value: "1", color: "#333" }],
          milestones: [{ date: "Q1", title: "M1" }],
          levels: [{ title: "L1", color: "#333" }],
          quadrants: [{ title: "Q1" }, { title: "Q2" }, { title: "Q3" }, { title: "Q4" }],
          pros: { title: "P", items: [] },
          cons: { title: "C", items: [] },
          items: [{ title: "I1", done: false }],
          mainStat: { value: "1", label: "L" },
          supportingStats: [],
        });
        expect(html).toContain("slide-footer");
        expect(html).toContain("3 / 10");
        expect(html).toContain("Test Presentation");
      }
    });
  });

  // ═══════════════════════════════════════════════════════
  // Markdown support in new layouts
  // ═══════════════════════════════════════════════════════
  describe("Markdown support in new layouts", () => {
    it("should render bold text in SWOT items", () => {
      const html = renderSlide("swot-analysis", {
        title: "SWOT",
        strengths: { title: "S", items: ["**Strong** brand recognition"] },
        weaknesses: { title: "W", items: [] },
        opportunities: { title: "O", items: [] },
        threats: { title: "T", items: [] },
      });
      expect(html).toContain("<strong>Strong</strong>");
    });

    it("should render bold text in pros-cons items", () => {
      const html = renderSlide("pros-cons", {
        title: "Analysis",
        pros: { title: "Pros", items: ["**Fast** deployment"] },
        cons: { title: "Cons", items: ["*Complex* setup"] },
      });
      expect(html).toContain("<strong>Fast</strong>");
      expect(html).toContain("<em>Complex</em>");
    });

    it("should render bold text in funnel descriptions", () => {
      const html = renderSlide("funnel", {
        title: "Funnel",
        stages: [{ title: "Stage", value: "100", description: "**Critical** step", color: "#333" }],
      });
      expect(html).toContain("<strong>Critical</strong>");
    });
  });
});
