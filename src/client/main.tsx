import React from "react";
import { createRoot } from "react-dom/client";
import {
  Aperture,
  AudioLines,
  Camera,
  Grid3X3,
  MonitorCog,
  Pause,
  Play,
  Radio,
  Save,
  Send,
  Settings2,
  Shuffle,
  Square,
  X,
  Maximize
} from "lucide-react";
import type { ControlCommand, ModuleName, PerformanceState, ScreenOwner, ScreenRoutePreset } from "../types";
import { createFirebaseDashboardClient, shouldUseFirebaseRealtime } from "./firebaseShowControl";
import { createIdFragment } from "./id";
import {
  apiUrl,
  webSocketUrl,
  fetchJson,
  fetchInitialState,
  useWebSocket,
  isStateSnapshot,
  isStatePatch,
  isShowPatch,
  isControlAck,
  isErrorMessage,
  applyStatePatch,
  applyShowPatch,
  ConnectionState,
  ServerMessage
} from "./useShowState";
import "./styles.css";
type ScreenSelectionMode = "solid" | "dashed" | "box";
type SequenceStep = "1/16" | "1/8" | "1/4" | "1/2" | "1";
type SequenceGroup = { order: number; screenIds: string[] };
type DragBox = { startX: number; startY: number; currentX: number; currentY: number };
type RouteDraftEntry = { owner: ScreenOwner; scene: string };
type DashboardTab = "interaction" | "visual" | "audio";
type ThemeMode = "system" | "light" | "dark";
type LanguageMode = "system" | "zh" | "en";
type UiLanguage = "zh" | "en";
type SyncStatus = "idle" | "sending" | "synced" | "error";

type UiCopy = {
  app: {
    title: string;
    subtitle: string;
    room: string;
    connection: string;
    clients: string;
    ack: string;
    showStatus: string;
    theme: string;
    language: string;
    token: string;
    activeTab: string;
    system: string;
  };
  layout: {
    workspace: string;
    stage: string;
    routes: string;
    logs: string;
    appearance: string;
    access: string;
    advanced: string;
    systemSettings: string;
    transport: string;
    quickActions: string;
    collapse: string;
    expand: string;
  };
  tabs: Record<DashboardTab, { label: string; detail: string }>;
  status: Record<ConnectionState, string> & Record<"waiting", string>;
  show: Record<"standby" | "running" | "paused" | "ended", string>;
  theme: Record<ThemeMode, string>;
  language: Record<LanguageMode, string>;
  actions: {
    play: string;
    pause: string;
    stop: string;
    reset: string;
    save: string;
    pulse: string;
    resetTree: string;
    clearSequence: string;
    send: string;
    fullscreen: string;
    mute: string;
    unmute: string;
  };
  metrics: {
    bpm: string;
    position: string;
    master: string;
    lastAck: string;
  };
  interaction: {
    title: string;
    lead: string;
    routePreset: string;
    presentation: string;
    selectionMode: string;
    screenMap: string;
    routeRegister: string;
    eventLog: string;
    clients: string;
    routeHint: string;
    mode: string;
    intensity: string;
    growth: string;
    gesture: string;
    route: string;
    autoRedirect: string;
    showMenu: string;
    showDebug: string;
    activeSequence: string;
    step: string;
  };
  visual: {
    title: string;
    lead: string;
    scene: string;
    preset: string;
    drive: string;
    colors: string;
    fullscreen: string;
    text: string;
    textStyle: string;
  };
  audio: {
    title: string;
    lead: string;
    activeSource: string;
    presets: string;
    sourceList: string;
    mute: string;
    speaking: string;
    idle: string;
  };
  screenSelectionModes: Record<ScreenSelectionMode, string>;
  screenRoutePresets: Record<ScreenRoutePreset, string>;
  screenOwners: Record<ScreenOwner | "unset", string>;
  interactionModes: Record<string, string>;
  fireworkStates: Record<"standby" | "launching" | "resetting" | "status", string>;
};

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env || {};
const defaultControlToken = env.VITE_CONTROL_TOKEN || "";
const CLIENT_ONLINE_STALE_MS = 120_000;
const MIN_PENDING_ACTION_MS = 180;
const storageKeys = {
  token: "vad-control-token",
  theme: "vad-theme-mode",
  language: "vad-language-mode"
} as const;

const moduleLabels: Record<ModuleName, { label: string; icon: React.ReactNode; accent: string }> = {
  audio: { label: "Audio", icon: <AudioLines size={17} />, accent: "var(--audio)" },
  visual: { label: "Visual", icon: <Aperture size={17} />, accent: "var(--visual)" },
  interaction: { label: "Interaction", icon: <Grid3X3 size={17} />, accent: "var(--interaction)" }
};

const tabDefinitions: Array<{
  key: DashboardTab;
  module: ModuleName;
  icon: React.ReactNode;
  accent: string;
}> = [
  { key: "interaction", module: "interaction", icon: <MonitorCog size={17} />, accent: "var(--interaction)" },
  { key: "visual", module: "visual", icon: <Aperture size={17} />, accent: "var(--visual)" },
  { key: "audio", module: "audio", icon: <AudioLines size={17} />, accent: "var(--audio)" }
];

const interactionModes = ["idle", "interaction", "flow", "climax"];
const visualScenes = [
  { id: "Video Flow", label: "Video Flow", preset: "Video Flow" },
  { id: "Layered Stage", label: "Live Layered Stage", preset: "Layered Stage" },
  { id: "Purple", label: "Purple", preset: "Purple" },
  { id: "Blue Font", label: "Blue Font", preset: "Blue Font" },
  { id: "Pulse", label: "Neon Pulse", preset: "Neon Pulse" },
  { id: "Liquid", label: "Liquid Dream", preset: "Liquid Dream" },
  { id: "Topology", label: "Sonic Topology", preset: "Sonic Topology" },
  { id: "Chromaflux", label: "Chromaflux", preset: "Chromaflux" },
  { id: "Dumbar", label: "Grey Glass Blocks", preset: "Dumbar Base" },
  { id: "Void", label: "Dark Space", preset: "Dark Space" },
  { id: "Cyber", label: "Cyberpunk", preset: "Cyberpunk" }
];
const visualTextStyles = ["Cinematic", "Massive", "Glitch", "Hologram", "Floating", "Beat"];
const visualAudioDrives: Array<PerformanceState["modules"]["visual"]["audioDriveMode"]> = ["mic", "music", "api"];
const audioStyles = [
  { id: "default", label: "Clean" },
  { id: "club", label: "Club" },
  { id: "techno", label: "Techno" },
  { id: "synthwave", label: "Synthwave" },
  { id: "trap", label: "Trap 808" },
  { id: "chiptune", label: "Chiptune" },
  { id: "piano", label: "Piano" },
  { id: "experimental", label: "Experimental" }
];
const screenSelectionModes: Array<{ id: ScreenSelectionMode; label: string }> = [
  { id: "solid", label: "实线点选" },
  { id: "dashed", label: "虚线点选" },
  { id: "box", label: "框选" }
];
const sequenceSteps: SequenceStep[] = ["1/16", "1/8", "1/4", "1/2", "1"];
const screenRoutePresets: Array<{ value: ScreenRoutePreset; label: string }> = [
  { value: "balanced", label: "Balanced" },
  { value: "vj_takeover", label: "All VJ" },
  { value: "baofa_takeover", label: "All Baofa" }
];
const screenOwners: Array<{ value: ScreenOwner; label: string }> = [
  { value: "vj", label: "VJ" },
  { value: "baofa", label: "Baofa" },
  { value: "off", label: "Off" }
];
const routePanelOwners = screenOwners;

const uiCopy: Record<UiLanguage, UiCopy> = {
  zh: {
    app: {
      title: "VAD 总控台",
      subtitle: "现场操作工作台",
      room: "现场房间",
      connection: "连接状态",
      clients: "在线客户端",
      ack: "最新回执",
      showStatus: "演出状态",
      theme: "主题",
      language: "语言",
      token: "控制令牌",
      activeTab: "当前页签",
      system: "系统"
    },
    layout: {
      workspace: "功能区",
      stage: "屏幕分布",
      routes: "路由",
      logs: "日志",
      appearance: "外观",
      access: "访问",
      advanced: "高级",
      systemSettings: "系统设置",
      transport: "播放快速控制",
      quickActions: "快速操作",
      collapse: "收起",
      expand: "展开"
    },
    tabs: {
      interaction: { label: "多屏联控", detail: "首屏主控制" },
      visual: { label: "VJ", detail: "视觉编排" },
      audio: { label: "DJ", detail: "音频编排" }
    },
    status: {
      connecting: "连接中",
      connected: "已连接",
      offline: "离线",
      waiting: "等待控制"
    },
    show: {
      standby: "待机",
      running: "运行中",
      paused: "已暂停",
      ended: "已结束"
    },
    theme: {
      system: "系统",
      light: "浅色",
      dark: "深色"
    },
    language: {
      system: "系统",
      zh: "中文",
      en: "English"
    },
    actions: {
      play: "播放",
      pause: "暂停",
      stop: "停止",
      reset: "重置",
      save: "保存",
      pulse: "脉冲",
      resetTree: "重置树",
      clearSequence: "清除顺序",
      send: "发送",
      fullscreen: "全屏",
      mute: "静音",
      unmute: "取消静音"
    },
    metrics: {
      bpm: "BPM",
      position: "时长",
      master: "主音量",
      lastAck: "最新回执"
    },
    interaction: {
      title: "Multi-screen Interaction",
      lead: "把屏幕路由、呈现状态与序列控制收在首屏。",
      routePreset: "预设",
      presentation: "呈现开关",
      selectionMode: "选择模式",
      screenMap: "屏幕拓扑",
      routeRegister: "路由",
      eventLog: "日志",
      clients: "设备",
      routeHint: "点选或框选屏幕，直接编排。",
      mode: "模式",
      intensity: "强度",
      growth: "生长",
      gesture: "手势",
      route: "路由",
      autoRedirect: "自动跳转",
      showMenu: "显示菜单",
      showDebug: "显示调试",
      activeSequence: "已选顺序",
      step: "步长"
    },
    visual: {
      title: "VJ",
      lead: "视觉控制收束到一个清晰的现场编排页。",
      scene: "场景",
      preset: "预设",
      drive: "驱动",
      colors: "颜色",
      fullscreen: "全屏",
      text: "文字",
      textStyle: "文字动效"
    },
    audio: {
      title: "DJ",
      lead: "音频矩阵、静音与预设在同一页快速操作。",
      activeSource: "当前源",
      presets: "预设",
      sourceList: "音源列表",
      mute: "静音",
      speaking: "发言中",
      idle: "空闲"
    },
    screenSelectionModes: {
      solid: "实线点选",
      dashed: "顺序点选",
      box: "框选"
    },
    screenRoutePresets: {
      balanced: "平衡",
      vj_takeover: "全 VJ",
      baofa_takeover: "全 Baofa"
    },
    screenOwners: {
      vj: "VJ",
      baofa: "Baofa",
      off: "关闭",
      diagnostic: "诊断",
      unset: "未设置"
    },
    interactionModes: {
      idle: "CALM",
      interaction: "PULSE",
      flow: "FLOW",
      climax: "CLIMAX"
    },
    fireworkStates: {
      standby: "待机",
      launching: "燃放",
      resetting: "重置",
      status: "状态"
    }
  },
  en: {
    app: {
      title: "VAD Control Deck",
      subtitle: "On-site operating workspace",
      room: "Room",
      connection: "Connection",
      clients: "Clients online",
      ack: "Latest ack",
      showStatus: "Show status",
      theme: "Theme",
      language: "Language",
      token: "Control token",
      activeTab: "Active tab",
      system: "System"
    },
    layout: {
      workspace: "Workspace",
      stage: "Screen distribution",
      routes: "Routes",
      logs: "Logs",
      appearance: "Appearance",
      access: "Access",
      advanced: "Advanced",
      systemSettings: "System settings",
      transport: "Playback quick controls",
      quickActions: "Quick actions",
      collapse: "Collapse",
      expand: "Expand"
    },
    tabs: {
      interaction: { label: "Multi-screen Interaction", detail: "Home control surface" },
      visual: { label: "VJ", detail: "Visual direction" },
      audio: { label: "DJ", detail: "Audio direction" }
    },
    status: {
      connecting: "Connecting",
      connected: "Connected",
      offline: "Offline",
      waiting: "Waiting"
    },
    show: {
      standby: "Standby",
      running: "Running",
      paused: "Paused",
      ended: "Ended"
    },
    theme: {
      system: "System",
      light: "Light",
      dark: "Dark"
    },
    language: {
      system: "System",
      zh: "中文",
      en: "English"
    },
    actions: {
      play: "Play",
      pause: "Pause",
      stop: "Stop",
      reset: "Reset",
      save: "Save",
      pulse: "Pulse",
      resetTree: "Reset tree",
      clearSequence: "Clear sequence",
      send: "Send",
      fullscreen: "Fullscreen",
      mute: "Mute",
      unmute: "Unmute"
    },
    metrics: {
      bpm: "BPM",
      position: "Position",
      master: "Master",
      lastAck: "Latest ack"
    },
    interaction: {
      title: "Multi-screen Interaction",
      lead: "Keep routing, presentation and sequence control on the first screen.",
      routePreset: "Preset",
      presentation: "Presentation",
      selectionMode: "Selection mode",
      screenMap: "Screen topology",
      routeRegister: "Routes",
      eventLog: "Log",
      clients: "Devices",
      routeHint: "Click or box select screens to edit routes.",
      mode: "Mode",
      intensity: "Intensity",
      growth: "Growth",
      gesture: "Gesture",
      route: "Route",
      autoRedirect: "Auto redirect",
      showMenu: "Show menu",
      showDebug: "Show debug",
      activeSequence: "Active order",
      step: "Step"
    },
    visual: {
      title: "VJ",
      lead: "A focused visual page for scene direction and live adjustments.",
      scene: "Scene",
      preset: "Preset",
      drive: "Drive",
      colors: "Colors",
      fullscreen: "Fullscreen",
      text: "Text",
      textStyle: "Text style"
    },
    audio: {
      title: "DJ",
      lead: "Fast access to the audio matrix, mute control and presets.",
      activeSource: "Active source",
      presets: "Presets",
      sourceList: "Source list",
      mute: "Mute",
      speaking: "Speaking",
      idle: "Idle"
    },
    screenSelectionModes: {
      solid: "Solid select",
      dashed: "Sequence select",
      box: "Box select"
    },
    screenRoutePresets: {
      balanced: "Balanced",
      vj_takeover: "All VJ",
      baofa_takeover: "All Baofa"
    },
    screenOwners: {
      vj: "VJ",
      baofa: "Baofa",
      off: "Off",
      diagnostic: "Diag",
      unset: "Unset"
    },
    interactionModes: {
      idle: "CALM",
      interaction: "PULSE",
      flow: "FLOW",
      climax: "CLIMAX"
    },
    fireworkStates: {
      standby: "Standby",
      launching: "Launch",
      resetting: "Reset",
      status: "Status"
    }
  }
};

type ScreenLayoutItem = {
  id: string;
  col: number;
  row: number;
  width?: number;
  height?: number;
  rotate?: number;
};

const stageBounds = { width: 11, height: 6.4 };
const screenLayoutItems: ScreenLayoutItem[] = [
  { id: "A1", col: 5.5, row: 0.7, width: 3.9, height: 1.05 },
  { id: "B1", col: 2.9, row: 1.75 },
  { id: "B2", col: 3.95, row: 1.75 },
  { id: "B3", col: 5.0, row: 1.75 },
  { id: "B4", col: 6.05, row: 1.75 },
  { id: "B5", col: 7.1, row: 1.75 },
  { id: "B6", col: 8.15, row: 1.75 },
  { id: "C1", col: 1.75, row: 2.55, rotate: -14 },
  { id: "C2", col: 2.55, row: 2.35, rotate: -4 },
  { id: "C3", col: 8.45, row: 2.35, rotate: 4 },
  { id: "C4", col: 9.25, row: 2.55, rotate: 14 },
  { id: "D1", col: 4.2, row: 3.35 },
  { id: "D2", col: 5.5, row: 3.15 },
  { id: "D3", col: 6.8, row: 3.35 },
  { id: "E1", col: 5.5, row: 4.35, width: 1.15 },
  { id: "F1", col: 5.5, row: 5.55, width: 1.2 },
  { id: "L1", col: 0.95, row: 4.2, height: 0.82 },
  { id: "L2", col: 0.95, row: 5.4, height: 0.82 },
  { id: "R1", col: 10.05, row: 4.2, height: 0.82 },
  { id: "R2", col: 10.05, row: 5.4, height: 0.82 }
];
const screenLayoutOrder = screenLayoutItems.map((screen) => screen.id);

function normalizeScreenOccupancyId(value: string | null | undefined) {
  if (!value) return "";
  return value === "MASTER" ? "A1" : value;
}

function makeActionKey(module: ControlCommand["module"], command: string, target: string) {
  return `${module}:${command}:${target}`;
}

function createRouteDraft(snapshot: PerformanceState): Record<string, RouteDraftEntry> {
  const screensById = new Map((snapshot.modules.visual.visualScreens || []).map((screen) => [screen.id, screen]));
  return Object.fromEntries(screenLayoutOrder.map((screenId) => {
    const route = snapshot.modules.interaction.screenRoutes?.[screenId];
    const visualScreen = screensById.get(screenId);
    return [screenId, {
      owner: route?.owner || "baofa",
      scene: visualScreen?.scene || "Video Flow"
    }];
  }));
}

function isLiveClient(client: PerformanceState["clients"][string], now: number) {
  if (client.status !== "online") return false;
  const lastSeen = Number(client.lastSeen || client.connectedAt || 0);
  if (!lastSeen) return true;
  return now - lastSeen <= CLIENT_ONLINE_STALE_MS;
}

function Root() {
  const screenId = getScreenIdFromPath();
  if (screenId) return <ScreenGateway screenId={screenId} />;
  return <App />;
}

function readStoredValue<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  return value ? (value as T) : fallback;
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value === "1" || value === "true";
}

function resolveBrowserLanguage(): UiLanguage {
  if (typeof navigator === "undefined") return "en";
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function App() {
  const [snapshot, setSnapshot] = React.useState<PerformanceState | null>(null);
  const [connection, setConnection] = React.useState<ConnectionState>("connecting");
  const [token, setToken] = React.useState(() => readStoredValue(storageKeys.token, defaultControlToken));
  const [lastAck, setLastAck] = React.useState("Waiting for control activity");
  const [manualText, setManualText] = React.useState("NEONPULSE");
  const [screenSelectionMode, setScreenSelectionMode] = React.useState<ScreenSelectionMode>("solid");
  const [sequenceStep, setSequenceStep] = React.useState<SequenceStep>("1/4");
  const [sequenceGroups, setSequenceGroups] = React.useState<SequenceGroup[]>([]);
  const [dragBox, setDragBox] = React.useState<DragBox | null>(null);
  const [routeComposerOpen, setRouteComposerOpen] = React.useState(false);
  const [routeComposerName, setRouteComposerName] = React.useState("");
  const [routeDraft, setRouteDraft] = React.useState<Record<string, RouteDraftEntry>>({});
  const [selectedComposerScreenId, setSelectedComposerScreenId] = React.useState("A1");
  const [activeTab] = React.useState<DashboardTab>("interaction");
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() => readStoredValue(storageKeys.theme, "system"));
  const [languageMode, setLanguageMode] = React.useState<LanguageMode>(() => readStoredValue(storageKeys.language, "system"));
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [prefersDark, setPrefersDark] = React.useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [systemLanguage, setSystemLanguage] = React.useState<UiLanguage>(() => resolveBrowserLanguage());
  const [pendingActions, setPendingActions] = React.useState<Set<string>>(() => new Set());
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);
  const [statusNow, setStatusNow] = React.useState(() => Date.now());
  const firebaseClientRef = React.useRef<ReturnType<typeof createFirebaseDashboardClient> | null>(null);
  const screenGridRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const timer = window.setInterval(() => setStatusNow(Date.now()), 2000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(storageKeys.token, token);
  }, [token]);

  React.useEffect(() => {
    window.localStorage.setItem(storageKeys.theme, themeMode);
  }, [themeMode]);

  React.useEffect(() => {
    window.localStorage.setItem(storageKeys.language, languageMode);
  }, [languageMode]);

  React.useEffect(() => {
    if (!settingsOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen]);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = (event: MediaQueryListEvent | MediaQueryList) => {
      setPrefersDark("matches" in event ? event.matches : media.matches);
    };
    update(media);
    const listener = (event: MediaQueryListEvent) => update(event);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
    media.addListener(listener);
    return () => media.removeListener(listener);
  }, []);

  React.useEffect(() => {
    const update = () => setSystemLanguage(resolveBrowserLanguage());
    update();
    window.addEventListener("languagechange", update);
    return () => window.removeEventListener("languagechange", update);
  }, []);

  const locale: UiLanguage = languageMode === "system" ? systemLanguage : languageMode;
  const theme = themeMode === "system" ? (prefersDark ? "dark" : "light") : themeMode;
  const ui = uiCopy[locale];

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.locale = locale;
    document.body.dataset.theme = theme;
    document.body.dataset.locale = locale;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.documentElement.style.colorScheme = theme;
  }, [locale, theme]);

  React.useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let firebaseClient: ReturnType<typeof createFirebaseDashboardClient> | null = null;
    let firebaseFallbackStarted = false;

    async function boot() {
      try {
        const state = await fetchInitialState();
        if (!closed) setSnapshot(state);
        if (shouldUseFirebaseRealtime() && token.trim()) {
          firebaseClient = createFirebaseDashboardClient({
            initialState: state,
            token,
            onState: (nextState) => {
              if (!closed) setSnapshot(nextState);
            },
            onStatus: (status) => {
              if (!closed) setConnection(status);
            },
            onAck: (message) => {
              if (!closed) setLastAck(message);
            },
            onError: (message) => {
              if (closed) return;
              setLastAck(`${message}; falling back to WebSocket`);
              if (!firebaseFallbackStarted) {
                firebaseFallbackStarted = true;
                void firebaseClient?.close();
                connect();
              }
            }
          });
          firebaseClientRef.current = firebaseClient;
          return;
        }
        if (!token.trim() && !closed) setLastAck("Control token is required for write actions");
      } catch {
        if (!closed) setConnection("offline");
      }
      connect();
    }

    function connect() {
      if (closed) return;
      setConnection("connecting");
      socket = new WebSocket(webSocketUrl("/ws"));
      socket.addEventListener("open", () => {
        setConnection("connected");
        socket?.send(JSON.stringify({
          type: "client.hello",
          clientId: "dashboard-main",
          module: "dashboard",
          role: "control-room",
          capabilities: ["state.read", "control.command", "dashboard"]
        }));
      });
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data) as ServerMessage;
        if (isStateSnapshot(message)) setSnapshot(message.state);
        if (isStatePatch(message)) {
          setSnapshot((current) => message.state || (current ? applyStatePatch(current, message) : current));
        }
        if (isShowPatch(message)) {
          setSnapshot((current) => current ? applyShowPatch(current, message) : current);
        }
        if (isControlAck(message)) setLastAck(`${message.command.command} accepted for ${message.command.target}`);
        if (isErrorMessage(message)) setLastAck(message.error);
      });
      socket.addEventListener("close", () => {
        if (closed) return;
        setConnection("offline");
        reconnectTimer = window.setTimeout(connect, 1200);
      });
    }

    void boot();
    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
      firebaseClientRef.current = null;
      void firebaseClient?.close();
    };
  }, [token]);

  const postJson = React.useCallback(async <T,>(url: string, body: unknown): Promise<T> => {
    if (!token.trim()) throw new Error("Control token is required");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) headers["x-control-token"] = token;
    const response = await fetch(apiUrl(url), {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
    return payload as T;
  }, [token]);

  const sendControl = React.useCallback(async (
    module: ControlCommand["module"],
    command: string,
    target: string,
    value?: unknown
  ) => {
    const pendingKey = makeActionKey(module, command, target);
    const startedAt = Date.now();
    setPendingActions((current) => new Set(current).add(pendingKey));
    setSyncStatus("sending");
    try {
      const payload: Omit<ControlCommand, "timestamp"> = {
        type: "control.command",
        id: `dashboard-${createIdFragment()}`,
        module,
        target,
        command,
        value,
        issuedBy: "dashboard-main"
      };
      if (shouldUseFirebaseRealtime() && firebaseClientRef.current) {
        const commandResult = await firebaseClientRef.current.sendControl(payload);
        setLastAck(`${commandResult.command} sent for ${commandResult.target}`);
        setLastSyncedAt(Date.now());
        setSyncStatus("synced");
        return;
      }
      const result = await postJson<{ state: PerformanceState; command: ControlCommand }>("/api/control", payload);
      setSnapshot(result.state);
      setLastAck(`${result.command.command} accepted for ${result.command.target}`);
      setLastSyncedAt(Date.now());
      setSyncStatus("synced");
    } catch (error) {
      setLastAck(error instanceof Error ? error.message : String(error));
      setSyncStatus("error");
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_PENDING_ACTION_MS) await wait(MIN_PENDING_ACTION_MS - elapsed);
      setPendingActions((current) => {
        const next = new Set(current);
        next.delete(pendingKey);
        return next;
      });
    }
  }, [postJson]);

  const launchFireworks = React.useCallback(() => {
    void sendControl("interaction", "setFireworkState", "firework-state", "launching");
  }, [sendControl]);

  const standbyFireworks = React.useCallback(() => {
    void sendControl("interaction", "setFireworkState", "firework-state", "standby");
  }, [sendControl]);

  const resetFireworks = React.useCallback(() => {
    void sendControl("interaction", "setFireworkState", "firework-state", "resetting");
  }, [sendControl]);

  const saveSnapshot = React.useCallback(async () => {
    setSyncStatus("sending");
    try {
      if (shouldUseFirebaseRealtime() && firebaseClientRef.current) {
        await firebaseClientRef.current.saveSnapshot();
        setLastSyncedAt(Date.now());
        setSyncStatus("synced");
        return;
      }
      const result = await postJson<{ state: PerformanceState }>("/api/show/snapshot", {});
      setSnapshot(result.state);
      setLastAck("Snapshot saved");
      setLastSyncedAt(Date.now());
      setSyncStatus("synced");
    } catch (error) {
      setLastAck(error instanceof Error ? error.message : String(error));
      setSyncStatus("error");
    }
  }, [postJson]);

  const sequenceOrderByScreen = React.useMemo(() => {
    const orders = new Map<string, number>();
    sequenceGroups.forEach((group) => {
      group.screenIds.forEach((screenId) => orders.set(screenId, group.order));
    });
    return orders;
  }, [sequenceGroups]);

  const addSequenceGroup = React.useCallback((screenIds: string[]) => {
    const uniqueScreenIds = Array.from(new Set(screenIds.filter((screenId) => screenLayoutOrder.includes(screenId))));
    if (uniqueScreenIds.length === 0) return;
    setSequenceGroups((current) => {
      const alreadySelected = new Set(current.flatMap((group) => group.screenIds));
      const nextScreenIds = uniqueScreenIds.filter((screenId) => !alreadySelected.has(screenId));
      if (nextScreenIds.length === 0) return current;
      return [...current, { order: current.length + 1, screenIds: nextScreenIds }];
    });
  }, []);

  const clearSequence = React.useCallback(() => {
    setSequenceGroups([]);
    setDragBox(null);
  }, []);

  const openRouteComposer = React.useCallback(() => {
    if (!snapshot) return;
    setRouteDraft(createRouteDraft(snapshot));
    setRouteComposerName(locale === "zh"
      ? `编排 ${snapshot.modules.interaction.customScreenRoutePresets.length + 1}`
      : `Arrangement ${snapshot.modules.interaction.customScreenRoutePresets.length + 1}`);
    setSelectedComposerScreenId(snapshot.modules.interaction.screenId || "A1");
    setRouteComposerOpen(true);
    setScreenSelectionMode("solid");
    clearSequence();
  }, [clearSequence, locale, snapshot]);

  const closeRouteComposer = React.useCallback(() => {
    setRouteComposerOpen(false);
    setDragBox(null);
  }, []);

  const setDraftScreenOwner = React.useCallback((screenId: string, owner: ScreenOwner) => {
    setRouteDraft((current) => ({
      ...current,
      [screenId]: {
        owner,
        scene: current[screenId]?.scene || "Video Flow"
      }
    }));
  }, []);

  const setDraftScreenScene = React.useCallback((screenId: string, scene: string) => {
    setRouteDraft((current) => ({
      ...current,
      [screenId]: {
        owner: "vj",
        scene
      }
    }));
  }, []);

  const saveRouteArrangement = React.useCallback(() => {
    const routes: Record<string, ScreenOwner> = {};
    const vjScenes: Record<string, string> = {};
    for (const screenId of screenLayoutOrder) {
      const entry = routeDraft[screenId] || { owner: "baofa", scene: "Video Flow" };
      routes[screenId] = entry.owner;
      if (entry.owner === "vj") vjScenes[screenId] = entry.scene;
    }
    void sendControl("interaction", "saveScreenRouteArrangement", "custom-route", {
      name: routeComposerName.trim() || (locale === "zh" ? "自定义编排" : "Custom arrangement"),
      routes,
      vjScenes
    });
    setRouteComposerOpen(false);
  }, [locale, routeComposerName, routeDraft, sendControl]);

  const deleteRouteArrangement = React.useCallback((presetId: string) => {
    void sendControl("interaction", "deleteScreenRouteArrangement", presetId, presetId);
  }, [sendControl]);

  const handleScreenSelect = React.useCallback((screenId: string) => {
    if (routeComposerOpen) {
      setSelectedComposerScreenId(screenId);
      return;
    }
    if (screenSelectionMode === "solid") {
      clearSequence();
      const occupiedClientId = snapshot
        ? Object.values(snapshot.clients).find((client) =>
            client.module === "interaction" &&
            isLiveClient(client, statusNow) &&
            normalizeScreenOccupancyId(client.screenId) === normalizeScreenOccupancyId(screenId)
          )?.id
        : null;
      void sendControl("interaction", "setScreen", occupiedClientId || screenId, screenId);
      return;
    }
    if (screenSelectionMode === "dashed") {
      addSequenceGroup([screenId]);
    }
  }, [addSequenceGroup, clearSequence, routeComposerOpen, screenSelectionMode, sendControl, setDraftScreenOwner, snapshot, statusNow]);

  const handleBoxPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (screenSelectionMode !== "box" || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const box = clampPoint(event.clientX - rect.left, event.clientY - rect.top, rect);
    setDragBox(box);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [screenSelectionMode]);

  const handleBoxPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragBox || screenSelectionMode !== "box") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = clampPoint(event.clientX - rect.left, event.clientY - rect.top, rect);
    setDragBox((current) => current ? { ...current, currentX: point.currentX, currentY: point.currentY } : current);
  }, [dragBox, screenSelectionMode]);

  const handleBoxPointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragBox || screenSelectionMode !== "box" || !screenGridRef.current) return;
    const gridRect = screenGridRef.current.getBoundingClientRect();
    const selectionRect = normalizeRect(dragBox);
    const selectedScreenIds = Array.from(screenGridRef.current.querySelectorAll<HTMLButtonElement>("[data-screen-id]"))
      .filter((button) => {
        const buttonRect = button.getBoundingClientRect();
        return rectsIntersect(selectionRect, {
          left: buttonRect.left - gridRect.left,
          right: buttonRect.right - gridRect.left,
          top: buttonRect.top - gridRect.top,
          bottom: buttonRect.bottom - gridRect.top
        });
      })
      .map((button) => button.dataset.screenId)
      .filter((screenId): screenId is string => Boolean(screenId));
    addSequenceGroup(selectedScreenIds);
    setDragBox(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, [addSequenceGroup, dragBox, screenSelectionMode]);

  const triggerInteractionMode = React.useCallback(async (mode: string) => {
    if (sequenceGroups.length === 0) {
      await sendControl("interaction", "setMode", "interaction-mode", mode);
      return;
    }

    const groups = [...sequenceGroups].sort((a, b) => a.order - b.order);
    const sequenceDelay = stepDurationMs(sequenceStep, snapshot?.show.bpm || 120);
    for (const group of groups) {
      await Promise.all(group.screenIds.map((screenId) => sendControl("interaction", "setMode", screenId, mode)));
      if (groups.length > 1) await wait(sequenceDelay);
    }
  }, [sendControl, sequenceGroups, sequenceStep, snapshot?.show.bpm]);

  if (!snapshot) {
    return (
      <main className="loading-screen" data-theme={theme} data-locale={locale}>
        <Radio size={22} />
        <span>{locale === "zh" ? "正在连接 VAD 总控台" : "Connecting to VAD control deck"}</span>
      </main>
    );
  }

  const show = snapshot.show;
  const clients = Object.values(snapshot.clients);
  const liveClients = clients.filter((client) => isLiveClient(client, statusNow));
  const liveDeviceClients = liveClients.filter((client) => client.module !== "dashboard");
  const routeClientsByScreenId = new Map<string, Array<PerformanceState["clients"][string]>>();
  for (const client of liveDeviceClients) {
    if (!client.screenId) continue;
    const screenId = normalizeScreenOccupancyId(client.screenId);
    if (!screenId) continue;
    const current = routeClientsByScreenId.get(screenId) || [];
    current.push(client);
    routeClientsByScreenId.set(screenId, current);
  }
  const unassignedClients = liveDeviceClients.filter((client) => !client.screenId);
  const audioSources = Object.values(snapshot.audioSources).sort((a, b) => b.level - a.level);
  const activeSource = snapshot.audioSources[snapshot.modules.audio.activeSourceId] || audioSources[0];
  const screenTopology = normalizeScreenTopology(snapshot.modules.interaction.screenTopology);
  const screenRoutes = snapshot.modules.interaction.screenRoutes || {};
  const screenPresentation = snapshot.modules.interaction.screenPresentation || {
    autoRedirect: true,
    cameraEnabled: false,
    showDebug: false,
    showMenu: false
  };
  const fireworkState = snapshot.modules.interaction.fireworkState || "standby";
  const baofaFishState = snapshot.modules.interaction.baofaFishState || "idle";
  const fireworkStateLabel =
    fireworkState === "launching"
      ? ui.fireworkStates.launching
      : fireworkState === "resetting"
        ? ui.fireworkStates.resetting
        : ui.fireworkStates.standby;
  const routeScreenIds = screenTopology.flatMap((row) => row).filter(Boolean);
  const routeCount = routeScreenIds.length;
  const customRoutePresets = snapshot.modules.interaction.customScreenRoutePresets || [];
  const selectedDraft = routeDraft[selectedComposerScreenId] || { owner: "vj" as ScreenOwner, scene: "Video Flow" };
  const selectedDraftSceneLabel = visualScenes.find((scene) => scene.id === selectedDraft.scene)?.label || selectedDraft.scene;
  const clientCount = liveDeviceClients.length;
  const headerEventLogLimit = 3;
  const visibleHeaderEventLog = snapshot.eventLog.slice(0, headerEventLogLimit);
  const summarizeClientIds = (items: Array<{ id: string }>, emptyLabel: string) => {
    if (items.length === 0) return emptyLabel;
    const clientIds = items.map((item) => item.id);
    const head = clientIds.slice(0, 2).join(" · ");
    return clientIds.length > 2 ? `${head} +${clientIds.length - 2}` : head;
  };
  const showStatusLabel = ui.show[show.status];
  const effectiveSyncStatus: SyncStatus = pendingActions.size > 0 ? "sending" : syncStatus;
  const syncLabel =
    effectiveSyncStatus === "sending"
      ? (locale === "zh" ? `同步中 ${pendingActions.size}` : `Syncing ${pendingActions.size}`)
      : effectiveSyncStatus === "error"
        ? (locale === "zh" ? "同步失败" : "Sync error")
        : lastSyncedAt
          ? (locale === "zh" ? `已同步 ${new Date(lastSyncedAt).toLocaleTimeString()}` : `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}`)
          : (locale === "zh" ? "待同步" : "Idle");
  const actionButtonClass = (
    module: ControlCommand["module"],
    command: string,
    target: string,
    selected = false,
    extra = ""
  ) => [
    extra,
    selected ? "selected" : "",
    pendingActions.has(makeActionKey(module, command, target)) ? "is-pending" : ""
  ].filter(Boolean).join(" ");

  return (
    <main className="shell" data-theme={theme} data-locale={locale}>
      <header className="bar" aria-label="Global command">
        <div className="brand">
          <div className="mark">V</div>
          <div>
            <p className="kicker">{ui.app.subtitle}</p>
            <h1>{ui.app.title}</h1>
          </div>
        </div>
        <div className="chips">
          <span className="chip">
            <i className={`dot ${connection === "connected" ? "ok" : connection === "connecting" ? "warn" : "err"}`} />
            <small>{locale === "zh" ? "连接" : "Connection"}</small>
            <strong>{connection === "connected" ? (locale === "zh" ? "已连接" : "Connected") : connection === "connecting" ? (locale === "zh" ? "连接中" : "Connecting") : (locale === "zh" ? "离线" : "Offline")}</strong>
          </span>
          <span className="chip"><small>{locale === "zh" ? "设备" : "Devices"}</small><strong>{clientCount}/20</strong></span>
          <span className="chip"><small>{locale === "zh" ? "状态" : "Status"}</small><strong>{showStatusLabel}</strong></span>
          <span className="chip"><small>{locale === "zh" ? "同步" : "Sync"}</small><strong>{syncLabel}</strong></span>
        </div>
        <div className="actions" aria-label="Show Transport commands">
          <button type="button" className="cmd write" onClick={() => sendControl("show", "play", show.id)}>{ui.actions.play}</button>
          <button type="button" className="cmd write" onClick={() => sendControl("show", "pause", show.id)}>{ui.actions.pause}</button>
          <button type="button" className="cmd write" onClick={() => sendControl("show", "stop", show.id)}>{ui.actions.stop}</button>
          <button type="button" className="cmd write" onClick={() => sendControl("show", "reset", show.id)}>{ui.actions.reset}</button>
          <button type="button" className="cmd danger write" onClick={() => sendControl("show", "setLocked", show.id, !snapshot.operationLock.locked)}>{snapshot.operationLock.locked ? "UNLOCK" : "LOCK"}</button>
          <button type="button" className="cmd pending" onClick={() => setSettingsOpen(true)} aria-label={ui.layout.systemSettings}>
            <Settings2 size={14} /> {ui.layout.systemSettings}
          </button>
        </div>
      </header>

      <section className="workspace" aria-label="Control workspace">
        <aside className="col left">
          <section className="module vj" aria-label="VJ Quick Director">
            <div className="module-head">
              <h2>VJ Quick Director</h2>
            </div>
            <div className="controls">
              <div>
                <div className="label"><span>{ui.visual.drive}</span></div>
                <div className="btn-grid three">
                  {visualAudioDrives.map((drive) => (
                    <button
                      key={drive}
                      type="button"
                      className={["mini-btn", snapshot.modules.visual.audioDriveMode === drive ? "primary" : ""].filter(Boolean).join(" ")}
                      onClick={() => sendControl("visual", "setAudioDrive", "visual-audio-drive", drive)}
                    >
                      {drive === "api" ? "show api" : drive}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="label"><span>{ui.visual.scene}</span></div>
                <div className="btn-grid two">
                  {visualScenes.map((scene) => (
                    <button
                      key={scene.id}
                      type="button"
                      className={["mini-btn", snapshot.modules.visual.scene === scene.id ? "primary" : ""].filter(Boolean).join(" ")}
                      onClick={() => sendControl("visual", "setScene", "visual-main", scene.id)}
                      title={scene.preset}
                    >
                      {scene.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="label"><span>{locale === "zh" ? "文字 / 提示" : "Text / Prompt"}</span></div>
                <form className="field" onSubmit={(event) => {
                  event.preventDefault();
                  void sendControl("visual", "setText", "visual-text", {
                    value: manualText,
                    animation: snapshot.modules.visual.text.animation,
                    reactive: snapshot.modules.visual.text.reactive
                  });
                }}>
                  <select
                    className="fake-select"
                    value={snapshot.modules.visual.text.animation}
                    onChange={(event) => sendControl("visual", "setText", "visual-text-style", {
                      value: snapshot.modules.visual.text.value,
                      animation: event.target.value,
                      reactive: snapshot.modules.visual.text.reactive
                    })}
                  >
                    {visualTextStyles.map((style) => <option key={style} value={style}>{style}</option>)}
                  </select>
                  <input value={manualText} onChange={(event) => setManualText(event.target.value)} aria-label="visual text" />
                  <button type="submit" className="mini-btn primary"><Send size={13} /></button>
                </form>
              </div>
            </div>
          </section>

          <section className="module readonly" aria-label="VJ Detail Summary">
            <div className="module-head">
              <h2>{locale === "zh" ? "VJ 细节摘要" : "VJ Detail Summary"}</h2>
            </div>
            <div className="manifest">
              <article><strong>{ui.visual.preset}</strong><span>{snapshot.modules.visual.preset} / {snapshot.modules.visual.scene}</span></article>
              <article><strong>Colors</strong><span>{Object.entries(snapshot.modules.visual.colors).map(([name]) => name).join(", ")}</span></article>
              <article><strong>FX</strong><span>bloom, rgb split, distortion, glitch, speed, chaos</span></article>
              <article><strong>{locale === "zh" ? "权限" : "Authority"}</strong><span>{locale === "zh" ? "4302 VJ 可接管，4300 显示锁定。" : "If 4302 VJ takes over, 4300 shows lock reason."}</span></article>
            </div>
          </section>
        </aside>

        <section className="module stage" aria-label="Stage topology">
          <div className="module-head">
            <h2>Stage Topology</h2>
          </div>
          <div className="map-toolbar">
            <div className="legend" />
            <div className="actions">
              {screenSelectionModes.map((mode) => {
                const Icon = mode.id === "solid" ? Square : mode.id === "dashed" ? Grid3X3 : Maximize;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    className={["cmd", screenSelectionMode === mode.id ? "read" : "pending"].join(" ")}
                    onClick={() => {
                      setScreenSelectionMode(mode.id);
                      setDragBox(null);
                      if (mode.id === "solid") clearSequence();
                    }}
                    title={ui.screenSelectionModes[mode.id]}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="stage-map">
            <div className="selection-space"></div>
            <div
              data-composing={routeComposerOpen ? "true" : "false"}
              aria-label={ui.interaction.screenMap}
              ref={screenGridRef}
              onPointerDown={handleBoxPointerDown}
              onPointerMove={handleBoxPointerMove}
              onPointerUp={handleBoxPointerUp}
              onPointerCancel={() => setDragBox(null)}
            >
              {screenLayoutItems.map((screen) => {
                const route = screenRoutes[screen.id];
                const screenClients = routeClientsByScreenId.get(screen.id) || [];
                const isOnline = screenClients.length > 0;
                const isSelected = snapshot.modules.interaction.screenId === screen.id;
                return (
                  <button
                    key={screen.id}
                    type="button"
                    data-screen-id={screen.id}
                    className={[
                      isSelected ? "selected" : "",
                      screen.id === "A1" ? "master" : "",
                      route?.owner ? `owner-${route.owner}` : "",
                      isOnline ? "is-online" : "is-offline",
                      pendingActions.has(makeActionKey("interaction", "setScreen", screen.id)) ? "is-pending" : ""
                    ].filter(Boolean).join(" ")}
                    style={getScreenLayoutStyle(screen)}
                    onClick={() => handleScreenSelect(screen.id)}
                    title={route?.url || route?.owner || screen.id}
                  >
                    <i className={`dot ${isOnline ? (isSelected ? "stage" : "ok") : ""}`} />
                    <strong>{screen.id}</strong>
                    <span>{ui.screenOwners[route?.owner || "unset"]}</span>
                  </button>
                );
              })}
              {dragBox && <span className="selection-box" style={dragBoxStyle(dragBox)} />}
            </div>
          </div>
        </section>

        <aside className="col right">
          <section className="module dj" aria-label="DJ audio controls">
            <div className="module-head">
              <h2>{ui.audio.title}</h2>
            </div>
            <div className="controls">
              <div className="manifest">
                <article><strong>{ui.audio.activeSource}</strong><span>{activeSource?.displayName || (locale === "zh" ? "无音源" : "No source")} · level {Math.round((activeSource?.level || 0) * 100)}%</span></article>
                <article><strong>Transport</strong><span>{show.status}: {snapshot.modules.audio.transport}</span></article>
                <article><strong>{ui.metrics.master}</strong><span>{Math.round(snapshot.modules.audio.masterLevel * 100)}%</span></article>
              </div>
              <div>
                <div className="label"><span>{ui.audio.presets}</span></div>
                <div className="btn-grid two">
                  {audioStyles.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      className={["mini-btn", (snapshot.modules.audio.activeStyleId || activeSource?.styleId || "default") === style.id ? "primary" : ""].filter(Boolean).join(" ")}
                      onClick={() => sendControl("audio", "setStyle", "audio-style", style.id)}
                    >
                      {style.label}
                    </button>
                  ))}
                  <button type="button" className="mini-btn" onClick={() => sendControl("audio", "shuffleStyle", "audio-shuffle", true)}>
                    <Shuffle size={12} /> Shuffle
                  </button>
                </div>
              </div>
              <div>
                <div className="label"><span>{ui.audio.sourceList}</span></div>
                <div className="btn-grid two">
                  {audioSources.slice(0, 8).map((source) => (
                    <button
                      key={source.sourceId}
                      type="button"
                      className={["mini-btn", source.muted ? "read" : ""].filter(Boolean).join(" ")}
                      onClick={() => sendControl("audio", "setMute", source.sourceId, !source.muted)}
                      title={`${source.displayName} · ${Math.round(source.level * 100)}%`}
                    >
                      {source.muted ? <><X size={10} /> {source.displayName}</> : source.displayName}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="module route" aria-label="Selected object inspector">
            <div className="module-head">
              <h2>{locale === "zh" ? "选中对象面板" : "Selected Inspector"}</h2>
            </div>
            <div className="route-stack">
              <div className="inspector-readout">
                <div>
                  <strong>{snapshot.modules.interaction.screenId}</strong>
                  <span>{locale === "zh" ? "范围" : "scope"}: selected · owner: {ui.screenOwners[screenRoutes[snapshot.modules.interaction.screenId]?.owner || "unset"]}</span>
                </div>
                <span className="chip"><i className={`dot ${routeClientsByScreenId.get(snapshot.modules.interaction.screenId)?.length ? "stage" : ""}`} />{routeClientsByScreenId.get(snapshot.modules.interaction.screenId)?.length ? "online" : "offline"}</span>
              </div>

              <div>
                <div className="label"><span>{locale === "zh" ? "路由预设" : "Route Preset"}</span></div>
                <div className="btn-grid three">
                  {screenRoutePresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={["mini-btn", snapshot.modules.interaction.screenRoutePreset === preset.value ? "primary" : ""].filter(Boolean).join(" ")}
                      onClick={() => sendControl("interaction", "setScreenRoutePreset", "screen-routes", preset.value)}
                    >
                      {ui.screenRoutePresets[preset.value]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="label"><span>{locale === "zh" ? "面板 Owner" : "Owner for Scope"}</span></div>
                <div className="btn-grid four">
                  {(["vj", "baofa", "off", "diagnostic"] as ScreenOwner[]).map((owner) => (
                    <button
                      key={owner}
                      type="button"
                      className={["mini-btn", screenRoutes[snapshot.modules.interaction.screenId]?.owner === owner ? "primary" : ""].filter(Boolean).join(" ")}
                      onClick={() => sendControl("interaction", "setScreenOwner", snapshot.modules.interaction.screenId, owner)}
                    >
                      {ui.screenOwners[owner]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="label"><span>{locale === "zh" ? "呈现" : "Presentation"}</span></div>
                <div className="btn-grid two">
                  <button type="button" className={["mini-btn", screenPresentation.autoRedirect ? "primary" : ""].filter(Boolean).join(" ")} onClick={() => sendControl("interaction", "setScreenAutoRedirect", "screen-routing", !screenPresentation.autoRedirect)}>{locale === "zh" ? "自动跳转" : "Auto Redirect"}</button>
                  <button type="button" className={["mini-btn", screenPresentation.showMenu ? "primary" : ""].filter(Boolean).join(" ")} onClick={() => sendControl("interaction", "setScreenMenuVisible", "screen-menu", !screenPresentation.showMenu)}>{locale === "zh" ? "显示菜单" : "Show Menu"}</button>
                  <button type="button" className={["mini-btn", screenPresentation.showDebug ? "primary" : ""].filter(Boolean).join(" ")} onClick={() => sendControl("interaction", "setScreenDebugVisible", "screen-debug", !screenPresentation.showDebug)}>{locale === "zh" ? "调试" : "Debug"}</button>
                  <button type="button" className={["mini-btn", screenPresentation.cameraEnabled ? "primary" : ""].filter(Boolean).join(" ")} onClick={() => sendControl("interaction", "setScreenCameraEnabled", "screen-camera", !screenPresentation.cameraEnabled)}>{locale === "zh" ? "摄像头" : "Camera"}</button>
                </div>
              </div>

              <div>
                <div className="label"><span>Baofa Engine</span></div>
                <div className="btn-grid two">
                  <button type="button" className={["mini-btn", snapshot.modules.interaction.visualMode === "tree" ? "primary" : ""].filter(Boolean).join(" ")} onClick={() => sendControl("interaction", "setVisualMode", "visual-mode", "tree")}>Tree</button>
                  <button type="button" className={["mini-btn", snapshot.modules.interaction.visualMode === "firework" ? "primary" : ""].filter(Boolean).join(" ")} onClick={() => sendControl("interaction", "setVisualMode", "visual-mode", "firework")}>Firework</button>
                  {snapshot.modules.interaction.visualMode === "tree" ? (
                    <>
                      {["idle", "flow", "interaction", "climax"].map((mode) => (
                        <button key={mode} type="button" className={["mini-btn", snapshot.modules.interaction.mode === mode ? "primary" : ""].filter(Boolean).join(" ")} onClick={() => triggerInteractionMode(mode)}>
                          {ui.interactionModes[mode]}
                        </button>
                      ))}
                      <button type="button" className="mini-btn" onClick={() => { clearSequence(); void sendControl("interaction", "resetTree", "tree-reset", true); }}>{locale === "zh" ? "重置" : "Reset Tree"}</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={["mini-btn", fireworkState === "standby" ? "primary" : ""].filter(Boolean).join(" ")} onClick={standbyFireworks}>Standby</button>
                      <button type="button" className={["mini-btn", fireworkState === "launching" ? "primary" : ""].filter(Boolean).join(" ")} onClick={launchFireworks}>Launch</button>
                      <button type="button" className={["mini-btn", fireworkState === "resetting" ? "primary" : ""].filter(Boolean).join(" ")} onClick={resetFireworks}>Reset</button>
                    </>
                  )}
                </div>
              </div>

              <div>
                <div className="label"><span>{locale === "zh" ? "鱼/烟花状态" : "Fish / Firework State"}</span></div>
                <div className="btn-grid three">
                  <button type="button" className={["mini-btn", baofaFishState === "idle" ? "primary" : ""].filter(Boolean).join(" ")} onClick={() => sendControl("interaction", "setBaofaFishState", "baofa-fish", "idle")}>Idle</button>
                  <button type="button" className={["mini-btn", baofaFishState === "running" ? "primary" : ""].filter(Boolean).join(" ")} onClick={() => sendControl("interaction", "setBaofaFishState", "baofa-fish", "running")}>Run</button>
                  <button type="button" className={["mini-btn", baofaFishState === "roam" ? "primary" : ""].filter(Boolean).join(" ")} onClick={() => sendControl("interaction", "setBaofaFishState", "baofa-fish", "roam")}>Roam</button>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <footer className="dock" aria-label="Event dock">
        <div className="actions">
          <span className="chip"><small>BPM</small><strong>{snapshot.modules.audio.bpm}</strong></span>
          <span className="chip"><small>{locale === "zh" ? "场景" : "Scene"}</small><strong>{snapshot.modules.visual.scene}</strong></span>
          <span className="chip"><small>{locale === "zh" ? "预设" : "Preset"}</small><strong>{snapshot.modules.visual.preset}</strong></span>
        </div>
        <div className="events">
          {visibleHeaderEventLog.length > 0 ? visibleHeaderEventLog.slice(0, 3).map((event) => (
            <article key={event.id} className="event">
              <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
              <strong>{event.type}</strong>
              <p>{event.message}</p>
            </article>
          )) : (
            <article className="event">
              <span>--:--:--</span>
              <strong>eventLog</strong>
              <p>{ui.status.waiting}</p>
            </article>
          )}
        </div>
        <div className="actions">
          <span className="chip">{locale === "zh" ? "只读日志" : "Read-only log"}</span>
        </div>
      </footer>

      {settingsOpen && (
        <div
          className="settings-backdrop"
          role="presentation"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-dialog__head">
              <div>
                <p>{ui.layout.systemSettings}</p>
                <h2 id="settings-dialog-title">{ui.layout.systemSettings}</h2>
                <span>
                  {locale === "zh"
                    ? "系统外观、语言和控制令牌集中在这里。"
                    : "Theme, language, and control token."}
                </span>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label={locale === "zh" ? "关闭" : "Close"}
                onClick={() => setSettingsOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="settings-dialog__grid">
              <section className="settings-block">
                <div className="settings-block__head">
                  <h3>{ui.layout.appearance}</h3>
                  <span>{ui.app.theme}</span>
                </div>
                <div className="segmented-control segmented-control--stretch" aria-label={ui.app.theme}>
                  {(["system", "light", "dark"] as ThemeMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={themeMode === mode ? "selected" : ""}
                      onClick={() => setThemeMode(mode)}
                    >
                      {ui.theme[mode]}
                    </button>
                  ))}
                </div>
              </section>

              <section className="settings-block">
                <div className="settings-block__head">
                  <h3>{ui.app.language}</h3>
                  <span>{ui.app.system}</span>
                </div>
                <div className="segmented-control segmented-control--stretch" aria-label={ui.app.language}>
                  {(["system", "zh", "en"] as LanguageMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={languageMode === mode ? "selected" : ""}
                      onClick={() => setLanguageMode(mode)}
                    >
                      {ui.language[mode]}
                    </button>
                  ))}
                </div>
              </section>

              <section className="settings-block">
                <div className="settings-block__head">
                  <h3>{ui.layout.quickActions}</h3>
                  <span>{ui.interaction.presentation}</span>
                </div>
                <div className="settings-actions-grid">
                  <div className="settings-action-item">
                    <span>{ui.interaction.autoRedirect}</span>
                    <button
                      type="button"
                      className={actionButtonClass("interaction", "setScreenAutoRedirect", "screen-routing", screenPresentation.autoRedirect)}
                      onClick={() => sendControl("interaction", "setScreenAutoRedirect", "screen-routing", !screenPresentation.autoRedirect)}
                    >
                      {screenPresentation.autoRedirect ? "ON" : "OFF"}
                    </button>
                  </div>
                  <div className="settings-action-item">
                    <span>{ui.actions.save}</span>
                    <button type="button" className="save-btn" onClick={saveSnapshot}>
                      <Save size={14} /> {ui.actions.save}
                    </button>
                  </div>
                </div>
              </section>

              <section className="settings-block settings-block--wide">
                <div className="settings-block__head">
                  <h3>{ui.app.token}</h3>
                  <span>{locale === "zh" ? "可选" : "Optional"}</span>
                </div>
                <label className="token-field token-field--stacked">
                  <span>{ui.app.token}</span>
                  <input
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="optional"
                    type="password"
                  />
                </label>
              </section>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const ScreenGateway = React.memo(function ScreenGateway({ screenId }: { screenId: string }) {
  const [snapshot, setSnapshot] = React.useState<PerformanceState | null>(null);
  const [connection, setConnection] = React.useState<ConnectionState>("connecting");
  const [message, setMessage] = React.useState("Resolving route");
  const route = snapshot?.modules.interaction.screenRoutes?.[screenId];
  const screenPresentation = snapshot?.modules.interaction.screenPresentation || {
    autoRedirect: true,
    cameraEnabled: false,
    showDebug: false,
    showMenu: false
  };
  const isValidScreen = Boolean(route);
  const routeTargetUrl = localizeScreenRouteTarget(route?.url || null, route?.owner);

  React.useEffect(() => {
    let closed = false;
    fetchInitialState()
      .then(state => { if (!closed) setSnapshot(state); })
      .catch(() => { if (!closed) { setConnection("offline"); setMessage("4300 API unavailable"); } });
    return () => { closed = true; };
  }, []);

  useWebSocket(
    `screen-gateway-${screenId}`,
    ["state.read", "screen.route"],
    (message) => {
      if (isStateSnapshot(message)) setSnapshot(message.state);
      if (isStatePatch(message)) {
        setSnapshot((current) => message.state || (current ? applyStatePatch(current, message) : current));
      }
      if (isShowPatch(message)) {
        setSnapshot((current) => current ? applyShowPatch(current, message) : current);
      }
    },
    setConnection
  );

  React.useEffect(() => {
    if (!snapshot) return;
    if (!route) {
      setMessage(`Unknown screen ${screenId}`);
      return;
    }
    if (!screenPresentation.autoRedirect) {
      setMessage(`Manual routing hold for ${formatOwner(route.owner)}`);
      return;
    }
    if (routeTargetUrl && route.owner !== "off" && route.owner !== "diagnostic") {
      setMessage(`Routing ${screenId} to ${formatOwner(route.owner)}`);
      window.location.replace(routeTargetUrl);
      return;
    }
    setMessage(route.owner === "diagnostic" ? "Diagnostic hold" : "Route URL unavailable");
  }, [route, routeTargetUrl, screenId, screenPresentation.autoRedirect, snapshot]);

  return (
    <main className="screen-gateway">
      <section>
        <div className={`connection-dot ${connection}`} />
        <span>{connection}</span>
        <h1>{screenId}</h1>
        <p>{message}</p>
        {isValidScreen && route && (
          <dl>
            <div>
              <dt>Owner</dt>
              <dd>{formatOwner(route.owner)}</dd>
            </div>
            <div>
              <dt>URL</dt>
              <dd>{route?.url || "Route URL unavailable"}</dd>
            </div>
            <div>
              <dt>Auto Redirect</dt>
              <dd>{screenPresentation.autoRedirect ? "enabled" : "disabled"}</dd>
            </div>
            <div>
              <dt>Menus / Debug</dt>
              <dd>{screenPresentation.showMenu ? "menus shown" : "menus hidden"} · {screenPresentation.showDebug ? "debug shown" : "debug hidden"} · {screenPresentation.cameraEnabled ? "camera enabled" : "camera off"}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{new Date(route.updatedAt).toLocaleTimeString()}</dd>
            </div>
          </dl>
        )}
      </section>
    </main>
  );
});

const Panel = React.memo(function Panel({
  id,
  title,
  icon,
  compact,
  className,
  headerExtra,
  children
}: {
  id?: string;
  title: string;
  icon: React.ReactNode;
  compact?: boolean;
  className?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={compact ? `panel compact ${className || ""}`.trim() : `panel ${className || ""}`.trim()}>
      <div className="panel-heading">
        <h2>{icon}{title}</h2>
        {headerExtra}
      </div>
      {children}
    </section>
  );
});

function isLocalRouteHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized.endsWith(".local") ||
    /^10\./.test(normalized) ||
    /^192\.168\./.test(normalized) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

function localizeScreenRouteTarget(url: string | null, owner: ScreenOwner | undefined) {
  if (!url || (owner !== "vj" && owner !== "baofa")) return url;
  if (typeof window === "undefined" || !isLocalRouteHostname(window.location.hostname)) return url;
  const target = new URL(url, window.location.origin);
  target.protocol = window.location.protocol;
  target.hostname = window.location.hostname;
  target.port = owner === "vj" ? "4302" : "4303";
  return target.toString().replace(/\/$/, "");
}

function formatMs(value: number) {
  const minutes = Math.floor(value / 60000);
  const seconds = Math.floor((value % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatOwner(owner: unknown) {
  if (owner === "vj") return "VJ";
  if (owner === "baofa") return "Baofa";
  if (owner === "off") return "Off";
  if (owner === "diagnostic") return "Diag";
  return "Unset";
}

function getScreenLayoutStyle(item: ScreenLayoutItem): React.CSSProperties {
  const width = item.width ?? 0.78;
  const height = item.height ?? 0.52;
  return {
    left: `${((item.col - width / 2) / stageBounds.width) * 100}%`,
    top: `${((item.row - height / 2) / stageBounds.height) * 100}%`,
    width: `${(width / stageBounds.width) * 100}%`,
    height: `${(height / stageBounds.height) * 100}%`,
    transform: item.rotate ? `rotate(${item.rotate}deg)` : undefined
  };
}

function getScreenIdFromPath() {
  const match = window.location.pathname.match(/^\/screen\/([^/]+)\/?$/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]).trim().toUpperCase();
  } catch {
    return match[1].trim().toUpperCase();
  }
}

function normalizeScreenTopology(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  if (value.every((row) => Array.isArray(row))) {
    return value.map((row) => row.map((screenId) => String(screenId || "")));
  }
  if (value.every((screenId) => typeof screenId === "string")) {
    const screens = value.map((screenId) => screenId.trim()).filter(Boolean);
    const rows: string[][] = [];
    for (let index = 0; index < screens.length; index += 6) {
      rows.push(screens.slice(index, index + 6));
    }
    return rows;
  }
  return [];
}

function normalizeRect(box: DragBox) {
  const left = Math.min(box.startX, box.currentX);
  const right = Math.max(box.startX, box.currentX);
  const top = Math.min(box.startY, box.currentY);
  const bottom = Math.max(box.startY, box.currentY);
  return { left, right, top, bottom };
}

function rectsIntersect(
  first: { left: number; right: number; top: number; bottom: number },
  second: { left: number; right: number; top: number; bottom: number }
) {
  return first.left <= second.right
    && first.right >= second.left
    && first.top <= second.bottom
    && first.bottom >= second.top;
}

function dragBoxStyle(box: DragBox): React.CSSProperties {
  const rect = normalizeRect(box);
  return {
    left: rect.left,
    top: rect.top,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top
  };
}

function clampPoint(x: number, y: number, rect: DOMRect): DragBox {
  const currentX = Math.max(0, Math.min(rect.width, x));
  const currentY = Math.max(0, Math.min(rect.height, y));
  return {
    startX: currentX,
    startY: currentY,
    currentX,
    currentY
  };
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function stepDurationMs(step: SequenceStep, bpm: number) {
  const beatMs = 60000 / Math.max(1, bpm);
  const beatMultipliers: Record<SequenceStep, number> = {
    "1/16": 0.25,
    "1/8": 0.5,
    "1/4": 1,
    "1/2": 2,
    "1": 4
  };
  return beatMs * beatMultipliers[step];
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
