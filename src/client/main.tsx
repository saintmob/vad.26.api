import React from "react";
import { createRoot } from "react-dom/client";
import {
  Aperture,
  AudioLines,
  Grid3X3,
  MonitorCog,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Save,
  Send,
  Settings2,
  SlidersHorizontal,
  Square,
  X,
  Type,
  Eye,
  Bug,
  Maximize
} from "lucide-react";
import type { ControlCommand, ModuleName, PerformanceState, ScreenOwner, ScreenRoutePreset } from "../types";
import { createFirebaseDashboardClient, shouldUseFirebaseRealtime } from "./firebaseShowControl";
import { createIdFragment } from "./id";
import "./styles.css";

type ConnectionState = "connecting" | "connected" | "offline";
type ScreenSelectionMode = "solid" | "dashed" | "box";
type SequenceStep = "1/16" | "1/8" | "1/4" | "1/2" | "1";
type SequenceGroup = { order: number; screenIds: string[] };
type DragBox = { startX: number; startY: number; currentX: number; currentY: number };
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
  tab: "vad-dashboard-tab",
  theme: "vad-theme-mode",
  language: "vad-language-mode"
} as const;

type ServerMessage =
  | { type: "state.snapshot"; state: PerformanceState }
  | { type: "state.patch"; state?: PerformanceState; module: ModuleName; patch: Record<string, unknown>; updatedAt?: number }
  | { type: "show.patch"; patch: PerformanceState["show"]; updatedAt?: number }
  | { type: "control.ack"; ok: boolean; command: ControlCommand }
  | { type: "client.presence"; state?: PerformanceState }
  | { type: "error"; error: string }
  | { type: string; [key: string]: unknown };

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
const visualScenes = ["Dumbar", "Topology", "Liquid", "Chromaflux", "Blue Font", "Cyber", "Pulse", "Void"];
const visualTextStyles = ["Cinematic", "Massive", "Glitch", "Hologram", "Floating", "Beat"];
const visualAudioDrives: Array<PerformanceState["modules"]["visual"]["audioDriveMode"]> = ["mic", "music", "api"];
const audioPresets = ["Neon Loop", "Warehouse", "Dream Pop", "Break Lab", "EDM Festival", "Echo Bass"];
const screenSelectionModes: Array<{ id: ScreenSelectionMode; label: string }> = [
  { id: "solid", label: "实线点选" },
  { id: "dashed", label: "虚线点选" },
  { id: "box", label: "框选" }
];
const sequenceSteps: SequenceStep[] = ["1/16", "1/8", "1/4", "1/2", "1"];
const screenRoutePresets: Array<{ value: ScreenRoutePreset; label: string }> = [
  { value: "balanced", label: "Balanced" },
  { value: "vj_takeover", label: "VJ Takeover" },
  { value: "baofa_takeover", label: "Baofa Takeover" }
];
const screenOwners: Array<{ value: ScreenOwner; label: string }> = [
  { value: "vj", label: "VJ" },
  { value: "baofa", label: "Baofa" },
  { value: "off", label: "Off" },
  { value: "diagnostic", label: "Diag" }
];

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
      vj_takeover: "VJ 接管",
      baofa_takeover: "Baofa 接管"
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
      vj_takeover: "VJ takeover",
      baofa_takeover: "Baofa takeover"
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
  const [eventLogExpanded, setEventLogExpanded] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<DashboardTab>(() => readStoredValue(storageKeys.tab, "interaction"));
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
    window.localStorage.setItem(storageKeys.tab, activeTab);
  }, [activeTab]);

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

    if (!token.trim()) {
      setConnection("offline");
      setLastAck("Control token is required");
      return () => {
        closed = true;
      };
    }

    async function boot() {
      try {
        const state = await fetchJson<PerformanceState>("/api/state");
        if (!closed) setSnapshot(state);
        if (shouldUseFirebaseRealtime()) {
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
              setLastAck(`${message}; falling back to Vercel WebSocket`);
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
      } catch {
        if (!closed) setConnection("offline");
      }
      connect();
    }

    function connect() {
      if (closed) return;
      setConnection("connecting");
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
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
    const response = await fetch(url, {
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

  const handleScreenSelect = React.useCallback((screenId: string) => {
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
  }, [addSequenceGroup, clearSequence, screenSelectionMode, sendControl, snapshot, statusNow]);

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
  const routeClientsByScreenId = new Map<string, Array<PerformanceState["clients"][string]>>();
  for (const client of liveClients) {
    if (!client.screenId) continue;
    const screenId = normalizeScreenOccupancyId(client.screenId);
    if (!screenId) continue;
    const current = routeClientsByScreenId.get(screenId) || [];
    current.push(client);
    routeClientsByScreenId.set(screenId, current);
  }
  const unassignedClients = liveClients.filter((client) => !client.screenId);
  const audioSources = Object.values(snapshot.audioSources).sort((a, b) => b.level - a.level);
  const activeSource = snapshot.audioSources[snapshot.modules.audio.activeSourceId] || audioSources[0];
  const screenTopology = normalizeScreenTopology(snapshot.modules.interaction.screenTopology);
  const screenRoutes = snapshot.modules.interaction.screenRoutes || {};
  const screenPresentation = snapshot.modules.interaction.screenPresentation || {
    autoRedirect: true,
    showDebug: false,
    showMenu: false
  };
  const fireworkState = snapshot.modules.interaction.fireworkState || "standby";
  const fireworkStateLabel =
    fireworkState === "launching"
      ? ui.fireworkStates.launching
      : fireworkState === "resetting"
        ? ui.fireworkStates.resetting
        : ui.fireworkStates.standby;
  const routeScreenIds = screenTopology.flatMap((row) => row).filter(Boolean);
  const routeCount = routeScreenIds.length;
  const clientCount = liveClients.length;
  const eventCount = snapshot.eventLog.length;
  const visibleEventLog = eventLogExpanded ? snapshot.eventLog : snapshot.eventLog.slice(0, 6);
  const summarizeClientIds = (items: Array<{ id: string }>, emptyLabel: string) => {
    if (items.length === 0) return emptyLabel;
    const clientIds = items.map((item) => item.id);
    const head = clientIds.slice(0, 2).join(" · ");
    return clientIds.length > 2 ? `${head} +${clientIds.length - 2}` : head;
  };
  const pageCopy = ui.tabs[activeTab];
  const latestAck = lastAck || ui.status.waiting;
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
  const interactionLayoutStyle = {
    "--right-rail-width": "clamp(330px, 23vw, 390px)"
  } as React.CSSProperties;

  return (
    <main className="console-shell" data-theme={theme} data-locale={locale}>
      <header className="console-header">
        <div className="brand-block">
          <div className="brand-mark">V</div>
          <div>
            <strong>{ui.app.title}</strong>
            <span>{ui.app.subtitle}</span>
          </div>
        </div>

        <div className="console-header__rail">
          <div className="header-summary">
            <div className="header-metrics" aria-label={locale === "zh" ? "路由与在线设备" : "Routes and online devices"}>
              <div className="header-metric">
                <span>{locale === "zh" ? "路由设备" : "Routes"}</span>
                <strong>{routeCount}</strong>
              </div>
              <div className="header-metric">
                <span>{locale === "zh" ? "在线设备" : "Online"}</span>
                <strong>{clientCount}</strong>
              </div>
            </div>

            <div className="status-stack">
              <div className="status-chip">
                <div className={`connection-dot ${connection}`} />
                <div>
                  <strong>{ui.app.connection}</strong>
                  <span>{ui.status[connection]}</span>
                </div>
              </div>
              <div className={`status-chip sync-chip sync-chip--${effectiveSyncStatus}`}>
                <div className={`connection-dot ${effectiveSyncStatus === "error" ? "offline" : effectiveSyncStatus === "sending" ? "connecting" : "connected"}`} />
                <div>
                  <strong>{locale === "zh" ? "数据同步" : "Sync"}</strong>
                  <span>{syncLabel}</span>
                </div>
              </div>
              <div className="status-chip">
                <div>
                  <strong>{ui.app.showStatus}</strong>
                  <span>{showStatusLabel}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="settings-trigger"
            aria-label={ui.layout.systemSettings}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={16} />
            <span>{ui.layout.systemSettings}</span>
          </button>
        </div>
      </header>

      <section className="console-dock">
        <nav className="tab-strip" aria-label={ui.app.activeTab}>
          {tabDefinitions.map((tab) => {
            const tabText = ui.tabs[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? "tab-button selected" : "tab-button"}
                style={{ "--accent": tab.accent } as React.CSSProperties}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                <span>
                  <strong>{tabText.label}</strong>
                  <small>{tabText.detail}</small>
                </span>
              </button>
            );
          })}
        </nav>

        <section className="playback-bar" aria-label={ui.layout.transport}>
          <div className="playback-bar__copy">
            <p>{ui.layout.transport}</p>
            <strong>{showStatusLabel}</strong>
            <span>{show.id} · {show.bpm} BPM · {formatMs(show.positionMs)}</span>
          </div>
          <div className="playback-bar__actions">
            <button type="button" className={actionButtonClass("show", "play", show.id, show.status === "running")} onClick={() => sendControl("show", "play", show.id)}>
              <Play size={16} /> {ui.actions.play}
            </button>
            <button type="button" className={actionButtonClass("show", "pause", show.id, show.status === "paused")} onClick={() => sendControl("show", "pause", show.id)}>
              <Pause size={16} /> {ui.actions.pause}
            </button>
            <button type="button" className={actionButtonClass("show", "stop", show.id, show.status === "ended")} onClick={() => sendControl("show", "stop", show.id)}>
              <Square size={16} /> {ui.actions.stop}
            </button>
            <button type="button" className={actionButtonClass("show", "reset", show.id)} onClick={() => sendControl("show", "reset", show.id)}>
              <RotateCcw size={16} /> {ui.actions.reset}
            </button>
          </div>
        </section>
      </section>

      <section className="console-body">
        {activeTab !== "interaction" && (
          <div className="page-meta">
            <div>
              <p>{ui.app.activeTab}</p>
              <h1>{pageCopy.label}</h1>
              <span>{pageCopy.detail}</span>
            </div>
          </div>
        )}

        {activeTab === "interaction" ? (
          <section className="workspace-grid workspace-grid--interaction">
            <Panel
              title={ui.interaction.title}
              icon={<MonitorCog size={18} />}
              className="workspace-panel workspace-panel--interaction"
            >
                <div className="interaction-layout-core">
                  <div className="interaction-header-block">
                    <div className="header-main">
                      <div className="header-mode-toggle">
                        <div className="mode-pill-label">Visual Mode: <strong>{snapshot.modules.interaction.visualMode === "firework" ? "FIREWORKS" : "TREE"}</strong></div>
                        <div className="segmented-control global-mode-switch">
                          <button
                            type="button"
                            className={actionButtonClass("interaction", "setVisualMode", "visual-mode", snapshot.modules.interaction.visualMode === "tree")}
                            onClick={() => sendControl("interaction", "setVisualMode", "visual-mode", "tree")}
                          >
                            Tree
                          </button>
                          <button
                            type="button"
                            className={actionButtonClass("interaction", "setVisualMode", "visual-mode", snapshot.modules.interaction.visualMode === "firework")}
                            onClick={() => sendControl("interaction", "setVisualMode", "visual-mode", "firework")}
                          >
                            Fireworks
                          </button>
                        </div>
                      </div>
                      <div className="header-action-bar">
                        {snapshot.modules.interaction.visualMode === "tree" ? (
                          <div className="action-group">
                            <span className="action-label">Tree Control: <strong>{ui.interactionModes[snapshot.modules.interaction.mode]}</strong></span>
                            <div className="action-buttons">
                            {["idle", "flow", "interaction", "climax"].map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                className={actionButtonClass("interaction", "setMode", sequenceGroups.length === 0 ? "interaction-mode" : "sequence", snapshot.modules.interaction.mode === mode)}
                                onClick={() => triggerInteractionMode(mode)}
                              >
                                {ui.interactionModes[mode]}
                              </button>
                            ))}
                            <button type="button" className={actionButtonClass("interaction", "setMode", "interaction-mode", false, "reset-btn")} onClick={() => { clearSequence(); void sendControl("interaction", "setMode", "interaction-mode", "idle"); }}>
                              Reset
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="action-group">
                          <span className="action-label">Fireworks: <strong>{fireworkStateLabel}</strong></span>
                          <div className="action-buttons">
                            <button
                              type="button"
                              className={actionButtonClass("interaction", "setFireworkState", "firework-state", fireworkState === "standby")}
                              onClick={standbyFireworks}
                            >
                              Standby
                            </button>
                            <button
                              type="button"
                              className={actionButtonClass("interaction", "setFireworkState", "firework-state", fireworkState === "launching")}
                              onClick={launchFireworks}
                            >
                              Launch
                            </button>
                            <button
                              type="button"
                              className={actionButtonClass("interaction", "setFireworkState", "firework-state", fireworkState === "resetting")}
                              onClick={resetFireworks}
                            >
                              Reset
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="header-sequence-pill">
                      {sequenceGroups.length > 0 && (
                        <div className="seq-pill">
                          <span className="seq-label">{ui.interaction.step}</span>
                          <div className="seq-buttons">
                            {sequenceSteps.map((step) => (
                              <button
                                key={step}
                                type="button"
                                className={sequenceStep === step ? "selected" : ""}
                                onClick={() => setSequenceStep(step)}
                              >
                                {step}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="screen-stage-container">
                    <div className="screen-stage-header">
                      <div className="presentation-toggles">
                        <button
                          type="button"
                          className={actionButtonClass("interaction", "setScreenMenuVisible", "screen-menu", screenPresentation.showMenu)}
                          onClick={() => sendControl("interaction", "setScreenMenuVisible", "screen-menu", !screenPresentation.showMenu)}
                        >
                          <Eye size={14} /> {ui.interaction.showMenu}
                        </button>
                        <button
                          type="button"
                          className={actionButtonClass("interaction", "setScreenDebugVisible", "screen-debug", screenPresentation.showDebug)}
                          onClick={() => sendControl("interaction", "setScreenDebugVisible", "screen-debug", !screenPresentation.showDebug)}
                        >
                          <Bug size={14} /> {ui.interaction.showDebug}
                        </button>
                      </div>
                    </div>
                    <div className="screen-stage">
                      <div className="stage-overlay-tools">
                        <div className="selection-mode-picker">
                          {screenSelectionModes.map((mode) => {
                            const Icon = mode.id === "solid" ? Square : mode.id === "dashed" ? Grid3X3 : Maximize;
                            return (
                              <button
                                key={mode.id}
                                type="button"
                                className={screenSelectionMode === mode.id ? "selected" : ""}
                                onClick={() => {
                                  setScreenSelectionMode(mode.id);
                                  setDragBox(null);
                                  if (mode.id === "solid") clearSequence();
                                }}
                                title={ui.screenSelectionModes[mode.id]}
                              >
                                <Icon size={16} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div
                        className={`screen-grid selection-mode-${screenSelectionMode}`}
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
                          const isScreenOnline = screenClients.length > 0;
                          return (
                            <button
                              key={screen.id}
                              type="button"
                              data-screen-id={screen.id}
                              className={[
                                snapshot.modules.interaction.screenId === screen.id ? "selected" : "",
                                sequenceOrderByScreen.has(screen.id) ? "sequenced" : "",
                                screen.id === "A1" ? "master-screen" : "",
                                route?.owner ? `owner-${route.owner}` : "",
                                isScreenOnline ? "is-online" : "is-offline",
                                pendingActions.has(makeActionKey("interaction", "setScreen", screen.id)) ? "is-pending" : ""
                              ].filter(Boolean).join(" ")}
                              style={getScreenLayoutStyle(screen)}
                              onClick={() => handleScreenSelect(screen.id)}
                              title={route?.url || route?.owner || screen.id}
                            >
                              <i className="device-dot" aria-label={isScreenOnline ? (locale === "zh" ? "设备在线" : "Device online") : (locale === "zh" ? "设备离线" : "Device offline")} />
                              <strong>{screen.id}</strong>
                              <span>{ui.screenOwners[route?.owner || "unset"]}</span>
                              {isScreenOnline && <small>{screenClients.length}</small>}
                              {sequenceOrderByScreen.has(screen.id) && (
                                <em className="screen-order">{sequenceOrderByScreen.get(screen.id)}</em>
                              )}
                            </button>
                          );
                        })}
                        {dragBox && <span className="selection-box" style={dragBoxStyle(dragBox)} />}
                      </div>
                      <p className="stage-hint stage-hint--overlay">{ui.interaction.routeHint}</p>
                    </div>
                  </div>
                  <div className="interaction-readout-row" aria-label={locale === "zh" ? "状态概览" : "Status overview"}>
                    {[
                      { key: "intensity", label: ui.interaction.intensity, value: snapshot.modules.interaction.intensity, kind: "percent" },
                      { key: "treeGrowth", label: ui.interaction.growth, value: snapshot.modules.interaction.treeGrowth, kind: "percent" },
                      { key: "gestureActive", label: ui.interaction.gesture, value: snapshot.modules.interaction.gestureActive, kind: "boolean" },
                      { key: "screenRoutePreset", label: ui.interaction.route, value: snapshot.modules.interaction.screenRoutePreset, kind: "route" }
                    ].map((item, idx) => {
                      let displayVal = "";
                      if (item.kind === "percent" && typeof item.value === "number") displayVal = `${Math.round(item.value * 100)}%`;
                      else if (item.kind === "boolean") displayVal = item.value ? "ACTIVE" : "IDLE";
                      else if (item.kind === "route") displayVal = ui.screenRoutePresets[item.value as ScreenRoutePreset];

                      return (
                        <div key={item.key} className="header-stat-pill">
                          <span className="stat-label">{item.label}</span>
                          <span className={`stat-value ${idx === 2 && item.value ? "active" : ""}`}>{displayVal}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="interaction-controls-footer">
                  {/* All controls moved to interaction-header-block */}
                </div>
            </Panel>

            <aside className="interaction-rail interaction-rail--right">
              <div className="rail-shell">
                <div className="rail-header">
                  <div>
                    <strong>{ui.layout.routes}</strong>
                  </div>
                </div>

                <div className="rail-stack rail-stack--right">
                  <section className="route-board">
                    <div className="route-board__head">
                      <div>
                        <p>{ui.interaction.routeRegister}</p>
                        <strong>{ui.interaction.routePreset}</strong>
                      </div>
                      <span>{routeCount}</span>
                    </div>

                    <div className="route-presets-rail">
                      <span className="rail-label">{ui.interaction.routePreset}</span>
                      <div className="route-presets">
                        {screenRoutePresets.map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            className={actionButtonClass("interaction", "setScreenRoutePreset", "screen-routes", snapshot.modules.interaction.screenRoutePreset === preset.value)}
                            onClick={() => sendControl("interaction", "setScreenRoutePreset", "screen-routes", preset.value)}
                          >
                            {ui.screenRoutePresets[preset.value]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="route-table route-table--rail">
                      {routeScreenIds.map((screenId) => {
                        const route = screenRoutes[screenId];
                        const routeClients = routeClientsByScreenId.get(screenId) || [];
                        const isRouteOnline = routeClients.length > 0;
                        const clientSummary = summarizeClientIds(
                          routeClients,
                          locale === "zh" ? "暂无在线设备" : "No live device"
                        );
                        const isSelected = snapshot.modules.interaction.screenId === screenId;
                        return (
                          <article key={screenId} className={[isSelected ? "selected" : "", isRouteOnline ? "is-online" : "is-offline"].filter(Boolean).join(" ")}>
                            <div>
                              <strong><i className="device-dot" />{screenId}</strong>
                              <span>{route?.url || "Route URL unavailable"}</span>
                              <small className="route-meta-line">
                                {route?.updatedAt ? new Date(route.updatedAt).toLocaleTimeString() : (locale === "zh" ? "等待中" : "Waiting")} · {ui.interaction.clients}: {clientSummary}
                              </small>
                            </div>
                            <div className="owner-switch" aria-label={`${screenId} owner`}>
                              {screenOwners.map((owner) => (
                                <button
                                  key={owner.value}
                                  type="button"
                                  className={actionButtonClass("interaction", "setScreenOwner", screenId, route?.owner === owner.value, route?.owner === owner.value ? `owner-${owner.value}` : "")}
                                  onClick={() => sendControl("interaction", "setScreenOwner", screenId, owner.value)}
                                >
                                  {ui.screenOwners[owner.value]}
                                </button>
                              ))}
                            </div>
                          </article>
                        );
                      })}

                      {unassignedClients.length > 0 && (
                        <article className="route-table__unassigned">
                          <div>
                            <strong>{locale === "zh" ? "未绑定" : "Unassigned"}</strong>
                            <span>{summarizeClientIds(unassignedClients, locale === "zh" ? "暂无在线设备" : "No live device")}</span>
                            <small>{ui.interaction.clients}</small>
                          </div>
                        </article>
                      )}
                    </div>
                  </section>

                  <section className="rail-log" aria-label={ui.interaction.eventLog}>
                    <div className="rail-log__head">
                      <div>
                        <p>{ui.interaction.eventLog}</p>
                      </div>
                      <div className="rail-log__head-actions">
                        {snapshot.eventLog.length > 6 && (
                          <button
                            type="button"
                            className="rail-log__toggle"
                            onClick={() => setEventLogExpanded((current) => !current)}
                          >
                            {eventLogExpanded ? (locale === "zh" ? "收起" : "Less") : (locale === "zh" ? "更多" : "More")}
                          </button>
                        )}
                        <span>{eventCount}</span>
                      </div>
                    </div>

                    <div className="rail-log__ack">
                      <span>{locale === "zh" ? "回执" : "Ack"}</span>
                      <strong>{latestAck}</strong>
                    </div>

                    <div className="event-list event-list--compact rail-log__body">
                      {visibleEventLog.map((event) => (
                        <article key={event.id}>
                          <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                          <strong>{event.type}</strong>
                          <p>{event.message}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </aside>
          </section>
        ) : activeTab === "visual" ? (
          <section className="workspace-grid workspace-grid--module workspace-grid--visual">
            <Panel title={ui.visual.title} icon={<Aperture size={18} />}>
              <p className="panel-lead">{ui.visual.lead}</p>

              <div className="scene-readout">
                <div>
                  <span>{ui.visual.scene}</span>
                  <strong>{snapshot.modules.visual.scene}</strong>
                </div>
                <div>
                  <span>{ui.visual.preset}</span>
                  <strong>{snapshot.modules.visual.preset}</strong>
                </div>
              </div>

              <div className="swatches" aria-label={ui.visual.colors}>
                {Object.entries(snapshot.modules.visual.colors).map(([name, color]) => (
                  <span key={name} title={name} style={{ background: color }} />
                ))}
              </div>

              <div className="button-row">
                {visualScenes.map((scene) => (
                  <button
                    key={scene}
                    type="button"
                    className={actionButtonClass("visual", "setScene", "visual-main", snapshot.modules.visual.scene === scene)}
                    onClick={() => sendControl("visual", "setScene", "visual-main", scene)}
                  >
                    {scene}
                  </button>
                ))}
              </div>

              <div className="visual-drive-control">
                <span>{ui.visual.drive}</span>
                <div className="button-row button-row--tight">
                  {visualAudioDrives.map((drive) => (
                    <button
                      key={drive}
                      type="button"
                      className={actionButtonClass("visual", "setAudioDrive", "visual-audio-drive", snapshot.modules.visual.audioDriveMode === drive)}
                      onClick={() => sendControl("visual", "setAudioDrive", "visual-audio-drive", drive)}
                    >
                      {drive === "api" ? "show api" : drive}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={actionButtonClass("visual", "setFullscreen", "visual-fullscreen", snapshot.modules.visual.fullscreen)}
                  onClick={() => sendControl("visual", "setFullscreen", "visual-fullscreen", !snapshot.modules.visual.fullscreen)}
                >
                  {ui.visual.fullscreen}
                </button>
              </div>

              <form className="inline-form" onSubmit={(event) => {
                event.preventDefault();
                void sendControl("visual", "setText", "visual-text", {
                  value: manualText,
                  animation: snapshot.modules.visual.text.animation,
                  reactive: snapshot.modules.visual.text.reactive
                });
              }}>
                <Type size={16} />
                <select
                  value={snapshot.modules.visual.text.animation}
                  onChange={(event) => sendControl("visual", "setText", "visual-text-style", {
                    value: snapshot.modules.visual.text.value,
                    animation: event.target.value,
                    reactive: snapshot.modules.visual.text.reactive
                  })}
                >
                  {visualTextStyles.map((style) => <option key={style} value={style}>{style}</option>)}
                </select>
                <input value={manualText} onChange={(event) => setManualText(event.target.value)} />
                <button type="submit" className={actionButtonClass("visual", "setText", "visual-text")}><Send size={15} /> {ui.actions.send}</button>
              </form>
            </Panel>
          </section>
        ) : (
          <section className="workspace-grid workspace-grid--module">
            <Panel title={ui.audio.title} icon={<AudioLines size={18} />}>
              <p className="panel-lead">{ui.audio.lead}</p>

              <div className="active-source">
                <div>
                  <span>{ui.audio.activeSource}</span>
                  <strong>{activeSource?.displayName || (locale === "zh" ? "无音源" : "No source")}</strong>
                </div>
                <div className="meter">
                  <i style={{ width: `${(activeSource?.level || 0) * 100}%` }} />
                </div>
              </div>

              <div className="source-list">
                {audioSources.map((source) => (
                  <article key={source.sourceId} className={source.muted ? "source-row muted" : "source-row"}>
                    <button type="button" className={actionButtonClass("audio", "setMute", source.sourceId)} onClick={() => sendControl("audio", "setMute", source.sourceId, !source.muted)}>
                      {source.muted ? ui.actions.unmute : ui.actions.mute}
                    </button>
                    <div>
                      <strong>{source.displayName}</strong>
                      <span>{source.sourceId} · {source.speaking && !source.muted ? ui.audio.speaking : ui.audio.idle}</span>
                    </div>
                    <small>{Math.round(source.level * 100)}%</small>
                  </article>
                ))}
              </div>

              <div className="button-row">
                {audioPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={actionButtonClass("audio", "setPreset", "audio-preset", snapshot.modules.audio.activePreset === preset)}
                    onClick={() => sendControl("audio", "setPreset", "audio-preset", preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </Panel>

            <div className="support-stack">
              <Panel title={ui.app.showStatus} icon={<SlidersHorizontal size={18} />} compact>
                <div className="scene-readout">
                  <div>
                    <span>{ui.metrics.bpm}</span>
                    <strong>{show.bpm}</strong>
                  </div>
                  <div>
                    <span>{ui.metrics.position}</span>
                    <strong>{formatMs(show.positionMs)}</strong>
                  </div>
                  <div>
                    <span>{ui.metrics.master}</span>
                    <strong>{Math.round(snapshot.modules.audio.masterLevel * 100)}%</strong>
                  </div>
                </div>
              </Panel>
            </div>
          </section>
        )}
      </section>

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
                    ? "系统外观、语言和控制令牌集中在这里，主面板只保留高频操作。"
                    : "Theme, language, and control token are centralized here. The main deck keeps only high-frequency actions."}
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

function ScreenGateway({ screenId }: { screenId: string }) {
  const [snapshot, setSnapshot] = React.useState<PerformanceState | null>(null);
  const [connection, setConnection] = React.useState<ConnectionState>("connecting");
  const [message, setMessage] = React.useState("Resolving route");
  const route = snapshot?.modules.interaction.screenRoutes?.[screenId];
  const screenPresentation = snapshot?.modules.interaction.screenPresentation || {
    autoRedirect: true,
    showDebug: false,
    showMenu: false
  };
  const isValidScreen = Boolean(route);
  const routeTargetUrl = route?.url || null;

  React.useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    async function boot() {
      try {
        const state = await fetchJson<PerformanceState>("/api/state");
        if (!closed) setSnapshot(state);
      } catch {
        if (!closed) {
          setConnection("offline");
          setMessage("4300 API unavailable");
        }
      }
      connect();
    }

    function connect() {
      if (closed) return;
      setConnection("connecting");
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
      socket.addEventListener("open", () => {
        setConnection("connected");
        socket?.send(JSON.stringify({
          type: "client.hello",
          clientId: `screen-gateway-${screenId}`,
          module: "dashboard",
          role: "screen-gateway",
          capabilities: ["state.read", "screen.route"]
        }));
      });
      socket.addEventListener("message", (event) => {
        const serverMessage = JSON.parse(event.data) as ServerMessage;
        if (isStateSnapshot(serverMessage)) setSnapshot(serverMessage.state);
        if (isStatePatch(serverMessage)) {
          setSnapshot((current) => serverMessage.state || (current ? applyStatePatch(current, serverMessage) : current));
        }
        if (isShowPatch(serverMessage)) {
          setSnapshot((current) => current ? applyShowPatch(current, serverMessage) : current);
        }
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
    };
  }, [screenId]);

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
    if ((route.owner === "vj" || route.owner === "baofa") && routeTargetUrl) {
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
              <dd>{screenPresentation.showMenu ? "menus shown" : "menus hidden"} · {screenPresentation.showDebug ? "debug shown" : "debug hidden"}</dd>
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
}

function Panel({
  id,
  title,
  icon,
  compact,
  className,
  children
}: {
  id?: string;
  title: string;
  icon: React.ReactNode;
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={compact ? `panel compact ${className || ""}`.trim() : `panel ${className || ""}`.trim()}>
      <div className="panel-heading">
        <h2>{icon}{title}</h2>
      </div>
      {children}
    </section>
  );
}

function isStateSnapshot(message: ServerMessage): message is Extract<ServerMessage, { type: "state.snapshot" }> {
  return message.type === "state.snapshot";
}

function isStatePatch(message: ServerMessage): message is Extract<ServerMessage, { type: "state.patch" }> {
  return message.type === "state.patch";
}

function isShowPatch(message: ServerMessage): message is Extract<ServerMessage, { type: "show.patch" }> {
  return message.type === "show.patch";
}

function applyStatePatch(state: PerformanceState, message: Extract<ServerMessage, { type: "state.patch" }>): PerformanceState {
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

function applyShowPatch(state: PerformanceState, message: Extract<ServerMessage, { type: "show.patch" }>): PerformanceState {
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

function isControlAck(message: ServerMessage): message is Extract<ServerMessage, { type: "control.ack" }> {
  return message.type === "control.ack";
}

function isErrorMessage(message: ServerMessage): message is Extract<ServerMessage, { type: "error" }> {
  return message.type === "error";
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
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
