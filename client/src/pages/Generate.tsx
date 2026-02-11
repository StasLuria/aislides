/**
 * Generate Page — Real-time presentation generation progress
 * Swiss Precision: Dual-column layout
 * Left: Progress timeline with agent statuses
 * Right: Live slide preview as they're generated
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  StopCircle,
  RotateCcw,
} from "lucide-react";
import api from "@/lib/api";
import type { PresentationDetail, WSEvent } from "@/lib/api";
import { GENERATION_STEPS, AGENTS } from "@/lib/constants";

const GENERATING_BG = "https://private-us-east-1.manuscdn.com/sessionFile/KBKMulqyrRTtBkQ7DeuSuk/sandbox/fEV2zCiRVgoVEHmhF3i7FE-img-4_1770801499000_na1fn_Z2VuZXJhdGluZy1hbmltYXRpb24tZnJhbWU.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvS0JLTXVscXlyUlR0QmtRN0RldVN1ay9zYW5kYm94L2ZFVjJ6Q2lSVmdvVkVIbWhGM2k3RkUtaW1nLTRfMTc3MDgwMTQ5OTAwMF9uYTFmbl9aMlZ1WlhKaGRHbHVaeTFoYm1sdFlYUnBiMjR0Wm5KaGJXVS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=VoGstkcW5sRaheRSd~ianqfuguVr9O3w3w5bz~fmM5jBX78hDLctPFA9bkQSV3eg6u55WyJKG6AMIyrSbmC8IaRb-aeqy~xC9E1t7jW-MadlraSjCXTz7uCbHqYmfnAh1mIPam6D3t3~wfWCorNJkrMZ3fZnd9xSgPI8dhGv7bSSLSwzTgkTRUtrWzx6em2QZgzHu-sUrBJQ~xWrSW3UXcHMq6MIryr52QS0-CiuXwXAo4zpKn9cIzXU9l9tIIlftFqDOady9VNCuLlyPNoA2YzAf9Ae9Bn8v2lYxzRNYJ5MWiqVh7Ih4biYnLftyfKNdCTRbVEmrRNr6zKoDvn4rA__";

interface StepStatus {
  key: string;
  status: "pending" | "active" | "completed" | "error";
  message?: string;
}

export default function Generate() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const presentationId = params.id || "";

  const [presentation, setPresentation] = useState<PresentationDetail | null>(null);
  const [steps, setSteps] = useState<StepStatus[]>(
    GENERATION_STEPS.map((s) => ({ key: s.key, status: "pending" }))
  );
  const [progress, setProgress] = useState(0);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [slidePreviewHtml, setSlidePreviewHtml] = useState<string | null>(null);
  const [slidePreviews, setSlidePreviews] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer
  useEffect(() => {
    if (!isCompleted && !isFailed) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCompleted, isFailed]);

  // Update step status based on progress
  const updateStepsFromProgress = useCallback((percent: number, step?: string | null) => {
    setSteps((prev) =>
      prev.map((s) => {
        const stepDef = GENERATION_STEPS.find((gs) => gs.key === s.key);
        if (!stepDef) return s;

        if (stepDef.percent <= percent && s.key !== "completed") {
          return { ...s, status: "completed" };
        }
        if (step && s.key === step) {
          return { ...s, status: "active" };
        }
        // Find the current active step
        const activeStep = GENERATION_STEPS.find(
          (gs) => gs.percent > percent
        );
        if (activeStep && s.key === activeStep.key) {
          return { ...s, status: "active" };
        }
        return s;
      })
    );
  }, []);

  // Handle WebSocket events
  const handleWSEvent = useCallback(
    (event: WSEvent) => {
      switch (event.event) {
        case "generation.started":
          setProgress(2);
          break;

        case "generation.progress": {
          const p = (event.data.progress_percent as number) || 0;
          const step = event.data.current_step as string | undefined;
          const agent = event.data.agent as string | undefined;
          setProgress(p);
          if (agent) setCurrentAgent(agent);
          updateStepsFromProgress(p, step);
          break;
        }

        case "generation.slide_preview": {
          const html = event.data.html as string;
          if (html) {
            setSlidePreviewHtml(html);
            setSlidePreviews((prev) => [...prev, html]);
          }
          break;
        }

        case "generation.completed":
          setProgress(100);
          setIsCompleted(true);
          setSteps((prev) =>
            prev.map((s) => ({ ...s, status: "completed" }))
          );
          toast.success("Презентация готова!");
          break;

        case "generation.failed": {
          setIsFailed(true);
          const errMsg =
            (event.data.error as string) || "Произошла ошибка генерации";
          setErrorMessage(errMsg);
          setSteps((prev) =>
            prev.map((s) =>
              s.status === "active" ? { ...s, status: "error" } : s
            )
          );
          toast.error("Ошибка генерации");
          break;
        }

        case "generation.interrupt":
          // Interactive mode — waiting for user
          toast.info("Требуется ваше решение");
          break;

        default:
          break;
      }
    },
    [updateStepsFromProgress]
  );

  // Connect WebSocket + polling fallback
  useEffect(() => {
    if (!presentationId) return;

    // Try WebSocket
    try {
      wsRef.current = api.connectWebSocket(
        presentationId,
        handleWSEvent,
        () => {
          // On WS error, fall back to polling
          startPolling();
        },
        () => {
          // On close, check if we need to poll
          if (!isCompleted && !isFailed) {
            startPolling();
          }
        }
      );
    } catch {
      startPolling();
    }

    // Also start polling as backup
    startPolling();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationId]);

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.getPresentation(presentationId);
        setPresentation(data);
        setProgress(data.progress_percent);
        updateStepsFromProgress(data.progress_percent, data.current_step);

        if (data.status === "completed") {
          setIsCompleted(true);
          setSteps((prev) =>
            prev.map((s) => ({ ...s, status: "completed" }))
          );
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === "failed") {
          setIsFailed(true);
          setErrorMessage(
            (data.error_info?.message as string) || "Ошибка генерации"
          );
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);
  };

  const handleCancel = async () => {
    try {
      await api.cancelPresentation(presentationId);
      toast.info("Генерация отменена");
      navigate("/");
    } catch {
      toast.error("Не удалось отменить");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Top progress bar */}
      <div
        className="top-progress-bar"
        style={{ width: `${progress}%` }}
      />

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-3.5rem)]">
        {/* Left panel — Progress timeline */}
        <div className="lg:w-[40%] p-8 lg:p-10 border-r border-border/50">
          {/* Header */}
          <div className="mb-8">
            <div className="section-number mb-3">03 — ГЕНЕРАЦИЯ</div>
            <h2
              className="text-2xl font-semibold tracking-tight mb-2"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {isCompleted
                ? "Презентация готова"
                : isFailed
                  ? "Ошибка генерации"
                  : "Генерация..."}
            </h2>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{formatTime(elapsedTime)}</span>
              <span className="font-mono text-xs">{Math.round(progress)}%</span>
              <span className="font-mono text-xs truncate max-w-[200px]">
                ID: {presentationId.slice(0, 8)}...
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <Progress value={progress} className="h-1" />
          </div>

          {/* Steps timeline */}
          <div className="space-y-1">
            {GENERATION_STEPS.slice(0, -1).map((step, i) => {
              const stepState = steps.find((s) => s.key === step.key);
              const status = stepState?.status || "pending";
              const agentInfo = AGENTS[step.agent as keyof typeof AGENTS];

              return (
                <div
                  key={step.key}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200
                    ${status === "active" ? "bg-primary/5 border border-primary/15" : ""}
                    ${status === "completed" ? "opacity-60" : ""}
                    ${status === "error" ? "bg-destructive/5 border border-destructive/15" : ""}
                  `}
                >
                  {/* Step number */}
                  <span className="font-mono text-[10px] text-muted-foreground w-5 text-right shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Status icon */}
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {status === "completed" && (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    )}
                    {status === "active" && (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    )}
                    {status === "error" && (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    {status === "pending" && (
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>

                  {/* Step info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm ${
                          status === "active"
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {status === "active" && agentInfo && (
                      <span className="text-[10px] text-primary/70 font-mono">
                        {agentInfo.nameRu}
                      </span>
                    )}
                  </div>

                  {/* Team badge */}
                  <span
                    className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      agentInfo?.team === "content"
                        ? "text-blue-400/60 bg-blue-400/5"
                        : "text-purple-400/60 bg-purple-400/5"
                    }`}
                  >
                    {agentInfo?.team === "content" ? "CTN" : "DSN"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="mt-8 space-y-3">
            <div className="swiss-divider" />
            <div className="flex gap-3 pt-3">
              {isCompleted && (
                <Button
                  onClick={() => navigate(`/view/${presentationId}`)}
                  className="flex-1 gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Открыть презентацию
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              {isFailed && (
                <Button
                  onClick={() => navigate("/")}
                  variant="outline"
                  className="flex-1 gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Попробовать снова
                </Button>
              )}
              {!isCompleted && !isFailed && (
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1 gap-2 text-destructive hover:text-destructive"
                >
                  <StopCircle className="w-4 h-4" />
                  Отменить
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right panel — Preview */}
        <div className="lg:w-[60%] flex flex-col items-center justify-center p-8 lg:p-10 relative">
          {/* Background decoration */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url(${GENERATING_BG})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-background/90" />

          <div className="relative z-10 w-full max-w-2xl">
            {/* Preview header */}
            <div className="flex items-center justify-between mb-4">
              <span className="section-number">ПРЕВЬЮ</span>
              {slidePreviews.length > 0 && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  {slidePreviews.length} слайд(ов)
                </span>
              )}
            </div>

            {/* Slide preview */}
            <div className="slide-frame">
              {slidePreviewHtml ? (
                <iframe
                  srcDoc={slidePreviewHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                  title="Slide Preview"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                  {!isCompleted && !isFailed && (
                    <>
                      <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                          {currentAgent
                            ? `${AGENTS[currentAgent as keyof typeof AGENTS]?.nameRu || currentAgent} работает...`
                            : "Подготовка к генерации..."}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50 font-mono mt-1">
                          Превью появится по мере готовности слайдов
                        </p>
                      </div>
                    </>
                  )}
                  {isCompleted && (
                    <div className="text-center">
                      <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" />
                      <p className="text-sm text-foreground font-medium">
                        Презентация готова
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-1">
                        {presentation?.slide_count || "?"} слайдов •{" "}
                        {formatTime(elapsedTime)}
                      </p>
                    </div>
                  )}
                  {isFailed && (
                    <div className="text-center">
                      <XCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
                      <p className="text-sm text-destructive font-medium">
                        Ошибка генерации
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-1 max-w-xs">
                        {errorMessage}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Slide thumbnails */}
            {slidePreviews.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {slidePreviews.map((html, i) => (
                  <button
                    key={i}
                    onClick={() => setSlidePreviewHtml(html)}
                    className={`shrink-0 w-24 h-14 rounded border overflow-hidden transition-all ${
                      slidePreviewHtml === html
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-border/50 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <iframe
                      srcDoc={html}
                      className="w-[320px] h-[180px] border-0 pointer-events-none"
                      style={{ transform: "scale(0.075)", transformOrigin: "top left" }}
                      tabIndex={-1}
                      title={`Slide ${i + 1}`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
