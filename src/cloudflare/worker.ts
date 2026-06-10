import type { AudioFrame, ClientHelloMessage, ClientInfo, ControlCommand, JsonRecord, ModuleName, PerformanceState, ScreenOwner, ScreenRouteArrangementPreset, ScreenRoutePreset } from "../types";

type Env = {
  SHOW_ROOM: DurableObjectNamespace;
  CONTROL_TOKEN?: string;
  DEFAULT_SHOW_ID?: string;
  VJ_SCREEN_ORIGIN?: string;
  BAOFA_SCREEN_ORIGIN?: string;
  PRIMARY_DJ_CLIENT_ID?: string;
};

type DurableObjectNamespace = {
  getByName(name: string): DurableObjectStub;
};

type DurableObjectStub = {
  fetch(request: Request): Promise<Response>;
};

type DurableObjectState = {
  storage: DurableObjectStorage;
  blockConcurrencyWhile(callback: () => Promise<void>): void;
  acceptWebSocket?(socket: WebSocket): void;
};

type DurableObjectStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
};

declare const WebSocketPair: {
  new(): { 0: WebSocket; 1: WebSocket };
};

type ConnectionState = {
  id: string;
  module: string;
  role: string;
  capabilities: Set<string>;
};

type SyncMessage =
  | { type: "state.snapshot"; state: PerformanceState }
  | { type: "state.patch"; module: ModuleName; patch: JsonRecord; updatedAt: number }
  | { type: "show.patch"; patch: PerformanceState["show"]; updatedAt: number }
  | { type: "client.presence"; client: ClientInfo; clients: PerformanceState["clients"] }
  | { type: "control.ack"; ok: true; command: ControlCommand }
  | ControlCommand
  | AudioFrame
  | { type: "error"; error: string; [key: string]: unknown };

const SCREEN_IDS = [
  "A1",
  "B1", "B2", "B3", "B4", "B5", "B6",
  "C1", "C2", "C3", "C4",
  "D1", "D2", "D3",
  "E1", "F1",
  "L1", "L2", "R1", "R2"
] as const;

const SCREEN_TOPOLOGY = [
  ["A1"],
  ["B1", "B2", "B3", "B4", "B5", "B6"],
  ["C1", "C2", "C3", "C4"],
  ["D1", "D2", "D3"],
  ["L1", "E1", "R1"],
  ["L2", "F1", "R2"]
];

function normalizeScreenOccupancyId(value: unknown) {
  const screenId = String(value || "").trim();
  if (!screenId) return "";
  return screenId === "MASTER" ? "A1" : screenId;
}

function inferScreenIdFromClientId(value: unknown) {
  const text = String(value || "").toUpperCase();
  if (!text) return "";
  for (const screenId of SCREEN_IDS) {
    const escaped = screenId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^A-Z0-9])${escaped}($|[^A-Z0-9])`).test(text)) return screenId;
  }
  if (/(^|[^A-Z0-9])MASTER($|[^A-Z0-9])/.test(text)) return "A1";
  return "";
}

const VJ_SCREEN_IDS = new Set<string>(["A1"]);
const HOSTED_VJ_SCREEN_ORIGIN = "https://doit-pearl.vercel.app";
const HOSTED_BAOFA_SCREEN_ORIGIN = "https://baofa.vercel.app";
const BUILT_IN_SCREEN_ROUTE_PRESETS = ["balanced", "vj_takeover", "baofa_takeover"] as const;
const VISUAL_AUTHORITY_FALLBACK_MS = 15_000;

export function resolveWorkerRoomId(url: URL, fallbackShowId?: string | null) {
  return url.searchParams.get("room") || url.searchParams.get("showId") || fallbackShowId || "show-main";
}

export function sanitizeWorkerInteractionModulePatch(patch: JsonRecord) {
  const sanitized = { ...patch };
  delete sanitized.screenRoutes;
  delete sanitized.screenRoutePreset;
  delete sanitized.customScreenRoutePresets;
  delete sanitized.screenPresentation;
  return sanitized;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const showId = resolveWorkerRoomId(url, env.DEFAULT_SHOW_ID);
    const stub = env.SHOW_ROOM.getByName(showId);
    const headers = new Headers(request.headers);
    headers.set("x-show-id", showId);
    headers.set("x-public-origin", `${url.protocol}//${url.host}`);
    const forwarded = new Request(request, { headers });
    try {
      return await stub.fetch(forwarded);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }
};

export class ShowRoomDurableObject {
  private state: PerformanceState | null = null;
  private readonly sockets = new Set<WebSocket>();
  private readonly profiles = new WeakMap<WebSocket, ConnectionState>();

  constructor(private readonly ctx: DurableObjectState, private readonly env: Env) {
    this.ctx.blockConcurrencyWhile(async () => {
      const storedState = await this.ctx.storage.get<PerformanceState>("state");
      this.state = storedState ? normalizeStoredState(storedState, this.env) : this.createDefaultState();
      await this.ctx.storage.put("state", this.state);
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });

    try {
      if (url.pathname === "/ws") return this.handleWebSocket(request);
      if (url.pathname === "/api/state" && request.method === "GET") return json(this.getStateForRequest(request));
      if (url.pathname === "/api/audio-summary" && request.method === "GET") return json(this.audioSummary());
      if (url.pathname === "/api/control" && request.method === "POST") return await this.handleControl(request);
      if (url.pathname === "/api/mixer/frame" && request.method === "POST") return await this.handleAudioFrame(request);
      const moduleMatch = url.pathname.match(/^\/api\/modules\/([^/]+)\/state$/);
      if (moduleMatch && request.method === "POST") return await this.handleModulePatch(request, moduleMatch[1]);
      if (url.pathname === "/api/health" && request.method === "GET") {
        return json({ ok: true, showId: request.headers.get("x-show-id") || "show-main", clients: Object.keys(this.requireState().clients).length });
      }
      return json({ ok: false, error: "Not found" }, 404);
    } catch (error) {
      const status = error instanceof Error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, status >= 400 && status < 600 ? status : 500);
    }
  }

  private handleWebSocket(request: Request) {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return json({ ok: false, error: "Expected WebSocket upgrade" }, 426);
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    (server as WebSocket & { accept: () => void }).accept();
    this.sockets.add(server);
    this.send(server, { type: "state.snapshot", state: this.getStateForRequest(request) });
    server.addEventListener("message", (event) => void this.handleSocketMessage(server, String(event.data), request).catch((error) => {
      this.send(server, { type: "error", error: error instanceof Error ? error.message : String(error) });
    }));
    server.addEventListener("close", () => void this.removeSocket(server));
    server.addEventListener("error", () => void this.removeSocket(server));
    return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket });
  }

  private async handleSocketMessage(socket: WebSocket, raw: string, request: Request) {
    const message = JSON.parse(raw) as JsonRecord;
    if (typeof message.type !== "string") throw new Error("message.type is required");
    if (message.type === "ui.subscribe") {
      this.send(socket, { type: "state.snapshot", state: this.getStateForRequest(request) });
      return;
    }
    if (message.type === "client.hello") {
      const client = this.registerClient(message as unknown as ClientHelloMessage, `ws-${crypto.randomUUID()}`);
      this.profiles.set(socket, {
        id: client.id,
        module: client.module,
        role: client.role,
        capabilities: new Set(client.capabilities)
      });
      await this.persistState();
      this.broadcast({ type: "client.presence", client, clients: this.requireState().clients });
      this.send(socket, { type: "state.snapshot", state: this.getStateForRequest(request) });
      return;
    }
    if (message.type === "heartbeat") {
      const clientId = String(message.clientId || this.profiles.get(socket)?.id || "");
      if (clientId) this.touchClient(clientId, Number(message.sentAt));
      this.send(socket, { type: "heartbeat.ack", clientId, timestamp: Date.now() } as unknown as SyncMessage);
      return;
    }
    if (!this.hasToken(message, request)) {
      this.send(socket, { type: "error", error: "Unauthorized" });
      return;
    }
    if (message.type === "mixer.audioFrame") {
      if (!this.canPublishAudioFrame(socket)) {
        this.send(socket, { type: "error", error: "Only the configured DJ client can publish mixer.audioFrame" });
        return;
      }
      const frame = normalizeAudioFrame(message);
      this.applyAudioFrame(frame);
      await this.persistState(false);
      this.broadcast(frame);
      return;
    }
    if (message.type === "module.statePatch") {
      const moduleName = String(message.module);
      if (!isModuleName(moduleName)) throw new Error("module.statePatch.module must be audio, visual, or interaction");
      const blockReason = this.getModulePatchBlockReason(moduleName, String(message.source || this.profiles.get(socket)?.id || "ws"));
      if (blockReason) {
        this.send(socket, { type: "error", error: blockReason, module: moduleName });
        return;
      }
      const patch = isRecord(message.patch) ? message.patch : isRecord(message.state) ? message.state : {};
      const sanitizedPatch = this.applyModulePatch(moduleName, patch, String(message.source || this.profiles.get(socket)?.id || "ws"));
      await this.persistState();
      this.broadcast({ type: "state.patch", module: moduleName, patch: sanitizedPatch, updatedAt: this.requireState().updatedAt });
      return;
    }
    if (message.type === "control.command") {
      const command = normalizeControlCommand(message);
      const blockReason = this.getControlCommandBlockReason(command);
      if (blockReason) {
        this.send(socket, { type: "error", error: blockReason, command });
        return;
      }
      this.applyControlCommand(command);
      await this.persistState();
      this.broadcastControlSync(command);
      return;
    }
    throw new Error(`Unsupported WebSocket message: ${message.type}`);
  }

  private async handleControl(request: Request) {
    await this.requireToken(request);
    const command = normalizeControlCommand(await request.json());
    const blockReason = this.getControlCommandBlockReason(command);
    if (blockReason) return json({ ok: false, error: blockReason, state: this.getStateForRequest(request) }, blockReason === "VJ control active" ? 409 : 423);
    this.applyControlCommand(command);
    await this.persistState();
    this.broadcastControlSync(command);
    return json({ ok: true, command, state: this.getStateForRequest(request) }, 202);
  }

  private async handleAudioFrame(request: Request) {
    await this.requireToken(request);
    if (!this.canPublishAudioFrameRequest(request)) return json({ ok: false, error: "Only the configured DJ client can publish mixer.audioFrame" }, 403);
    const frame = normalizeAudioFrame(await request.json());
    this.applyAudioFrame(frame);
    await this.persistState(false);
    this.broadcast(frame);
    return json({ ok: true, frame, state: this.getStateForRequest(request) }, 202);
  }

  private async handleModulePatch(request: Request, moduleName: string) {
    await this.requireToken(request);
    if (!isModuleName(moduleName)) return json({ ok: false, error: "module must be audio, visual, or interaction" }, 400);
    const body = await request.json() as JsonRecord;
    const patch = isRecord(body.patch) ? body.patch : body;
    const source = String(body.source || "rest");
    const blockReason = this.getModulePatchBlockReason(moduleName, source);
    if (blockReason) return json({ ok: false, error: blockReason, state: this.getStateForRequest(request) }, blockReason === "VJ control active" ? 409 : 423);
    const sanitizedPatch = this.applyModulePatch(moduleName, patch, source);
    await this.persistState();
    this.broadcast({ type: "state.patch", module: moduleName, patch: sanitizedPatch, updatedAt: this.requireState().updatedAt });
    return json({ ok: true, module: moduleName, patch: sanitizedPatch, state: this.getStateForRequest(request) }, 202);
  }

  private broadcastControlSync(command: ControlCommand) {
    const ack = { type: "control.ack", ok: true, command } as const;
    this.broadcast(command);
    this.broadcast(ack);
    for (const message of buildControlPatchMessages(command, this.requireState())) this.broadcast(message);
  }

  private broadcast(message: SyncMessage) {
    for (const socket of this.sockets) {
      const profile = this.profiles.get(socket);
      if (socket.readyState === WebSocket.OPEN && shouldDeliverToSocket(profile, message)) this.send(socket, message);
    }
  }

  private send(socket: WebSocket, message: SyncMessage) {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      void this.removeSocket(socket);
    }
  }

  private async removeSocket(socket: WebSocket) {
    this.sockets.delete(socket);
    const profile = this.profiles.get(socket);
    if (!profile) return;
    const client = this.removeClient(profile.id);
    await this.persistState();
    if (client) this.broadcast({ type: "client.presence", client, clients: this.requireState().clients });
  }

  private getStateForRequest(request: Request) {
    const url = new URL(request.url);
    const origin = request.headers.get("x-public-origin") || url.origin;
    const room = resolveWorkerRoomId(url, request.headers.get("x-show-id") || this.env.DEFAULT_SHOW_ID);
    return resolveStateRoutes(this.requireState(), origin, this.env, room);
  }

  private requireState() {
    if (!this.state) this.state = this.createDefaultState();
    return this.state;
  }

  private async persistState(includeAudio = true) {
    const state = this.requireState();
    if (!includeAudio) {
      const current = await this.ctx.storage.get<PerformanceState>("state");
      if (current) {
        await this.ctx.storage.put("state", { ...state, audioSources: current.audioSources });
        return;
      }
    }
    await this.ctx.storage.put("state", state);
  }

  private async requireToken(request: Request) {
    const token = this.env.CONTROL_TOKEN || "";
    if (!token) throw new Error("CONTROL_TOKEN is required");
    const supplied = request.headers.get("x-control-token") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || new URL(request.url).searchParams.get("token");
    if (supplied !== token) throw new Error("Unauthorized");
  }

  private hasToken(message: JsonRecord, request: Request) {
    const token = this.env.CONTROL_TOKEN || "";
    if (!token) return false;
    return message.token === token || message.authToken === token || new URL(request.url).searchParams.get("token") === token;
  }

  private createDefaultState(): PerformanceState {
    const now = Date.now();
    return {
      protocolVersion: "mixer.realtime.v1",
      performanceProtocolVersion: "performance.show.v1",
      updatedAt: now,
      show: { id: "show-main", name: "Live Performance", status: "standby", startedAt: null, positionMs: 0, bpm: 120, beat: 0, bar: 1 },
      operationLock: { locked: false, lockedModules: [], ownerModule: "dashboard", lockedBy: null, updatedAt: null },
      room: { id: "classroom-a", name: "Main Performance Room", mode: "live-performance" },
      modules: {
        audio: {
          status: "online",
          projectName: "Music Editor",
          transport: "stopped",
          masterLevel: 0.42,
          activeTab: "tab-1",
          activePreset: "Neon Loop",
          activeStyleId: "default",
          bpm: 120,
          activeSourceId: "mic-teacher",
          slots: [],
          fx: {},
          arrangementSummary: null
        },
        visual: {
          status: "online",
          controlAuthority: createDefaultVisualControlAuthority(),
          scene: "Cyber",
          preset: "Neon Pulse",
          colors: { base: "#00f3ff", secondary: "#bf00ff", accent: "#ffffff", background: "#030008" },
          fx: { bloomIntensity: 1.5, rgbSplitAmount: 0.005, distortion: 0, glitchActive: false, speed: 1, chaos: 0 },
          text: { value: "GAFA", animation: "Cinematic", reactive: 1, glow: 1, speed: 1, color: "#ffffff", fontSize: 4.6, fontWeight: 900, letterSpacing: 0.02 },
          audioDriveMode: "mic",
          fullscreen: false,
          visualMemories: [],
          visualScreens: createDefaultVisualScreens()
        },
        interaction: {
          status: "online",
          screenTopology: SCREEN_TOPOLOGY,
          screenRegistry: createDefaultScreenRegistry(),
          screenRoutes: makeScreenRoutes("balanced", now, "", this.env),
          screenRoutePreset: "balanced",
          customScreenRoutePresets: [],
          screenPresentation: { autoRedirect: true, cameraEnabled: false, showDebug: false, showMenu: false, configured: false },
          screenId: "C2",
          role: "screen",
          overview: false,
          mode: "idle",
          visualMode: "tree",
          fireworkState: "standby",
          baofaFishState: "idle",
          intensity: 0.08,
          evolution: 0,
          treeGrowth: 0,
          treePhase: "idle",
          gestureActive: false,
          lastInteraction: null,
          screenPulse: null
        }
      },
      audioSources: {},
      clients: {},
      commandLog: [],
      eventLog: []
    };
  }

  private registerClient(message: ClientHelloMessage, fallbackId: string) {
    const state = this.requireState();
    const now = Date.now();
    const id = message.clientId || fallbackId;
    const module = isModuleName(message.module) || message.module === "dashboard" ? message.module : "unknown";
    const client: ClientInfo = {
      id,
      module,
      role: String(message.role || "client"),
      status: "online",
      connectedAt: state.clients[id]?.connectedAt || now,
      lastSeen: now,
      latency: null,
      capabilities: Array.isArray(message.capabilities) ? message.capabilities.map(String) : [],
      screenId: normalizeScreenOccupancyId(message.screenId)
        || normalizeScreenOccupancyId(state.clients[id]?.screenId)
        || inferScreenIdFromClientId(id),
      overview: state.clients[id]?.overview
    };
    state.clients[id] = client;
    state.updatedAt = now;
    appendEvent(state, "client.presence", client.module, id, `${id} connected`, client);
    return client;
  }

  private touchClient(clientId: string, sentAt?: number) {
    const client = this.requireState().clients[clientId];
    if (!client) return;
    const now = Date.now();
    client.lastSeen = now;
    client.latency = Number.isFinite(sentAt) ? Math.max(0, now - Number(sentAt)) : client.latency;
  }

  private removeClient(clientId: string) {
    const state = this.requireState();
    const client = state.clients[clientId];
    if (!client) return null;
    delete state.clients[clientId];
    state.updatedAt = Date.now();
    const offline = { ...client, status: "offline" as const, lastSeen: Date.now() };
    appendEvent(state, "client.presence", client.module, clientId, `${clientId} disconnected`, offline);
    return offline;
  }

  private applyAudioFrame(frame: AudioFrame) {
    const state = this.requireState();
    state.audioSources[frame.sourceId] = { ...(state.audioSources[frame.sourceId] || {}), ...frame };
    state.modules.audio.activeSourceId = frame.sourceId;
    state.modules.audio.masterLevel = frame.muted ? 0 : frame.level;
    if (frame.activePreset) state.modules.audio.activePreset = frame.activePreset;
    if (frame.styleId) state.modules.audio.activeStyleId = frame.styleId;
    if (frame.bpm) state.modules.audio.bpm = frame.bpm;
    if (frame.transport === "playing" || frame.transport === "paused" || frame.transport === "stopped") {
      state.modules.audio.transport = frame.transport;
    }
    state.updatedAt = Date.now();
  }

  private applyModulePatch(moduleName: ModuleName, patch: JsonRecord, source: string) {
    const state = this.requireState();
    const sanitizedPatch = moduleName === "interaction" ? sanitizeWorkerInteractionModulePatch(patch) : patch;
    (state.modules as unknown as JsonRecord)[moduleName] = mergePatch(state.modules[moduleName] as unknown as JsonRecord, sanitizedPatch);
    if (moduleName === "visual" && isVjVisualSource(source)) markVisualAuthorityFromVj(state, source);
    if (moduleName === "audio" && typeof sanitizedPatch.bpm === "number") state.show.bpm = positiveNumber(sanitizedPatch.bpm, state.show.bpm);
    if (moduleName === "audio") {
      if (typeof sanitizedPatch.activeStyleId === "string" && sanitizedPatch.activeStyleId) {
        state.modules.audio.activeStyleId = sanitizedPatch.activeStyleId;
      } else if (isRecord(sanitizedPatch.arrangementSummary) && typeof sanitizedPatch.arrangementSummary.styleId === "string" && sanitizedPatch.arrangementSummary.styleId) {
        state.modules.audio.activeStyleId = sanitizedPatch.arrangementSummary.styleId;
      }
    }
    if (moduleName === "interaction") {
      const client = state.clients[source];
      if (client) {
        if (typeof sanitizedPatch.screenId === "string") client.screenId = sanitizedPatch.screenId;
        if (typeof sanitizedPatch.overview === "boolean") client.overview = sanitizedPatch.overview;
        if (typeof sanitizedPatch.role === "string") client.role = sanitizedPatch.role;
      }
    }
    state.updatedAt = Date.now();
    if (moduleName !== "audio") appendEvent(state, "module.statePatch", moduleName, source, `${moduleName} state updated`, sanitizedPatch);
    return sanitizedPatch;
  }

  private applyControlCommand(command: ControlCommand) {
    const state = this.requireState();
    applyCommand(state, command, this.env);
    if (command.module === "visual" || command.module === "video") {
      if (isVjVisualSource(command.issuedBy)) markVisualAuthorityFromVj(state, command.issuedBy);
      else markVisualAuthorityFromShowControl(state, command.issuedBy);
    }
    state.commandLog.unshift(command);
    state.commandLog = state.commandLog.slice(0, 80);
    state.updatedAt = Date.now();
    appendEvent(state, "control.command", command.module, command.issuedBy, `${command.command} -> ${command.target}`, { id: command.id, value: command.value });
  }

  private audioSummary() {
    const state = this.requireState();
    const source = state.audioSources[state.modules.audio.activeSourceId] || Object.values(state.audioSources)[0];
    if (!source) return emptyAudioSummary();
    const bands = source.frequencyBands || [];
    const avg = (start: number, end: number) => {
      const values = bands.slice(start, end + 1);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    };
    return {
      type: "mixer.audioFrame",
      sourceId: source.sourceId,
      deviceId: source.deviceId,
      displayName: source.displayName,
      timestamp: source.timestamp,
      level: source.level,
      rms: source.rms,
      peak: source.peak,
      gain: source.gain,
      muted: source.muted,
      speaking: source.speaking,
      frequencyBands: bands,
      activeStep: source.activeStep,
      stepProgress: source.stepProgress,
      bpm: source.bpm,
      styleEnergy: source.styleEnergy,
      styleId: source.styleId,
      activePreset: source.activePreset,
      transport: source.transport,
      masterLevel: source.masterLevel,
      slotLevels: source.slotLevels,
      slotActivity: source.slotActivity,
      slotIds: source.slotIds,
      slotNames: source.slotNames,
      slotCategories: source.slotCategories,
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
    };
  }

  private canPublishAudioFrame(socket: WebSocket) {
    const profile = this.profiles.get(socket);
    if (!profile || profile.module !== "audio") return false;
    const configuredDj = this.env.PRIMARY_DJ_CLIENT_ID || "";
    const activeAudioClients = Object.values(this.requireState().clients).filter(isActiveAudioPublisher);
    if (configuredDj && activeAudioClients.some((client) => client.id === configuredDj)) return profile.id === configuredDj;
    const activeDj = activeAudioClients[0];
    return !activeDj || activeDj.id === profile.id;
  }

  private canPublishAudioFrameRequest(request: Request) {
    const configuredDj = this.env.PRIMARY_DJ_CLIENT_ID || "";
    if (!configuredDj) return true;
    return request.headers.get("x-dj-client-id") === configuredDj || new URL(request.url).searchParams.get("djClientId") === configuredDj;
  }

  private getControlCommandBlockReason(command: ControlCommand) {
    if (command.command === "setOperationLock") return isCentralControlSource(command.issuedBy) ? null : "Operation lock active";
    const moduleName = normalizeLockModule(command.module);
    if (!isCentralControlSource(command.issuedBy) && moduleName && this.requireState().operationLock.lockedModules.includes(moduleName)) return "Operation lock active";
    if ((command.module === "visual" || command.module === "video") && shouldDeferVisualControlToVj(this.requireState(), command.issuedBy)) return "VJ control active";
    return null;
  }

  private getModulePatchBlockReason(moduleName: ModuleName, source: string) {
    if (!isCentralControlSource(source) && this.requireState().operationLock.lockedModules.includes(moduleName)) return "Operation lock active";
    if (moduleName === "visual" && shouldDeferVisualControlToVj(this.requireState(), source)) return "VJ control active";
    return null;
  }
}

function isActiveAudioPublisher(client: ClientInfo) {
  return client.module === "audio" &&
    client.status === "online" &&
    (client.role === "dj" || client.capabilities.includes("mixer.audioFrame"));
}

function normalizeStoredState(state: PerformanceState, env: Env): PerformanceState {
  const customScreenRoutePresets = normalizeCustomScreenRoutePresets(state.modules.interaction.customScreenRoutePresets);
  const screenRoutePreset = normalizeKnownScreenRoutePreset(state.modules.interaction.screenRoutePreset, customScreenRoutePresets);
  const lockedModules = normalizeLockedModules(state.operationLock.lockedModules || (state.operationLock.locked ? ["audio", "visual", "interaction"] : []));
  return {
    ...state,
    operationLock: {
      ...state.operationLock,
      lockedModules,
      locked: lockedModules.length > 0
    },
    modules: {
      ...state.modules,
      visual: {
        ...state.modules.visual,
        controlAuthority: normalizeVisualControlAuthority(state.modules.visual.controlAuthority),
        visualScreens: normalizeVisualScreens(state.modules.visual.visualScreens)
      },
      interaction: {
        ...state.modules.interaction,
        screenRegistry: normalizeScreenRegistry(state.modules.interaction.screenRegistry),
        screenRoutes: normalizeScreenRoutes(state.modules.interaction.screenRoutes, screenRoutePreset, env),
        screenRoutePreset,
        customScreenRoutePresets
      }
    }
  };
}

function createDefaultScreenRegistry() {
  return SCREEN_IDS.map((id, index) => ({
    id,
    label: `Screen ${id}`,
    enabled: true,
    physicalIndex: index + 1
  }));
}

function createDefaultVisualScreens(): PerformanceState["modules"]["visual"]["visualScreens"] {
  return SCREEN_IDS.map((id, index) => ({
    id,
    name: `Show Screen ${id}`,
    device: index === 0 ? "stage" : "led",
    scene: index === 0 ? "Layered Stage" : index % 4 === 1 ? "Topology" : index % 4 === 2 ? "Pulse" : "Liquid",
    enabled: true
  }));
}

function createDefaultVisualControlAuthority(): PerformanceState["modules"]["visual"]["controlAuthority"] {
  return {
    owner: "show-control",
    source: null,
    lastVjAt: null,
    activeUntil: null,
    fallbackAfterMs: VISUAL_AUTHORITY_FALLBACK_MS
  };
}

function normalizeScreenRegistry(value: unknown) {
  if (!Array.isArray(value)) return createDefaultScreenRegistry();
  const byId = new Map<string, unknown>(value.map((item) => {
    const record = isRecord(item) ? item : {};
    return [String(record.id || ""), record];
  }));
  return SCREEN_IDS.map((id, index) => {
    const record = isRecord(byId.get(id)) ? byId.get(id) as JsonRecord : {};
    return {
      id,
      label: String(record.label || `Screen ${id}`),
      enabled: typeof record.enabled === "boolean" ? record.enabled : true,
      physicalIndex: Math.max(1, Math.round(positiveNumber(record.physicalIndex, index + 1)))
    };
  });
}

function normalizeVisualScreens(value: unknown): PerformanceState["modules"]["visual"]["visualScreens"] {
  const defaults = createDefaultVisualScreens();
  const byId = new Map<string, unknown>(Array.isArray(value) ? value.map((item) => {
    const record = isRecord(item) ? item : {};
    return [String(record.id || ""), record];
  }) : []);
  return defaults.map((screen) => {
    const record = isRecord(byId.get(screen.id)) ? byId.get(screen.id) as JsonRecord : {};
    return {
      id: screen.id,
      name: String(record.name || screen.name),
      device: normalizeVisualDevice(record.device) || screen.device,
      scene: String(record.scene || screen.scene),
      enabled: typeof record.enabled === "boolean" ? record.enabled : screen.enabled
    };
  });
}

function normalizeVisualDevice(value: unknown): PerformanceState["modules"]["visual"]["visualScreens"][number]["device"] | null {
  return ["stage", "projector", "led", "tablet", "phone"].includes(String(value))
    ? String(value) as PerformanceState["modules"]["visual"]["visualScreens"][number]["device"]
    : null;
}

function normalizeScreenRoutes(value: unknown, preset: ScreenRoutePreset, env: Env): PerformanceState["modules"]["interaction"]["screenRoutes"] {
  const defaults = makeScreenRoutes(isBuiltInScreenRoutePreset(preset) ? preset : "balanced", Date.now(), "", env);
  if (!isRecord(value)) return defaults;
  for (const screenId of SCREEN_IDS) {
    const existing = value[screenId];
    if (!isRecord(existing)) continue;
    const owner = normalizeScreenOwner(existing.owner) || defaults[screenId].owner;
    defaults[screenId] = {
      ...defaults[screenId],
      ...existing,
      screenId,
      owner,
      url: makeScreenRoute(screenId, owner, positiveNumber(existing.updatedAt, defaults[screenId].updatedAt), String(existing.source || defaults[screenId].source || "state"), "", env).url,
      updatedAt: positiveNumber(existing.updatedAt, defaults[screenId].updatedAt)
    };
  }
  return defaults;
}

function normalizeCustomScreenRoutePresets(value: unknown): ScreenRouteArrangementPreset[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((entry) => normalizeScreenRouteArrangement(entry, Date.now(), null))
    .filter((entry): entry is ScreenRouteArrangementPreset => Boolean(entry))
    .filter((entry) => {
      if (isBuiltInScreenRoutePreset(entry.id) || seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
}

function normalizeScreenRouteArrangement(value: unknown, now: number, state: PerformanceState | null): ScreenRouteArrangementPreset | null {
  if (!isRecord(value)) return null;
  const rawId = String(value.id || "").trim();
  const id = rawId && !isBuiltInScreenRoutePreset(rawId) ? rawId : `custom-${crypto.randomUUID().slice(0, 8)}`;
  const name = String(value.name || value.label || "自定义编排").trim().slice(0, 40) || "自定义编排";
  const inputRoutes = isRecord(value.routes) ? value.routes : {};
  const inputScenes = isRecord(value.vjScenes) ? value.vjScenes : {};
  const routes: Record<string, ScreenOwner> = {};
  const vjScenes: Record<string, string> = {};
  const currentRoutes = state?.modules.interaction.screenRoutes || {};
  const currentScreens = new Map((state?.modules.visual.visualScreens || createDefaultVisualScreens()).map((screen) => [screen.id, screen]));

  for (const screenId of SCREEN_IDS) {
    const owner = normalizeScreenOwner(inputRoutes[screenId])
      || normalizeScreenOwner(currentRoutes[screenId]?.owner)
      || ownerForPreset(screenId, "balanced");
    routes[screenId] = owner;

    const scene = normalizeVisualScene(inputScenes[screenId]) || currentScreens.get(screenId)?.scene || "Video Flow";
    if (owner === "vj") vjScenes[screenId] = scene;
  }

  return {
    id,
    name,
    routes,
    vjScenes,
    userDefined: true,
    createdAt: positiveNumber(value.createdAt, now),
    updatedAt: now
  };
}

function normalizeVisualScene(value: unknown): string | null {
  const scene = String(value || "").trim();
  return scene ? scene : null;
}

function applyScreenRouteArrangement(
  state: PerformanceState,
  preset: ScreenRouteArrangementPreset,
  now: number,
  env: Env,
  options: { applyVisualScenes?: boolean } = {}
) {
  const routes: PerformanceState["modules"]["interaction"]["screenRoutes"] = {};
  for (const screenId of SCREEN_IDS) {
    const owner = normalizeScreenOwner(preset.routes[screenId]) || "baofa";
    routes[screenId] = makeScreenRoute(screenId, owner, now, "preset", "", env);
  }
  state.modules.interaction.screenRoutePreset = preset.id;
  state.modules.interaction.screenRoutes = routes;
  if (options.applyVisualScenes === false) return;
  state.modules.visual.visualScreens = normalizeVisualScreens(
    state.modules.visual.visualScreens.map((screen) => {
      const scene = preset.vjScenes[screen.id];
      return scene ? { ...screen, scene, enabled: true } : screen;
    })
  );
}

function applyCommand(state: PerformanceState, command: ControlCommand, env: Env) {
  const value = command.value;
  if (command.module === "show") {
    if (command.command === "play") {
      state.show.status = "running";
      state.show.startedAt = state.show.startedAt || Date.now();
      state.modules.audio.transport = "playing";
    }
    if (command.command === "pause") {
      state.show.status = "paused";
      state.modules.audio.transport = "paused";
    }
    if (command.command === "stop") {
      state.show.status = "ended";
      state.show.startedAt = null;
      state.modules.audio.transport = "stopped";
    }
    if (command.command === "reset") {
      state.show.status = "standby";
      state.show.startedAt = null;
      state.show.positionMs = 0;
      state.show.beat = 0;
      state.show.bar = 1;
      state.modules.audio.transport = "stopped";
    }
    if (command.command === "setBpm") {
      state.show.bpm = positiveNumber(value, state.show.bpm);
      state.modules.audio.bpm = state.show.bpm;
    }
  }
  if (command.module === "audio") {
    const source = state.audioSources[command.target];
    if (source && command.command === "setMute") {
      source.muted = Boolean(value);
      source.gain = source.muted ? 0 : Math.max(source.gain, 0.5);
    }
    if (source && command.command === "setGain") {
      source.gain = clampUnit(value, source.gain);
      source.muted = source.gain === 0;
    }
    if (command.command === "setPreset") state.modules.audio.activePreset = String(value || command.target);
    if (command.command === "setStyle") state.modules.audio.activeStyleId = String(value || command.target);
    if (command.command === "shuffleStyle") state.modules.audio.activePreset = `${state.modules.audio.activePreset || "Style"} Shuffle`;
    if (command.command === "setActiveTab") state.modules.audio.activeTab = String(value || command.target);
    if (command.command === "setMasterLevel") state.modules.audio.masterLevel = clampUnit(value, state.modules.audio.masterLevel);
  }
  if (command.module === "visual" || command.module === "video") {
    if (["setScene", "focusVideo"].includes(command.command)) state.modules.visual.scene = String(value || command.target);
    if (command.command === "setPreset") state.modules.visual.preset = String(value || command.target);
    if (command.command === "setText") {
      if (isRecord(value)) state.modules.visual.text = mergePatch(state.modules.visual.text as unknown as JsonRecord, value) as typeof state.modules.visual.text;
      else state.modules.visual.text.value = String(value || "");
    }
    if (command.command === "setAudioDrive" && ["mic", "music", "api", "hybrid"].includes(String(value))) {
      state.modules.visual.audioDriveMode = (String(value) === "hybrid" ? "api" : String(value)) as "mic" | "music" | "api";
    }
    if (command.command === "setFullscreen") state.modules.visual.fullscreen = Boolean(value);
    if (command.command === "setColors" && isRecord(value)) state.modules.visual.colors = mergePatch(state.modules.visual.colors as unknown as JsonRecord, value) as typeof state.modules.visual.colors;
    if (command.command === "setFx" && isRecord(value)) state.modules.visual.fx = mergePatch(state.modules.visual.fx as unknown as JsonRecord, value) as typeof state.modules.visual.fx;
  }
  if (command.module === "interaction") {
    if (command.command === "setOperationLock") {
      const lockedModules = nextLockedModules(state.operationLock.lockedModules, command.target, value);
      state.operationLock = {
        locked: lockedModules.length > 0,
        lockedModules,
        ownerModule: "dashboard",
        lockedBy: command.issuedBy,
        updatedAt: Date.now()
      };
    }
    if (["setInteractionMode", "setMode"].includes(command.command)) {
      const nextMode = String(value || command.target) as PerformanceState["modules"]["interaction"]["mode"];
      state.modules.interaction.mode = nextMode;
      state.modules.interaction.visualMode = "tree";
      if (nextMode === "idle") {
        state.modules.interaction.treeGrowth = Math.max(state.modules.interaction.treeGrowth, 0.12);
        state.modules.interaction.treePhase = "idle";
        state.modules.interaction.intensity = 0.08;
        state.modules.interaction.gestureActive = false;
      }
    }
    if (command.command === "setIntensity") state.modules.interaction.intensity = clampUnit(value, state.modules.interaction.intensity);
    if (command.command === "resetTree") {
      state.modules.interaction.treeGrowth = 0;
      state.modules.interaction.treePhase = "idle";
      state.modules.interaction.gestureActive = false;
      state.modules.interaction.mode = "idle";
      state.modules.interaction.visualMode = "tree";
      state.modules.interaction.fireworkState = "standby";
      state.modules.interaction.baofaFishState = "idle";
      state.modules.interaction.intensity = 0.08;
      state.modules.interaction.evolution = 0;
      state.modules.interaction.lastInteraction = null;
      state.modules.interaction.screenPulse = null;
      state.show.status = "standby";
      state.show.startedAt = null;
      state.show.positionMs = 0;
      state.show.beat = 0;
      state.show.bar = 1;
      state.modules.audio.transport = "stopped";
    }
    if (command.command === "setTreeStandby") {
      state.modules.interaction.treeGrowth = 0;
      state.modules.interaction.treePhase = "idle";
      state.modules.interaction.gestureActive = false;
      state.modules.interaction.mode = "idle";
      state.modules.interaction.visualMode = "tree";
      state.modules.interaction.intensity = 0.08;
      state.modules.interaction.evolution = 0;
      state.modules.interaction.lastInteraction = null;
      state.modules.interaction.screenPulse = null;
    }
    if (command.command === "setVisualMode" && ["tree", "firework"].includes(String(value))) {
      state.modules.interaction.visualMode = String(value) as PerformanceState["modules"]["interaction"]["visualMode"];
    }
    if (command.command === "setFireworkState") {
      state.modules.interaction.fireworkState = ["standby", "launching", "resetting"].includes(String(value)) ? String(value) as PerformanceState["modules"]["interaction"]["fireworkState"] : "standby";
      state.modules.interaction.visualMode = "firework";
    }
    if (command.command === "setBaofaFishState") {
      const fishState = String(value) === "roam" ? "roam" : String(value) === "running" ? "running" : "idle";
      state.modules.interaction.baofaFishState = fishState;
    }
    if (command.command === "pulseScreen") state.modules.interaction.screenPulse = { source: String(value || command.target), timestamp: Date.now() };
    if (command.command === "setScreen") {
      state.modules.interaction.screenId = String(value || command.target);
      state.modules.interaction.role = ["MASTER", "A1"].includes(state.modules.interaction.screenId) ? "master" : "screen";
    }
    if (command.command === "setScreenOwner") {
      const owner = normalizeScreenOwner(value);
      if (SCREEN_IDS.includes(command.target as (typeof SCREEN_IDS)[number]) && owner) {
        state.modules.interaction.screenRoutes[command.target] = makeScreenRoute(command.target, owner, Date.now(), "control", "", env);
        state.modules.interaction.screenRoutePreset = "balanced";
      }
    }
    if (command.command === "setScreenRoutePreset") {
      const preset = normalizeScreenRoutePreset(value || command.target);
      if (preset) {
        const customPreset = state.modules.interaction.customScreenRoutePresets.find((entry) => entry.id === preset);
        if (customPreset) applyScreenRouteArrangement(state, customPreset, Date.now(), env, { applyVisualScenes: !isVisualAuthorityActive(state) });
        else if (isBuiltInScreenRoutePreset(preset)) {
          state.modules.interaction.screenRoutePreset = preset;
          state.modules.interaction.screenRoutes = makeScreenRoutes(preset, Date.now(), "", env);
        }
      }
    }
    if (command.command === "saveScreenRouteArrangement") {
      const now = Date.now();
      const preset = normalizeScreenRouteArrangement(value, now, state);
      if (preset) {
        state.modules.interaction.customScreenRoutePresets = [
          ...state.modules.interaction.customScreenRoutePresets.filter((entry) => entry.id !== preset.id),
          preset
        ];
        applyScreenRouteArrangement(state, preset, now, env, { applyVisualScenes: !isVisualAuthorityActive(state) });
      }
    }
    if (command.command === "deleteScreenRouteArrangement") {
      const presetId = String(value || command.target || "").trim();
      if (presetId && !isBuiltInScreenRoutePreset(presetId)) {
        state.modules.interaction.customScreenRoutePresets = state.modules.interaction.customScreenRoutePresets.filter((entry) => entry.id !== presetId);
        if (state.modules.interaction.screenRoutePreset === presetId) {
          state.modules.interaction.screenRoutePreset = "balanced";
          state.modules.interaction.screenRoutes = makeScreenRoutes("balanced", Date.now(), "", env);
        }
      }
    }
    if (command.command === "setScreenAutoRedirect") state.modules.interaction.screenPresentation.autoRedirect = Boolean(value);
    if (command.command === "setScreenDebugVisible") state.modules.interaction.screenPresentation.showDebug = Boolean(value);
    if (command.command === "setScreenMenuVisible") state.modules.interaction.screenPresentation.showMenu = Boolean(value);
    if (command.command === "setScreenCameraEnabled") state.modules.interaction.screenPresentation.cameraEnabled = Boolean(value);
    if (command.command === "setScreenPresentation" && isRecord(value)) {
      state.modules.interaction.screenPresentation = { ...state.modules.interaction.screenPresentation, ...value, configured: true };
    }
  }
}

function buildControlPatchMessages(command: ControlCommand, state: PerformanceState): SyncMessage[] {
  const updatedAt = state.updatedAt;
  if (command.module === "show") {
    const audioPatch: JsonRecord = {};
    if (["play", "pause", "stop", "reset"].includes(command.command)) audioPatch.transport = state.modules.audio.transport;
    if (command.command === "setBpm") audioPatch.bpm = state.modules.audio.bpm;
    return [
      { type: "show.patch", patch: state.show, updatedAt },
      ...(Object.keys(audioPatch).length ? [{ type: "state.patch" as const, module: "audio" as const, patch: audioPatch, updatedAt }] : [])
    ];
  }
  if (command.module === "audio") return [{ type: "state.patch", module: "audio", patch: pickAudioPatch(command, state), updatedAt }];
  if (command.module === "visual" || command.module === "video") return [{ type: "state.patch", module: "visual", patch: pickVisualPatch(command, state), updatedAt }];
  if (command.module === "interaction") {
    const interaction = state.modules.interaction;
    let patch: JsonRecord;
    if (["setInteractionMode", "setMode"].includes(command.command)) patch = { mode: interaction.mode, visualMode: interaction.visualMode };
    else if (command.command === "setIntensity") patch = { intensity: interaction.intensity };
    else if (["resetTree", "setTreeStandby"].includes(command.command)) {
      patch = { mode: interaction.mode, intensity: interaction.intensity, evolution: interaction.evolution, treeGrowth: interaction.treeGrowth, treePhase: interaction.treePhase, gestureActive: interaction.gestureActive, visualMode: interaction.visualMode, fireworkState: interaction.fireworkState, baofaFishState: interaction.baofaFishState, lastInteraction: interaction.lastInteraction, screenPulse: interaction.screenPulse };
    } else if (command.command === "setVisualMode") patch = { visualMode: interaction.visualMode, mode: interaction.mode, baofaFishState: interaction.baofaFishState };
    else if (command.command === "setFireworkState") patch = { fireworkState: interaction.fireworkState, visualMode: interaction.visualMode };
    else if (command.command === "setBaofaFishState") patch = { baofaFishState: interaction.baofaFishState };
    else if (command.command === "pulseScreen") patch = { screenPulse: interaction.screenPulse };
    else if (command.command === "setScreen") patch = { screenId: interaction.screenId, role: interaction.role };
    else if (["setScreenOwner", "setScreenRoutePreset"].includes(command.command)) patch = { screenRoutePreset: interaction.screenRoutePreset, screenRoutes: interaction.screenRoutes };
    else if (["setScreenAutoRedirect", "setScreenDebugVisible", "setScreenMenuVisible", "setScreenCameraEnabled", "setScreenPresentation"].includes(command.command)) patch = { screenPresentation: interaction.screenPresentation };
    else if (command.command === "saveScreenRouteArrangement") patch = { screenRoutePreset: interaction.screenRoutePreset, screenRoutes: interaction.screenRoutes, customScreenRoutePresets: interaction.customScreenRoutePresets };
    else if (command.command === "deleteScreenRouteArrangement") patch = { screenRoutePreset: interaction.screenRoutePreset, screenRoutes: interaction.screenRoutes, customScreenRoutePresets: interaction.customScreenRoutePresets };
    else if (command.command === "setOperationLock") patch = {};
    else patch = interaction as unknown as JsonRecord;
    const messages: SyncMessage[] = [{ type: "state.patch", module: "interaction", patch, updatedAt }];
    if (command.command === "resetTree") {
      messages.push({ type: "show.patch", patch: state.show, updatedAt });
      messages.push({ type: "state.patch", module: "audio", patch: { transport: state.modules.audio.transport }, updatedAt });
    }
    return messages;
  }
  return [];
}

function pickAudioPatch(command: ControlCommand, state: PerformanceState): JsonRecord {
  if (["setMute", "setGain"].includes(command.command)) {
    return { activeSourceId: state.modules.audio.activeSourceId, masterLevel: state.modules.audio.masterLevel, audioSources: { [command.target]: state.audioSources[command.target] } };
  }
  if (command.command === "setMasterLevel") return { masterLevel: state.modules.audio.masterLevel };
  if (command.command === "setPreset") return { activePreset: state.modules.audio.activePreset };
  if (command.command === "setStyle") return { activeStyleId: state.modules.audio.activeStyleId };
  if (command.command === "shuffleStyle") return { activePreset: state.modules.audio.activePreset, activeStyleId: state.modules.audio.activeStyleId };
  if (command.command === "setActiveTab") return { activeTab: state.modules.audio.activeTab };
  return state.modules.audio as unknown as JsonRecord;
}

function pickVisualPatch(command: ControlCommand, state: PerformanceState): JsonRecord {
  if (["setScene", "focusVideo"].includes(command.command)) return { scene: state.modules.visual.scene, preset: state.modules.visual.preset };
  if (command.command === "setPreset") return { preset: state.modules.visual.preset };
  if (command.command === "setText") return { text: state.modules.visual.text };
  if (command.command === "setAudioDrive") return { audioDriveMode: state.modules.visual.audioDriveMode };
  if (command.command === "setFullscreen") return { fullscreen: state.modules.visual.fullscreen };
  if (command.command === "setColors") return { colors: state.modules.visual.colors };
  if (command.command === "setFx") return { fx: state.modules.visual.fx };
  return state.modules.visual as unknown as JsonRecord;
}

function shouldDeliverToSocket(profile: ConnectionState | undefined, message: SyncMessage) {
  if (!profile) return true;
  if (message.type === "client.presence") return isDashboardProfile(profile);
  if (message.type === "control.ack") return isDashboardProfile(profile) || profile.id === message.command.issuedBy;
  if (message.type === "control.command") return shouldDeliverControl(profile, message);
  if (message.type === "state.patch") return shouldDeliverModulePatch(profile, message.module, message.patch);
  if (message.type === "show.patch") return !isScreenGatewayProfile(profile) || isDashboardProfile(profile);
  if (message.type === "mixer.audioFrame") return isDashboardProfile(profile) || profile.module === "visual" || profile.module === "audio";
  return true;
}

function shouldDeliverControl(profile: ConnectionState, command: ControlCommand) {
  if (isDashboardProfile(profile)) return true;
  if (isScreenGatewayProfile(profile)) return false;
  if (command.module === "show") return profile.module !== "unknown";
  if (command.module === "video") return profile.module === "visual";
  return profile.module === command.module;
}

function shouldDeliverModulePatch(profile: ConnectionState, moduleName: ModuleName, patch: JsonRecord) {
  if (isDashboardProfile(profile)) return true;
  if (isScreenGatewayProfile(profile)) {
    return moduleName === "interaction" && Boolean(patch.screenRoutes || patch.screenRoutePreset || patch.screenPresentation || patch.screenTopology || patch.screenRegistry);
  }
  return profile.module === moduleName || profile.capabilities.has(`state.${moduleName}`);
}

function isDashboardProfile(profile: ConnectionState) {
  return profile.module === "dashboard" && !isScreenGatewayProfile(profile);
}

function isScreenGatewayProfile(profile: ConnectionState) {
  return profile.role === "screen-gateway" || profile.capabilities.has("screen.route");
}

function resolveStateRoutes(state: PerformanceState, origin: string, env: Env, room?: string | null): PerformanceState {
  const routes = makeScreenRoutes(state.modules.interaction.screenRoutePreset, Date.now(), origin, env, room);
  for (const [screenId, route] of Object.entries(state.modules.interaction.screenRoutes)) {
    routes[screenId] = makeScreenRoute(screenId, route.owner, route.updatedAt, route.source || "state", origin, env, room);
  }
  return {
    ...state,
    modules: {
      ...state.modules,
      interaction: {
        ...state.modules.interaction,
        screenRoutes: routes
      }
    }
  };
}

function makeScreenRoutes(preset: ScreenRoutePreset, updatedAt: number, origin: string, env: Env, room?: string | null) {
  return Object.fromEntries(SCREEN_IDS.map((screenId) => [
    screenId,
    makeScreenRouteForPreset(screenId, preset, updatedAt, "preset", origin, env, room)
  ]));
}

function makeScreenRouteForPreset(screenId: string, preset: ScreenRoutePreset, updatedAt: number, source: string, origin: string, env: Env, room?: string | null) {
  return makeScreenRoute(screenId, ownerForPreset(screenId, preset), updatedAt, source, origin, env, room);
}

function makeScreenRoute(screenId: string, owner: ScreenOwner, updatedAt: number, source: string, origin: string, env: Env, room?: string | null) {
  const vjOrigin = env.VJ_SCREEN_ORIGIN || origin || HOSTED_VJ_SCREEN_ORIGIN;
  const baofaOrigin = env.BAOFA_SCREEN_ORIGIN || origin || HOSTED_BAOFA_SCREEN_ORIGIN;
  const makeUrl = (routeOrigin: string) => {
    const url = new URL(`${routeOrigin.replace(/\/$/, "")}/screen/${encodeURIComponent(screenId)}`);
    if (room) url.searchParams.set("room", room);
    return url.toString();
  };
  return {
    screenId,
    owner,
    url: owner === "vj"
      ? makeUrl(vjOrigin)
      : owner === "baofa"
        ? makeUrl(baofaOrigin)
        : null,
    updatedAt,
    source
  };
}

function ownerForPreset(screenId: string, preset: ScreenRoutePreset): ScreenOwner {
  if (preset === "vj_takeover") return "vj";
  if (preset === "baofa_takeover") return "baofa";
  return VJ_SCREEN_IDS.has(screenId) ? "vj" : "baofa";
}

function normalizeControlCommand(input: unknown): ControlCommand {
  if (!isRecord(input)) throw new Error("controlCommand must be an object");
  if (!input.target || typeof input.target !== "string") throw new Error("controlCommand.target is required");
  if (!input.command || typeof input.command !== "string") throw new Error("controlCommand.command is required");
  return {
    type: "control.command",
    id: String(input.id || crypto.randomUUID()),
    target: input.target,
    module: (input.module || inferModule(input.command)) as ControlCommand["module"],
    command: input.command,
    value: input.value,
    issuedBy: String(input.issuedBy || "api-client"),
    timestamp: Number(input.timestamp || Date.now())
  };
}

function inferModule(command: string): ControlCommand["module"] {
  if (["setMute", "setGain", "setMasterLevel", "setPreset", "setStyle", "shuffleStyle", "setActiveTab"].includes(command)) return "audio";
  if (["setScene", "setText", "setAudioDrive", "setFullscreen", "setColors", "setFx"].includes(command)) return "visual";
  if (["setMode", "setIntensity", "resetTree", "setTreeStandby", "setVisualMode", "setFireworkState", "setBaofaFishState", "pulseScreen", "setScreen", "setScreenOwner", "setScreenRoutePreset", "saveScreenRouteArrangement", "deleteScreenRouteArrangement", "setScreenAutoRedirect", "setScreenDebugVisible", "setScreenMenuVisible", "setScreenCameraEnabled", "setScreenPresentation", "setOperationLock"].includes(command)) return "interaction";
  if (["play", "pause", "stop", "reset", "setBpm", "seek"].includes(command)) return "show";
  if (command === "focusVideo") return "video";
  if (command === "setGuestOnStage") return "guest";
  return "show";
}

function normalizeAudioFrame(input: unknown): AudioFrame {
  if (!isRecord(input)) throw new Error("audioFrame must be an object");
  if (!input.sourceId || typeof input.sourceId !== "string") throw new Error("audioFrame.sourceId is required");
  const level = clampUnit(input.level);
  return {
    type: "mixer.audioFrame",
    sourceId: input.sourceId,
    deviceId: String(input.deviceId || "mixer-main"),
    displayName: String(input.displayName || input.sourceId),
    timestamp: Number(input.timestamp || Date.now()),
    level,
    rms: clampUnit(input.rms, Math.max(0, level - 0.06)),
    peak: clampUnit(input.peak, Math.min(1, level + 0.12)),
    gain: clampUnit(input.gain, 0.72),
    muted: Boolean(input.muted),
    speaking: typeof input.speaking === "boolean" ? input.speaking : level > 0.22,
    frequencyBands: Array.isArray(input.frequencyBands) ? input.frequencyBands.slice(0, 32).map((value) => clampUnit(value)) : Array.from({ length: 16 }, () => 0),
    slotIds: normalizeStringList(input.slotIds),
    slotNames: normalizeStringList(input.slotNames),
    slotCategories: normalizeStringList(input.slotCategories),
    slotLevels: Array.isArray(input.slotLevels) ? input.slotLevels.slice(0, 32).map((value) => clampUnit(value)) : [],
    slotActivity: Array.isArray(input.slotActivity) ? input.slotActivity.slice(0, 32).map((value) => clampUnit(value)) : [],
    activeStep: typeof input.activeStep === "number" ? input.activeStep : undefined,
    stepProgress: clampUnit(input.stepProgress),
    bpm: typeof input.bpm === "number" ? input.bpm : undefined,
    styleEnergy: clampUnit(input.styleEnergy),
    styleId: typeof input.styleId === "string" ? input.styleId : "",
    activePreset: typeof input.activePreset === "string" ? input.activePreset : "",
    transport: typeof input.transport === "string" ? input.transport : "",
    masterLevel: clampUnit(input.masterLevel, level)
  };
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => typeof entry === "string" ? entry : "").filter(Boolean)
    : [];
}

function isCentralControlSource(source: unknown): boolean {
  const normalized = String(source || "").toLowerCase();
  return normalized.includes("dashboard") || normalized.includes("central") || normalized.includes("control-room") || normalized.includes("中控");
}

function isVjVisualSource(source: unknown): boolean {
  const normalized = String(source || "").toLowerCase();
  if (!normalized) return false;
  return normalized.includes("vj") || normalized.includes("visual") || normalized.includes("4302");
}

function normalizeLockModule(value: unknown): ModuleName | null {
  if (value === "video") return "visual";
  return isModuleName(value) ? value : null;
}

function normalizeVisualControlAuthority(value: unknown): PerformanceState["modules"]["visual"]["controlAuthority"] {
  const record = isRecord(value) ? value : {};
  const fallbackAfterMs = Math.max(1_000, Math.round(positiveNumber(record.fallbackAfterMs, VISUAL_AUTHORITY_FALLBACK_MS)));
  return {
    owner: record.owner === "vj" ? "vj" : "show-control",
    source: typeof record.source === "string" && record.source.trim() ? record.source.trim() : null,
    lastVjAt: nullableTimestamp(record.lastVjAt),
    activeUntil: nullableTimestamp(record.activeUntil),
    fallbackAfterMs
  };
}

function nullableTimestamp(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function isVisualAuthorityActive(state: PerformanceState, now = Date.now()) {
  const authority = normalizeVisualControlAuthority(state.modules.visual.controlAuthority);
  return authority.owner === "vj" && typeof authority.activeUntil === "number" && authority.activeUntil > now;
}

function shouldDeferVisualControlToVj(state: PerformanceState, source: unknown) {
  return !isVjVisualSource(source) && isVisualAuthorityActive(state);
}

function markVisualAuthorityFromVj(state: PerformanceState, source: unknown, now = Date.now()) {
  const current = normalizeVisualControlAuthority(state.modules.visual.controlAuthority);
  state.modules.visual.controlAuthority = {
    owner: "vj",
    source: String(source || "vj-4302"),
    lastVjAt: now,
    activeUntil: now + current.fallbackAfterMs,
    fallbackAfterMs: current.fallbackAfterMs
  };
}

function markVisualAuthorityFromShowControl(state: PerformanceState, source: unknown) {
  const current = normalizeVisualControlAuthority(state.modules.visual.controlAuthority);
  if (isVisualAuthorityActive(state)) return;
  state.modules.visual.controlAuthority = {
    owner: "show-control",
    source: String(source || "show-control"),
    lastVjAt: current.lastVjAt,
    activeUntil: null,
    fallbackAfterMs: current.fallbackAfterMs
  };
}

function normalizeLockedModules(value: unknown): ModuleName[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(normalizeLockModule).filter((item): item is ModuleName => Boolean(item))));
}

function nextLockedModules(current: ModuleName[], target: string, value: unknown): ModuleName[] {
  const lockedModules = new Set(normalizeLockedModules(current));
  const record = isRecord(value) ? value : {};
  const modulesValue = Array.isArray(record.modules) ? record.modules : undefined;
  const moduleValue = normalizeLockModule(record.module || target);
  const modules = modulesValue
    ? modulesValue.map(normalizeLockModule).filter((item): item is ModuleName => Boolean(item))
    : moduleValue
      ? [moduleValue]
      : ["audio", "visual", "interaction"] as ModuleName[];
  const shouldLock = typeof record.locked === "boolean" ? record.locked : Boolean(value);

  for (const moduleName of modules) {
    if (shouldLock) lockedModules.add(moduleName);
    else lockedModules.delete(moduleName);
  }

  return [...lockedModules];
}

function appendEvent(state: PerformanceState, type: string, module: string | undefined, source: string | undefined, message: string, payload?: unknown) {
  state.eventLog.unshift({ id: crypto.randomUUID(), type, module, source, message, timestamp: Date.now(), payload });
  state.eventLog = state.eventLog.slice(0, 160);
}

function normalizeScreenOwner(value: unknown): ScreenOwner | null {
  return ["vj", "baofa", "off", "diagnostic"].includes(String(value)) ? String(value) as ScreenOwner : null;
}

function normalizeScreenRoutePreset(value: unknown): ScreenRoutePreset | null {
  const preset = String(value || "").trim();
  return preset ? preset : null;
}

function normalizeKnownScreenRoutePreset(value: unknown, customPresets: ScreenRouteArrangementPreset[]): ScreenRoutePreset {
  const preset = normalizeScreenRoutePreset(value);
  if (!preset) return "balanced";
  if (isBuiltInScreenRoutePreset(preset)) return preset;
  return customPresets.some((entry) => entry.id === preset) ? preset : "balanced";
}

function isBuiltInScreenRoutePreset(value: ScreenRoutePreset): value is (typeof BUILT_IN_SCREEN_ROUTE_PRESETS)[number] {
  return BUILT_IN_SCREEN_ROUTE_PRESETS.includes(value as (typeof BUILT_IN_SCREEN_ROUTE_PRESETS)[number]);
}

function mergePatch(target: JsonRecord, patch: JsonRecord): JsonRecord {
  const next = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (isRecord(value) && isRecord(next[key])) next[key] = mergePatch(next[key] as JsonRecord, value);
    else next[key] = value;
  }
  return next;
}

function isModuleName(value: unknown): value is ModuleName {
  return value === "audio" || value === "visual" || value === "interaction";
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function positiveNumber(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, number);
}

function clampUnit(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function emptyAudioSummary() {
  return {
    volume: 0,
    subBass: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    highMid: 0,
    treble: 0,
    energy: 0,
    beat: 0,
    spectralCentroid: 0,
    spectralFlux: 0,
    transient: 0,
    dynamicRange: 0,
    syncedSignal: 0
  };
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-control-token"
  };
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: corsHeaders() });
}
