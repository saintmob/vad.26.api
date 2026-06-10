import { useEffect, useState } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import type { PerformanceState, ControlCommand } from "../../types";
import type { UiCopy } from "../data/i18n";
import { screenRoutePresets } from "../data/constants";

type EngineTab = "tree" | "firework" | "fish";

interface RoutePanelProps {
  interaction: PerformanceState["modules"]["interaction"];
  screenPresentation: PerformanceState["modules"]["interaction"]["screenPresentation"];
  fireworkState: string;
  baofaFishState: string;
  modeLabels: Record<string, string>;
  fireworkLabels: { standby: string; launching: string; resetting: string };
  ui: UiCopy;
  sendControl: (module: ControlCommand["module"], command: string, target: string, value?: unknown) => Promise<void>;
  onTriggerMode: (mode: string) => void;
  onClearSequence: () => void;
  onOpenComposer: () => void;
  onDeleteArrangement: (presetId: string) => void;
}

export function RoutePanel({
  interaction,
  screenPresentation,
  fireworkState,
  baofaFishState,
  modeLabels,
  fireworkLabels,
  ui,
  sendControl,
  onTriggerMode,
  onClearSequence,
  onOpenComposer,
  onDeleteArrangement
}: RoutePanelProps) {
  const customPresets = interaction.customScreenRoutePresets || [];
  const presetLabel = (value: string) =>
    ui.screenRoutePresets[value as keyof UiCopy["screenRoutePresets"]] || value;

  const fishStates = [
    { value: "idle", label: ui.interaction.fishIdle },
    { value: "running", label: ui.interaction.fishRun },
    { value: "roam", label: ui.interaction.fishRoam }
  ];
  const [activeEngineTab, setActiveEngineTab] = useState<EngineTab>(interaction.visualMode);

  useEffect(() => {
    setActiveEngineTab(interaction.visualMode);
  }, [interaction.visualMode]);

  const handleEngineTabChange = (tab: EngineTab) => {
    setActiveEngineTab(tab);
    if (tab !== "fish") {
      sendControl("interaction", "setVisualMode", "visual-mode", tab);
    }
  };

  const resetEngines = () => {
    onClearSequence();
    setActiveEngineTab("tree");
    sendControl("interaction", "resetTree", "engine-reset", true);
    sendControl("interaction", "setBaofaFishState", "baofa-fish", "idle");
  };

  return (
    <div className="module module-route">
      <div className="module-head">
        <h2 className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-(--color-route)" />
          {ui.layout.stage}
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[10px] gap-1"
          onClick={onOpenComposer}
        >
          <Plus className="h-3 w-3" /> {ui.actions.newArrangement}
        </Button>
      </div>
      <div className="controls">

        <section className="control-section">
          <div className="label"><span>{ui.interaction.routePreset}</span></div>
          <div className="btn-grid three">
            {screenRoutePresets.map((preset) => (
              <Button
                key={preset.value}
                size="sm"
                variant={interaction.screenRoutePreset === preset.value ? "stage" : "outline"}
                className="h-9 text-[12px] font-semibold"
                onClick={() => sendControl("interaction", "setScreenRoutePreset", "screen-routes", preset.value)}
              >
                {presetLabel(preset.value)}
              </Button>
            ))}
          </div>
          {customPresets.length > 0 && (
            <div className="btn-grid two">
              {customPresets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-1 min-w-0">
                  <Button
                    size="sm"
                    variant={interaction.screenRoutePreset === preset.id ? "stage" : "outline"}
                    className="h-8 text-[11px] flex-1 min-w-0 justify-start"
                    title={preset.name}
                    onClick={() => sendControl("interaction", "setScreenRoutePreset", "screen-routes", preset.id)}
                  >
                    <span className="truncate">{preset.name}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                    title={ui.actions.delete}
                    onClick={() => onDeleteArrangement(preset.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="control-section">
          <div className="label engine-label">
            <span>{ui.interaction.engine}</span>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] gap-1 text-(--destructive) border-(--destructive)/40 hover:bg-(--destructive)/10"
              onClick={resetEngines}
            >
              <RotateCcw className="h-3 w-3" />
              {ui.actions.reset}
            </Button>
          </div>
          <div className="sub-panel engine-panel">
            <div className="engine-tabs" role="tablist" aria-label={ui.interaction.engine}>
              <button
                type="button"
                role="tab"
                aria-selected={activeEngineTab === "tree"}
                className={`engine-tab ${activeEngineTab === "tree" ? "active" : ""}`}
                onClick={() => handleEngineTabChange("tree")}
              >
                {ui.interaction.engineTree}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeEngineTab === "firework"}
                className={`engine-tab ${activeEngineTab === "firework" ? "active" : ""}`}
                onClick={() => handleEngineTabChange("firework")}
              >
                {ui.interaction.engineFirework}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeEngineTab === "fish"}
                className={`engine-tab ${activeEngineTab === "fish" ? "active" : ""}`}
                onClick={() => handleEngineTabChange("fish")}
              >
                {ui.interaction.fish}
              </button>
            </div>

            <div className="engine-content" role="tabpanel">
              {activeEngineTab === "tree" && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["idle", "flow", "interaction", "climax"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`scene-tag ${interaction.mode === mode ? "active" : ""}`}
                      onClick={() => onTriggerMode(mode)}
                    >
                      {modeLabels[mode]}
                    </button>
                  ))}
                </div>
              )}

              {activeEngineTab === "firework" && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {([
                    ["standby", fireworkLabels.standby],
                    ["launching", fireworkLabels.launching],
                    ["resetting", fireworkLabels.resetting]
                  ] as const).map(([state, label]) => (
                    <button
                      key={state}
                      type="button"
                      className={`scene-tag ${fireworkState === state ? "active" : ""}`}
                      onClick={() => sendControl("interaction", "setFireworkState", "firework-state", state)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {activeEngineTab === "fish" && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {fishStates.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      className={`scene-tag ${baofaFishState === value ? "active" : ""}`}
                      onClick={() => sendControl("interaction", "setBaofaFishState", "baofa-fish", value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <Separator className="my-0.5" />

        <section className="control-section">
          <div className="label"><span>{ui.interaction.presentation}</span></div>
          <div className="btn-grid three">
            <Button
              size="sm"
              variant={screenPresentation.showMenu ? "default" : "outline"}
              className="h-7 text-[10px]"
              onClick={() => sendControl("interaction", "setScreenMenuVisible", "screen-menu", !screenPresentation.showMenu)}
            >
              {ui.interaction.showMenu}
            </Button>
            <Button
              size="sm"
              variant={screenPresentation.showDebug ? "default" : "outline"}
              className="h-7 text-[10px]"
              onClick={() => sendControl("interaction", "setScreenDebugVisible", "screen-debug", !screenPresentation.showDebug)}
            >
              {ui.interaction.showDebug}
            </Button>
            <Button
              size="sm"
              variant={screenPresentation.cameraEnabled ? "default" : "outline"}
              className="h-7 text-[10px]"
              onClick={() => sendControl("interaction", "setScreenCameraEnabled", "screen-camera", !screenPresentation.cameraEnabled)}
            >
              {ui.interaction.camera}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
