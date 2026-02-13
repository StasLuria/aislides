/**
 * ChatSidebar — Collapsible sidebar with chat session history.
 * Clean Light Design: white background, subtle borders, soft shadows.
 * Supports inline title editing and real-time title updates.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  Pencil,
  Check,
  X,
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
  /** Real-time title update from SSE */
  updatedTitle?: string | null;
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
  updatedTitle,
}: ChatSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

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

  // Apply real-time title update from SSE
  useEffect(() => {
    if (updatedTitle && currentSessionId) {
      setSessions((prev) =>
        prev.map((s) =>
          s.session_id === currentSessionId
            ? { ...s, topic: updatedTitle }
            : s,
        ),
      );
    }
  }, [updatedTitle, currentSessionId]);

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (deletingId) return;
    setConfirmDeleteId(sessionId);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId || deletingId) return;
    const sessionId = confirmDeleteId;
    setConfirmDeleteId(null);
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

  const handleDeleteCancel = () => {
    setConfirmDeleteId(null);
  };

  const startEditing = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingId(session.session_id);
    setEditValue(session.topic === "Новый чат" ? "" : session.topic);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveTitle = async (sessionId: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }

    try {
      await fetch(`${API_BASE}/sessions/${sessionId}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      setSessions((prev) =>
        prev.map((s) =>
          s.session_id === sessionId ? { ...s, topic: trimmed } : s,
        ),
      );
    } catch {
      toast.error("Не удалось сохранить название");
    } finally {
      setEditingId(null);
    }
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
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
            const isEditing = editingId === session.session_id;

            return (
              <div
                key={session.session_id}
                onClick={() => !isEditing && onSelectSession(session.session_id)}
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
                  {isEditing ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveTitle(session.session_id);
                          if (e.key === "Escape") cancelEditing();
                        }}
                        className="text-xs w-full bg-background border border-primary/30 rounded px-1.5 py-0.5 outline-none focus:border-primary"
                        placeholder="Название чата..."
                      />
                      <button
                        onClick={() => saveTitle(session.session_id)}
                        className="p-0.5 rounded hover:bg-primary/10 text-primary"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="p-0.5 rounded hover:bg-secondary text-muted-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <p
                      className={`text-xs truncate leading-tight ${
                        isActive ? "font-medium" : ""
                      }`}
                    >
                      {session.topic || "Новый чат"}
                    </p>
                  )}
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

                {/* Edit & Delete buttons */}
                {!isEditing && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startEditing(e, session)}
                      className="p-1 rounded-md hover:bg-primary/10 text-muted-foreground/40 hover:text-primary"
                      title="Переименовать"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(e, session.session_id)}
                      className={`
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
                )}
              </div>
            );
          })
        )}
      </div>
      {/* Delete confirmation overlay */}
      {confirmDeleteId && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-4 shadow-lg max-w-[220px] w-full">
            <p className="text-xs font-medium text-foreground mb-1">Удалить чат?</p>
            <p className="text-[10px] text-muted-foreground mb-3">Это действие нельзя отменить.</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteCancel}
                className="flex-1 h-7 text-[11px]"
              >
                Отмена
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteConfirm}
                className="flex-1 h-7 text-[11px]"
              >
                Удалить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
