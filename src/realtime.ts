import type { Response } from "express";
import WebSocket from "ws";

export type ServerMessage = {
  type: string;
};

export class RealtimeHub {
  private readonly sockets = new Set<WebSocket>();
  private readonly sseClients = new Set<Response>();
  private readonly sseHeartbeats = new WeakMap<Response, NodeJS.Timeout>();

  addSocket(socket: WebSocket) {
    this.sockets.add(socket);
    socket.on("close", () => this.sockets.delete(socket));
    socket.on("error", () => this.sockets.delete(socket));
  }

  addSse(response: Response) {
    this.sseClients.add(response);
    const heartbeat = setInterval(() => {
      if (!this.sendSse(response, "ping", JSON.stringify({ type: "ping", timestamp: Date.now() }))) {
        clearInterval(heartbeat);
      }
    }, 25_000);
    this.sseHeartbeats.set(response, heartbeat);
    response.on("close", () => this.removeSse(response));
  }

  send<T extends ServerMessage>(socket: WebSocket, message: T) {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
      } catch {
        this.sockets.delete(socket);
        socket.terminate();
      }
    }
  }

  forEachSocket(callback: (socket: WebSocket) => void) {
    for (const socket of this.sockets) callback(socket);
  }

  forEachSseClient(callback: (client: Response) => void) {
    for (const client of this.sseClients) callback(client);
  }

  sendSse(client: Response, event: string, payload: string) {
    try {
      const writable = client.write(`event: ${event}\n`) && client.write(`data: ${payload}\n\n`);
      if (!writable) {
        this.removeSse(client);
        client.end();
      }
      return writable;
    } catch {
      this.removeSse(client);
      return false;
    }
  }

  broadcast<T extends ServerMessage>(message: T) {
    const payload = JSON.stringify(message);
    for (const socket of this.sockets) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      if (socket.bufferedAmount > 1_000_000) {
        this.sockets.delete(socket);
        socket.terminate();
        continue;
      }
      try {
        socket.send(payload);
      } catch {
        this.sockets.delete(socket);
        socket.terminate();
      }
    }
    for (const client of this.sseClients) {
      this.sendSse(client, message.type, payload);
    }
  }

  private removeSse(response: Response) {
    this.sseClients.delete(response);
    const heartbeat = this.sseHeartbeats.get(response);
    if (heartbeat) clearInterval(heartbeat);
    this.sseHeartbeats.delete(response);
  }
}
