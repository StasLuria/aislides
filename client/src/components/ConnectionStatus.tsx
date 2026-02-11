/**
 * ConnectionStatus — Backend health indicator
 * Shows a small dot in the header indicating API connectivity
 */

import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";

export default function ConnectionStatus() {
  const [status, setStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = async () => {
      const result = await api.checkHealth();
      setStatus(result.status === "ok" ? "connected" : "disconnected");
    };

    check();
    intervalRef.current = setInterval(check, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const colors = {
    checking: "bg-yellow-400/60",
    connected: "bg-emerald-400",
    disconnected: "bg-red-400",
  };

  const labels = {
    checking: "Проверка...",
    connected: "API подключен",
    disconnected: "API недоступен",
  };

  return (
    <div className="flex items-center gap-1.5" title={labels[status]}>
      <div className={`w-1.5 h-1.5 rounded-full ${colors[status]} ${status === "connected" ? "animate-pulse" : ""}`} />
      <span className="text-[9px] font-mono text-muted-foreground/60 hidden sm:inline">
        {status === "connected" ? "API" : status === "disconnected" ? "offline" : "..."}
      </span>
    </div>
  );
}
