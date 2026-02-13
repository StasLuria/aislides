/**
 * ChatSidebar — Collapsible sidebar with chat session history.
 * Clean Light Design: white background, subtle borders, soft shadows.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface ChatSession {
  session_id: string;
  topic: string;
  phase: string;
  mode: string;
  presentation_id: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

interface ChatSidebarProps {
  currentSessionId: string | null;
  onNewChat: () => Promise<void>;
  onSelectSession: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  refreshTrigger?: number;
}

const API_BASE = "/api/v1/chat";

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffHr < 24) return `${diffHr} ч назад`;
  if (diffDay < 7) return `${diffDay} дн назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function ChatSidebar({
  currentSessionId,
  onNewChat,
  onSelectSession,
  isCollapsed,
  onToggleCollapse,
  refreshTrigger,
}: ChatSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions?limit=50`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, refreshTrigger]);

  useEffect(() => {
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (deletingId) return;

    setDeletingId(sessionId);
    try {
      await fetch(`${API_BASE}/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (sessionId === currentSessionId) {
        await onNewChat();
      }
      toast.success("Чат удалён");
    } catch {
      toast.error("Не удалось удалить чат");
    } finally {
      setDeletingId(null);
    }
  };

  // Collapsed state
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-3 px-1.5 border-r border-border bg-sidebar">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
          title="Открыть историю чатов"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewChat}
          className="h-8 w-8 mt-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
          title="Новый чат"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 flex flex-col border-r border-border bg-sidebar shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">
          История чатов
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="Свернуть"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* New chat button */}
      <div className="px-3 py-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onNewChat}
          className="w-full gap-2 text-xs h-8 border-dashed hover:border-primary/50 hover:bg-primary/5"
        >
          <Plus className="w-3.5 h-3.5" />
          Новый чат
        </Button>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/60">Нет чатов</p>
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session.session_id === currentSessionId;
            return (
              <div
                key={session.session_id}
                onClick={() => onSelectSession(session.session_id)}
                className={`
                  group flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors relative
                  ${
                    isActive
                      ? "bg-primary/8 text-foreground"
                      : "hover:bg-secondary text-foreground/80"
                  }
                `}
              >
                <MessageSquare
                  className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                    isActive ? "text-primary" : "text-muted-foreground/50"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs truncate leading-tight ${
                      isActive ? "font-medium" : ""
                    }`}
                  >
                    {session.topic || "Новый чат"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeDate(session.updated_at)}
                    </span>
                    {session.message_count > 0 && (
                      <span className="text-[10px] text-muted-foreground/60">
                        · {session.message_count}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(e, session.session_id)}
                  className={`
                    opacity-0 group-hover:opacity-100 transition-opacity
                    p-1 rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive
                    ${deletingId === session.session_id ? "opacity-100" : ""}
                  `}
                  title="Удалить чат"
                >
                  {deletingId === session.session_id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
