import React from "react";
import { createRoot } from "react-dom/client";
import {
  Aperture,
  AudioLines,
  Database,
  Grid3X3,
  ListChecks,
  MonitorCog,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Save,
  Send,
  SlidersHorizontal,
  Sparkles,
  Type,
  Zap
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
    memories: string;
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
};

const env = import.meta.env;
const defaultControlToken = env.VITE_CONTROL_TOKEN || "";
const storageKeys = {
  token: "vad-control-token",
  tab: "vad-dashboard-tab",
  theme: "vad-theme-mode",
  language: "vad-language-mode",
  leftRail: "vad-layout-left-rail",
  rightRail: "vad-layout-right-rail",
  logs: "vad-layout-logs"
} as const;

type ServerMessage =
  | { type: "state.snapshot"; state: PerformanceState }
  | { type: "state.patch"; state?: PerformanceState; module: ModuleName; patch: Record<string, unknown>; updatedAt?: number }
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
const visualScenes = ["Cyber", "Liquid", "Topology", "Pulse", "Void", "Dumbar"];
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
      routePreset: "路由预设",
      presentation: "呈现开关",
      selectionMode: "选择模式",
      screenMap: "屏幕拓扑",
      routeRegister: "路由清单",
      eventLog: "事件日志",
      clients: "连接客户端",
      routeHint: "点击或框选屏幕，直接编排序列与路由。",
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
      memories: "视觉记忆"
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
      idle: "待机",
      interaction: "互动",
      flow: "流动",
      climax: "高潮"
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
      routePreset: "Route preset",
      presentation: "Presentation",
      selectionMode: "Selection mode",
      screenMap: "Screen topology",
      routeRegister: "Route register",
      eventLog: "Event log",
      clients: "Connected clients",
      routeHint: "Click or box select screens to build routing sequences.",
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
      memories: "Visual memories"
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
      idle: "Idle",
      interaction: "Interaction",
      flow: "Flow",
      climax: "Climax"
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
  { id: "G1", col: 0.95, row: 4.2, height: 0.82 },
  { id: "G2", col: 0.95, row: 5.4, height: 0.82 },
  { id: "H1", col: 10.05, row: 4.2, height: 0.82 },
  { id: "H2", col: 10.05, row: 5.4, height: 0.82 }
];
const screenLayoutOrder = screenLayoutItems.map((screen) => screen.id);

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
  const [activeTab, setActiveTab] = React.useState<DashboardTab>(() => readStoredValue(storageKeys.tab, "interaction"));
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() => readStoredValue(storageKeys.theme, "system"));
  const [languageMode, setLanguageMode] = React.useState<LanguageMode>(() => readStoredValue(storageKeys.language, "system"));
  const [leftRailOpen, setLeftRailOpen] = React.useState(() => readStoredBoolean(storageKeys.leftRail, false));
  const [rightRailOpen, setRightRailOpen] = React.useState(() => readStoredBoolean(storageKeys.rightRail, false));
  const [logsOpen, setLogsOpen] = React.useState(() => readStoredBoolean(storageKeys.logs, false));
  const [prefersDark, setPrefersDark] = React.useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [systemLanguage, setSystemLanguage] = React.useState<UiLanguage>(() => resolveBrowserLanguage());
  const firebaseClientRef = React.useRef<ReturnType<typeof createFirebaseDashboardClient> | null>(null);
  const screenGridRef = React.useRef<HTMLDivElement | null>(null);

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
    window.localStorage.setItem(storageKeys.leftRail, leftRailOpen ? "1" : "0");
  }, [leftRailOpen]);

  React.useEffect(() => {
    window.localStorage.setItem(storageKeys.rightRail, rightRailOpen ? "1" : "0");
  }, [rightRailOpen]);

  React.useEffect(() => {
    window.localStorage.setItem(storageKeys.logs, logsOpen ? "1" : "0");
  }, [logsOpen]);

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
              if (!closed) setLastAck(message);
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
        return;
      }
      const result = await postJson<{ state: PerformanceState; command: ControlCommand }>("/api/control", payload);
      setSnapshot(result.state);
      setLastAck(`${result.command.command} accepted for ${result.command.target}`);
    } catch (error) {
      setLastAck(error instanceof Error ? error.message : String(error));
    }
  }, [postJson]);

  const saveSnapshot = React.useCallback(async () => {
    try {
      if (shouldUseFirebaseRealtime() && firebaseClientRef.current) {
        await firebaseClientRef.current.saveSnapshot();
        return;
      }
      const result = await postJson<{ state: PerformanceState }>("/api/show/snapshot", {});
      setSnapshot(result.state);
      setLastAck("Snapshot saved");
    } catch (error) {
      setLastAck(error instanceof Error ? error.message : String(error));
    }
  }, [postJson]);

  const resetShow = React.useCallback(async () => {
    try {
      if (shouldUseFirebaseRealtime() && firebaseClientRef.current) {
        await firebaseClientRef.current.resetShow();
        return;
      }
      const result = await postJson<{ state: PerformanceState }>("/api/show/reset", {});
      setSnapshot(result.state);
      setLastAck("Show reset");
    } catch (error) {
      setLastAck(error instanceof Error ? error.message : String(error));
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
      void sendControl("interaction", "setScreen", screenId, screenId);
      return;
    }
    if (screenSelectionMode === "dashed") {
      addSequenceGroup([screenId]);
    }
  }, [addSequenceGroup, clearSequence, screenSelectionMode, sendControl]);

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

  const pulseSelectedScreens = React.useCallback(async () => {
    if (sequenceGroups.length === 0 && snapshot) {
      await sendControl("interaction", "pulseScreen", snapshot.modules.interaction.screenId, snapshot.modules.interaction.screenId);
      return;
    }

    const groups = [...sequenceGroups].sort((a, b) => a.order - b.order);
    const sequenceDelay = stepDurationMs(sequenceStep, snapshot?.show.bpm || 120);
    for (const group of groups) {
      await Promise.all(group.screenIds.map((screenId) => sendControl("interaction", "pulseScreen", screenId, screenId)));
      if (groups.length > 1) await wait(sequenceDelay);
    }
  }, [sendControl, sequenceGroups, sequenceStep, snapshot]);

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
  const audioSources = Object.values(snapshot.audioSources).sort((a, b) => b.level - a.level);
  const activeSource = snapshot.audioSources[snapshot.modules.audio.activeSourceId] || audioSources[0];
  const screenTopology = normalizeScreenTopology(snapshot.modules.interaction.screenTopology);
  const screenRoutes = snapshot.modules.interaction.screenRoutes || {};
  const screenPresentation = snapshot.modules.interaction.screenPresentation || {
    autoRedirect: true,
    showDebug: false,
    showMenu: false
  };
  const routeScreenIds = screenTopology.flatMap((row) => row).filter(Boolean);
  const pageCopy = ui.tabs[activeTab];
  const latestAck = lastAck || ui.status.waiting;
  const showStatusLabel = ui.show[show.status];
  const interactionLayoutStyle = {
    "--left-rail-width": leftRailOpen ? "286px" : "44px",
    "--right-rail-width": rightRailOpen ? "360px" : "44px"
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
          <div className="status-stack">
            <div className="status-chip">
              <div className={`connection-dot ${connection}`} />
              <div>
                <strong>{ui.app.connection}</strong>
                <span>{ui.status[connection]}</span>
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
      </header>

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

      <section className="console-body">
        <div className={activeTab === "interaction" ? "page-meta page-meta--interaction" : "page-meta"}>
          <div>
            <p>{ui.app.activeTab}</p>
            <h1>{pageCopy.label}</h1>
            <span>{pageCopy.detail}</span>
          </div>
          <div className="page-meta__stack">
            <span>{ui.app.clients}: {clients.length}</span>
            <span>{ui.app.ack}: {latestAck}</span>
          </div>
        </div>

        {activeTab === "interaction" ? (
          <section className="workspace-grid workspace-grid--interaction" style={interactionLayoutStyle}>
            <aside className={`interaction-rail interaction-rail--left ${leftRailOpen ? "open" : "collapsed"}`}>
              <div className="rail-shell">
                <div className="rail-header">
                  <div>
                    <p>{ui.layout.workspace}</p>
                    <strong>{leftRailOpen ? ui.layout.collapse : ui.layout.expand}</strong>
                  </div>
                  <button
                    type="button"
                    className="rail-toggle"
                    aria-expanded={leftRailOpen}
                    aria-label={leftRailOpen ? ui.layout.collapse : ui.layout.expand}
                    onClick={() => setLeftRailOpen((value) => !value)}
                  >
                    {leftRailOpen ? "‹" : "›"}
                  </button>
                </div>

                {leftRailOpen ? (
                  <div className="rail-stack">
                    <section className="rail-section">
                      <div className="rail-section__head">
                        <h2>{ui.layout.appearance}</h2>
                      </div>
                      <div className="segmented-control" aria-label={ui.app.theme}>
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
                      <div className="segmented-control" aria-label={ui.app.language}>
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

                    <section className="rail-section">
                      <div className="rail-section__head">
                        <h2>{ui.layout.access}</h2>
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

                    <section className="rail-section">
                      <div className="rail-section__head">
                        <h2>{ui.layout.advanced}</h2>
                      </div>
                      <div className="screen-presentation-controls" aria-label={ui.interaction.presentation}>
                        <button
                          type="button"
                          className={screenPresentation.autoRedirect ? "selected" : ""}
                          onClick={() => sendControl("interaction", "setScreenAutoRedirect", "screen-routing", !screenPresentation.autoRedirect)}
                        >
                          {ui.interaction.autoRedirect}
                        </button>
                        <button
                          type="button"
                          className={screenPresentation.showMenu ? "selected" : ""}
                          onClick={() => sendControl("interaction", "setScreenMenuVisible", "screen-menu", !screenPresentation.showMenu)}
                        >
                          {ui.interaction.showMenu}
                        </button>
                        <button
                          type="button"
                          className={screenPresentation.showDebug ? "selected" : ""}
                          onClick={() => sendControl("interaction", "setScreenDebugVisible", "screen-debug", !screenPresentation.showDebug)}
                        >
                          {ui.interaction.showDebug}
                        </button>
                        <button type="button" onClick={saveSnapshot}>
                          <Save size={15} /> {ui.actions.save}
                        </button>
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="rail-collapsed-note">
                    <span>{ui.layout.workspace}</span>
                  </div>
                )}
              </div>
            </aside>

            <section className="interaction-stage">
              <div className="stage-head">
                <div>
                  <p>{ui.layout.stage}</p>
                  <h2>{ui.interaction.title}</h2>
                  <span>{ui.interaction.routeHint}</span>
                </div>
              </div>

              <div className="stage-toolbar">
                <div className="route-presets" aria-label={ui.interaction.routePreset}>
                  {screenRoutePresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={snapshot.modules.interaction.screenRoutePreset === preset.value ? "selected" : ""}
                      onClick={() => sendControl("interaction", "setScreenRoutePreset", "screen-routes", preset.value)}
                    >
                      {ui.screenRoutePresets[preset.value]}
                    </button>
                  ))}
                </div>

                <div className="button-row">
                  <button type="button" onClick={() => sendControl("show", "play", show.id, true)}><Play size={16} /> {ui.actions.play}</button>
                  <button type="button" onClick={() => sendControl("show", "pause", show.id, false)}><Pause size={16} /> {ui.actions.pause}</button>
                  <button type="button" onClick={resetShow}><RotateCcw size={16} /> {ui.actions.reset}</button>
                </div>

                <div className="screen-tools">
                  {screenSelectionModes.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      className={screenSelectionMode === mode.id ? "selected" : ""}
                      onClick={() => {
                        setScreenSelectionMode(mode.id);
                        setDragBox(null);
                        if (mode.id === "solid") clearSequence();
                      }}
                    >
                      {ui.screenSelectionModes[mode.id]}
                    </button>
                  ))}
                  {sequenceGroups.length > 0 && (
                    <button type="button" onClick={clearSequence}>{ui.actions.clearSequence}</button>
                  )}
                </div>
              </div>

              <div className="screen-stage">
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
                    return (
                      <button
                        key={screen.id}
                        type="button"
                        data-screen-id={screen.id}
                        className={[
                          snapshot.modules.interaction.screenId === screen.id ? "selected" : "",
                          sequenceOrderByScreen.has(screen.id) ? "sequenced" : "",
                          screen.id === "A1" ? "master-screen" : "",
                          route?.owner ? `owner-${route.owner}` : ""
                        ].filter(Boolean).join(" ")}
                        style={getScreenLayoutStyle(screen)}
                        onClick={() => handleScreenSelect(screen.id)}
                        title={route?.url || route?.owner || screen.id}
                      >
                        <strong>{screen.id}</strong>
                        <span>{ui.screenOwners[route?.owner || "unset"]}</span>
                        {sequenceOrderByScreen.has(screen.id) && (
                          <em className="screen-order">{sequenceOrderByScreen.get(screen.id)}</em>
                        )}
                      </button>
                    );
                  })}
                  {dragBox && <span className="selection-box" style={dragBoxStyle(dragBox)} />}
                </div>

                <div className="interaction-readout">
                  <span>{ui.interaction.intensity} {Math.round(snapshot.modules.interaction.intensity * 100)}%</span>
                  <span>{ui.interaction.growth} {Math.round(snapshot.modules.interaction.treeGrowth * 100)}%</span>
                  <span>{snapshot.modules.interaction.gestureActive ? ui.interaction.gesture : ui.status.offline}</span>
                  <span>{ui.interaction.route} {ui.screenRoutePresets[snapshot.modules.interaction.screenRoutePreset]}</span>
                </div>

                {sequenceGroups.length > 0 && (
                  <div className="sequence-step-control">
                    <span>{ui.interaction.step}</span>
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
                    <small>{Math.round(stepDurationMs(sequenceStep, snapshot.show.bpm))}ms @ {snapshot.show.bpm} BPM</small>
                  </div>
                )}

                <div className="stage-actions">
                  <button
                    type="button"
                    className={snapshot.modules.interaction.mode === "idle" ? "selected" : ""}
                    onClick={() => triggerInteractionMode("idle")}
                  >
                    {ui.interactionModes.idle}
                  </button>
                  <button
                    type="button"
                    className={snapshot.modules.interaction.mode === "interaction" ? "selected" : ""}
                    onClick={() => triggerInteractionMode("interaction")}
                  >
                    {ui.interactionModes.interaction}
                  </button>
                  <button
                    type="button"
                    className={snapshot.modules.interaction.mode === "flow" ? "selected" : ""}
                    onClick={() => triggerInteractionMode("flow")}
                  >
                    {ui.interactionModes.flow}
                  </button>
                  <button
                    type="button"
                    className={snapshot.modules.interaction.mode === "climax" ? "selected" : ""}
                    onClick={() => triggerInteractionMode("climax")}
                  >
                    {ui.interactionModes.climax}
                  </button>
                  <button type="button" onClick={pulseSelectedScreens}>
                    <Zap size={15} /> {ui.actions.pulse}
                  </button>
                  <button type="button" onClick={() => {
                    clearSequence();
                    void sendControl("interaction", "resetTree", "tree", true);
                  }}>
                    {ui.actions.resetTree}
                  </button>
                  <button
                    type="button"
                    className={snapshot.modules.interaction.visualMode === "firework" ? "selected" : ""}
                    onClick={() => sendControl(
                      "interaction",
                      "setVisualMode",
                      "visual-mode",
                      snapshot.modules.interaction.visualMode === "firework" ? "tree" : "firework"
                    )}
                  >
                    <Sparkles size={15} /> {snapshot.modules.interaction.visualMode === "firework" ? "Firework" : "Tree"}
                  </button>
                </div>
              </div>
            </section>

            <aside className={`interaction-rail interaction-rail--right ${rightRailOpen ? "open" : "collapsed"}`}>
              <div className="rail-shell">
                <div className="rail-header">
                  <div>
                    <p>{ui.layout.routes}</p>
                    <strong>{rightRailOpen ? ui.layout.collapse : ui.layout.expand}</strong>
                  </div>
                  <button
                    type="button"
                    className="rail-toggle"
                    aria-expanded={rightRailOpen}
                    aria-label={rightRailOpen ? ui.layout.collapse : ui.layout.expand}
                    onClick={() => setRightRailOpen((value) => !value)}
                  >
                    {rightRailOpen ? "›" : "‹"}
                  </button>
                </div>

                {rightRailOpen ? (
                  <div className="route-table route-table--rail">
                  {routeScreenIds.map((screenId) => {
                      const route = screenRoutes[screenId];
                      return (
                        <article key={screenId}>
                          <div>
                            <strong>{screenId}</strong>
                            <span>{route?.url || "Route URL unavailable"}</span>
                            <small>{route?.updatedAt ? `updated ${new Date(route.updatedAt).toLocaleTimeString()}` : "waiting for route"}</small>
                          </div>
                          <div className="owner-switch" aria-label={`${screenId} owner`}>
                            {screenOwners.map((owner) => (
                              <button
                                key={owner.value}
                                type="button"
                                className={route?.owner === owner.value ? `selected owner-${owner.value}` : ""}
                                onClick={() => sendControl("interaction", "setScreenOwner", screenId, owner.value)}
                              >
                                {ui.screenOwners[owner.value]}
                              </button>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rail-collapsed-note">
                    <span>{ui.layout.routes}</span>
                  </div>
                )}
              </div>
            </aside>

            <section className={`interaction-logs ${logsOpen ? "open" : "collapsed"}`}>
              <div className="logs-head">
                <div>
                  <p>{ui.layout.logs}</p>
                  <strong>{snapshot.eventLog.length} · {clients.length}</strong>
                </div>
                <button
                  type="button"
                  className="rail-toggle"
                  aria-expanded={logsOpen}
                  aria-label={logsOpen ? ui.layout.collapse : ui.layout.expand}
                  onClick={() => setLogsOpen((value) => !value)}
                >
                  {logsOpen ? "▾" : "▴"}
                </button>
              </div>

              {logsOpen && (
                <div className="logs-grid">
                  <Panel title={ui.interaction.eventLog} icon={<ListChecks size={18} />} compact>
                    <div className="event-list">
                      {snapshot.eventLog.slice(0, 8).map((event) => (
                        <article key={event.id}>
                          <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                          <strong>{event.type}</strong>
                          <p>{event.message}</p>
                        </article>
                      ))}
                    </div>
                  </Panel>

                  <Panel title={ui.interaction.clients} icon={<Database size={18} />} compact>
                    <div className="client-list">
                      {clients.length === 0 && <p className="empty">{locale === "zh" ? "尚未有模块客户端宣布在线。" : "No module clients have announced presence."}</p>}
                      {clients.map((client) => (
                        <article key={client.id}>
                          <strong>{client.id}</strong>
                          <span>{client.module} · {client.role}</span>
                          <small>{new Date(client.lastSeen).toLocaleTimeString()}</small>
                        </article>
                      ))}
                    </div>
                  </Panel>
                </div>
              )}
            </section>
          </section>
        ) : activeTab === "visual" ? (
          <section className="workspace-grid workspace-grid--module">
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
                <div>
                  <span>{ui.visual.drive}</span>
                  <strong>{snapshot.modules.visual.audioDriveMode}</strong>
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
                    className={snapshot.modules.visual.scene === scene ? "selected" : ""}
                    onClick={() => sendControl("visual", "setScene", "visual-main", scene)}
                  >
                    {scene}
                  </button>
                ))}
                <button
                  type="button"
                  className={snapshot.modules.visual.fullscreen ? "selected" : ""}
                  onClick={() => sendControl("visual", "setFullscreen", "visual-fullscreen", !snapshot.modules.visual.fullscreen)}
                >
                  {ui.visual.fullscreen}
                </button>
              </div>

              <form className="inline-form" onSubmit={(event) => {
                event.preventDefault();
                void sendControl("visual", "setText", "visual-text", manualText);
              }}>
                <Type size={16} />
                <input value={manualText} onChange={(event) => setManualText(event.target.value)} />
                <button type="submit"><Send size={15} /> {ui.actions.send}</button>
              </form>
            </Panel>

            <div className="support-stack">
              <Panel title={ui.visual.memories} icon={<Sparkles size={18} />} compact>
                <div className="client-list">
                  {snapshot.modules.visual.visualMemories.length === 0 && (
                    <p className="empty">{locale === "zh" ? "暂无视觉记忆。" : "No visual memories yet."}</p>
                  )}
                  {snapshot.modules.visual.visualMemories.map((memory) => (
                    <article key={memory.id}>
                      <strong>{memory.name}</strong>
                      <span>{memory.scene}</span>
                      <small>{memory.id}</small>
                    </article>
                  ))}
                </div>
              </Panel>

              <Panel title={ui.interaction.eventLog} icon={<ListChecks size={18} />} compact>
                <div className="event-list">
                  {snapshot.eventLog.slice(0, 8).map((event) => (
                    <article key={event.id}>
                      <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                      <strong>{event.type}</strong>
                      <p>{event.message}</p>
                    </article>
                  ))}
                </div>
              </Panel>

              <Panel title={ui.interaction.clients} icon={<Database size={18} />} compact>
                <div className="client-list">
                  {clients.length === 0 && <p className="empty">{locale === "zh" ? "尚未有模块客户端宣布在线。" : "No module clients have announced presence."}</p>}
                  {clients.map((client) => (
                    <article key={client.id}>
                      <strong>{client.id}</strong>
                      <span>{client.module} · {client.role}</span>
                      <small>{new Date(client.lastSeen).toLocaleTimeString()}</small>
                    </article>
                  ))}
                </div>
              </Panel>
            </div>
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
                    <button type="button" onClick={() => sendControl("audio", "setMute", source.sourceId, !source.muted)}>
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
                    className={snapshot.modules.audio.activePreset === preset ? "selected" : ""}
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

              <Panel title={ui.interaction.eventLog} icon={<ListChecks size={18} />} compact>
                <div className="event-list">
                  {snapshot.eventLog.slice(0, 8).map((event) => (
                    <article key={event.id}>
                      <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                      <strong>{event.type}</strong>
                      <p>{event.message}</p>
                    </article>
                  ))}
                </div>
              </Panel>

              <Panel title={ui.interaction.clients} icon={<Database size={18} />} compact>
                <div className="client-list">
                  {clients.length === 0 && <p className="empty">{locale === "zh" ? "尚未有模块客户端宣布在线。" : "No module clients have announced presence."}</p>}
                  {clients.map((client) => (
                    <article key={client.id}>
                      <strong>{client.id}</strong>
                      <span>{client.module} · {client.role}</span>
                      <small>{new Date(client.lastSeen).toLocaleTimeString()}</small>
                    </article>
                  ))}
                </div>
              </Panel>
            </div>
          </section>
        )}
      </section>
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
  children
}: {
  id?: string;
  title: string;
  icon: React.ReactNode;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={compact ? "panel compact" : "panel"}>
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

function applyStatePatch(state: PerformanceState, message: Extract<ServerMessage, { type: "state.patch" }>): PerformanceState {
  return {
    ...state,
    updatedAt: message.updatedAt || Date.now(),
    modules: {
      ...state.modules,
      [message.module]: mergePatch(state.modules[message.module], message.patch)
    }
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
