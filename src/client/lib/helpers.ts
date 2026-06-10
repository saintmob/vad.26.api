import type { ScreenOwner } from "../../types";

export function normalizeScreenOccupancyId(value: string | null | undefined): string {
  if (!value) return "";
  return value === "MASTER" ? "A1" : value;
}

export function isLiveClient(client: { status: string; lastSeen?: number; connectedAt?: number }, now: number, staleMs: number): boolean {
  if (client.status !== "online") return false;
  const lastSeen = Number(client.lastSeen || client.connectedAt || 0);
  if (!lastSeen) return true;
  return now - lastSeen <= staleMs;
}

export function formatOwner(owner: unknown): string {
  if (owner === "vj") return "VJ";
  if (owner === "baofa") return "Baofa";
  if (owner === "off") return "Off";
  if (owner === "diagnostic") return "Diag";
  return "Unset";
}

export function formatMs(value: number): string {
  const minutes = Math.floor(value / 60000);
  const seconds = Math.floor((value % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function getScreenIdFromPath(): string {
  const match = window.location.pathname.match(/^\/screen\/([^/]+)\/?$/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]).trim().toUpperCase();
  } catch {
    return match[1].trim().toUpperCase();
  }
}

export function resolveBrowserLanguage(): "zh" | "en" {
  if (typeof navigator === "undefined") return "en";
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function isPublicRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return !isLocalRouteHostname(window.location.hostname);
}

export function isLocalRouteHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
  );
}

export function localizeScreenRouteTarget(url: string | null, owner: ScreenOwner | undefined): string | null {
  if (!url || (owner !== "vj" && owner !== "baofa")) return url;
  if (typeof window === "undefined" || !isLocalRouteHostname(window.location.hostname)) return url;
  const target = new URL(url, window.location.origin);
  target.protocol = window.location.protocol;
  target.hostname = window.location.hostname;
  target.port = owner === "vj" ? "4302" : "4303";
  return target.toString().replace(/\/$/, "");
}

export function normalizeScreenTopology(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  if (value.every((row) => Array.isArray(row))) {
    return value.map((row) => row.map((s) => String(s || "")));
  }
  if (value.every((s) => typeof s === "string")) {
    const screens = value.map((s) => s.trim()).filter(Boolean);
    const rows: string[][] = [];
    for (let i = 0; i < screens.length; i += 6) {
      rows.push(screens.slice(i, i + 6));
    }
    return rows;
  }
  return [];
}

export type DragBox = { startX: number; startY: number; currentX: number; currentY: number };

export function normalizeRect(box: DragBox) {
  return {
    left: Math.min(box.startX, box.currentX),
    right: Math.max(box.startX, box.currentX),
    top: Math.min(box.startY, box.currentY),
    bottom: Math.max(box.startY, box.currentY)
  };
}

export function rectsIntersect(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number }
) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

export function clampPoint(x: number, y: number, rect: DOMRect): DragBox {
  return {
    startX: Math.max(0, Math.min(rect.width, x)),
    startY: Math.max(0, Math.min(rect.height, y)),
    currentX: Math.max(0, Math.min(rect.width, x)),
    currentY: Math.max(0, Math.min(rect.height, y))
  };
}

export function dragBoxStyle(box: DragBox): React.CSSProperties {
  const r = normalizeRect(box);
  return { left: r.left, top: r.top, width: r.right - r.left, height: r.bottom - r.top };
}

export function makeActionKey(module: string, command: string, target: string): string {
  return `${module}:${command}:${target}`;
}

export function stepDurationMs(step: string, bpm: number): number {
  const beatMs = 60000 / Math.max(1, bpm);
  const multipliers: Record<string, number> = {
    "1/16": 0.25, "1/8": 0.5, "1/4": 1, "1/2": 2, "1": 4
  };
  return beatMs * (multipliers[step] ?? 1);
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
