/**
 * SlideContentEditor — Inline editor for slide content in step-by-step mode.
 * Allows users to edit title, key message, text, and speaker notes
 * before approving the slide content for design generation.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SlideContentData {
  title: string;
  key_message: string;
  text: string;
  notes: string;
  data_points?: Array<{ label: string; value: string; unit: string }>;
  slide_number?: number;
  structured_content?: Record<string, unknown>;
  content_shape?: string;
  slide_category?: string;
}

interface SlideContentEditorProps {
  sessionId: string;
  content: SlideContentData;
  onSave: (updatedContent: SlideContentData) => void;
  onCancel: () => void;
}

const API_BASE = "/api/v1/chat";

export default function SlideContentEditor({
  sessionId,
  content,
  onSave,
  onCancel,
}: SlideContentEditorProps) {
  const [title, setTitle] = useState(content.title);
  const [keyMessage, setKeyMessage] = useState(content.key_message);
  const [text, setText] = useState(content.text);
  const [notes, setNotes] = useState(content.notes || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!title.trim() || !text.trim()) {
      toast.error("Заголовок и текст обязательны");
      return;
    }

    setIsSaving(true);
    try {
      const updatedContent: SlideContentData = {
        ...content,
        title: title.trim(),
        key_message: keyMessage.trim(),
        text: text.trim(),
        notes: notes.trim(),
      };

      // Save to server metadata
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedContent: updatedContent }),
      });

      if (!res.ok) {
        throw new Error("Failed to save content");
      }

      toast.success("Контент обновлён");
      onSave(updatedContent);
    } catch (err: any) {
      console.error("Failed to save slide content:", err);
      toast.error("Не удалось сохранить изменения");
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, content, title, keyMessage, text, notes, onSave]);

  return (
    <div className="bg-secondary/30 border border-border/60 rounded-lg p-4 space-y-4 mt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground/90">
          ✏️ Редактирование контента слайда
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 w-7 p-0"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="space-y-3">
        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Заголовок</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок слайда"
            className="text-sm"
          />
        </div>

        {/* Key Message */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ключевое сообщение</Label>
          <Input
            value={keyMessage}
            onChange={(e) => setKeyMessage(e.target.value)}
            placeholder="Главная мысль слайда"
            className="text-sm"
          />
        </div>

        {/* Text */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Текст</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Основной текст слайда"
            className="text-sm min-h-[100px] resize-y"
          />
        </div>

        {/* Speaker Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Заметки спикера</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Заметки для выступающего (необязательно)"
            className="text-sm min-h-[60px] resize-y"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || !title.trim() || !text.trim()}
          className="text-xs gap-1.5"
        >
          {isSaving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          Сохранить изменения
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          className="text-xs"
        >
          Отмена
        </Button>
      </div>
    </div>
  );
}
