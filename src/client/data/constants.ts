import type { ModuleName, ScreenOwner, ScreenRoutePreset } from "../../types";

export type ScreenSelectionMode = "solid" | "dashed" | "box";
export type SequenceStep = "1/16" | "1/8" | "1/4" | "1/2" | "1";
export type DashboardTab = "interaction" | "visual" | "audio";

export const CLIENT_ONLINE_STALE_MS = 120_000;
export const MIN_PENDING_ACTION_MS = 180;

export const storageKeys = {
  token: "vad-control-token",
  theme: "vad-theme-mode",
  language: "vad-language-mode"
} as const;

export const moduleLabels: Record<ModuleName, { label: string; accent: string }> = {
  audio: { label: "Audio", accent: "var(--audio)" },
  visual: { label: "Visual", accent: "var(--visual)" },
  interaction: { label: "Interaction", accent: "var(--interaction)" }
};

export const tabDefinitions: Array<{ key: DashboardTab; module: ModuleName; label: string; accent: string }> = [
  { key: "interaction", module: "interaction", label: "Multi-screen", accent: "var(--interaction)" },
  { key: "visual", module: "visual", label: "VJ", accent: "var(--visual)" },
  { key: "audio", module: "audio", label: "DJ", accent: "var(--audio)" }
];

export const interactionModes = ["idle", "interaction", "flow", "climax"] as const;

export const visualScenes = [
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

export const visualTextStyles = ["Cinematic", "Massive", "Glitch", "Hologram", "Floating", "Beat"] as const;
export const visualAudioDrives = ["mic", "music", "api"] as const;

export const audioStyles = [
  { id: "default", label: "Clean" },
  { id: "club", label: "Club" },
  { id: "techno", label: "Techno" },
  { id: "synthwave", label: "Synthwave" },
  { id: "trap", label: "Trap 808" },
  { id: "chiptune", label: "Chiptune" },
  { id: "piano", label: "Piano" },
  { id: "experimental", label: "Experimental" }
];

export const screenSelectionModes: Array<{ id: ScreenSelectionMode; label: string }> = [
  { id: "solid", label: "Solid Select" },
  { id: "dashed", label: "Sequence Select" },
  { id: "box", label: "Box Select" }
];

export const sequenceSteps: SequenceStep[] = ["1/16", "1/8", "1/4", "1/2", "1"];

export const bpmOptions = [90, 110, 120, 130, 140, 160];

export const screenRoutePresets: Array<{ value: ScreenRoutePreset; label: string }> = [
  { value: "balanced", label: "Balanced" },
  { value: "vj_takeover", label: "All VJ" },
  { value: "baofa_takeover", label: "All Baofa" }
];

export const screenOwners: Array<{ value: ScreenOwner; label: string }> = [
  { value: "vj", label: "VJ" },
  { value: "baofa", label: "Baofa" },
  { value: "off", label: "Off" },
  { value: "diagnostic", label: "Diag" }
];
