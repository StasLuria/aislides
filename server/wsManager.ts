/**
 * WebSocket Manager — handles real-time progress updates for presentation generation.
 * Uses native ws library via the HTTP server upgrade mechanism.
 */
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";

interface WsClient {
  ws: WebSocket;
  presentationId: string;
}

class WsManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<WebSocket>> = new Map();

  register(server: Server) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request: IncomingMessage, socket, head) => {
      const url = request.url || "";

      // Handle /ws/{presentationId}
      const wsMatch = url.match(/^\/ws\/([a-zA-Z0-9_-]+)/);
      if (wsMatch && this.wss) {
        const presentationId = wsMatch[1];
        this.wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          this.handleConnection(ws, presentationId);
        });
        return;
      }

      // Not a WS route we handle — let other upgrade handlers (like Vite HMR) handle it
    });
  }

  private handleConnection(ws: WebSocket, presentationId: string) {
    console.log(`[WS] Client connected for presentation: ${presentationId}`);

    if (!this.clients.has(presentationId)) {
      this.clients.set(presentationId, new Set());
    }
    this.clients.get(presentationId)!.add(ws);

    // Send initial connection confirmation
    ws.send(
      JSON.stringify({
        type: "connection.established",
        data: { presentation_id: presentationId },
      }),
    );

    ws.on("close", () => {
      console.log(`[WS] Client disconnected for presentation: ${presentationId}`);
      const clients = this.clients.get(presentationId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          this.clients.delete(presentationId);
        }
      }
    });

    ws.on("error", (err: Error) => {
      console.error(`[WS] Error for presentation ${presentationId}:`, err);
    });
  }

  /**
   * Send progress event to all clients watching a presentation.
   * Event format matches the Python backend ws_manager.py:
   * { type: "generation.progress", data: { ... } }
   */
  sendProgress(
    presentationId: string,
    data: {
      node_name: string;
      current_step: string;
      progress_percentage: number;
      html_content?: string;
      message?: string;
    },
  ) {
    const clients = this.clients.get(presentationId);
    if (!clients || clients.size === 0) return;

    const payload = JSON.stringify({
      type: "generation.progress",
      data: {
        presentation_id: presentationId,
        ...data,
      },
    });

    Array.from(clients).forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }

  /**
   * Send completion event.
   */
  sendCompleted(
    presentationId: string,
    data: {
      result_urls: Record<string, string>;
      slide_count: number;
      title: string;
    },
  ) {
    const clients = this.clients.get(presentationId);
    if (!clients || clients.size === 0) return;

    const payload = JSON.stringify({
      type: "generation.completed",
      data: {
        presentation_id: presentationId,
        ...data,
      },
    });

    Array.from(clients).forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }

  /**
   * Send error event.
   */
  sendError(
    presentationId: string,
    data: {
      error_message: string;
      error_type: string;
    },
  ) {
    const clients = this.clients.get(presentationId);
    if (!clients || clients.size === 0) return;

    const payload = JSON.stringify({
      type: "generation.error",
      data: {
        presentation_id: presentationId,
        ...data,
      },
    });

    Array.from(clients).forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }

  getClientCount(presentationId: string): number {
    return this.clients.get(presentationId)?.size || 0;
  }
}

// Singleton
export const wsManager = new WsManager();
