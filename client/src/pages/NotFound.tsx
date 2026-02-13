import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center">
      <div className="text-center">
        <p className="text-7xl font-bold text-primary/15 mb-4">
          404
        </p>
        <h1 className="text-xl font-semibold mb-2 text-foreground">
          Страница не найдена
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Запрошенная страница не существует или была удалена
        </p>
        <Link href="/chat">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Button>
        </Link>
      </div>
    </div>
  );
}
