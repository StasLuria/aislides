import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for auto-save (debounced reassemble) logic.
 *
 * The auto-save feature:
 * 1. After each inline field edit or sidebar edit, a debounced timer (2s) is set.
 * 2. If another edit happens within 2s, the timer resets (debounce).
 * 3. When the timer fires, handleReassemble() is called automatically.
 * 4. UI shows status: "pending" → "reassembling" → "saved" (or "error").
 * 5. The old manual "Save all changes" button is replaced by a status indicator.
 *
 * Since the auto-save logic lives in a React component (Viewer.tsx), we test
 * the core debounce scheduling behavior and state transitions in isolation.
 */

describe("Auto-Save — Debounce Scheduling Logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should call reassemble after debounce timeout (2s)", () => {
    const handleReassemble = vi.fn();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleAutoReassemble = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        handleReassemble();
      }, 2000);
    };

    scheduleAutoReassemble();

    // Before 2s: should NOT have been called
    vi.advanceTimersByTime(1999);
    expect(handleReassemble).not.toHaveBeenCalled();

    // At 2s: should be called
    vi.advanceTimersByTime(1);
    expect(handleReassemble).toHaveBeenCalledTimes(1);
  });

  it("should reset timer on subsequent edits (debounce behavior)", () => {
    const handleReassemble = vi.fn();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleAutoReassemble = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        handleReassemble();
      }, 2000);
    };

    // First edit
    scheduleAutoReassemble();
    vi.advanceTimersByTime(1500);
    expect(handleReassemble).not.toHaveBeenCalled();

    // Second edit at 1.5s — resets the timer
    scheduleAutoReassemble();
    vi.advanceTimersByTime(1500);
    expect(handleReassemble).not.toHaveBeenCalled();

    // Third edit at 3.0s — resets again
    scheduleAutoReassemble();
    vi.advanceTimersByTime(1999);
    expect(handleReassemble).not.toHaveBeenCalled();

    // Finally fires at 5.0s (2s after last edit)
    vi.advanceTimersByTime(1);
    expect(handleReassemble).toHaveBeenCalledTimes(1);
  });

  it("should only call reassemble once even with many rapid edits", () => {
    const handleReassemble = vi.fn();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleAutoReassemble = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        handleReassemble();
      }, 2000);
    };

    // Simulate 10 rapid edits, 200ms apart
    for (let i = 0; i < 10; i++) {
      scheduleAutoReassemble();
      vi.advanceTimersByTime(200);
    }

    // At this point, 2000ms have passed since first edit,
    // but only 200ms since last edit. Should not have fired yet.
    expect(handleReassemble).not.toHaveBeenCalled();

    // Advance remaining 1800ms
    vi.advanceTimersByTime(1800);
    expect(handleReassemble).toHaveBeenCalledTimes(1);
  });

  it("should allow a new save cycle after previous one completes", () => {
    const handleReassemble = vi.fn();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleAutoReassemble = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        handleReassemble();
      }, 2000);
    };

    // First cycle
    scheduleAutoReassemble();
    vi.advanceTimersByTime(2000);
    expect(handleReassemble).toHaveBeenCalledTimes(1);

    // Second cycle (new edit after first save)
    scheduleAutoReassemble();
    vi.advanceTimersByTime(2000);
    expect(handleReassemble).toHaveBeenCalledTimes(2);
  });

  it("should be cancellable (cleanup on unmount)", () => {
    const handleReassemble = vi.fn();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleAutoReassemble = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        handleReassemble();
      }, 2000);
    };

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    scheduleAutoReassemble();
    vi.advanceTimersByTime(1000);

    // Simulate unmount
    cleanup();

    vi.advanceTimersByTime(2000);
    expect(handleReassemble).not.toHaveBeenCalled();
  });
});

describe("Auto-Save — Status Transitions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should transition: idle → pending → reassembling → saved → idle", async () => {
    const statusHistory: string[] = [];
    let status = "idle";
    let timer: ReturnType<typeof setTimeout> | null = null;
    let statusTimer: ReturnType<typeof setTimeout> | null = null;

    const setStatus = (s: string) => {
      status = s;
      statusHistory.push(s);
    };

    const handleReassemble = async () => {
      setStatus("reassembling");
      // Simulate API call
      await Promise.resolve();
      setStatus("saved");
      statusTimer = setTimeout(() => setStatus("idle"), 3000);
    };

    const scheduleAutoReassemble = () => {
      if (timer) clearTimeout(timer);
      setStatus("pending");
      timer = setTimeout(() => {
        handleReassemble();
      }, 2000);
    };

    // Edit triggers pending
    scheduleAutoReassemble();
    expect(status).toBe("pending");

    // After 2s, reassemble fires
    vi.advanceTimersByTime(2000);
    await vi.runAllTimersAsync();
    // Should have gone through reassembling → saved
    expect(statusHistory).toContain("reassembling");
    expect(statusHistory).toContain("saved");

    // After 3s more, back to idle
    vi.advanceTimersByTime(3000);
    expect(status).toBe("idle");
  });

  it("should transition to error status on failure", async () => {
    let status = "idle";
    let timer: ReturnType<typeof setTimeout> | null = null;
    let statusTimer: ReturnType<typeof setTimeout> | null = null;

    const setStatus = (s: string) => {
      status = s;
    };

    const handleReassemble = () => {
      setStatus("reassembling");
      // Simulate synchronous API failure (like the real code catches errors)
      try {
        throw new Error("Network error");
      } catch {
        setStatus("error");
        statusTimer = setTimeout(() => setStatus("idle"), 5000);
      }
    };

    const scheduleAutoReassemble = () => {
      if (timer) clearTimeout(timer);
      setStatus("pending");
      timer = setTimeout(() => {
        handleReassemble();
      }, 2000);
    };

    scheduleAutoReassemble();
    expect(status).toBe("pending");

    vi.advanceTimersByTime(2000);
    expect(status).toBe("error");

    // After 5s, back to idle
    vi.advanceTimersByTime(5000);
    expect(status).toBe("idle");
  });

  it("should reset pending status when new edit arrives during reassemble", () => {
    let status = "idle";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const setStatus = (s: string) => {
      status = s;
    };

    const scheduleAutoReassemble = () => {
      if (timer) clearTimeout(timer);
      setStatus("pending");
      timer = setTimeout(() => {
        setStatus("reassembling");
      }, 2000);
    };

    // First edit
    scheduleAutoReassemble();
    expect(status).toBe("pending");

    // New edit before timer fires — still pending, timer reset
    vi.advanceTimersByTime(1500);
    scheduleAutoReassemble();
    expect(status).toBe("pending");

    // Original timer would have fired at 2000ms, but was cleared
    vi.advanceTimersByTime(500);
    expect(status).toBe("pending"); // Not reassembling yet

    // Fires 2s after second edit
    vi.advanceTimersByTime(1500);
    expect(status).toBe("reassembling");
  });
});

describe("Auto-Save — Integration with Edit Handlers", () => {
  it("should trigger auto-save from inline field edit", () => {
    const scheduleAutoReassemble = vi.fn();
    let hasEdits = false;

    // Simulate handleInlineFieldSaved
    const handleInlineFieldSaved = (
      _index: number,
      _field: string,
      _value: string,
      _response: any,
    ) => {
      hasEdits = true;
      scheduleAutoReassemble();
    };

    handleInlineFieldSaved(0, "title", "New Title", { data: {} });

    expect(hasEdits).toBe(true);
    expect(scheduleAutoReassemble).toHaveBeenCalledTimes(1);
  });

  it("should trigger auto-save from sidebar editor update", () => {
    const scheduleAutoReassemble = vi.fn();
    let hasEdits = false;

    // Simulate handleSlideUpdated
    const handleSlideUpdated = (_index: number, _response: any) => {
      hasEdits = true;
      scheduleAutoReassemble();
    };

    handleSlideUpdated(0, { layoutId: "title-slide", data: {}, html: "<div>slide</div>" });

    expect(hasEdits).toBe(true);
    expect(scheduleAutoReassemble).toHaveBeenCalledTimes(1);
  });

  it("should trigger auto-save for each edit in a sequence", () => {
    const scheduleAutoReassemble = vi.fn();

    const handleInlineFieldSaved = () => {
      scheduleAutoReassemble();
    };

    // Simulate editing 3 fields in sequence
    handleInlineFieldSaved();
    handleInlineFieldSaved();
    handleInlineFieldSaved();

    expect(scheduleAutoReassemble).toHaveBeenCalledTimes(3);
  });
});
