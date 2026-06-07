import React from "react";
import type { ControlCommand, ModuleName, PerformanceState } from "../types";

export type ConnectionState = "connecting" | "connected" | "offline";

export type ServerMessage =
  | { type: "state.snapshot"; state: PerformanceState }
  | { type: "state.patch"; state?: PerformanceState; module: ModuleName; patch: Record<string, unknown>; updatedAt?: number }
  | { type: "show.patch"; patch: PerformanceState["show"]; updatedAt?: number }
  | { type: "control.ack"; ok: boolean; command: ControlCommand }
  | { type: "client.presence"; state?: PerformanceState }
  | { type: "error"; error: string }
  | { type: string; [key: string]: unknown };

export function isStateSnapshot(message: ServerMessage): message is Extract<ServerMessage, { type: "state.snapshot" }> {
  return message.type === "state.snapshot";
}

export function isStatePatch(message: ServerMessage): message is Extract<ServerMessage, { type: "state.patch" }> {
  return message.type === "state.patch";
}

export function isShowPatch(message: ServerMessage): message is Extract<ServerMessage, { type: "show.patch" }> {
  return message.type === "show.patch";
}

export function isControlAck(message: ServerMessage): message is Extract<ServerMessage, { type: "control.ack" }> {
  return message.type === "control.ack";
}

export function isErrorMessage(message: ServerMessage): message is Extract<ServerMessage, { type: "error" }> {
  return message.type === "error";
}

export function applyStatePatch(state: PerformanceState, message: Extract<ServerMessage, { type: "state.patch" }>): PerformanceState {
  const { audioSources, ...modulePatch } = message.patch;
  return {
    ...state,
    updatedAt: message.updatedAt || Date.now(),
    audioSources: isPlainRecord(audioSources)
      ? mergePatch(state.audioSources, audioSources)
      : state.audioSources,
    modules: {
      ...state.modules,
      [message.module]: mergePatch(state.modules[message.module], modulePatch)
    }
  };
}

export function applyShowPatch(state: PerformanceState, message: Extract<ServerMessage, { type: "show.patch" }>): PerformanceState {
  return {
    ...state,
    updatedAt: message.updatedAt || Date.now(),
    show: mergePatch(state.show, message.patch as unknown as Record<string, unknown>)
  };
}

function mergePatch<T>(target: T, patch: Record<string, unknown>): T {
  if (!isPlainRecord(target)) return patch as T;
  const next: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainRecord(value) && isPlainRecord(next[key])) {
      next[key] = mergePatch(next[key], value);
    } else {
      next[key] = value;
    }
  }
  return next as T;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env || {};
const configuredShowBackendUrl = String(env.VITE_SHOW_BACKEND_URL || "").trim().replace(/\/$/, "");
const configuredShowWsUrl = String(env.VITE_SHOW_WS_URL || "").trim().replace(/\/$/, "");
const hostedShowBackendUrl = "https://vad-26-show-control.saintmob.workers.dev";
const hostedShowWsUrl = "wss://vad-26-show-control.saintmob.workers.dev/ws";

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export function apiUrl(path: string) {
  const backendUrl = configuredShowBackendUrl || (isPublicRuntime() ? hostedShowBackendUrl : "");
  return withRoom(backendUrl ? `${backendUrl}${path}` : path);
}

export function webSocketUrl(path: string) {
  if (configuredShowWsUrl) return withRoom(configuredShowWsUrl);
  const backendUrl = configuredShowBackendUrl || (isPublicRuntime() ? hostedShowBackendUrl : "");
  if (backendUrl) {
    const url = new URL(path, backendUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return withRoom(url.toString());
  }
  if (isPublicRuntime()) return withRoom(hostedShowWsUrl);
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return withRoom(`${protocol}://${window.location.host}${path}`);
}

function isPublicRuntime() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return !(
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

export function currentRoom() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("room") || new URLSearchParams(window.location.search).get("showId") || "";
}

function withRoom(path: string) {
  const room = currentRoom().trim();
  if (!room) return path;
  const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(path);
  const url = new URL(path, window.location.origin);
  url.searchParams.set("room", room);
  return absolute ? url.toString() : `${url.pathname}${url.search}`;
}

export function useWebSocket(
  clientId: string,
  capabilities: string[],
  onMessage: (message: ServerMessage) => void,
  onConnectionChange: (status: ConnectionState) => void
) {
  React.useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    function connect() {
      if (closed) return;
      onConnectionChange("connecting");
      socket = new WebSocket(webSocketUrl("/ws"));
      socket.addEventListener("open", () => {
        onConnectionChange("connected");
        socket?.send(JSON.stringify({
          type: "client.hello",
          clientId,
          module: "dashboard",
          role: "control-room",
          capabilities
        }));
        heartbeatTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "heartbeat", clientId, sentAt: Date.now() }));
          }
        }, 25_000);
      });
      socket.addEventListener("message", (event) => {
        onMessage(JSON.parse(event.data) as ServerMessage);
      });
      socket.addEventListener("close", () => {
        if (closed) return;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        onConnectionChange("offline");
        reconnectTimer = setTimeout(connect, 1200);
      });
    }

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      socket?.close();
    };
  }, [clientId, capabilities]);
}

export function fetchInitialState() {
  return fetchJson<PerformanceState>(apiUrl("/api/state"));
}
