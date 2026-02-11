/**
 * Home Page — Presentation Creation Form
 * Swiss Precision Design: Asymmetric two-panel layout
 * Left: Hero with branding. Right: Creation form.
 * Typography-driven, dark canvas, indigo accent.
 *
 * Slide count is auto-determined by the AI pipeline
 * based on the "one slide = one idea" principle.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";  // still used for mode selector
import { toast } from "sonner";
import { ArrowRight, Sparkles, Layers, Zap, FileText, ImageIcon } from "lucide-react";
import api from "@/lib/api";
import type { GenerationMode } from "@/lib/api";
import { THEME_PRESETS } from "@/lib/constants";

const HERO_BG = "https://private-us-east-1.manuscdn.com/sessionFile/KBKMulqyrRTtBkQ7DeuSuk/sandbox/fEV2zCiRVgoVEHmhF3i7FE-img-1_1770801497000_na1fn_aGVyby1hYnN0cmFjdC1kYXJr.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvS0JLTXVscXlyUlR0QmtRN0RldVN1ay9zYW5kYm94L2ZFVjJ6Q2lSVmdvVkVIbWhGM2k3RkUtaW1nLTFfMTc3MDgwMTQ5NzAwMF9uYTFmbl9hR1Z5YnkxaFluTjBjbUZqZEMxa1lYSnIucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=LZlCpAF7k39vnxKR-fYXrbMuJk1GdZcoNJny-6LmeJ3WYK4wloe-hhsrJmYFA1P4-NLzjW5mZ~uZ0sdj4QTS85hYQ79w2Jz7zGEfNQxVC-XJgGuluGsuska92Rt4vQwB3hHgQ3551NZLIZPJkrKfdnkiz5DAecFD5GFSzb6kr9FrJTPbwUUltMSU1KQsrfAAfxjNSIw8V6n54vXlo3h8tLHCrkCUwJeRacYuR1P5-qSVj~~EiHZGJNrzmpMQ~p21YsZVwqWj4CePsXVL~IfhCTl334t4Awq25MUYG-su9Nnoq~LOfHXlkWwBZnauyi-Qhkoww6ec~geIElOz2QefMg__";

export default function Home() {

  const [, navigate] = useLocation();
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<GenerationMode>("batch");
  const [theme, setTheme] = useState("corporate_blue");
  const [enableImages, setEnableImages] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast.error("Введите тему презентации");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "interactive") {
        // Interactive mode — start step-by-step flow
        const result = await api.startInteractive({
          prompt: prompt.trim(),
          config: { theme_preset: theme },
        });
        navigate(`/interactive/${result.presentation_id}`);
      } else {
        // Batch mode — full auto generation
        const result = await api.createPresentation({
          prompt: prompt.trim(),
          mode,
          config: {
            theme_preset: theme,
            enable_images: enableImages,
          },
        });
        navigate(`/generate/${result.presentation_id}`);
      }
    } catch (error) {
      console.error("Failed to create presentation:", error);
      toast.error("Не удалось создать презентацию. Проверьте подключение к серверу.");
      setIsSubmitting(false);
    }
  };

  const features = [
    {
      icon: Sparkles,
      title: "AI-агенты",
      desc: "Команда специализированных агентов для контента и дизайна",
    },
    {
      icon: Layers,
      title: "1 слайд = 1 мысль",
      desc: "AI сам определит оптимальное количество слайдов",
    },
    {
      icon: Zap,
      title: "~60 секунд",
      desc: "Полная генерация презентации за минуту",
    },
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Two-panel layout */}
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-3.5rem)]">
        {/* Left panel — Hero */}
        <div className="relative lg:w-[45%] flex flex-col justify-between p-8 lg:p-12 overflow-hidden">
          {/* Background image */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: `url(${HERO_BG})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />

          {/* Content */}
          <div className="relative z-10 flex flex-col justify-center flex-1 max-w-lg">
            <div className="section-number mb-6">01 — ГЕНЕРАТОР</div>

            <h1
              className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight leading-[1.1] mb-6"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Презентации
              <br />
              <span className="text-primary">за минуту</span>
            </h1>

            <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-10 max-w-md">
              Введите тему — получите готовую презентацию. AI-агенты
              создадут контент, подберут дизайн и соберут слайды.
            </p>

            {/* Feature cards */}
            <div className="space-y-4">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 group"
                >
                  <div className="w-9 h-9 rounded-md bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/12 transition-colors">
                    <feature.icon className="w-4 h-4 text-primary/70" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground/90">
                      {feature.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {feature.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom attribution */}
          <div className="relative z-10 mt-8">
            <div className="swiss-divider mb-4" />
            <p className="text-[11px] text-muted-foreground font-mono">
              Powered by LLM Pipeline + 18 HTML Templates
            </p>
          </div>
        </div>

        {/* Right panel — Form */}
        <div className="lg:w-[55%] flex items-center justify-center p-8 lg:p-12 border-l border-border/50">
          <div className="w-full max-w-lg space-y-8">
            {/* Form header */}
            <div>
              <div className="section-number mb-3">02 — СОЗДАНИЕ</div>
              <h2
                className="text-2xl font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Новая презентация
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Опишите тему и запустите генерацию — AI определит структуру
              </p>
            </div>

            {/* Prompt */}
            <div className="space-y-2.5">
              <Label
                htmlFor="prompt"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Тема презентации
              </Label>
              <Textarea
                id="prompt"
                placeholder="Например: Стратегия развития компании на 2026 год с фокусом на AI-технологии и автоматизацию бизнес-процессов"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[140px] resize-none bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-primary/20 text-sm leading-relaxed"
              />
              <div className="flex justify-between">
                <p className="text-[11px] text-muted-foreground font-mono">
                  Чем подробнее описание, тем лучше результат
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {prompt.length}/2000
                </p>
              </div>
            </div>

            {/* Mode selector */}
            <div className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Режим
              </Label>
              <Select value={mode} onValueChange={(v) => setMode(v as GenerationMode)}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="batch">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-primary" />
                      <span>Автоматический</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="interactive">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span>Интерактивный</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {mode === "batch"
                  ? "Полная генерация без остановок"
                  : "С утверждением структуры и контента"}
              </p>
            </div>

            {/* Theme selector — visual gradient grid */}
            <div className="space-y-3">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Тема дизайна
              </Label>
              <div className="grid grid-cols-5 gap-2">
                {THEME_PRESETS.map((t) => {
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all duration-200 ${
                        isSelected
                          ? "bg-primary/10 ring-2 ring-primary/50"
                          : "hover:bg-secondary/60"
                      }`}
                    >
                      <div
                        className={`w-full aspect-[16/10] rounded-md shadow-sm transition-transform duration-200 ${
                          isSelected ? "scale-105 shadow-md" : "group-hover:scale-105"
                        }`}
                        style={{ background: t.gradient }}
                      />
                      <span className={`text-[10px] leading-tight text-center transition-colors ${
                        isSelected ? "text-primary font-medium" : "text-muted-foreground"
                      }`}>
                        {t.nameRu}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Image generation toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/40">
              <div className="flex items-center gap-3">
                <ImageIcon className="w-4 h-4 text-primary/60 shrink-0" />
                <div>
                  <p className="text-xs text-foreground/80 font-medium">
                    AI-иллюстрации
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Автоматическая генерация изображений для слайдов
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEnableImages(!enableImages)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                  enableImages ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    enableImages ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Info about auto slide count */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Layers className="w-4 h-4 text-primary/60 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-foreground/80 font-medium">
                  Количество слайдов определяется автоматически
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  AI анализирует тему и создаёт оптимальную структуру по принципу «один слайд — одна мысль»
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="swiss-divider" />

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !prompt.trim()}
              size="lg"
              className="w-full h-12 text-sm font-medium gap-2 bg-primary hover:bg-primary/90 text-primary-foreground glow-indigo"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Запуск генерации...
                </>
              ) : (
                <>
                  Создать презентацию
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>

            <p className="text-[10px] text-center text-muted-foreground/60 font-mono">
              Генерация занимает ~60 секунд • AI-агенты • HTML-вывод
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
