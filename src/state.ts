import crypto from "node:crypto";
import {
  AudioFrame,
  ClientHelloMessage,
  ClientInfo,
  ControlCommand,
  EventLogItem,
  InteractionModuleState,
  JsonRecord,
  MODULE_NAMES,
  ModuleName,
  PerformanceState,
  ScreenRouteArrangementPreset,
  ScreenOwner,
  ScreenRouteEntry,
  BuiltInScreenRoutePreset,
  ScreenRoutePreset,
  VisualScreenState
} from "./types.js";

const DEFAULT_BANDS = Array.from({ length: 16 }, () => 0);

export const SCREEN_IDS = [
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

const VJ_SCREEN_IDS = new Set(["A1"]);
const VJ_TAKEOVER_SCREEN_IDS: Set<string> = new Set(SCREEN_IDS);
const BUILT_IN_SCREEN_ROUTE_PRESETS: BuiltInScreenRoutePreset[] = ["balanced", "checkin", "gallery", "vj_takeover", "baofa_takeover", "echo"];
const EXTERNAL_SCREEN_ROUTE_PRESETS: Partial<Record<BuiltInScreenRoutePreset, string>> = {
  checkin: "https://sign-rho-azure.vercel.app/",
  gallery: "https://333d-main-read.vercel.app/",
  echo: "https://review-zeta-seven.vercel.app/"
};
const HOSTED_VJ_SCREEN_ORIGIN = "https://doit-pearl.vercel.app";
const HOSTED_BAOFA_SCREEN_ORIGIN = "https://baofa.vercel.app";
const VISUAL_SCENE_PRESETS: Record<string, string> = {
  "Video Flow": "Video Flow",
  "Layered Stage": "Layered Stage",
  Purple: "Purple",
  "Blue Font": "Blue Font",
  Pulse: "Neon Pulse",
  Liquid: "Liquid Dream",
  Topology: "Sonic Topology",
  Chromaflux: "Chromaflux",
  Dumbar: "Dumbar Base",
  Void: "Dark Space",
  Cyber: "Cyberpunk"
};
const VISUAL_SCENE_IDS = Object.keys(VISUAL_SCENE_PRESETS);
const CONFIGURED_SCREEN_ROUTE_ORIGIN = (() => {
  const origin = normalizeScreenRouteOrigin(process.env.SHOW_SCREEN_ROUTE_ORIGIN || process.env.SHOW_PUBLIC_ORIGIN);
  return origin ? `${origin.protocol}//${origin.host}` : null;
})();
const CONFIGURED_VJ_SCREEN_ORIGIN = (() => {
  const origin = normalizeScreenRouteOrigin(process.env.VJ_SCREEN_ORIGIN);
  return origin ? `${origin.protocol}//${origin.host}` : null;
})();
const CONFIGURED_BAOFA_SCREEN_ORIGIN = (() => {
  const origin = normalizeScreenRouteOrigin(process.env.BAOFA_SCREEN_ORIGIN);
  return origin ? `${origin.protocol}//${origin.host}` : null;
})();

function normalizeScreenOccupancyId(value: unknown) {
  const screenId = String(value || "").trim();
  if (!screenId) return "";
  return screenId === "MASTER" ? "A1" : screenId;
}

export function isModuleName(value: unknown): value is ModuleName {
  return typeof value === "string" && MODULE_NAMES.includes(value as ModuleName);
}

export function createDefaultState(now = Date.now()): PerformanceState {
  return {
    protocolVersion: "mixer.realtime.v1",
    performanceProtocolVersion: "performance.show.v1",
    updatedAt: now,
    show: {
      id: "show-main",
      name: "Live Performance",
      status: "standby",
      startedAt: null,
      positionMs: 0,
      bpm: 120,
      beat: 0,
      bar: 1
    },
    operationLock: {
      locked: false,
      lockedModules: [],
      ownerModule: "dashboard",
      lockedBy: null,
      updatedAt: null
    },
    room: {
      id: "classroom-a",
      name: "Main Performance Room",
      mode: "live-performance"
    },
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
        slots: [
          { id: "slot-1", name: "Beat", category: "beat", muted: false, level: 0.72 },
          { id: "slot-2", name: "Bass", category: "bass", muted: false, level: 0.58 },
          { id: "slot-3", name: "Melody", category: "melody", muted: false, level: 0.48 },
          { id: "slot-4", name: "FX", category: "effect", muted: false, level: 0.32 }
        ],
        fx: {
          compressor: 18,
          reverb: 8,
          delay: 0
        },
        arrangementSummary: null
      },
      visual: {
        status: "online",
        scene: "Cyber",
        preset: "Cyberpunk",
        colors: {
          base: "#00f3ff",
          secondary: "#bf00ff",
          accent: "#ffffff",
          background: "#030008"
        },
        fx: {
          bloomIntensity: 1.5,
          rgbSplitAmount: 0.005,
          distortion: 0,
          glitchActive: false,
          speed: 1,
          chaos: 0
        },
        text: {
          value: "GAFA",
          animation: "Cinematic",
          reactive: 1,
          glow: 1,
          speed: 1,
          color: "#ffffff",
          fontSize: 4.6,
          fontWeight: 900,
          letterSpacing: 0.02
        },
        audioDriveMode: "mic",
        fullscreen: false,
        visualMemories: [],
        visualScreens: createDefaultVisualScreens()
      },
      interaction: createDefaultInteractionModule()
    },
    audioSources: {
      "mic-teacher": makeAudioSource("mic-teacher", "Teacher Mic", 0.45, false, true, now),
      "mic-student": makeAudioSource("mic-student", "Student Mic", 0.18, false, false, now),
      "line-media": makeAudioSource("line-media", "Media Feed", 0.3, false, false, now),
      "remote-guest": makeAudioSource("remote-guest", "Remote Guest", 0.12, true, false, now)
    },
    clients: {},
    commandLog: [],
    eventLog: []
  };
}

function createDefaultInteractionModule(): InteractionModuleState {
  const now = Date.now();
  return {
    status: "online",
    screenTopology: SCREEN_TOPOLOGY,
    screenRegistry: createDefaultScreenRegistry(),
    screenRoutes: createScreenRoutesForPreset("balanced", now),
    screenRoutePreset: "balanced",
    customScreenRoutePresets: [],
    screenPresentation: {
      autoRedirect: true,
      showDebug: false,
      showMenu: false,
      configured: false
    },
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
  };
}

function makeAudioSource(
  sourceId: string,
  displayName: string,
  level: number,
  muted: boolean,
  speaking: boolean,
  timestamp: number
): AudioFrame {
  return {
    type: "mixer.audioFrame",
    sourceId,
    deviceId: "mixer-main",
    displayName,
    timestamp,
    level,
    rms: Math.max(0, level - 0.08),
    peak: Math.min(1, level + 0.16),
    gain: muted ? 0 : 0.72,
    muted,
    speaking,
    frequencyBands: DEFAULT_BANDS
  };
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => typeof entry === "string" ? entry : "").filter(Boolean)
    : [];
}

export function hydrateState(snapshot: unknown): PerformanceState {
  if (!snapshot || typeof snapshot !== "object") return createDefaultState();
  return normalizePerformanceState(mergePatch(createDefaultState() as unknown as JsonRecord, snapshot as JsonRecord) as unknown as PerformanceState);
}

export function normalizeAudioFrame(input: unknown): AudioFrame {
  if (!input || typeof input !== "object") {
    throw new Error("audioFrame must be an object");
  }

  const record = input as JsonRecord;
  if (!record.sourceId || typeof record.sourceId !== "string") {
    throw new Error("audioFrame.sourceId is required");
  }

  const level = clampUnit(record.level);
  return {
    type: "mixer.audioFrame",
    sourceId: record.sourceId,
    deviceId: String(record.deviceId || "mixer-main"),
    displayName: String(record.displayName || record.sourceId),
    timestamp: numberOrNow(record.timestamp),
    level,
    rms: clampUnit(record.rms, Math.max(0, level - 0.06)),
    peak: clampUnit(record.peak, Math.min(1, level + 0.12)),
    gain: clampUnit(record.gain, 0.72),
    muted: Boolean(record.muted),
    speaking: typeof record.speaking === "boolean" ? record.speaking : level > 0.22,
    frequencyBands: normalizeBands(record.frequencyBands),
    slotIds: normalizeStringList(record.slotIds),
    slotNames: normalizeStringList(record.slotNames),
    slotCategories: normalizeStringList(record.slotCategories),
    slotLevels: normalizeBands(record.slotLevels),
    slotActivity: normalizeBands(record.slotActivity),
    activeStep: typeof record.activeStep === "number" ? record.activeStep : undefined,
    stepProgress: clampUnit(record.stepProgress),
    bpm: typeof record.bpm === "number" ? record.bpm : undefined,
    styleEnergy: clampUnit(record.styleEnergy),
    styleId: typeof record.styleId === "string" ? record.styleId : "",
    activePreset: typeof record.activePreset === "string" ? record.activePreset : "",
    transport: typeof record.transport === "string" ? record.transport : "",
    masterLevel: clampUnit(record.masterLevel, level)
  };
}

export function normalizeControlCommand(input: unknown): ControlCommand {
  if (!input || typeof input !== "object") {
    throw new Error("controlCommand must be an object");
  }

  const record = input as JsonRecord;
  if (!record.target || typeof record.target !== "string") {
    throw new Error("controlCommand.target is required");
  }
  if (!record.command || typeof record.command !== "string") {
    throw new Error("controlCommand.command is required");
  }

  const module = String(record.module || inferModule(record.command));
  if (!isModuleName(module) && !["show", "video", "guest"].includes(module)) {
    throw new Error("controlCommand.module must be audio, visual, interaction, show, video, or guest");
  }

  return {
    type: "control.command",
    id: String(record.id || crypto.randomUUID()),
    target: record.target,
    module: module as ControlCommand["module"],
    command: record.command,
    value: record.value,
    issuedBy: String(record.issuedBy || "api-client"),
    timestamp: numberOrNow(record.timestamp)
  };
}

function inferModule(command: string): ControlCommand["module"] {
  if (["setMute", "setGain", "setMasterLevel", "setPreset", "setStyle", "shuffleStyle", "setActiveTab"].includes(command)) return "audio";
  if (["setScene", "setText", "setAudioDrive", "setFullscreen", "setColors", "setFx"].includes(command)) return "visual";
  if ([
    "setInteractionMode",
    "setMode",
    "setIntensity",
    "resetTree",
    "setVisualMode",
    "setFireworkState",
    "setBaofaFishState",
    "pulseScreen",
    "setScreen",
    "setScreenOwner",
    "setScreenRoutePreset",
    "saveScreenRouteArrangement",
    "deleteScreenRouteArrangement",
    "setScreenAutoRedirect",
    "setScreenDebugVisible",
    "setScreenMenuVisible",
    "setScreenPresentation",
    "setOperationLock"
  ].includes(command)) return "interaction";
  if (["play", "pause", "stop", "reset", "setBpm", "seek"].includes(command)) return "show";
  if (command === "focusVideo") return "video";
  if (command === "setGuestOnStage") return "guest";
  return "show";
}

export class ShowStateStore {
  private state: PerformanceState;

  constructor(initialState: PerformanceState = createDefaultState()) {
    this.state = hydrateState(initialState);
  }

  getState(): PerformanceState {
    return this.state;
  }

  reset(source = "control"): PerformanceState {
    this.state = createDefaultState();
    this.appendEvent("show.reset", "show", source, "Show state reset", {});
    return this.state;
  }

  applyAudioFrame(frame: AudioFrame): PerformanceState {
    this.state.audioSources[frame.sourceId] = {
      ...(this.state.audioSources[frame.sourceId] || {}),
      ...frame
    };
    this.state.modules.audio.activeSourceId = frame.sourceId;
    this.state.modules.audio.masterLevel = frame.muted ? 0 : frame.level;
    if (frame.activePreset) this.state.modules.audio.activePreset = frame.activePreset;
    if (frame.styleId) this.state.modules.audio.activeStyleId = frame.styleId;
    if (frame.bpm) this.state.modules.audio.bpm = frame.bpm;
    if (frame.transport === "playing" || frame.transport === "paused" || frame.transport === "stopped") {
      this.state.modules.audio.transport = frame.transport;
    }
    this.touch();
    return this.state;
  }

  applyModulePatch(moduleName: ModuleName, patch: JsonRecord, source = "module"): PerformanceState {
    const sanitizedPatch = moduleName === "interaction" ? sanitizeInteractionModulePatch(patch) : patch;
    mergePatch(this.state.modules[moduleName] as unknown as JsonRecord, sanitizedPatch);
    if (moduleName === "audio" && typeof patch.masterLevel === "number") {
      this.state.modules.audio.masterLevel = clampUnit(patch.masterLevel, this.state.modules.audio.masterLevel);
    }
    if (moduleName === "audio" && typeof patch.bpm === "number") {
      this.state.show.bpm = positiveNumber(patch.bpm, this.state.show.bpm);
    }
    if (moduleName === "audio") {
      if (typeof patch.activeStyleId === "string" && patch.activeStyleId) {
        this.state.modules.audio.activeStyleId = patch.activeStyleId;
      } else if (isRecord(patch.arrangementSummary) && typeof patch.arrangementSummary.styleId === "string" && patch.arrangementSummary.styleId) {
        this.state.modules.audio.activeStyleId = patch.arrangementSummary.styleId;
      }
    }
    if (moduleName === "interaction") {
      const client = this.state.clients[String(source || "")];
      if (client) {
        if (typeof sanitizedPatch.screenId === "string") client.screenId = normalizeScreenOccupancyId(sanitizedPatch.screenId) || sanitizedPatch.screenId;
        if (typeof sanitizedPatch.overview === "boolean") client.overview = sanitizedPatch.overview;
        if (typeof sanitizedPatch.role === "string") client.role = sanitizedPatch.role;
      }
      this.state.modules.interaction.screenTopology = normalizeScreenTopology(this.state.modules.interaction.screenTopology);
      this.state.modules.interaction.screenRegistry = normalizeScreenRegistry(this.state.modules.interaction.screenRegistry);
      const patchedPreset = normalizeScreenRoutePreset(sanitizedPatch.screenRoutePreset);
      if (patchedPreset) {
        this.state.modules.interaction.screenRoutePreset = patchedPreset;
        this.state.modules.interaction.screenRoutes = createScreenRoutesForPreset(patchedPreset, Date.now());
      }
      this.state.modules.interaction.screenPresentation = normalizeScreenPresentation(this.state.modules.interaction.screenPresentation);
      this.state.modules.interaction.screenRoutes = normalizeScreenRoutes(
        this.state.modules.interaction.screenRoutes,
        this.state.modules.interaction.screenRoutePreset
      );
    }
    this.touch();
    if (moduleName !== "audio") {
      this.appendEvent("module.statePatch", moduleName, source, `${moduleName} state updated`, patch);
    }
    return this.state;
  }

  applyControlCommand(command: ControlCommand): PerformanceState {
    applyCommand(this.state, command);
    this.state.commandLog.unshift(command);
    this.state.commandLog = this.state.commandLog.slice(0, 80);
    this.touch();
    this.appendEvent("control.command", command.module, command.issuedBy, `${command.command} -> ${command.target}`, {
      id: command.id,
      value: command.value
    });
    return this.state;
  }

  canApplyControlCommand(command: ControlCommand): boolean {
    if (command.command === "setOperationLock") return isCentralControlSource(command.issuedBy);
    if (isCentralControlSource(command.issuedBy)) return true;
    const moduleName = normalizeLockModule(command.module);
    if (!moduleName) return true;
    return !this.state.operationLock.lockedModules.includes(moduleName);
  }

  canApplyModulePatch(moduleName: ModuleName, source = "module"): boolean {
    if (isCentralControlSource(source)) return true;
    return !this.state.operationLock.lockedModules.includes(moduleName);
  }

  registerClient(message: ClientHelloMessage, fallbackId: string): ClientInfo {
    const now = Date.now();
    const module = isModuleName(message.module) || message.module === "dashboard"
      ? message.module
      : "unknown";
    const client: ClientInfo = {
      id: message.clientId || fallbackId,
      module,
      role: String(message.role || "client"),
      status: "online",
      connectedAt: this.state.clients[message.clientId || fallbackId]?.connectedAt || now,
      lastSeen: now,
      latency: null,
      capabilities: Array.isArray(message.capabilities) ? message.capabilities.map(String) : [],
      screenId: normalizeScreenOccupancyId(this.state.clients[message.clientId || fallbackId]?.screenId),
      overview: this.state.clients[message.clientId || fallbackId]?.overview
    };
    this.state.clients[client.id] = client;
    this.touch();
    this.appendEvent("client.presence", client.module, client.id, `${client.id} connected`, client);
    return client;
  }

  touchClient(clientId: string, sentAt?: number): ClientInfo | null {
    const client = this.state.clients[clientId];
    if (!client) return null;
    const now = Date.now();
    client.lastSeen = now;
    client.status = "online";
    client.latency = Number.isFinite(sentAt) ? Math.max(0, now - Number(sentAt)) : client.latency;
    this.touch();
    return client;
  }

  removeClient(clientId: string): ClientInfo | null {
    const client = this.state.clients[clientId];
    if (!client) return null;
    delete this.state.clients[clientId];
    this.touch();
    this.appendEvent("client.presence", client.module, client.id, `${client.id} disconnected`, client);
    return { ...client, status: "offline", lastSeen: Date.now() };
  }

  appendEvent(type: string, module: string | undefined, source: string | undefined, message: string, payload?: unknown): EventLogItem {
    const event: EventLogItem = {
      id: crypto.randomUUID(),
      type,
      module,
      source,
      message,
      timestamp: Date.now(),
      payload
    };
    this.state.eventLog.unshift(event);
    this.state.eventLog = this.state.eventLog.slice(0, 160);
    return event;
  }

  private touch() {
    this.state.updatedAt = Date.now();
  }
}

function applyCommand(state: PerformanceState, command: ControlCommand) {
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
    if (command.command === "seek") {
      state.show.positionMs = Math.max(0, Math.round(positiveNumber(value, state.show.positionMs)));
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
    if (command.command === "setMasterLevel") state.modules.audio.masterLevel = clampUnit(value, state.modules.audio.masterLevel);
    if (command.command === "setPreset") state.modules.audio.activePreset = String(value || command.target);
    if (command.command === "setStyle") state.modules.audio.activeStyleId = String(value || command.target);
    if (command.command === "shuffleStyle") state.modules.audio.activePreset = `${state.modules.audio.activePreset || "Style"} Shuffle`;
    if (command.command === "setActiveTab") state.modules.audio.activeTab = String(value || command.target);
  }

  if (command.module === "visual" || command.module === "video") {
    if (command.command === "focusVideo") {
      state.modules.visual.scene = String(value || command.target);
      state.modules.visual.preset = "Focused";
    }
    if (command.command === "setScene") {
      state.modules.visual.scene = String(value || command.target);
      state.modules.visual.preset = VISUAL_SCENE_PRESETS[state.modules.visual.scene] || state.modules.visual.preset;
    }
    if (command.command === "setPreset") state.modules.visual.preset = String(value || command.target);
    if (command.command === "setText") {
      if (isRecord(value)) mergePatch(state.modules.visual.text as unknown as JsonRecord, value);
      else state.modules.visual.text.value = String(value || "");
    }
    if (command.command === "setAudioDrive" && ["mic", "music", "api", "hybrid"].includes(String(value))) {
      state.modules.visual.audioDriveMode = (String(value) === "hybrid" ? "api" : String(value)) as "mic" | "music" | "api";
    }
    if (command.command === "setFullscreen") state.modules.visual.fullscreen = Boolean(value);
    if (command.command === "setColors" && isRecord(value)) mergePatch(state.modules.visual.colors as unknown as JsonRecord, value);
    if (command.command === "setFx" && isRecord(value)) mergePatch(state.modules.visual.fx as unknown as JsonRecord, value);
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
      state.modules.interaction.mode = String(value || command.target) as InteractionModuleState["mode"];
      state.modules.interaction.visualMode = "tree";
    }
    if (command.command === "setIntensity") state.modules.interaction.intensity = clampUnit(value, state.modules.interaction.intensity);
    if (command.command === "resetTree") {
      state.modules.interaction.treeGrowth = 0;
      state.modules.interaction.treePhase = "idle";
      state.modules.interaction.gestureActive = false;
      state.modules.interaction.mode = "idle";
      state.modules.interaction.visualMode = "tree";
      state.modules.interaction.fireworkState = "standby";
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
    if (command.command === "setVisualMode" && ["tree", "firework"].includes(String(value))) {
      state.modules.interaction.visualMode = String(value) as InteractionModuleState["visualMode"];
    }
    if (command.command === "setFireworkState") {
      const nextFireworkState = normalizeFireworkState(value);
      state.modules.interaction.fireworkState = nextFireworkState;
      state.modules.interaction.visualMode = "firework";
    }
    if (command.command === "setBaofaFishState") {
      const nextFishState = normalizeBaofaFishState(value);
      state.modules.interaction.baofaFishState = nextFishState;
    }
    if (command.command === "pulseScreen") {
      state.modules.interaction.screenPulse = { source: String(value || command.target), timestamp: Date.now() };
    }
    if (command.command === "setScreen") {
      state.modules.interaction.screenId = normalizeScreenOccupancyId(value || command.target) || String(value || command.target);
      state.modules.interaction.role = ["MASTER", "A1"].includes(state.modules.interaction.screenId) ? "master" : "screen";
    }
    if (command.command === "setScreenOwner") {
      const screenId = String(command.target || "");
      const owner = normalizeScreenOwner(value);
      if (SCREEN_IDS.includes(screenId as (typeof SCREEN_IDS)[number]) && owner) {
        state.modules.interaction.screenRoutes[screenId] = makeScreenRoute(screenId, owner, Date.now(), "control");
        state.modules.interaction.screenRoutePreset = "balanced";
      }
    }
    if (command.command === "setScreenRoutePreset") {
      const preset = normalizeScreenRoutePreset(value || command.target);
      if (preset) {
        const customPreset = state.modules.interaction.customScreenRoutePresets.find((entry) => entry.id === preset);
        if (customPreset) applyScreenRouteArrangement(state, customPreset, Date.now());
        else if (isBuiltInScreenRoutePreset(preset)) {
          state.modules.interaction.screenRoutePreset = preset;
          state.modules.interaction.screenRoutes = createScreenRoutesForPreset(preset, Date.now());
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
        applyScreenRouteArrangement(state, preset, now);
      }
    }
    if (command.command === "deleteScreenRouteArrangement") {
      const presetId = String(value || command.target || "").trim();
      if (presetId && !isBuiltInScreenRoutePreset(presetId)) {
        state.modules.interaction.customScreenRoutePresets = state.modules.interaction.customScreenRoutePresets.filter((entry) => entry.id !== presetId);
        if (state.modules.interaction.screenRoutePreset === presetId) {
          state.modules.interaction.screenRoutePreset = "balanced";
          state.modules.interaction.screenRoutes = createScreenRoutesForPreset("balanced", Date.now());
        }
      }
    }
    if (command.command === "setScreenAutoRedirect") {
      state.modules.interaction.screenPresentation.autoRedirect = Boolean(value);
      state.modules.interaction.screenPresentation.configured = true;
    }
    if (command.command === "setScreenDebugVisible") {
      state.modules.interaction.screenPresentation.showDebug = Boolean(value);
      state.modules.interaction.screenPresentation.configured = true;
    }
    if (command.command === "setScreenMenuVisible") {
      state.modules.interaction.screenPresentation.showMenu = Boolean(value);
      state.modules.interaction.screenPresentation.configured = true;
    }
    if (command.command === "setScreenPresentation" && isRecord(value)) {
      state.modules.interaction.screenPresentation = normalizeScreenPresentation({
        ...state.modules.interaction.screenPresentation,
        ...value,
        configured: true
      });
    }
  }

  if (command.module === "guest" && command.command === "setGuestOnStage") {
    state.show.status = Boolean(value) ? "running" : state.show.status;
  }
}

function normalizeBands(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_BANDS;
  return value.slice(0, 32).map((item) => clampUnit(item));
}

function normalizePerformanceState(state: PerformanceState): PerformanceState {
  state.operationLock.lockedModules = normalizeLockedModules(
    state.operationLock.lockedModules || (state.operationLock.locked ? MODULE_NAMES : [])
  );
  state.operationLock.locked = state.operationLock.lockedModules.length > 0;
  state.modules.audio.activeStyleId = typeof state.modules.audio.activeStyleId === "string" && state.modules.audio.activeStyleId
    ? state.modules.audio.activeStyleId
    : "default";
  state.modules.audio.activePreset = typeof state.modules.audio.activePreset === "string" && state.modules.audio.activePreset
    ? state.modules.audio.activePreset
    : "Neon Loop";
  state.modules.audio.bpm = positiveNumber(state.modules.audio.bpm, state.show.bpm || 120);
  state.modules.audio.masterLevel = clampUnit(state.modules.audio.masterLevel, 0.42);
  state.modules.visual.audioDriveMode = normalizeVisualAudioDriveMode(state.modules.visual.audioDriveMode);
  state.modules.visual.visualScreens = normalizeVisualScreens(state.modules.visual.visualScreens);
  state.modules.interaction.screenTopology = normalizeScreenTopology(state.modules.interaction.screenTopology);
  state.modules.interaction.screenRegistry = normalizeScreenRegistry(state.modules.interaction.screenRegistry);
  state.modules.interaction.screenRoutePreset = normalizeScreenRoutePreset(state.modules.interaction.screenRoutePreset) || "balanced";
  state.modules.interaction.customScreenRoutePresets = normalizeCustomScreenRoutePresets(state.modules.interaction.customScreenRoutePresets);
  state.modules.interaction.screenPresentation = normalizeScreenPresentation(state.modules.interaction.screenPresentation);
  state.modules.interaction.screenId = normalizeScreenOccupancyId(state.modules.interaction.screenId) || state.modules.interaction.screenId;
  state.modules.interaction.role = ["MASTER", "A1"].includes(state.modules.interaction.screenId) ? "master" : "screen";
  state.modules.interaction.visualMode = ["tree", "firework"].includes(String(state.modules.interaction.visualMode))
    ? state.modules.interaction.visualMode
    : "tree";
  state.modules.interaction.fireworkState = normalizeFireworkState(state.modules.interaction.fireworkState);
  state.modules.interaction.baofaFishState = normalizeBaofaFishState(state.modules.interaction.baofaFishState);
  state.modules.interaction.treePhase = normalizeTreePhase(state.modules.interaction.treePhase);
  state.modules.interaction.evolution = clampUnit(state.modules.interaction.evolution);
  if (state.modules.interaction.fireworkState !== "standby") {
    state.modules.interaction.visualMode = "firework";
  }
  state.modules.interaction.screenRoutes = normalizeScreenRoutes(
    state.modules.interaction.screenRoutes,
    state.modules.interaction.screenRoutePreset
  );
  return state;
}

function isCentralControlSource(source: unknown): boolean {
  const normalized = String(source || "").toLowerCase();
  return normalized.includes("dashboard") || normalized.includes("central") || normalized.includes("control-room") || normalized.includes("中控");
}

function normalizeLockModule(value: unknown): ModuleName | null {
  if (value === "video") return "visual";
  return isModuleName(value) ? value : null;
}

function normalizeVisualAudioDriveMode(value: unknown): "mic" | "music" | "api" {
  if (value === "hybrid") return "api";
  return value === "mic" || value === "music" || value === "api" ? value : "mic";
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
      : [...MODULE_NAMES];
  const shouldLock = typeof record.locked === "boolean" ? record.locked : Boolean(value);

  for (const moduleName of modules) {
    if (shouldLock) lockedModules.add(moduleName);
    else lockedModules.delete(moduleName);
  }

  return [...lockedModules];
}

function normalizeScreenPresentation(value: unknown): InteractionModuleState["screenPresentation"] {
  const record = isRecord(value) ? value : {};
  return {
    autoRedirect: typeof record.autoRedirect === "boolean" ? record.autoRedirect : true,
    showDebug: typeof record.showDebug === "boolean" ? record.showDebug : false,
    showMenu: typeof record.showMenu === "boolean" ? record.showMenu : false,
    configured: typeof record.configured === "boolean" ? record.configured : false
  };
}

function normalizeFireworkState(value: unknown) {
  return ["standby", "launching", "resetting"].includes(String(value)) ? String(value) as InteractionModuleState["fireworkState"] : "standby";
}

function normalizeBaofaFishState(value: unknown) {
  if (String(value) === "roam") return "roam" as const;
  return String(value) === "running" ? "running" as const : "idle" as const;
}

function normalizeTreePhase(value: unknown) {
  return ["idle", "growing", "bright", "fading"].includes(String(value)) ? String(value) as InteractionModuleState["treePhase"] : "idle";
}

function isLoopbackOrigin(origin: unknown) {
  try {
    const url = new URL(String(origin || ""));
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function createDefaultScreenRegistry() {
  return SCREEN_IDS.map((id, index) => ({
    id,
    label: `Screen ${id}`,
    enabled: true,
    physicalIndex: index + 1
  }));
}

function createDefaultVisualScreens(): VisualScreenState[] {
  return SCREEN_IDS.map((id, index) => ({
    id,
    name: `Show Screen ${id}`,
    device: index === 0 ? "stage" : "led",
    scene: index === 0 ? "Layered Stage" : index % 4 === 1 ? "Topology" : index % 4 === 2 ? "Pulse" : "Liquid",
    enabled: true
  }));
}

function createScreenRoutesForPreset(preset: ScreenRoutePreset, now: number): Record<string, ScreenRouteEntry> {
  const routes: Record<string, ScreenRouteEntry> = {};
  const externalUrl = isBuiltInScreenRoutePreset(preset) ? EXTERNAL_SCREEN_ROUTE_PRESETS[preset] : undefined;
  for (const screenId of SCREEN_IDS) {
    if (externalUrl) {
      routes[screenId] = makeExternalScreenRoute(screenId, preset, externalUrl, now, "preset");
      continue;
    }
    const owner = ownerForPreset(screenId, preset);
    routes[screenId] = makeScreenRoute(screenId, owner, now, "preset");
  }
  return routes;
}

function ownerForPreset(screenId: string, preset: ScreenRoutePreset): ScreenOwner {
  if (preset === "baofa_takeover") return "baofa";
  if (preset === "vj_takeover") return VJ_TAKEOVER_SCREEN_IDS.has(screenId) ? "vj" : "baofa";
  return VJ_SCREEN_IDS.has(screenId) ? "vj" : "baofa";
}

function makeScreenRoute(screenId: string, owner: ScreenOwner, updatedAt: number, source?: string): ScreenRouteEntry {
  return {
    screenId,
    owner,
    url: resolveScreenRouteUrl(CONFIGURED_SCREEN_ROUTE_ORIGIN, owner, screenId),
    updatedAt,
    source
  };
}

function makeExternalScreenRoute(screenId: string, preset: ScreenRoutePreset, url: string, updatedAt: number, source?: string): ScreenRouteEntry {
  return {
    screenId,
    owner: "external",
    url,
    updatedAt,
    source: source || preset
  };
}

export function resolveScreenRouteUrl(origin: string | null | undefined, owner: ScreenOwner, screenId: string, room?: string | null) {
  if (owner !== "vj" && owner !== "baofa") return null;
  const normalizedOrigin = normalizeScreenRouteOrigin(origin);
  const configuredOwnerOrigin = owner === "vj" ? CONFIGURED_VJ_SCREEN_ORIGIN : CONFIGURED_BAOFA_SCREEN_ORIGIN;
  const hostedOwnerOrigin = owner === "vj" ? HOSTED_VJ_SCREEN_ORIGIN : HOSTED_BAOFA_SCREEN_ORIGIN;
  const routeOrigin = configuredOwnerOrigin || (normalizedOrigin && isLanRouteOrigin(normalizedOrigin) ? `${normalizedOrigin.protocol}//${hostnameFromOrigin(normalizedOrigin.host)}:${owner === "vj" ? 4302 : 4303}` : hostedOwnerOrigin);
  const url = new URL(routeOrigin);
  url.pathname = `/screen/${encodeURIComponent(screenId)}`;
  url.search = "";
  if (room) url.searchParams.set("room", room);
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function hostnameFromOrigin(host: string) {
  return host.replace(/:\d+$/, "");
}

function isLanRouteOrigin(origin: { host: string }) {
  const host = hostnameFromOrigin(origin.host).toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

export function resolveStateScreenRoutes(state: PerformanceState, origin: string | null | undefined, room?: string | null): PerformanceState {
  const screenRoutes: Record<string, ScreenRouteEntry> = {};
  for (const [screenId, route] of Object.entries(state.modules.interaction.screenRoutes || {})) {
    const owner = normalizeScreenOwner(route?.owner) || "off";
    screenRoutes[screenId] = {
      ...route,
      screenId,
      owner,
      url: owner === "external" ? route.url || null : resolveScreenRouteUrl(origin, owner, screenId, room),
      updatedAt: positiveNumber(route?.updatedAt, Date.now())
    };
  }
  return {
    ...state,
    modules: {
      ...state.modules,
      interaction: {
        ...state.modules.interaction,
        screenRoutes
      }
    }
  };
}

export function resolveStateScreenPresentation(state: PerformanceState, origin: string | null | undefined): PerformanceState {
  const presentation = state.modules.interaction.screenPresentation;
  if (presentation.configured) return state;

  const isLocal = isLoopbackOrigin(origin);
  return {
    ...state,
    modules: {
      ...state.modules,
      interaction: {
        ...state.modules.interaction,
        screenPresentation: {
          ...presentation,
          showMenu: isLocal,
          showDebug: isLocal
        }
      }
    }
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

function normalizeVisualScreens(value: unknown): VisualScreenState[] {
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
      scene: normalizeVisualScene(record.scene) || screen.scene,
      enabled: typeof record.enabled === "boolean" ? record.enabled : screen.enabled
    };
  });
}

function normalizeVisualDevice(value: unknown): VisualScreenState["device"] | null {
  return ["stage", "projector", "led", "tablet", "phone"].includes(String(value))
    ? String(value) as VisualScreenState["device"]
    : null;
}

function normalizeVisualScene(value: unknown): string | null {
  const scene = String(value || "").trim();
  if (!scene) return null;
  return VISUAL_SCENE_IDS.includes(scene) ? scene : scene;
}

function normalizeScreenRoutes(value: unknown, preset: ScreenRoutePreset) {
  const defaults = createScreenRoutesForPreset(preset, Date.now());
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
      url: owner === "external" ? String(existing.url || defaults[screenId].url || "") || null : resolveScreenRouteUrl(CONFIGURED_SCREEN_ROUTE_ORIGIN, owner, screenId),
      updatedAt: positiveNumber(existing.updatedAt, defaults[screenId].updatedAt)
    };
  }
  return defaults;
}

function normalizeScreenOwner(value: unknown): ScreenOwner | null {
  return ["vj", "baofa", "off", "diagnostic", "external"].includes(String(value)) ? String(value) as ScreenOwner : null;
}

function normalizeScreenRoutePreset(value: unknown): ScreenRoutePreset | null {
  const preset = String(value || "").trim();
  return preset ? preset : null;
}

function isBuiltInScreenRoutePreset(value: ScreenRoutePreset): value is BuiltInScreenRoutePreset {
  return BUILT_IN_SCREEN_ROUTE_PRESETS.includes(value as BuiltInScreenRoutePreset);
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

function applyScreenRouteArrangement(state: PerformanceState, preset: ScreenRouteArrangementPreset, now: number) {
  const routes: Record<string, ScreenRouteEntry> = {};
  for (const screenId of SCREEN_IDS) {
    const owner = normalizeScreenOwner(preset.routes[screenId]) || "baofa";
    routes[screenId] = makeScreenRoute(screenId, owner, now, "preset");
  }
  state.modules.interaction.screenRoutePreset = preset.id;
  state.modules.interaction.screenRoutes = routes;
  state.modules.visual.visualScreens = normalizeVisualScreens(
    state.modules.visual.visualScreens.map((screen) => {
      const scene = preset.vjScenes[screen.id];
      return scene ? { ...screen, scene, enabled: true } : screen;
    })
  );
}

export function sanitizeInteractionModulePatch(patch: JsonRecord) {
  const sanitized = { ...patch };
  delete sanitized.screenRoutes;
  delete sanitized.screenRoutePreset;
  delete sanitized.customScreenRoutePresets;
  delete sanitized.screenPresentation;
  return sanitized;
}

function normalizeScreenRouteOrigin(value: unknown): { protocol: "http:" | "https:"; host: string } | null {
  const input = String(value || "").trim();
  if (!input) return null;
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return { protocol: url.protocol as "http:" | "https:", host: url.host };
  } catch {
    return null;
  }
}

function normalizeScreenTopology(value: unknown): string[][] {
  if (!Array.isArray(value)) return SCREEN_TOPOLOGY;
  if (value.every((row) => Array.isArray(row))) {
    const rawScreens = value.flat().map((screenId) => String(screenId || "").trim());
    if (hasLegacySideScreenIds(rawScreens)) return SCREEN_TOPOLOGY;
    const rows = value
      .map((row) => row
        .map((screenId) => String(screenId || "").trim())
        .filter((screenId) => (SCREEN_IDS as readonly string[]).includes(screenId)))
      .filter((row) => row.length > 0);
    return rows.length > 0 ? rows : SCREEN_TOPOLOGY;
  }
  if (value.every((screenId) => typeof screenId === "string")) {
    const rawScreens = value.map((screenId) => screenId.trim());
    if (hasLegacySideScreenIds(rawScreens)) return SCREEN_TOPOLOGY;
    const screens = rawScreens.filter((screenId) => (SCREEN_IDS as readonly string[]).includes(screenId));
    if (screens.length === 0) return SCREEN_TOPOLOGY;
    const rows: string[][] = [];
    for (let index = 0; index < screens.length; index += 6) {
      rows.push(screens.slice(index, index + 6));
    }
    return rows;
  }
  return SCREEN_TOPOLOGY;
}

function hasLegacySideScreenIds(screenIds: string[]) {
  return screenIds.some((screenId) => ["G1", "G2", "H1", "H2"].includes(screenId));
}

function clampUnit(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function positiveNumber(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, number);
}

function numberOrNow(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Date.now();
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergePatch<T extends JsonRecord>(target: T, patch: JsonRecord): T {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (isRecord(value) && isRecord(target[key])) {
      mergePatch(target[key] as JsonRecord, value);
    } else {
      target[key as keyof T] = value as T[keyof T];
    }
  }
  return target;
}
