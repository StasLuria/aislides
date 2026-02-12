/**
 * InlineEditableSlide — Renders a slide in an iframe with contentEditable
 * text fields. Communicates with the iframe via postMessage.
 *
 * The iframe receives HTML with injected inline editing script that:
 * 1. Marks editable elements with data-field attributes
 * 2. Makes them contentEditable
 * 3. Sends postMessage to parent on blur with changed text
 *
 * The parent (this component) listens for messages and calls the API
 * to persist changes.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Check, Loader2, MousePointerClick } from "lucide-react";
import api from "@/lib/api";
import type { EditableSlideResponse, InlineFieldPatchResponse } from "@/lib/api";

interface InlineEditableSlideProps {
  presentationId: string;
  slideIndex: number;
  containerWidth: number;
  containerHeight: number;
  /** Called when a field is saved — parent should update its state */
  onFieldSaved?: (index: number, field: string, value: string, response: InlineFieldPatchResponse) => void;
  /** Called when the editable HTML is loaded (with field count) */
  onReady?: (fieldCount: number) => void;
  className?: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function InlineEditableSlide({
  presentationId,
  slideIndex,
  containerWidth,
  containerHeight,
  onFieldSaved,
  onReady,
  className = "",
}: InlineEditableSlideProps) {
  const SLIDE_W = 1280;
  const SLIDE_H = 720;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [editableHtml, setEditableHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [activeFieldLabel, setActiveFieldLabel] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [fieldCount, setFieldCount] = useState(0);

  // Debounce timer for auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scale = Math.min(containerWidth / SLIDE_W, containerHeight / SLIDE_H);

  // Fetch editable slide HTML
  useEffect(() => {
    let cancelled = false;

    const fetchEditable = async () => {
      setIsLoading(true);
      try {
        const resp: EditableSlideResponse = await api.getEditableSlide(
          presentationId,
          slideIndex,
        );
        if (!cancelled) {
          setEditableHtml(resp.html);
          setFieldCount(resp.editableFields.length);
        }
      } catch (err) {
        console.error("[InlineEdit] Failed to fetch editable slide:", err);
        if (!cancelled) {
          toast.error("Не удалось загрузить редактируемый слайд");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchEditable();
    return () => { cancelled = true; };
  }, [presentationId, slideIndex]);

  // Handle postMessage from iframe
  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;

      switch (msg.type) {
        case "inline-edit-ready":
          setFieldCount(msg.fieldCount || 0);
          onReady?.(msg.fieldCount || 0);
          break;

        case "inline-edit-focus":
          setActiveField(msg.field);
          setActiveFieldLabel(msg.label);
          setSaveStatus("idle");
          break;

        case "inline-edit-blur":
          // Small delay before clearing active field (for save indicator)
          setTimeout(() => {
            setActiveField(null);
            setActiveFieldLabel(null);
          }, 1500);
          break;

        case "inline-edit-change": {
          const { field, value } = msg;
          if (!field || typeof value !== "string") return;

          // Clear previous timer
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
          }

          // Auto-save with small debounce
          setSaveStatus("saving");
          saveTimerRef.current = setTimeout(async () => {
            try {
              const resp = await api.patchSlideField(
                presentationId,
                slideIndex,
                field,
                value,
              );
              setSaveStatus("saved");
              onFieldSaved?.(slideIndex, field, value, resp);

              // Reset status after 2 seconds
              setTimeout(() => setSaveStatus("idle"), 2000);
            } catch (err) {
              console.error("[InlineEdit] Failed to save field:", err);
              setSaveStatus("error");
              toast.error(`Не удалось сохранить поле "${msg.label || field}"`);
              setTimeout(() => setSaveStatus("idle"), 3000);
            }
          }, 300);
          break;
        }
      }
    },
    [presentationId, slideIndex, onFieldSaved, onReady],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <div
        className={`relative overflow-hidden flex items-center justify-center bg-black/5 ${className}`}
        style={{ width: containerWidth, height: containerHeight }}
      >
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Загрузка редактора...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Save status indicator */}
      <div
        className={`
          absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md
          text-[11px] font-medium transition-all duration-300
          ${saveStatus === "saving" ? "bg-amber-500/90 text-white opacity-100" : ""}
          ${saveStatus === "saved" ? "bg-emerald-500/90 text-white opacity-100" : ""}
          ${saveStatus === "error" ? "bg-red-500/90 text-white opacity-100" : ""}
          ${saveStatus === "idle" && activeField ? "bg-primary/90 text-white opacity-100" : ""}
          ${saveStatus === "idle" && !activeField ? "opacity-0 pointer-events-none" : ""}
        `}
      >
        {saveStatus === "saving" && (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Сохранение...
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <Check className="w-3 h-3" />
            Сохранено
          </>
        )}
        {saveStatus === "error" && "Ошибка сохранения"}
        {saveStatus === "idle" && activeField && (
          <>
            <MousePointerClick className="w-3 h-3" />
            {activeFieldLabel || activeField}
          </>
        )}
      </div>

      {/* Hint badge — shown when no field is active */}
      {!activeField && saveStatus === "idle" && fieldCount > 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-[11px] font-medium backdrop-blur-sm pointer-events-none">
          <MousePointerClick className="w-3.5 h-3.5" />
          Нажмите на текст для редактирования
        </div>
      )}

      {/* Scaled iframe */}
      <div
        className="overflow-hidden"
        style={{
          width: containerWidth,
          height: containerHeight,
        }}
      >
        <div
          style={{
            width: SLIDE_W,
            height: SLIDE_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "relative",
            top: Math.max(0, (containerHeight - SLIDE_H * scale) / 2),
            left: Math.max(0, (containerWidth - SLIDE_W * scale) / 2),
          }}
        >
          {editableHtml && (
            <iframe
              ref={iframeRef}
              srcDoc={editableHtml}
              className="border-0"
              style={{ width: SLIDE_W, height: SLIDE_H }}
              sandbox="allow-scripts allow-same-origin"
              tabIndex={0}
              title="Editable Slide"
            />
          )}
        </div>
      </div>
    </div>
  );
}
