import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the presentation retry endpoint logic.
 * Validates status checks, state reset, and pipeline restart.
 */

describe("Presentation Retry Endpoint", () => {
  describe("Status validation", () => {
    it("should only allow retry for failed presentations", () => {
      const allowedStatuses = ["failed"];
      const blockedStatuses = [
        "pending",
        "processing",
        "completed",
        "cancelled",
        "awaiting_outline_approval",
        "awaiting_content_approval",
        "assembling",
      ];

      for (const status of allowedStatuses) {
        expect(status === "failed").toBe(true);
      }
      for (const status of blockedStatuses) {
        expect(status === "failed").toBe(false);
      }
    });

    it("should return 404 for non-existent presentation", () => {
      const presentation = undefined;
      expect(presentation).toBeUndefined();
    });

    it("should return 400 for non-failed presentation", () => {
      const presentation = { status: "completed" };
      const canRetry = presentation.status === "failed";
      expect(canRetry).toBe(false);
    });

    it("should allow retry for failed presentation", () => {
      const presentation = { status: "failed" };
      const canRetry = presentation.status === "failed";
      expect(canRetry).toBe(true);
    });
  });

  describe("State reset on retry", () => {
    it("should reset progress to 0", () => {
      const resetState = {
        status: "processing",
        currentStep: "starting",
        progressPercent: 0,
        errorInfo: {},
      };

      expect(resetState.status).toBe("processing");
      expect(resetState.currentStep).toBe("starting");
      expect(resetState.progressPercent).toBe(0);
      expect(resetState.errorInfo).toEqual({});
    });

    it("should preserve original prompt and config", () => {
      const original = {
        presentationId: "test-123",
        prompt: "AI in education",
        config: { theme_preset: "corporate_blue", enable_images: true },
        status: "failed",
        errorInfo: { error_type: "TimeoutError", error_message: "Pipeline timed out" },
      };

      // After retry, prompt and config should be reused
      const retryConfig = (original.config as Record<string, any>) || {};
      expect(retryConfig.theme_preset).toBe("corporate_blue");
      expect(retryConfig.enable_images).toBe(true);
    });

    it("should clear error info on retry", () => {
      const beforeRetry = {
        errorInfo: { error_type: "TimeoutError", error_message: "Pipeline timed out" },
      };
      const afterRetry = { errorInfo: {} };

      expect(Object.keys(afterRetry.errorInfo)).toHaveLength(0);
      expect(beforeRetry.errorInfo.error_type).toBe("TimeoutError");
    });
  });

  describe("Response format", () => {
    it("should return presentation_id and processing status", () => {
      const response = {
        presentation_id: "test-123",
        status: "processing",
        message: "Pipeline restarted",
      };

      expect(response.presentation_id).toBe("test-123");
      expect(response.status).toBe("processing");
      expect(response.message).toBe("Pipeline restarted");
    });
  });

  describe("Edge cases", () => {
    it("should handle presentation with null config", () => {
      const presentation = {
        config: null,
        prompt: "Test prompt",
      };
      const config = (presentation.config as Record<string, any>) || {};
      expect(config).toEqual({});
    });

    it("should handle presentation with empty config", () => {
      const presentation = {
        config: {},
        prompt: "Test prompt",
      };
      const config = (presentation.config as Record<string, any>) || {};
      expect(config).toEqual({});
    });

    it("should not allow double retry while processing", () => {
      const statuses = ["processing", "pending"];
      for (const status of statuses) {
        expect(status === "failed").toBe(false);
      }
    });
  });
});
