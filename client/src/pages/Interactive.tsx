/**
 * Interactive Mode — Step-by-step presentation generation with user approval.
 *
 * Step 1: Outline Review — Edit slide titles, reorder, add/remove slides
 * Step 2: Content Review — Edit per-slide text content
 * Step 3: Assembly — Final HTML generation with progress
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Pencil,
  RotateCcw,
  Save,
} from "lucide-react";
import api from "@/lib/api";
import type {
  OutlineData,
  OutlineSlideData,
  SlideContentData,
  WSEvent,
} from "@/lib/api";

// ═══════════════════════════════════════════════════════
// STEP DEFINITIONS
// ═══════════════════════════════════════════════════════

const STEPS = [
  { id: 1, label: "Структура", description: "Утвердите план презентации" },
  { id: 2, label: "Контент", description: "Проверьте текст слайдов" },
  { id: 3, label: "Сборка", description: "Финальная генерация" },
];

type InteractiveStep = "loading" | "outline" | "writing" | "content" | "assembling" | "completed" | "error";

export default function Interactive() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const presentationId = params.id || "";

  // State
  const [step, setStep] = useState<InteractiveStep>("loading");
  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [content, setContent] = useState<SlideContentData[] | null>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Загрузка...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedSlide, setExpandedSlide] = useState<number | null>(null);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load initial state ──────────────────────────────
  useEffect(() => {
    if (!presentationId) return;

    const loadState = async () => {
      try {
        const data = await api.getPresentation(presentationId);
        setTitle(data.title || "");

        switch (data.status) {
          case "awaiting_outline_approval": {
            const state = data.pipeline_state as any;
            if (state?.outline) {
              setOutline(state.outline);
              setStep("outline");
              setProgress(15);
            }
            break;
          }
          case "processing": {
            const currentStep = data.current_step;
            if (currentStep === "writing") {
              setStep("writing");
              setProgress(data.progress_percent);
              setStatusMessage("Написание контента...");
              startPolling();
              connectWS();
            } else {
              setStep("loading");
              setProgress(data.progress_percent);
              startPolling();
              connectWS();
            }
            break;
          }
          case "awaiting_content_approval": {
            const contentData = await api.getInteractiveContent(presentationId);
            if (contentData.outline) setOutline(contentData.outline);
            if (contentData.content) setContent(contentData.content);
            setStep("content");
            setProgress(45);
            break;
          }
          case "assembling": {
            setStep("assembling");
            setProgress(data.progress_percent);
            setStatusMessage("Сборка презентации...");
            connectWS();
            startPolling();
            break;
          }
          case "completed":
            setStep("completed");
            setProgress(100);
            break;
          case "failed":
            setStep("error");
            setErrorMessage((data.error_info as any)?.error_message || "Ошибка генерации");
            break;
          default:
            setStep("loading");
            setProgress(data.progress_percent);
            startPolling();
            connectWS();
        }
      } catch (err: any) {
        setStep("error");
        setErrorMessage(err.message || "Не удалось загрузить презентацию");
      }
    };

    loadState();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationId]);

  // ── WebSocket ───────────────────────────────────────
  const handleWSEvent = useCallback(
    (event: WSEvent) => {
      const data = event.data;
      switch (event.type) {
        case "generation.progress": {
          const p = (data.progress_percentage as number) || 0;
          const msg = (data.message as string) || "";
          const currentStep = (data.current_step as string) || "";
          setProgress(p);
          setStatusMessage(msg);

          if (currentStep === "awaiting_outline_approval") {
            // Reload outline
            api.getPresentation(presentationId).then((pres) => {
              const state = pres.pipeline_state as any;
              if (state?.outline) {
                setOutline(state.outline);
                setTitle(pres.title || "");
                setStep("outline");
              }
            });
          } else if (currentStep === "awaiting_content_approval") {
            // Reload content
            api.getInteractiveContent(presentationId).then((resp) => {
              if (resp.outline) setOutline(resp.outline);
              if (resp.content) setContent(resp.content);
              setStep("content");
            });
          }
          break;
        }
        case "generation.completed":
          setStep("completed");
          setProgress(100);
          toast.success("Презентация готова!");
          break;
        case "generation.error": {
          setStep("error");
          setErrorMessage((data.error_message as string) || "Ошибка");
          toast.error("Ошибка генерации");
          break;
        }
      }
    },
    [presentationId],
  );

  const connectWS = useCallback(() => {
    if (wsRef.current) return;
    try {
      wsRef.current = api.connectWebSocket(
        presentationId,
        handleWSEvent,
        () => {},
        () => { wsRef.current = null; },
      );
    } catch {}
  }, [presentationId, handleWSEvent]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.getPresentation(presentationId);
        setProgress(data.progress_percent);
        setTitle(data.title || "");

        if (data.status === "awaiting_outline_approval") {
          const state = data.pipeline_state as any;
          if (state?.outline) {
            setOutline(state.outline);
            setStep("outline");
          }
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        } else if (data.status === "awaiting_content_approval") {
          const resp = await api.getInteractiveContent(presentationId);
          if (resp.outline) setOutline(resp.outline);
          if (resp.content) setContent(resp.content);
          setStep("content");
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        } else if (data.status === "completed") {
          setStep("completed");
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        } else if (data.status === "failed") {
          setStep("error");
          setErrorMessage((data.error_info as any)?.error_message || "Ошибка");
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {}
    }, 3000);
  }, [presentationId]);

  // ── Outline editing ─────────────────────────────────

  const updateSlideTitle = (index: number, newTitle: string) => {
    if (!outline) return;
    const updated = { ...outline };
    updated.slides = [...updated.slides];
    updated.slides[index] = { ...updated.slides[index], title: newTitle };
    setOutline(updated);
  };

  const updateSlidePurpose = (index: number, newPurpose: string) => {
    if (!outline) return;
    const updated = { ...outline };
    updated.slides = [...updated.slides];
    updated.slides[index] = { ...updated.slides[index], purpose: newPurpose };
    setOutline(updated);
  };

  const updateSlideKeyPoints = (index: number, newPoints: string[]) => {
    if (!outline) return;
    const updated = { ...outline };
    updated.slides = [...updated.slides];
    updated.slides[index] = { ...updated.slides[index], key_points: newPoints };
    setOutline(updated);
  };

  const addSlide = () => {
    if (!outline) return;
    const newSlide: OutlineSlideData = {
      slide_number: outline.slides.length + 1,
      title: "Новый слайд",
      purpose: "",
      key_points: [""],
      speaker_notes_hint: "",
    };
    setOutline({
      ...outline,
      slides: [...outline.slides, newSlide],
    });
  };

  const removeSlide = (index: number) => {
    if (!outline || outline.slides.length <= 2) {
      toast.error("Минимум 2 слайда");
      return;
    }
    const updated = { ...outline };
    updated.slides = updated.slides.filter((_, i) => i !== index);
    // Renumber
    updated.slides = updated.slides.map((s, i) => ({ ...s, slide_number: i + 1 }));
    setOutline(updated);
  };

  const moveSlide = (index: number, direction: "up" | "down") => {
    if (!outline) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= outline.slides.length) return;

    const updated = { ...outline };
    const slides = [...updated.slides];
    [slides[index], slides[newIndex]] = [slides[newIndex], slides[index]];
    // Renumber
    updated.slides = slides.map((s, i) => ({ ...s, slide_number: i + 1 }));
    setOutline(updated);
  };

  // ── Approve outline ─────────────────────────────────
  const handleApproveOutline = async () => {
    if (!outline) return;
    setIsApproving(true);
    try {
      await api.approveOutline(presentationId, outline);
      setStep("writing");
      setStatusMessage("Написание контента...");
      setProgress(20);
      connectWS();
      startPolling();
    } catch (err: any) {
      toast.error(err.message || "Ошибка при утверждении структуры");
    } finally {
      setIsApproving(false);
    }
  };

  // ── Content editing ─────────────────────────────────
  const handleSaveSlide = async (slideNumber: number) => {
    if (!content) return;
    const slide = content.find((s) => s.slide_number === slideNumber);
    if (!slide) return;

    setIsSaving(true);
    try {
      await api.updateSlide(presentationId, slideNumber, {
        title: slide.title,
        text: slide.text,
        key_message: slide.key_message,
        notes: slide.notes,
      });
      toast.success(`Слайд ${slideNumber} сохранён`);
      setEditingSlide(null);
    } catch (err: any) {
      toast.error(err.message || "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  const updateContentField = (slideNumber: number, field: keyof SlideContentData, value: string) => {
    if (!content) return;
    setContent(
      content.map((s) =>
        s.slide_number === slideNumber ? { ...s, [field]: value } : s,
      ),
    );
  };

  // ── Approve content & assemble ──────────────────────
  const handleAssemble = async () => {
    setIsApproving(true);
    try {
      await api.assemblePresentation(presentationId);
      setStep("assembling");
      setStatusMessage("Сборка презентации...");
      setProgress(50);
      connectWS();
      startPolling();
    } catch (err: any) {
      toast.error(err.message || "Ошибка при запуске сборки");
    } finally {
      setIsApproving(false);
    }
  };

  // ── Current step index for wizard ───────────────────
  const currentStepIndex =
    step === "outline" ? 0
    : step === "writing" || step === "content" ? 1
    : step === "assembling" || step === "completed" ? 2
    : 0;

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Top progress bar */}
      <div className="top-progress-bar" style={{ width: `${progress}%` }} />

      {/* Step wizard header */}
      <div className="border-b border-border/50 bg-secondary/20">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="section-number mb-1">ИНТЕРАКТИВНЫЙ РЕЖИМ</div>
              <h2
                className="text-lg font-semibold tracking-tight truncate max-w-md"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {title || "Новая презентация"}
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              ID: {presentationId.slice(0, 8)}...
            </span>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                    ${i < currentStepIndex ? "bg-primary/10 text-primary" : ""}
                    ${i === currentStepIndex ? "bg-primary text-primary-foreground" : ""}
                    ${i > currentStepIndex ? "bg-secondary/50 text-muted-foreground" : ""}
                  `}
                >
                  {i < currentStepIndex ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : i === currentStepIndex && (step === "writing" || step === "assembling" || step === "loading") ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span className="w-4 text-center font-mono">{s.id}</span>
                  )}
                  <span>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-px ${i < currentStepIndex ? "bg-primary/40" : "bg-border/50"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* ── LOADING ────────────────────────────────── */}
        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
            <Progress value={progress} className="w-64 h-1" />
          </div>
        )}

        {/* ── STEP 1: OUTLINE REVIEW ─────────────────── */}
        {step === "outline" && outline && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3
                  className="text-xl font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Структура презентации
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Отредактируйте заголовки, порядок слайдов, добавьте или удалите слайды
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-mono">
                  {outline.slides.length} слайдов
                </p>
                <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                  Аудитория: {outline.target_audience}
                </p>
              </div>
            </div>

            {/* Presentation title edit */}
            <div className="mb-6 p-4 rounded-lg bg-secondary/30 border border-border/50">
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Заголовок презентации
              </label>
              <Input
                value={outline.presentation_title}
                onChange={(e) => setOutline({ ...outline, presentation_title: e.target.value })}
                className="bg-background/50 border-border/50 text-base font-medium"
              />
            </div>

            {/* Slides list */}
            <div className="space-y-2">
              {outline.slides.map((slide, index) => (
                <div
                  key={`slide-${index}`}
                  className="group rounded-lg border border-border/50 bg-secondary/20 hover:bg-secondary/30 transition-colors"
                >
                  {/* Slide header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Drag handle & number */}
                    <div className="flex items-center gap-1 shrink-0">
                      <GripVertical className="w-4 h-4 text-muted-foreground/30" />
                      <span className="font-mono text-xs text-muted-foreground w-6 text-right">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    {/* Title input */}
                    <Input
                      value={slide.title}
                      onChange={(e) => updateSlideTitle(index, e.target.value)}
                      className="flex-1 bg-transparent border-0 px-0 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 h-8"
                      placeholder="Заголовок слайда"
                    />

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveSlide(index, "up")}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveSlide(index, "down")}
                        disabled={index === outline.slides.length - 1}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setExpandedSlide(expandedSlide === index ? null : index)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeSlide(index)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedSlide === index && (
                    <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border/30 mt-0">
                      <div className="pt-3">
                        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
                          Цель слайда
                        </label>
                        <Input
                          value={slide.purpose}
                          onChange={(e) => updateSlidePurpose(index, e.target.value)}
                          className="bg-background/50 border-border/50 text-xs"
                          placeholder="Зачем этот слайд нужен"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
                          Ключевые тезисы
                        </label>
                        {slide.key_points.map((point, pi) => (
                          <div key={pi} className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] text-muted-foreground/50 font-mono w-4 shrink-0">
                              {pi + 1}.
                            </span>
                            <Input
                              value={point}
                              onChange={(e) => {
                                const newPoints = [...slide.key_points];
                                newPoints[pi] = e.target.value;
                                updateSlideKeyPoints(index, newPoints);
                              }}
                              className="bg-background/50 border-border/50 text-xs h-7"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => {
                                const newPoints = slide.key_points.filter((_, i) => i !== pi);
                                updateSlideKeyPoints(index, newPoints);
                              }}
                            >
                              <Trash2 className="w-3 h-3 text-muted-foreground" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground h-7 mt-1"
                          onClick={() => updateSlideKeyPoints(index, [...slide.key_points, ""])}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Добавить тезис
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add slide button */}
            <Button
              variant="outline"
              className="w-full mt-3 border-dashed border-border/50 text-muted-foreground hover:text-foreground h-10"
              onClick={addSlide}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить слайд
            </Button>

            {/* Approve button */}
            <div className="mt-8 pt-6 border-t border-border/50">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Назад
                </Button>
                <Button
                  onClick={handleApproveOutline}
                  disabled={isApproving}
                  className="gap-2 min-w-[200px]"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Утверждение...
                    </>
                  ) : (
                    <>
                      Утвердить структуру
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── WRITING (waiting) ──────────────────────── */}
        {step === "writing" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-foreground font-medium">Написание контента</p>
            <p className="text-xs text-muted-foreground">{statusMessage}</p>
            <Progress value={progress} className="w-64 h-1" />
            <p className="text-[10px] text-muted-foreground/60 font-mono mt-2">
              AI-агенты пишут текст для каждого слайда...
            </p>
          </div>
        )}

        {/* ── STEP 2: CONTENT REVIEW ─────────────────── */}
        {step === "content" && content && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3
                  className="text-xl font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Контент слайдов
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Проверьте и отредактируйте текст каждого слайда перед сборкой
                </p>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {content.length} слайдов
              </p>
            </div>

            <div className="space-y-3">
              {content.map((slide) => {
                const isEditing = editingSlide === slide.slide_number;
                const isExpanded = expandedSlide === slide.slide_number;

                return (
                  <div
                    key={slide.slide_number}
                    className="rounded-lg border border-border/50 bg-secondary/20 overflow-hidden"
                  >
                    {/* Slide header */}
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
                      onClick={() => setExpandedSlide(isExpanded ? null : slide.slide_number)}
                    >
                      <span className="font-mono text-xs text-muted-foreground w-6 text-right shrink-0">
                        {String(slide.slide_number).padStart(2, "0")}
                      </span>
                      <span className="flex-1 text-sm font-medium truncate">{slide.title}</span>
                      <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">
                        {slide.text.length} зн.
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border/30 space-y-3 pt-3">
                        {/* Title */}
                        <div>
                          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
                            Заголовок
                          </label>
                          <Input
                            value={slide.title}
                            onChange={(e) => updateContentField(slide.slide_number, "title", e.target.value)}
                            disabled={!isEditing}
                            className="bg-background/50 border-border/50 text-sm font-medium disabled:opacity-80"
                          />
                        </div>

                        {/* Text */}
                        <div>
                          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
                            Текст слайда
                          </label>
                          <Textarea
                            value={slide.text}
                            onChange={(e) => updateContentField(slide.slide_number, "text", e.target.value)}
                            disabled={!isEditing}
                            className="bg-background/50 border-border/50 text-xs min-h-[100px] disabled:opacity-80"
                          />
                        </div>

                        {/* Key message */}
                        <div>
                          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
                            Ключевое сообщение
                          </label>
                          <Input
                            value={slide.key_message}
                            onChange={(e) => updateContentField(slide.slide_number, "key_message", e.target.value)}
                            disabled={!isEditing}
                            className="bg-background/50 border-border/50 text-xs disabled:opacity-80"
                          />
                        </div>

                        {/* Notes */}
                        <div>
                          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
                            Заметки спикера
                          </label>
                          <Textarea
                            value={slide.notes}
                            onChange={(e) => updateContentField(slide.slide_number, "notes", e.target.value)}
                            disabled={!isEditing}
                            className="bg-background/50 border-border/50 text-xs min-h-[60px] disabled:opacity-80"
                          />
                        </div>

                        {/* Edit/Save buttons */}
                        <div className="flex justify-end gap-2 pt-2">
                          {isEditing ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingSlide(null)}
                                className="text-xs h-7"
                              >
                                Отмена
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveSlide(slide.slide_number)}
                                disabled={isSaving}
                                className="text-xs h-7 gap-1"
                              >
                                {isSaving ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Save className="w-3 h-3" />
                                )}
                                Сохранить
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingSlide(slide.slide_number)}
                              className="text-xs h-7 gap-1"
                            >
                              <Pencil className="w-3 h-3" />
                              Редактировать
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Assemble button */}
            <div className="mt-8 pt-6 border-t border-border/50">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground/60 font-mono">
                  Нажмите «Собрать» для финальной генерации HTML-слайдов
                </p>
                <Button
                  onClick={handleAssemble}
                  disabled={isApproving}
                  className="gap-2 min-w-[200px]"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Запуск сборки...
                    </>
                  ) : (
                    <>
                      Утвердить и собрать
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── ASSEMBLING ─────────────────────────────── */}
        {step === "assembling" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-foreground font-medium">Финальная сборка</p>
            <p className="text-xs text-muted-foreground">{statusMessage}</p>
            <Progress value={progress} className="w-64 h-1" />
          </div>
        )}

        {/* ── COMPLETED ──────────────────────────────── */}
        {step === "completed" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <CheckCircle2 className="w-12 h-12 text-primary" />
            <h3
              className="text-xl font-semibold"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Презентация готова!
            </h3>
            <p className="text-sm text-muted-foreground">
              Интерактивная генерация завершена успешно
            </p>
            <Button
              onClick={() => navigate(`/view/${presentationId}`)}
              className="gap-2 mt-4"
            >
              <Eye className="w-4 h-4" />
              Открыть презентацию
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* ── ERROR ──────────────────────────────────── */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <XCircle className="w-12 h-12 text-destructive" />
            <h3
              className="text-xl font-semibold"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Ошибка генерации
            </h3>
            <p className="text-sm text-muted-foreground max-w-md text-center">
              {errorMessage}
            </p>
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="gap-2 mt-4"
            >
              <RotateCcw className="w-4 h-4" />
              Попробовать снова
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
