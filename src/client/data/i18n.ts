import type { ConnectionState } from "../useShowState";
import type { ScreenSelectionMode, SequenceStep, DashboardTab } from "./constants";

export type ThemeMode = "system" | "light" | "dark";
export type LanguageMode = "system" | "zh" | "en";
export type UiLanguage = "zh" | "en";
export type SyncStatus = "idle" | "sending" | "synced" | "error";
export type ScreenOwner = "vj" | "baofa" | "off" | "diagnostic";
export type ScreenRoutePreset = string;

export interface UiCopy {
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
  status: Record<ConnectionState | "waiting", string>;
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
    cancel: string;
    delete: string;
    newArrangement: string;
    shuffle: string;
    confirmReset: string;
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
    arrangements: string;
    arrangementName: string;
    engine: string;
    engineTree: string;
    engineFirework: string;
    fish: string;
    fishIdle: string;
    fishRun: string;
    fishRoam: string;
    camera: string;
  };
  modulePorts: Record<"audio" | "visual" | "interaction", string>;
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
  screenRoutePresets: Record<"balanced" | "vj_takeover" | "baofa_takeover", string>;
  screenOwners: Record<ScreenOwner | "unset", string>;
  interactionModes: Record<string, string>;
  fireworkStates: Record<"standby" | "launching" | "resetting" | "status", string>;
}

export const uiCopy: Record<UiLanguage, UiCopy> = {
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
      unmute: "取消静音",
      cancel: "取消",
      delete: "删除",
      newArrangement: "新建编排",
      shuffle: "随机",
      confirmReset: "确认重置?"
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
      screenMap: "舞台",
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
      step: "步长",
      arrangements: "自定义编排",
      arrangementName: "编排名称",
      engine: "引擎",
      engineTree: "树",
      engineFirework: "烟花",
      fish: "鱼群",
      fishIdle: "待机",
      fishRun: "奔跑",
      fishRoam: "漫游",
      camera: "摄像头交互"
    },
    modulePorts: {
      audio: "DJ",
      visual: "VJ",
      interaction: "多屏"
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
      unmute: "Unmute",
      cancel: "Cancel",
      delete: "Delete",
      newArrangement: "New arrangement",
      shuffle: "Shuffle",
      confirmReset: "Confirm reset?"
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
      screenMap: "Stage Topology",
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
      step: "Step",
      arrangements: "Arrangements",
      arrangementName: "Arrangement name",
      engine: "Engine",
      engineTree: "Tree",
      engineFirework: "Firework",
      fish: "Fish",
      fishIdle: "Idle",
      fishRun: "Run",
      fishRoam: "Roam",
      camera: "Camera"
    },
    modulePorts: {
      audio: "DJ",
      visual: "VJ",
      interaction: "Screens"
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
