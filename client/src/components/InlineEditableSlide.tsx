/**
 * InlineEditableSlide — Renders a slide in an iframe with contentEditable
 * text fields and image replacement overlay. Communicates with the iframe
 * via postMessage.
 *
 * The iframe receives HTML with injected inline editing script that:
 * 1. Marks editable text elements with data-field attributes
 * 2. Makes them contentEditable
 * 3. Sends postMessage to parent on blur with changed text
 * 4. Wraps images with hover overlay for replacement (click or drag-and-drop)
 * 5. Reports content height changes so iframe can auto-expand
 *
 * The parent (this component) listens for messages and calls the API
 * to persist changes.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Check, Loader2, MousePointerClick, Upload } from "lucide-react";
import api from "@/lib/api";
import type { EditableSlideResponse, InlineFieldPatchResponse, SlideEditResponse } from "@/lib/api";

interface InlineEditableSlideProps {
  presentationId: string;
  slideIndex: number;
  containerWidth: number;
  containerHeight: number;
  /** Called when a field is saved — parent should update its state */
  onFieldSaved?: (index: number, field: string, value: string, response: InlineFieldPatchResponse) => void;
  /** Called when an image is replaced — parent should update its state */
  onImageReplaced?: (index: number, response: SlideEditResponse) => void;
  /** Called when the editable HTML is loaded (with field count) */
  onReady?: (fieldCount: number) => void;
  className?: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error" | "uploading";

export default function InlineEditableSlide({
  presentationId,
  slideIndex,
  containerWidth,
  containerHeight,
  onFieldSaved,
  onImageReplaced,
  onReady,
  className = "",
}: InlineEditableSlideProps) {
  const SLIDE_W = 1280;
  const SLIDE_H = 720;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editableHtml, setEditableHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [activeFieldLabel, setActiveFieldLabel] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [fieldCount, setFieldCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Dynamic height from iframe content
  const [contentHeight, setContentHeight] = useState(SLIDE_H);

  // Debounce timer for auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use the larger of SLIDE_H and contentHeight for scaling
  const effectiveHeight = Math.max(SLIDE_H, contentHeight);
  const scale = Math.min(containerWidth / SLIDE_W, containerHeight / effectiveHeight);
  // The outer container height adapts: if content is taller, the container grows
  const scaledHeight = effectiveHeight * scale;
  const outerHeight = Math.max(containerHeight, scaledHeight);

  // Fetch editable slide HTML
  useEffect(() => {
    let cancelled = false;

    const fetchEditable = async () => {
      setIsLoading(true);
      setContentHeight(SLIDE_H); // Reset height on slide change
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

  /**
   * Upload a file to replace the slide image.
   * Converts dataUrl string back to File if needed.
   */
  const uploadImage = useCallback(
    async (file: File) => {
      setSaveStatus("uploading");
      setUploadProgress(0);
      try {
        const response = await api.uploadSlideEditImage(
          presentationId,
          slideIndex,
          file,
          (percent) => setUploadProgress(percent),
        );
        setSaveStatus("saved");
        setUploadProgress(100);
        toast.success("Изображение заменено");
        onImageReplaced?.(slideIndex, response);

        // Refresh the editable HTML to show the new image
        try {
          const resp = await api.getEditableSlide(presentationId, slideIndex);
          setEditableHtml(resp.html);
        } catch {
          // Non-critical — the image was already saved
        }

        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("[InlineEdit] Failed to upload image:", err);
        setSaveStatus("error");
        toast.error("Не удалось загрузить изображение");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    },
    [presentationId, slideIndex, onImageReplaced],
  );

  /**
   * Convert a dataUrl to a File object.
   */
  const dataUrlToFile = useCallback((dataUrl: string, fileName: string, mimeType: string): File => {
    const arr = dataUrl.split(",");
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], fileName, { type: mimeType });
  }, []);

  // Handle file input change (from file picker)
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowed.includes(file.type)) {
        toast.error("Поддерживаются только JPEG, PNG, WebP и GIF");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Файл слишком большой (макс. 5 МБ)");
        return;
      }

      uploadImage(file);

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [uploadImage],
  );

  // Handle postMessage from iframe
  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;

      switch (msg.type) {
        case "inline-edit-ready":
          setFieldCount(msg.fieldCount || 0);
          setImageCount(msg.imageCount || 0);
          onReady?.(msg.fieldCount || 0);
          break;

        case "inline-slide-resize": {
          // Iframe reports new content height
          const newHeight = msg.height;
          if (typeof newHeight === "number" && newHeight >= SLIDE_H) {
            setContentHeight(newHeight);
          }
          break;
        }

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

        // Image editing messages
        case "inline-image-click": {
          // Open file picker
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
          break;
        }

        case "inline-image-drop": {
          // File was dropped on image in iframe — convert dataUrl to File and upload
          const { fileName, fileType, dataUrl } = msg;
          if (!dataUrl || !fileName) return;

          const file = dataUrlToFile(dataUrl, fileName, fileType || "image/png");
          uploadImage(file);
          break;
        }

        case "inline-image-error": {
          toast.error(msg.message || "Ошибка при работе с изображением");
          break;
        }
      }
    },
    [presentationId, slideIndex, onFieldSaved, onReady, uploadImage, dataUrlToFile],
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
      {/* Hidden file input for image replacement */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Save status indicator */}
      <div
        className={`
          absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md
          text-[11px] font-medium transition-all duration-300
          ${saveStatus === "saving" ? "bg-amber-500/90 text-white opacity-100" : ""}
          ${saveStatus === "uploading" ? "bg-blue-500/90 text-white opacity-100" : ""}
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
        {saveStatus === "uploading" && (
          <>
            <Upload className="w-3 h-3 animate-pulse" />
            Загрузка {uploadProgress > 0 ? `${uploadProgress}%` : "..."}
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
      {!activeField && saveStatus === "idle" && (fieldCount > 0 || imageCount > 0) && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-[11px] font-medium backdrop-blur-sm pointer-events-none">
          <MousePointerClick className="w-3.5 h-3.5" />
          {fieldCount > 0 && imageCount > 0
            ? "Нажмите на текст или изображение для редактирования"
            : fieldCount > 0
              ? "Нажмите на текст для редактирования"
              : "Наведите на изображение для замены"
          }
        </div>
      )}

      {/* Scaled iframe — auto-expands when content grows */}
      <div
        className="overflow-auto"
        style={{
          width: containerWidth,
          height: outerHeight,
          maxHeight: containerHeight + 200, // Allow some expansion beyond container
          transition: "height 0.2s ease",
        }}
      >
        <div
          style={{
            width: SLIDE_W,
            height: effectiveHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "relative",
            top: effectiveHeight <= SLIDE_H
              ? Math.max(0, (containerHeight - SLIDE_H * scale) / 2)
              : 0,
            left: Math.max(0, (containerWidth - SLIDE_W * scale) / 2),
          }}
        >
          {editableHtml && (
            <iframe
              ref={iframeRef}
              srcDoc={editableHtml}
              className="border-0"
              style={{
                width: SLIDE_W,
                height: effectiveHeight,
                transition: "height 0.2s ease",
              }}
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
