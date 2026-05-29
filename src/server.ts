import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import express, { Express, Request, Response } from "express";
import { WebSocket, WebSocketServer } from "ws";
import { performanceSpec } from "./contract.js";
import { loadSnapshotSync, SnapshotWriter } from "./persistence.js";
import { RealtimeHub } from "./realtime.js";
import {
  createDefaultState,
  isModuleName,
  normalizeAudioFrame,
  normalizeControlCommand,
  resolveStateScreenPresentation,
  resolveStateScreenRoutes,
  ShowStateStore
} from "./state.js";
import { AudioFrame, ClientHelloMessage, ControlCommand, JsonRecord, ModuleName, PerformanceState } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SHOW_CONTROL_PORT = 4300;
const defaultSnapshotPath = () => process.env.SHOW_STATE_PATH || path.join(process.cwd(), "data", "show-state.json");

function getLanAddresses(port: number) {
  const addresses = new Set<string>();
  const interfaces = os.networkInterfaces();

  for (const infos of Object.values(interfaces)) {
    for (const info of infos || []) {
      if (!info) continue;
      const isBenchmarkRange = info.address.startsWith("198.18.") || info.address.startsWith("198.19.");
      if (info.family === "IPv4" && !info.internal && !isBenchmarkRange) {
        addresses.add(`http://${info.address}:${port}`);
      }
    }
  }

  return [...addresses];
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeConfiguredOrigin(value: unknown) {
  const input = String(value || "").trim();
  if (!input) return null;
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function resolveRequestOrigin(headers: http.IncomingHttpHeaders, secure = false) {
  const configuredOrigin = normalizeConfiguredOrigin(process.env.SHOW_SCREEN_ROUTE_ORIGIN || process.env.SHOW_PUBLIC_ORIGIN);
  if (configuredOrigin) return configuredOrigin;

  const forwardedProto = String(getHeaderValue(headers["x-forwarded-proto"]) || "").split(",")[0].trim().toLowerCase();
  const forwardedHost = String(getHeaderValue(headers["x-forwarded-host"]) || "").split(",")[0].trim();
  const host = forwardedHost || getHeaderValue(headers.host) || `localhost:${SHOW_CONTROL_PORT}`;
  const protocol = forwardedProto === "https" || secure ? "https:" : "http:";
  try {
    const url = new URL(`${protocol}//${host}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return `${protocol}//localhost:${SHOW_CONTROL_PORT}`;
  }
}

function resolveStateForRequest(state: PerformanceState, origin: string) {
  return resolveStateScreenPresentation(resolveStateScreenRoutes(state, origin), origin);
}

export interface CreateServerOptions {
  initialState?: PerformanceState;
  snapshotPath?: string;
  loadSnapshot?: boolean;
  persist?: boolean;
  controlToken?: string;
  serveClient?: boolean;
}

export interface AppServer {
  app: Express;
  server: http.Server;
  store: ShowStateStore;
  hub: RealtimeHub;
  snapshotWriter: SnapshotWriter | null;
}

type SocketProfile = {
  id: string;
  module: string;
  role: string;
  capabilities: Set<string>;
};

type SyncMessage =
  | { type: "state.snapshot"; state: PerformanceState }
  | { type: "state.patch"; module: ModuleName; patch: JsonRecord; updatedAt: number }
  | { type: "show.patch"; patch: PerformanceState["show"]; updatedAt: number }
  | { type: "client.presence"; client: unknown; clients: PerformanceState["clients"] }
  | { type: "control.ack"; ok: true; command: ControlCommand }
  | ControlCommand
  | AudioFrame
  | { type: "module.telemetry"; module?: unknown; event: unknown }
  | { type: "cue.fire"; module?: unknown; event: unknown };

export function createServer(options: CreateServerOptions = {}) {
  return createAppServer(options).server;
}

export function createAppServer(options: CreateServerOptions = {}): AppServer {
  const snapshotPath = options.snapshotPath || defaultSnapshotPath();
  const initialState = options.initialState
    || (options.loadSnapshot === false ? null : loadSnapshotSync(snapshotPath))
    || createDefaultState();
  const store = new ShowStateStore(initialState);
  const hub = new RealtimeHub();
  const socketOrigins = new WeakMap<WebSocket, string>();
  const socketProfiles = new WeakMap<WebSocket, SocketProfile>();
  const sseOrigins = new WeakMap<Response, string>();
  const snapshotWriter = options.persist === false ? null : new SnapshotWriter(snapshotPath);
  const app = express();
  const server = http.createServer(app);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "3mb" }));
  app.use((req, res, next) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type,authorization,x-control-token");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get("/api/spec", (_req, res) => {
    res.json(performanceSpec);
  });

  app.get("/api/audio-summary", (_req, res) => {
    const state = store.getState();
    const activeSourceId = state.modules.audio.activeSourceId;
    const source = state.audioSources[activeSourceId];

    if (!source) {
      res.json({
        volume: 0, subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0,
        energy: 0, beat: 0, spectralCentroid: 0, spectralFlux: 0, transient: 0,
        dynamicRange: 0, syncedSignal: 0
      });
      return;
    }

    const bands = source.frequencyBands || Array(16).fill(0);
    const avg = (start: number, end: number) => 
      bands.slice(start, end + 1).reduce((a, b) => a + b, 0) / (end - start + 1);

    res.json({
      volume: source.level,
      subBass: avg(0, 0),
      bass: avg(1, 2),
      lowMid: avg(3, 5),
      mid: avg(6, 8),
      highMid: avg(9, 11),
      treble: avg(12, 15),
      energy: source.rms,
      beat: source.speaking ? 1 : 0,
      spectralCentroid: avg(0, 15),
      spectralFlux: source.peak,
      transient: Math.max(0, source.peak - source.rms),
      dynamicRange: Math.min(1, source.peak / (source.rms || 0.01)),
      syncedSignal: source.level
    });
  });

  app.get("/api/state", (req, res) => {
    const origin = resolveRequestOrigin(req.headers, req.secure);
    res.json(resolveStateForRequest(store.getState(), origin));
  });

  app.get("/api/events", (req, res) => {
    const origin = resolveRequestOrigin(req.headers, req.secure);
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*"
    });
    sseOrigins.set(res, origin);
    hub.addSse(res);
    res.write("event: state.snapshot\n");
    res.write(`data: ${JSON.stringify({ type: "state.snapshot", state: resolveStateForRequest(store.getState(), origin) })}\n\n`);
  });

  app.post("/api/mixer/frame", requireToken(options), (req, res) => {
    const origin = resolveRequestOrigin(req.headers, req.secure);
    const frame = normalizeAudioFrame(req.body);
    store.applyAudioFrame(frame);
    snapshotWriter?.schedule(store.getState());
    broadcastSyncMessage(hub, socketProfiles, frame);
    res.status(202).json({ ok: true, frame, state: resolveStateForRequest(store.getState(), origin) });
  });

  app.post("/api/modules/:module/state", requireToken(options), (req, res) => {
    const origin = resolveRequestOrigin(req.headers, req.secure);
    const moduleName = req.params.module;
    if (!isModuleName(moduleName)) {
      res.status(400).json({ ok: false, error: "module must be audio, visual, or interaction" });
      return;
    }
    if (!isRecord(req.body)) {
      res.status(400).json({ ok: false, error: "module state patch must be an object" });
      return;
    }
    const patch = isRecord(req.body.patch) ? req.body.patch : req.body;
    if (!store.canApplyModulePatch(moduleName, String(req.body.source || "rest"))) {
      res.status(423).json({ ok: false, error: "Operation lock active", state: store.getState() });
      return;
    }
    store.applyModulePatch(moduleName, patch, String(req.body.source || "rest"));
    snapshotWriter?.schedule(store.getState());
    broadcastSyncMessage(hub, socketProfiles, { type: "state.patch", module: moduleName, patch, updatedAt: store.getState().updatedAt });
    res.status(202).json({ ok: true, module: moduleName, patch, state: resolveStateForRequest(store.getState(), origin) });
  });

  app.post("/api/control", requireToken(options), (req, res) => {
    const origin = resolveRequestOrigin(req.headers, req.secure);
    const command = normalizeControlCommand(req.body);
    if (!store.canApplyControlCommand(command)) {
      res.status(423).json({ ok: false, error: "Operation lock active", state: store.getState() });
      return;
    }
    store.applyControlCommand(command);
    snapshotWriter?.schedule(store.getState());
    const ack = { type: "control.ack", ok: true, command } as const;
    broadcastControlSync(hub, store, command, ack, socketProfiles);
    res.status(202).json({ ok: true, command, state: resolveStateForRequest(store.getState(), origin) });
  });

  app.post("/api/show/reset", requireToken(options), (_req, res) => {
    const origin = resolveRequestOrigin(_req.headers, _req.secure);
    store.reset("rest");
    snapshotWriter?.schedule(store.getState());
    broadcastSnapshot(hub, store, origin, socketOrigins, sseOrigins);
    res.status(202).json({ ok: true, state: resolveStateForRequest(store.getState(), origin) });
  });

  app.post("/api/show/snapshot", requireToken(options), async (_req, res, next) => {
    try {
      const origin = resolveRequestOrigin(_req.headers, _req.secure);
      if (!snapshotWriter) {
        res.status(202).json({ ok: true, persisted: false, state: resolveStateForRequest(store.getState(), origin) });
        return;
      }
      await snapshotWriter.flush(store.getState());
      res.status(202).json({ ok: true, persisted: true, state: resolveStateForRequest(store.getState(), origin) });
    } catch (error) {
      next(error);
    }
  });

  attachWebSocket(server, hub, store, snapshotWriter, options, socketOrigins, socketProfiles, sseOrigins);

  if (options.serveClient) {
    addClientRoutes(app);
  }

  app.use((error: Error, _req: Request, res: Response, _next: express.NextFunction) => {
    res.status(400).json({ ok: false, error: error.message });
  });

  return { app, server, store, hub, snapshotWriter };
}

export function addClientRoutes(app: Express, clientDir = path.join(__dirname, "client")) {
  app.use(express.static(clientDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

function attachWebSocket(
  server: http.Server,
  hub: RealtimeHub,
  store: ShowStateStore,
  snapshotWriter: SnapshotWriter | null,
  options: CreateServerOptions,
  socketOrigins: WeakMap<WebSocket, string>,
  socketProfiles: WeakMap<WebSocket, SocketProfile>,
  sseOrigins: WeakMap<Response, string>
) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("close", () => {
    for (const client of wss.clients) client.terminate();
    wss.close();
  });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, url.searchParams.get("token") || undefined);
    });
  });

  wss.on("connection", (socket: WebSocket, _req: http.IncomingMessage, queryToken?: string) => {
    const fallbackClientId = `ws-${crypto.randomUUID()}`;
    const origin = resolveRequestOrigin(_req.headers, Boolean(((_req.socket as unknown as { encrypted?: boolean }) || {}).encrypted));
    let clientId: string | null = null;
    socketOrigins.set(socket, origin);
    hub.addSocket(socket);
    hub.send(socket, { type: "state.snapshot", state: resolveStateForRequest(store.getState(), origin) });

    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as JsonRecord;
        handleWsMessage(message, queryToken, fallbackClientId);
      } catch (error) {
        hub.send(socket, { type: "error", error: error instanceof Error ? error.message : String(error) });
      }
    });

    socket.on("close", () => {
      if (!clientId) return;
      const client = store.removeClient(clientId);
      if (client) {
        snapshotWriter?.schedule(store.getState());
        broadcastSyncMessage(hub, socketProfiles, { type: "client.presence", client, clients: store.getState().clients });
      }
    });

    function handleWsMessage(message: JsonRecord, queryToken: string | undefined, fallbackId: string) {
      if (typeof message.type !== "string") throw new Error("WebSocket message.type is required");

      if (message.type === "ui.subscribe") {
        hub.send(socket, { type: "state.snapshot", state: resolveStateForRequest(store.getState(), origin) });
        return;
      }

      if (message.type === "client.hello") {
        const client = store.registerClient(message as unknown as ClientHelloMessage, fallbackId);
        clientId = client.id;
        socketProfiles.set(socket, {
          id: client.id,
          module: client.module,
          role: client.role,
          capabilities: new Set(client.capabilities)
        });
        snapshotWriter?.schedule(store.getState());
        broadcastSyncMessage(hub, socketProfiles, { type: "client.presence", client, clients: store.getState().clients });
        hub.send(socket, { type: "state.snapshot", state: resolveStateForRequest(store.getState(), origin) });
        return;
      }

      if (message.type === "heartbeat") {
        const heartbeatId = String(message.clientId || clientId || fallbackId);
        const client = store.touchClient(heartbeatId, Number(message.sentAt));
        hub.send(socket, { type: "heartbeat.ack", clientId: heartbeatId, client, timestamp: Date.now() });
        return;
      }

      if (!messageHasToken(message, queryToken, options)) {
        hub.send(socket, { type: "error", error: "Unauthorized" });
        return;
      }

      if (message.type === "mixer.audioFrame") {
        const frame = normalizeAudioFrame(message);
        store.applyAudioFrame(frame);
        snapshotWriter?.schedule(store.getState());
        broadcastSyncMessage(hub, socketProfiles, frame);
        return;
      }

      if (message.type === "module.statePatch") {
        if (!isModuleName(message.module)) throw new Error("module.statePatch.module must be audio, visual, or interaction");
        if (!store.canApplyModulePatch(message.module, String(message.source || clientId || "ws"))) {
          hub.send(socket, { type: "error", error: "Operation lock active", module: message.module });
          return;
        }
        const patch = isRecord(message.patch) ? message.patch : isRecord(message.state) ? message.state : {};
        store.applyModulePatch(message.module, patch, String(message.source || clientId || "ws"));
        snapshotWriter?.schedule(store.getState());
        broadcastSyncMessage(hub, socketProfiles, { type: "state.patch", module: message.module, patch, updatedAt: store.getState().updatedAt });
        return;
      }

      if (message.type === "module.telemetry") {
        const event = store.appendEvent("module.telemetry", String(message.module || "unknown"), String(message.source || clientId || "ws"), "Module telemetry", message);
        snapshotWriter?.schedule(store.getState());
        broadcastSyncMessage(hub, socketProfiles, { type: "module.telemetry", module: message.module, event });
        return;
      }

      if (message.type === "control.command") {
        const command = normalizeControlCommand(message);
        if (!store.canApplyControlCommand(command)) {
          hub.send(socket, { type: "error", error: "Operation lock active", command });
          return;
        }
        store.applyControlCommand(command);
        snapshotWriter?.schedule(store.getState());
        broadcastControlSync(hub, store, command, { type: "control.ack", ok: true, command }, socketProfiles);
        return;
      }

      if (message.type === "cue.fire") {
        const event = store.appendEvent("cue.fire", String(message.module || "show"), String(message.source || clientId || "ws"), String(message.cue || "cue.fire"), message);
        snapshotWriter?.schedule(store.getState());
        broadcastSyncMessage(hub, socketProfiles, { type: "cue.fire", module: message.module, event });
        return;
      }

      throw new Error(`Unsupported WebSocket message: ${message.type}`);
    }
  });
}

function requireToken(options: CreateServerOptions) {
  return (req: Request, res: Response, next: express.NextFunction) => {
    const requiredToken = options.controlToken ?? process.env.CONTROL_TOKEN;
    if (!requiredToken) {
      res.status(401).json({ ok: false, error: "CONTROL_TOKEN is required" });
      return;
    }
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const supplied = req.headers["x-control-token"] || bearer || req.query.token;
    if (supplied === requiredToken) {
      next();
      return;
    }
    res.status(401).json({ ok: false, error: "Unauthorized" });
  };
}

function messageHasToken(message: JsonRecord, queryToken: string | undefined, options: CreateServerOptions) {
  const requiredToken = options.controlToken ?? process.env.CONTROL_TOKEN;
  if (!requiredToken) return false;
  return message.token === requiredToken || message.authToken === requiredToken || queryToken === requiredToken;
}

function broadcastControlSync(
  hub: RealtimeHub,
  store: ShowStateStore,
  command: ControlCommand,
  ack: { type: "control.ack"; ok: true; command: ControlCommand },
  socketProfiles: WeakMap<WebSocket, SocketProfile>
) {
  broadcastSyncMessage(hub, socketProfiles, command);
  broadcastSyncMessage(hub, socketProfiles, ack);
  for (const message of buildControlPatchMessages(command, store.getState())) {
    broadcastSyncMessage(hub, socketProfiles, message);
  }
}

function buildControlPatchMessages(command: ControlCommand, state: PerformanceState): SyncMessage[] {
  const updatedAt = state.updatedAt;

  if (command.module === "show") {
    const audioPatch: JsonRecord = {};
    if (["play", "pause", "stop", "reset"].includes(command.command)) {
      audioPatch.transport = state.modules.audio.transport;
    }
    if (command.command === "setBpm") {
      audioPatch.bpm = state.modules.audio.bpm;
    }
    return [
      { type: "show.patch", patch: state.show, updatedAt },
      ...(Object.keys(audioPatch).length ? [{ type: "state.patch" as const, module: "audio" as const, patch: audioPatch, updatedAt }] : [])
    ];
  }

  if (command.module === "audio") {
    return [{ type: "state.patch", module: "audio", patch: pickAudioControlPatch(command, state), updatedAt }];
  }

  if (command.module === "visual" || command.module === "video") {
    return [{ type: "state.patch", module: "visual", patch: pickVisualControlPatch(command, state), updatedAt }];
  }

  if (command.module === "interaction") {
    return [{ type: "state.patch", module: "interaction", patch: pickInteractionControlPatch(command, state), updatedAt }];
  }

  return [{ type: "show.patch", patch: state.show, updatedAt }];
}

function pickAudioControlPatch(command: ControlCommand, state: PerformanceState): JsonRecord {
  if (["setMute", "setGain"].includes(command.command)) {
    return {
      activeSourceId: state.modules.audio.activeSourceId,
      masterLevel: state.modules.audio.masterLevel,
      audioSources: { [command.target]: state.audioSources[command.target] }
    };
  }
  if (command.command === "setMasterLevel") return { masterLevel: state.modules.audio.masterLevel };
  if (command.command === "setPreset") return { activePreset: state.modules.audio.activePreset };
  if (command.command === "setActiveTab") return { activeTab: state.modules.audio.activeTab };
  return state.modules.audio as unknown as JsonRecord;
}

function pickVisualControlPatch(command: ControlCommand, state: PerformanceState): JsonRecord {
  if (["setScene", "focusVideo"].includes(command.command)) {
    return { scene: state.modules.visual.scene, preset: state.modules.visual.preset };
  }
  if (command.command === "setPreset") return { preset: state.modules.visual.preset };
  if (command.command === "setText") return { text: state.modules.visual.text };
  if (command.command === "setAudioDrive") return { audioDriveMode: state.modules.visual.audioDriveMode };
  if (command.command === "setFullscreen") return { fullscreen: state.modules.visual.fullscreen };
  if (command.command === "setColors") return { colors: state.modules.visual.colors };
  if (command.command === "setFx") return { fx: state.modules.visual.fx };
  return state.modules.visual as unknown as JsonRecord;
}

function pickInteractionControlPatch(command: ControlCommand, state: PerformanceState): JsonRecord {
  const interaction = state.modules.interaction;
  if (["setInteractionMode", "setMode"].includes(command.command)) {
    return { mode: interaction.mode, visualMode: interaction.visualMode };
  }
  if (command.command === "setIntensity") return { intensity: interaction.intensity };
  if (command.command === "resetTree") {
    return {
      mode: interaction.mode,
      intensity: interaction.intensity,
      treeGrowth: interaction.treeGrowth,
      gestureActive: interaction.gestureActive,
      visualMode: interaction.visualMode
    };
  }
  if (command.command === "setVisualMode") return { visualMode: interaction.visualMode };
  if (command.command === "setFireworkState") return { fireworkState: interaction.fireworkState, visualMode: interaction.visualMode };
  if (command.command === "pulseScreen") return { screenPulse: interaction.screenPulse };
  if (command.command === "setScreen") return { screenId: interaction.screenId, role: interaction.role };
  if (["setScreenOwner", "setScreenRoutePreset"].includes(command.command)) {
    return { screenRoutePreset: interaction.screenRoutePreset, screenRoutes: interaction.screenRoutes };
  }
  if (["setScreenAutoRedirect", "setScreenDebugVisible", "setScreenMenuVisible", "setScreenPresentation"].includes(command.command)) {
    return { screenPresentation: interaction.screenPresentation };
  }
  if (command.command === "setOperationLock") return {};
  return interaction as unknown as JsonRecord;
}

function broadcastSyncMessage(
  hub: RealtimeHub,
  socketProfiles: WeakMap<WebSocket, SocketProfile>,
  message: SyncMessage
) {
  hub.forEachSocket((socket) => {
    const profile = socketProfiles.get(socket);
    if (shouldDeliverToSocket(profile, message)) {
      hub.send(socket, message);
    }
  });
  hub.forEachSseClient((client) => {
    const payload = JSON.stringify(message);
    client.write(`event: ${message.type}\n`);
    client.write(`data: ${payload}\n\n`);
  });
}

function shouldDeliverToSocket(profile: SocketProfile | undefined, message: SyncMessage) {
  if (!profile) return true;
  if (message.type === "client.presence") return isDashboardProfile(profile);
  if (message.type === "control.ack") return isDashboardProfile(profile) || profile.id === message.command.issuedBy;
  if (message.type === "control.command") return shouldDeliverControl(profile, message);
  if (message.type === "state.patch") return shouldDeliverModulePatch(profile, message.module, message.patch);
  if (message.type === "show.patch") return !isScreenGatewayProfile(profile) || isDashboardProfile(profile);
  if (message.type === "mixer.audioFrame") return isDashboardProfile(profile) || profile.module === "audio" || profile.module === "visual";
  if (message.type === "module.telemetry" || message.type === "cue.fire") return isDashboardProfile(profile);
  return true;
}

function shouldDeliverControl(profile: SocketProfile, command: ControlCommand) {
  if (isDashboardProfile(profile)) return true;
  if (isScreenGatewayProfile(profile)) return false;
  if (command.module === "show") return profile.module !== "unknown";
  if (command.module === "video") return profile.module === "visual";
  if (command.module === "guest") return false;
  return profile.module === command.module;
}

function shouldDeliverModulePatch(profile: SocketProfile, moduleName: ModuleName, patch: JsonRecord) {
  if (isDashboardProfile(profile)) return true;
  if (isScreenGatewayProfile(profile)) {
    return moduleName === "interaction" && isRoutePatch(patch);
  }
  return profile.module === moduleName || profile.capabilities.has(`state.${moduleName}`);
}

function isDashboardProfile(profile: SocketProfile) {
  return profile.module === "dashboard" && !isScreenGatewayProfile(profile);
}

function isScreenGatewayProfile(profile: SocketProfile) {
  return profile.role === "screen-gateway" || profile.capabilities.has("screen.route");
}

function isRoutePatch(patch: JsonRecord) {
  return Boolean(
    patch.screenRoutes ||
    patch.screenRoutePreset ||
    patch.screenPresentation ||
    patch.screenTopology ||
    patch.screenRegistry
  );
}

function broadcastSnapshot(
  hub: RealtimeHub,
  store: ShowStateStore,
  origin: string,
  socketOrigins: WeakMap<WebSocket, string>,
  sseOrigins: WeakMap<Response, string>
) {
  hub.forEachSocket((socket) => {
    const socketOrigin = socketOrigins.get(socket) || origin;
    hub.send(socket, { type: "state.snapshot", state: resolveStateForRequest(store.getState(), socketOrigin) });
  });
  hub.forEachSseClient((client) => {
    const clientOrigin = sseOrigins.get(client) || origin;
    client.write("event: state.snapshot\n");
    client.write(`data: ${JSON.stringify({ type: "state.snapshot", state: resolveStateForRequest(store.getState(), clientOrigin) })}\n\n`);
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function start() {
  const isProduction = process.env.NODE_ENV === "production";
  const { app, server } = createAppServer({
    snapshotPath: defaultSnapshotPath(),
    persist: true,
    serveClient: isProduction
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }

  server.listen(SHOW_CONTROL_PORT, "0.0.0.0", () => {
    const lanUrls = getLanAddresses(SHOW_CONTROL_PORT);
    console.log(`VAD show control listening on http://0.0.0.0:${SHOW_CONTROL_PORT}`);
    if (lanUrls.length > 0) {
      console.log(`LAN URLs: ${lanUrls.join(", ")}`);
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void start();
}
