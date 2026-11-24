import type { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { resolveUserFromHeaders } from './auth.ts';

interface ClientMeta {
  userId: number | null;
}

class RealtimeHub {
  private wss: WebSocketServer | null = null;
  private clients = new Map<WebSocket, ClientMeta>();
  private userSockets = new Map<number, Set<WebSocket>>();

  attach(server: HttpServer) {
    if (this.wss) return;
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', async (ws, req) => {
      const meta: ClientMeta = { userId: null };
      this.clients.set(ws, meta);

      try {
        const user = await resolveUserFromHeaders(req.headers.cookie, undefined);
        if (user) {
          this.bindUserSocket(ws, user.id);
        }
      } catch (err) {
        console.error('WebSocket initial auth failed:', err);
      }

      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg?.type === 'auth' && typeof msg.token === 'string') {
            const user = await resolveUserFromHeaders(undefined, `Bearer ${msg.token}`);
            if (user) {
              this.bindUserSocket(ws, user.id);
            }
          } else if (msg?.type === 'auth:refresh') {
            const user = await resolveUserFromHeaders(req.headers.cookie, undefined);
            if (user) {
              this.bindUserSocket(ws, user.id);
            }
          }
        } catch {
          // Ignore malformed client frames
        }
      });

      ws.on('close', () => {
        const existing = this.clients.get(ws);
        if (existing?.userId) {
          const set = this.userSockets.get(existing.userId);
          set?.delete(ws);
          if (set && set.size === 0) {
            this.userSockets.delete(existing.userId);
          }
        }
        this.clients.delete(ws);
      });

      ws.send(JSON.stringify({ event: 'connected', data: { ok: true } }));
    });
  }

  private bindUserSocket(ws: WebSocket, userId: number) {
    const prev = this.clients.get(ws);
    if (prev?.userId && prev.userId !== userId) {
      this.userSockets.get(prev.userId)?.delete(ws);
    }
    this.clients.set(ws, { userId });
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(ws);
  }

  broadcastAll(event: string, data: unknown) {
    const payload = JSON.stringify({ event, data });
    for (const [ws] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  sendToUser(userId: number, event: string, data: unknown) {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    const payload = JSON.stringify({ event, data });
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  sendToUsers(userIds: number[], event: string, data: unknown) {
    const unique = new Set(userIds);
    for (const uid of unique) {
      this.sendToUser(uid, event, data);
    }
  }
}

export const realtimeHub = new RealtimeHub();
