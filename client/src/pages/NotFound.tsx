import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
      <div className="text-center">
        <p
          className="text-8xl font-bold text-primary/20 mb-4"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          404
        </p>
        <h1
          className="text-xl font-semibold mb-2"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Страница не найдена
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Запрошенная страница не существует или была удалена
        </p>
        <Link href="/">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Button>
        </Link>
      </div>
    </div>
  );
}
