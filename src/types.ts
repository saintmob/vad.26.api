export const MODULE_NAMES = ["audio", "visual", "interaction"] as const;

export type ModuleName = (typeof MODULE_NAMES)[number];
export type ModuleStatus = "offline" | "standby" | "online" | "live" | "error";
export type ShowStatus = "standby" | "running" | "paused" | "ended";
export type JsonRecord = Record<string, unknown>;
export type ScreenOwner = "vj" | "baofa" | "off" | "diagnostic" | "external";
export type BuiltInScreenRoutePreset = "balanced" | "checkin" | "gallery" | "vj_takeover" | "baofa_takeover" | "echo";
export type ScreenRoutePreset = BuiltInScreenRoutePreset | string;

export interface AudioFrame {
  type: "mixer.audioFrame";
  sourceId: string;
  deviceId: string;
  displayName: string;
  timestamp: number;
  level: number;
  rms: number;
  peak: number;
  gain: number;
  muted: boolean;
  speaking: boolean;
  frequencyBands: number[];
  slotIds?: string[];
  slotNames?: string[];
  slotCategories?: string[];
  slotLevels?: number[];
  slotActivity?: number[];
  activeStep?: number;
  stepProgress?: number;
  bpm?: number;
  styleEnergy?: number;
  styleId?: string;
  activePreset?: string;
  transport?: string;
  masterLevel?: number;
}

export interface ControlCommand {
  type: "control.command";
  id: string;
  target: string;
  module: ModuleName | "show" | "video" | "guest";
  command: string;
  value?: unknown;
  issuedBy: string;
  timestamp: number;
}

export interface ShowState {
  id: string;
  name: string;
  status: ShowStatus;
  startedAt: number | null;
  positionMs: number;
  bpm: number;
  beat: number;
  bar: number;
}

export interface OperationLockState {
  locked: boolean;
  lockedModules: ModuleName[];
  ownerModule: ModuleName | "dashboard";
  lockedBy: string | null;
  updatedAt: number | null;
}

export interface ScreenPoint {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface ScreenRegistryEntry {
  id: string;
  label: string;
  enabled: boolean;
  physicalIndex: number;
}

export interface ScreenRouteEntry {
  screenId: string;
  owner: ScreenOwner;
  url: string | null;
  updatedAt: number;
  status?: ModuleStatus;
  source?: string;
}

export interface VisualScreenState {
  id: string;
  name: string;
  device: "stage" | "projector" | "led" | "tablet" | "phone";
  scene: string;
  enabled: boolean;
}

export interface ScreenRouteArrangementPreset {
  id: string;
  name: string;
  routes: Record<string, ScreenOwner>;
  vjScenes: Record<string, string>;
  userDefined: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AudioModuleState {
  status: ModuleStatus;
  projectName: string;
  transport: "stopped" | "playing" | "paused";
  masterLevel: number;
  activeTab: string;
  activePreset: string;
  activeStyleId: string;
  bpm: number;
  activeSourceId: string;
  slots: Array<{
    id: string;
    name: string;
    category: string;
    muted: boolean;
    level: number;
  }>;
  fx: JsonRecord;
  arrangementSummary: null | {
    fileName?: string;
    tabCount?: number;
    slotCount?: number;
    exportedAt?: number;
  };
}

export interface VisualModuleState {
  status: ModuleStatus;
  scene: string;
  preset: string;
  colors: {
    base: string;
    secondary: string;
    accent: string;
    background: string;
  };
  fx: {
    bloomIntensity: number;
    rgbSplitAmount: number;
    distortion: number;
    glitchActive: boolean;
    speed: number;
    chaos: number;
  };
  text: {
    value: string;
    animation: string;
    reactive: number;
    glow: number;
    speed: number;
    color: string;
    fontSize: number;
    fontWeight: number;
    letterSpacing: number;
  };
  audioDriveMode: "mic" | "music" | "api";
  fullscreen: boolean;
  visualMemories: Array<{ id: string; name: string; scene: string }>;
  visualScreens: VisualScreenState[];
}

export interface InteractionModuleState {
  status: ModuleStatus;
  screenTopology: string[][];
  screenRegistry: ScreenRegistryEntry[];
  screenRoutes: Record<string, ScreenRouteEntry>;
  screenRoutePreset: ScreenRoutePreset;
  customScreenRoutePresets: ScreenRouteArrangementPreset[];
  screenPresentation: {
    autoRedirect: boolean;
    showDebug: boolean;
    showMenu: boolean;
    configured: boolean;
  };
  screenId: string;
  role: "screen" | "master";
  overview: boolean;
  mode: "idle" | "interaction" | "flow" | "climax";
  visualMode: "tree" | "firework";
  fireworkState: "standby" | "launching" | "resetting";
  baofaFishState: "idle" | "running" | "roam";
  intensity: number;
  evolution: number;
  treeGrowth: number;
  treePhase: "idle" | "growing" | "bright" | "fading";
  gestureActive: boolean;
  lastInteraction: ScreenPoint | null;
  screenPulse: null | { source: string; timestamp: number };
}

export interface ClientInfo {
  id: string;
  module: ModuleName | "dashboard" | "unknown";
  role: string;
  status: "online" | "offline";
  connectedAt: number;
  lastSeen: number;
  latency: number | null;
  capabilities: string[];
  screenId?: string;
  overview?: boolean;
}

export interface EventLogItem {
  id: string;
  type: string;
  module?: string;
  source?: string;
  message: string;
  timestamp: number;
  payload?: unknown;
}

export interface PerformanceState {
  protocolVersion: "mixer.realtime.v1";
  performanceProtocolVersion: "performance.show.v1";
  updatedAt: number;
  show: ShowState;
  operationLock: OperationLockState;
  room: {
    id: string;
    name: string;
    mode: string;
  };
  modules: {
    audio: AudioModuleState;
    visual: VisualModuleState;
    interaction: InteractionModuleState;
  };
  audioSources: Record<string, AudioFrame>;
  clients: Record<string, ClientInfo>;
  commandLog: ControlCommand[];
  eventLog: EventLogItem[];
}

export interface ClientHelloMessage {
  type: "client.hello";
  clientId?: string;
  module?: string;
  role?: string;
  capabilities?: string[];
  token?: string;
}

export interface ModuleStatePatchMessage {
  type: "module.statePatch";
  module: ModuleName;
  patch?: JsonRecord;
  state?: JsonRecord;
  source?: string;
  token?: string;
}

export interface HeartbeatMessage {
  type: "heartbeat";
  clientId?: string;
  sentAt?: number;
}
