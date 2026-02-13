/**
 * SlideEditor — Side panel for editing individual slide text, images, and layout.
 * Appears when user clicks "Edit" on a slide in the Viewer.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  X,
  Save,
  Upload,
  Trash2,
  ImageIcon,
  Type,
  LayoutGrid,
  Loader2,
  RefreshCw,
} from "lucide-react";
import api from "@/lib/api";
import type { SlideData, SlideEditResponse } from "@/lib/api";

// Editable text fields per layout type
const LAYOUT_TEXT_FIELDS: Record<string, Array<{ key: string; label: string; multiline?: boolean }>> = {
  "title-slide": [
    { key: "title", label: "Заголовок" },
    { key: "description", label: "Описание", multiline: true },
    { key: "presenterName", label: "Имя докладчика" },
    { key: "presentationDate", label: "Дата" },
  ],
  "section-header": [
    { key: "title", label: "Заголовок" },
    { key: "subtitle", label: "Подзаголовок" },
  ],
  "text-slide": [
    { key: "title", label: "Заголовок" },
    { key: "description", label: "Текст", multiline: true },
    { key: "key_message", label: "Ключевое сообщение" },
  ],
  "two-column": [
    { key: "title", label: "Заголовок" },
    { key: "leftTitle", label: "Левая колонка — заголовок" },
    { key: "rightTitle", label: "Правая колонка — заголовок" },
  ],
  "image-text": [
    { key: "title", label: "Заголовок" },
    { key: "description", label: "Описание", multiline: true },
  ],
  "image-fullscreen": [
    { key: "title", label: "Заголовок" },
    { key: "subtitle", label: "Подзаголовок" },
  ],
  "quote-slide": [
    { key: "title", label: "Заголовок" },
    { key: "quote", label: "Цитата", multiline: true },
    { key: "author", label: "Автор" },
  ],
  "final-slide": [
    { key: "title", label: "Заголовок" },
    { key: "description", label: "Описание", multiline: true },
    { key: "callToAction", label: "Призыв к действию" },
    { key: "contactInfo", label: "Контакты" },
  ],
  "bullet-list-slide": [
    { key: "title", label: "Заголовок" },
    { key: "description", label: "Описание", multiline: true },
  ],
  "metrics-slide": [
    { key: "title", label: "Заголовок" },
    { key: "description", label: "Описание", multiline: true },
  ],
  "icons-numbers": [
    { key: "title", label: "Заголовок" },
    { key: "description", label: "Описание", multiline: true },
  ],
  "process-steps": [
    { key: "title", label: "Заголовок" },
    { key: "description", label: "Описание", multiline: true },
  ],
  "timeline": [
    { key: "title", label: "Заголовок" },
    { key: "description", label: "Описание", multiline: true },
  ],
  "comparison": [
    { key: "title", label: "Заголовок" },
    { key: "description", label: "Описание", multiline: true },
  ],
  "table-slide": [
    { key: "title", label: "Заголовок" },
    { key: "description", label: "Описание", multiline: true },
  ],
};

// Default fields for unknown layouts
const DEFAULT_TEXT_FIELDS = [
  { key: "title", label: "Заголовок" },
  { key: "description", label: "Описание", multiline: true },
];

interface SlideEditorProps {
  presentationId: string;
  slide: SlideData;
  onClose: () => void;
  onSlideUpdated: (index: number, response: SlideEditResponse) => void;
}

export default function SlideEditor({
  presentationId,
  slide,
  onClose,
  onSlideUpdated,
}: SlideEditorProps) {
  const [editData, setEditData] = useState<Record<string, any>>({ ...slide.data });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when slide changes
  useEffect(() => {
    setEditData({ ...slide.data });
    setIsDirty(false);
  }, [slide.index, slide.layoutId]);

  const fields = LAYOUT_TEXT_FIELDS[slide.layoutId] || DEFAULT_TEXT_FIELDS;

  const hasImage = !!(editData.image?.url || editData.backgroundImage?.url);
  const imageUrl = editData.image?.url || editData.backgroundImage?.url;

  const handleFieldChange = useCallback((key: string, value: string) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await api.updateSlideData(presentationId, slide.index, editData);
      onSlideUpdated(slide.index, result);
      setIsDirty(false);
      toast.success("Слайд обновлён");
    } catch (error) {
      console.error("Failed to save slide:", error);
      toast.error("Не удалось сохранить изменения");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл слишком большой (макс. 5 МБ)");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const result = await api.uploadSlideEditImage(
        presentationId,
        slide.index,
        file,
        (percent) => setUploadProgress(percent),
      );
      onSlideUpdated(slide.index, result);
      setEditData(result.data);
      setIsDirty(false);
      toast.success("Изображение загружено");
    } catch (error) {
      console.error("Failed to upload image:", error);
      toast.error("Не удалось загрузить изображение");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveImage = async () => {
    try {
      const result = await api.removeSlideEditImage(presentationId, slide.index);
      onSlideUpdated(slide.index, result);
      setEditData(result.data);
      setIsDirty(false);
      toast.success("Изображение удалено");
    } catch (error) {
      console.error("Failed to remove image:", error);
      toast.error("Не удалось удалить изображение");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImageUpload(file);
    }
  }, [presentationId, slide.index]);

  return (
    <div className="w-[360px] border-l border-border/50 flex flex-col bg-background/95 backdrop-blur-sm h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
            <Type className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Редактирование</h3>
            <p className="text-[10px] text-muted-foreground font-mono">
              Слайд {slide.index + 1} • {slide.layoutId}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-5">
          {/* Text Fields */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Type className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Текст
              </span>
            </div>

            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                {field.multiline ? (
                  <Textarea
                    value={editData[field.key] || ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="min-h-[80px] resize-none bg-secondary/50 border-border/50 text-sm"
                    placeholder={field.label}
                  />
                ) : (
                  <Input
                    value={editData[field.key] || ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="bg-secondary/50 border-border/50 text-sm"
                    placeholder={field.label}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-border/50" />

          {/* Image Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Изображение
              </span>
            </div>

            {hasImage ? (
              <div className="space-y-2">
                {/* Image preview */}
                <div className="relative rounded-lg overflow-hidden border border-border/30 aspect-video bg-secondary/30">
                  <img
                    src={imageUrl}
                    alt="Slide image"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Заменить
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={handleRemoveImage}
                    disabled={isUploading}
                  >
                    <Trash2 className="w-3 h-3" />
                    Удалить
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-border/50 rounded-lg p-6 text-center cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                {isUploading ? (
                  <div className="space-y-2">
                    <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
                    <p className="text-xs text-muted-foreground">
                      Загрузка... {uploadProgress}%
                    </p>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Перетащите изображение или нажмите для загрузки
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      JPG, PNG, WebP, GIF • до 5 МБ
                    </p>
                  </>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Footer — Save button */}
      <div className="p-4 border-t border-border/50 space-y-2 shrink-0">
        <Button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="w-full gap-2 text-sm"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Сохранить изменения
            </>
          )}
        </Button>
        {isDirty && (
          <p className="text-[10px] text-center text-amber-400/70 font-mono">
            Есть несохранённые изменения
          </p>
        )}
      </div>
    </div>
  );
}
