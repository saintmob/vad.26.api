import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { TooltipProvider } from "./components/ui/tooltip";
import { ToastProvider, useToast } from "./components/ui/toast";
import {
  apiUrl, fetchInitialState, useWebSocket,
  isStateSnapshot, isStatePatch, isShowPatch,
  isControlAck, isErrorMessage, applyStatePatch, applyShowPatch,
  type ConnectionState, type ServerMessage
} from "./useShowState";

import { createIdFragment } from "./id";
import { TopStrip } from "./components/TopStrip";
import { PlaybackPanel } from "./components/PlaybackPanel";
import { RoutePanel } from "./components/RoutePanel";
import { StatusBar } from "./components/StatusBar";
import { StageMap } from "./components/StageMap";
import { SettingsDialog } from "./components/SettingsDialog";
import { RouteComposerDialog } from "./components/RouteComposerDialog";
import { ScreenGateway } from "./components/ScreenGateway";
import type { PerformanceState, ControlCommand, ScreenOwner } from "../types";
import type { SequenceStep, ScreenSelectionMode } from "./data/constants";
import type { UiCopy, UiLanguage, ThemeMode, LanguageMode, SyncStatus } from "./data/i18n";
import {
  CLIENT_ONLINE_STALE_MS, MIN_PENDING_ACTION_MS,
  storageKeys
} from "./data/constants";
import { uiCopy } from "./data/i18n";
import {
  screenLayoutOrder
} from "./data/screenLayout";
import {
  normalizeScreenOccupancyId, inferScreenOccupancyId, isLiveClient, makeActionKey,
  stepDurationMs, wait, resolveBrowserLanguage,
  getScreenIdFromPath
} from "./lib/helpers";
import type { DragBox } from "./lib/helpers";

type RouteDraftEntry = { owner: ScreenOwner; scene: string };
type SequenceGroup = { order: number; screenIds: string[] };

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env || {};
const defaultControlToken = env.VITE_CONTROL_TOKEN || "";
const dashboardCapabilities = ["state.read", "control.command", "dashboard"];

function readStoredValue<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  return v ? (v as T) : fallback;
}

function createRouteDraft(snapshot: PerformanceState): Record<string, RouteDraftEntry> {
  const screensById = new Map((snapshot.modules.visual.visualScreens || []).map((s) => [s.id, s]));
  return Object.fromEntries(screenLayoutOrder.map((id) => {
    const route = snapshot.modules.interaction.screenRoutes?.[id];
    const vs = screensById.get(id);
    return [id, { owner: route?.owner || "baofa" as ScreenOwner, scene: vs?.scene || "Video Flow" }];
  }));
}

function Root() {
  const screenId = getScreenIdFromPath();
  if (screenId) return <ScreenGateway screenId={screenId} />;
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}

function App() {
  const { toast } = useToast();
  const [snapshot, setSnapshot] = useState<PerformanceState | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [token, setToken] = useState(() => readStoredValue(storageKeys.token, defaultControlToken));
  const [lastAck, setLastAck] = useState("Waiting for control activity");
  const [screenSelectionMode, setScreenSelectionMode] = useState<ScreenSelectionMode>("solid");
  const [sequenceStep, setSequenceStep] = useState<SequenceStep>("1/4");
  const [sequenceGroups, setSequenceGroups] = useState<SequenceGroup[]>([]);
  const [dragBox, setDragBox] = useState<DragBox | null>(null);
  const [routeComposerOpen, setRouteComposerOpen] = useState(false);
  const [routeComposerName, setRouteComposerName] = useState("");
  const [routeDraft, setRouteDraft] = useState<Record<string, RouteDraftEntry>>({});
  const [selectedComposerScreenId, setSelectedComposerScreenId] = useState("A1");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredValue(storageKeys.theme, "system"));
  const [languageMode, setLanguageMode] = useState<LanguageMode>(() => readStoredValue(storageKeys.language, "system"));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [systemLanguage, setSystemLanguage] = useState<UiLanguage>(() => resolveBrowserLanguage());
  const [pendingActions, setPendingActions] = useState<Set<string>>(() => new Set());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [statusNow, setStatusNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setStatusNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { window.localStorage.setItem(storageKeys.token, token); }, [token]);
  useEffect(() => { window.localStorage.setItem(storageKeys.theme, themeMode); }, [themeMode]);
  useEffect(() => { window.localStorage.setItem(storageKeys.language, languageMode); }, [languageMode]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSettingsOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [settingsOpen]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = (e: MediaQueryListEvent | MediaQueryList) => setPrefersDark("matches" in e ? e.matches : media.matches);
    update(media);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    const update = () => setSystemLanguage(resolveBrowserLanguage());
    update();
    window.addEventListener("languagechange", update);
    return () => window.removeEventListener("languagechange", update);
  }, []);

  const locale: UiLanguage = languageMode === "system" ? systemLanguage : languageMode;
  const theme = themeMode === "system" ? (prefersDark ? "dark" : "light") : themeMode;
  const ui = uiCopy[locale];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.locale = locale;
    document.body.dataset.theme = theme;
    document.body.dataset.locale = locale;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.documentElement.style.colorScheme = theme;
  }, [locale, theme]);

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    if (isStateSnapshot(msg)) setSnapshot(msg.state);
    if (isStatePatch(msg)) {
      setSnapshot((cur) => msg.state || (cur ? applyStatePatch(cur, msg) : cur));
    }
    if (isShowPatch(msg)) {
      setSnapshot((cur) => cur ? applyShowPatch(cur, msg) : cur);
    }
    if (isControlAck(msg)) setLastAck(`${msg.command.command} accepted for ${msg.command.target}`);
    if (isErrorMessage(msg)) setLastAck(msg.error);
  }, []);

  useWebSocket("dashboard-main", dashboardCapabilities, handleServerMessage, setConnection);

  useEffect(() => {
    let closed = false;
    fetchInitialState()
      .then((state) => {
        if (closed) return;
        setSnapshot(state);
        if (!tokenRef.current.trim()) setLastAck("Control token is required for write actions");
      })
      .catch(() => {
        if (!closed) setConnection("offline");
      });
    return () => { closed = true; };
  }, []);

  const postJson = useCallback(async <T,>(url: string, body: unknown): Promise<T> => {
    if (!token.trim()) throw new Error("Control token is required");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) headers["x-control-token"] = token;
    const res = await fetch(apiUrl(url), { method: "POST", headers, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `Request failed: ${res.status}`);
    return json as T;
  }, [token]);

  const sendControl = useCallback(async (
    module: ControlCommand["module"],
    command: string,
    target: string,
    value?: unknown
  ) => {
    const key = makeActionKey(module, command, target);
    const startedAt = Date.now();
    setPendingActions((cur) => new Set(cur).add(key));
    setSyncStatus("sending");
    try {
      const payload: Omit<ControlCommand, "timestamp"> = {
        type: "control.command",
        id: `dashboard-${createIdFragment()}`,
        module, target, command, value,
        issuedBy: "dashboard-main"
      };
      const result = await postJson<{ state: PerformanceState; command: ControlCommand }>("/api/control", payload);
      setSnapshot(result.state);
      setLastAck(`${result.command.command} accepted for ${result.command.target}`);
      setLastSyncedAt(Date.now());
      setSyncStatus("synced");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLastAck(message);
      setSyncStatus("error");
      toast({ title: `${command} → ${target}`, description: message, variant: "error" });
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_PENDING_ACTION_MS) await wait(MIN_PENDING_ACTION_MS - elapsed);
      setPendingActions((cur) => { const n = new Set(cur); n.delete(key); return n; });
    }
  }, [postJson, toast]);

  const saveSnapshot = useCallback(async () => {
    setSyncStatus("sending");
    try {
      const r = await postJson<{ state: PerformanceState }>("/api/show/snapshot", {});
      setSnapshot(r.state);
      setLastAck("Snapshot saved");
      setLastSyncedAt(Date.now());
      setSyncStatus("synced");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLastAck(message);
      setSyncStatus("error");
      toast({ title: "Snapshot", description: message, variant: "error" });
    }
  }, [postJson, toast]);

  const sequenceOrderByScreen = useMemo(() => {
    const m = new Map<string, number>();
    sequenceGroups.forEach((g) => g.screenIds.forEach((id) => m.set(id, g.order)));
    return m;
  }, [sequenceGroups]);

  const addSequenceGroup = useCallback((screenIds: string[]) => {
    const ids = Array.from(new Set(screenIds.filter((id) => screenLayoutOrder.includes(id))));
    if (!ids.length) return;
    setSequenceGroups((cur) => {
      const used = new Set(cur.flatMap((g) => g.screenIds));
      const next = ids.filter((id) => !used.has(id));
      return next.length ? [...cur, { order: cur.length + 1, screenIds: next }] : cur;
    });
  }, []);

  const clearSequence = useCallback(() => {
    setSequenceGroups([]);
    setDragBox(null);
  }, []);

  const openRouteComposer = useCallback(() => {
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

  const closeRouteComposer = useCallback(() => {
    setRouteComposerOpen(false);
    setDragBox(null);
  }, []);

  const setDraftScreenOwner = useCallback((screenId: string, owner: ScreenOwner) => {
    setRouteDraft((cur) => ({
      ...cur,
      [screenId]: { owner, scene: cur[screenId]?.scene || "Video Flow" }
    }));
  }, []);

  const setDraftScreenScene = useCallback((screenId: string, scene: string) => {
    setRouteDraft((cur) => ({
      ...cur,
      [screenId]: { owner: "vj" as ScreenOwner, scene }
    }));
  }, []);

  const saveRouteArrangement = useCallback(() => {
    const routes: Record<string, ScreenOwner> = {};
    const vjScenes: Record<string, string> = {};
    for (const id of screenLayoutOrder) {
      const e = routeDraft[id] || { owner: "baofa" as ScreenOwner, scene: "Video Flow" };
      routes[id] = e.owner;
      if (e.owner === "vj") vjScenes[id] = e.scene;
    }
    sendControl("interaction", "saveScreenRouteArrangement", "custom-route", {
      name: routeComposerName.trim() || (locale === "zh" ? "自定义编排" : "Custom arrangement"),
      routes, vjScenes
    });
    setRouteComposerOpen(false);
  }, [locale, routeComposerName, routeDraft, sendControl]);

  const deleteRouteArrangement = useCallback((presetId: string) => {
    sendControl("interaction", "deleteScreenRouteArrangement", presetId, presetId);
  }, [sendControl]);

  const handleScreenSelect = useCallback((screenId: string) => {
    if (routeComposerOpen) {
      setSelectedComposerScreenId(screenId);
      return;
    }
    if (screenSelectionMode === "solid") {
      clearSequence();
      const occupiedClientId = snapshot
        ? Object.values(snapshot.clients).find((c) =>
            c.module === "interaction" &&
            isLiveClient(c, statusNow, CLIENT_ONLINE_STALE_MS) &&
            normalizeScreenOccupancyId(c.screenId) === normalizeScreenOccupancyId(screenId)
          )?.id
        : null;
      sendControl("interaction", "setScreen", occupiedClientId || screenId, screenId);
      return;
    }
    if (screenSelectionMode === "dashed") {
      addSequenceGroup([screenId]);
    }
  }, [addSequenceGroup, clearSequence, routeComposerOpen, screenSelectionMode, sendControl, snapshot, statusNow]);

  const triggerInteractionMode = useCallback(async (mode: string) => {
    if (sequenceGroups.length === 0) {
      await sendControl("interaction", "setMode", "interaction-mode", mode);
      return;
    }
    const groups = [...sequenceGroups].sort((a, b) => a.order - b.order);
    const delay = stepDurationMs(sequenceStep, snapshot?.show.bpm || 120);
    for (const g of groups) {
      await Promise.all(g.screenIds.map((id) => sendControl("interaction", "setMode", id, mode)));
      if (groups.length > 1) await wait(delay);
    }
  }, [sendControl, sequenceGroups, sequenceStep, snapshot?.show.bpm]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (settingsOpen || routeComposerOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (!snapshot) break;
          if (snapshot.show.status === "running") sendControl("show", "pause", snapshot.show.id);
          else sendControl("show", "play", snapshot.show.id);
          break;
        case "s":
        case "S":
          e.preventDefault();
          if (snapshot) sendControl("show", "stop", snapshot.show.id);
          break;
        case "1":
          setScreenSelectionMode("solid");
          break;
        case "2":
          setScreenSelectionMode("dashed");
          break;
        case "3":
          setScreenSelectionMode("box");
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sendControl, snapshot, settingsOpen, routeComposerOpen, setScreenSelectionMode]);

  if (!snapshot) {
    return (
      <main className="loading-screen" data-theme={theme} data-locale={locale}>
        <div className="flex flex-col items-center gap-4">
          <div className="mark" style={{ width: 40, height: 40, fontSize: 18, borderRadius: 10 }}>V</div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-semibold text-foreground/80">{locale === "zh" ? "VAD 总控台" : "VAD Control Deck"}</span>
            <span className="text-[10px] opacity-50">{locale === "zh" ? "正在连接..." : "Connecting..."}</span>
          </div>
        </div>
      </main>
    );
  }

  const show = snapshot.show;
  const clients = Object.values(snapshot.clients);
  const liveClients = clients.filter((c) => isLiveClient(c, statusNow, CLIENT_ONLINE_STALE_MS));
  const liveDeviceClients = liveClients.filter((c) => c.module !== "dashboard");
  const routeClientsByScreenId = new Map<string, PerformanceState["clients"][string][]>();
  for (const c of liveDeviceClients) {
    const sid = normalizeScreenOccupancyId(c.screenId) || inferScreenOccupancyId(c.id);
    if (!sid) continue;
    const cur = routeClientsByScreenId.get(sid) || [];
    cur.push(c);
    routeClientsByScreenId.set(sid, cur);
  }

  const screenRoutes = snapshot.modules.interaction.screenRoutes || {};
  const screenPresentation = snapshot.modules.interaction.screenPresentation || {
    autoRedirect: true, cameraEnabled: false, showDebug: false, showMenu: false
  };
  const fireworkState = snapshot.modules.interaction.fireworkState || "standby";
  const baofaFishState = snapshot.modules.interaction.baofaFishState || "idle";
  const clientCount = liveDeviceClients.length;
  const showStatusLabel = ui.show[show.status];
  const effectiveSyncStatus: SyncStatus = pendingActions.size > 0 ? "sending" : syncStatus;
  const syncLabel = effectiveSyncStatus === "sending"
    ? (locale === "zh" ? `同步中 ${pendingActions.size}` : `Syncing ${pendingActions.size}`)
    : effectiveSyncStatus === "error"
      ? (locale === "zh" ? "同步失败" : "Sync error")
      : lastSyncedAt
        ? (locale === "zh" ? `已同步 ${new Date(lastSyncedAt).toLocaleTimeString()}` : `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}`)
        : (locale === "zh" ? "待同步" : "Idle");

  const selectedScreenIds = sequenceGroups.length > 0
    ? Array.from(new Set(sequenceGroups.flatMap((g) => g.screenIds)))
    : [snapshot.modules.interaction.screenId];

  const moduleOnline = {
    audio: liveDeviceClients.some((c) => c.module === "audio"),
    visual: liveDeviceClients.some((c) => c.module === "visual"),
    interaction: liveDeviceClients.some((c) => c.module === "interaction")
  };

  return (
    <TooltipProvider>
      <main className="shell" data-theme={theme} data-locale={locale}>
        <TopStrip
          connection={connection}
          showStatusLabel={showStatusLabel}
          showId={show.id}
          ui={ui}
          moduleOnline={moduleOnline}
          syncStatus={effectiveSyncStatus}
          syncLabel={syncLabel}
          clientCount={clientCount}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <section className="workspace" aria-label="Control workspace">
          <StageMap
            screenRoutes={screenRoutes}
            routeClientsByScreenId={routeClientsByScreenId}
            screenSelectionMode={screenSelectionMode}
            selectedScreenId={snapshot.modules.interaction.screenId}
            selectedScreenIds={selectedScreenIds}
            sequenceOrderByScreen={sequenceOrderByScreen}
            sequenceGroupCount={sequenceGroups.length}
            sequenceStep={sequenceStep}
            pendingActions={pendingActions}
            dragBox={dragBox}
            ui={ui}
            onScreenSelect={handleScreenSelect}
            onSelectionModeChange={setScreenSelectionMode}
            onClearSequence={clearSequence}
            onSequenceStepChange={setSequenceStep}
            onDragBoxChange={setDragBox}
            onAddSequence={addSequenceGroup}
            sendControl={sendControl}
          />

          <div className="col-right">
            <PlaybackPanel
              sendControl={sendControl}
              showId={show.id}
              showStatus={show.status}
              bpm={snapshot.modules.audio.bpm}
              currentScene={snapshot.modules.visual.scene}
              locale={locale}
              ui={ui}
            />
            <RoutePanel
              interaction={snapshot.modules.interaction}
              screenPresentation={screenPresentation}
              fireworkState={fireworkState}
              baofaFishState={baofaFishState}
              modeLabels={ui.interactionModes}
              fireworkLabels={ui.fireworkStates}
              ui={ui}
              sendControl={sendControl}
              onTriggerMode={triggerInteractionMode}
              onClearSequence={clearSequence}
              onOpenComposer={openRouteComposer}
              onDeleteArrangement={deleteRouteArrangement}
            />
          </div>
        </section>

        <StatusBar
          lastAck={lastAck}
          syncStatus={effectiveSyncStatus}
          locale={locale}
          ui={ui}
        />
      </main>

      <RouteComposerDialog
        open={routeComposerOpen}
        name={routeComposerName}
        draft={routeDraft}
        selectedScreenId={selectedComposerScreenId}
        ui={ui}
        locale={locale}
        onOpenChange={(open) => { if (!open) closeRouteComposer(); }}
        onNameChange={setRouteComposerName}
        onSelectScreen={setSelectedComposerScreenId}
        onOwnerChange={setDraftScreenOwner}
        onSceneChange={setDraftScreenScene}
        onSave={saveRouteArrangement}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        themeMode={themeMode}
        languageMode={languageMode}
        token={token}
        screenPresentation={screenPresentation}
        ui={ui}
        locale={locale}
        onThemeChange={setThemeMode}
        onLanguageChange={setLanguageMode}
        onTokenChange={setToken}
        onAutoRedirectToggle={() => sendControl("interaction", "setScreenAutoRedirect", "screen-routing", !screenPresentation.autoRedirect)}
        onSaveSnapshot={saveSnapshot}
      />
    </TooltipProvider>
  );
}

export default App;
