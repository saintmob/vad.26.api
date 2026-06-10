import { Plus, X } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import type { PerformanceState, ControlCommand } from "../../types";
import type { UiCopy } from "../data/i18n";
import { screenRoutePresets } from "../data/constants";

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
          <div className="label"><span>{ui.interaction.engine}</span></div>
          <div className="flex items-center gap-1.5 flex-wrap px-1">
            <button
              type="button"
              className={`scene-tag ${interaction.visualMode === "tree" ? "active" : ""}`}
              onClick={() => sendControl("interaction", "setVisualMode", "visual-mode", "tree")}
            >
              {ui.interaction.engineTree}
            </button>
            <button
              type="button"
              className={`scene-tag ${interaction.visualMode === "firework" ? "active" : ""}`}
              onClick={() => sendControl("interaction", "setVisualMode", "visual-mode", "firework")}
            >
              {ui.interaction.engineFirework}
            </button>
          </div>
          <div className="sub-panel">
            {interaction.visualMode === "tree" ? (
              <>
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
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] w-full"
                  onClick={() => { onClearSequence(); sendControl("interaction", "resetTree", "tree-reset", true); }}
                >
                  {ui.actions.resetTree}
                </Button>
              </>
            ) : (
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
          </div>
        </section>

        <section className="control-section">
          <div className="label"><span>{ui.interaction.fish}</span></div>
          <div className="flex items-center gap-1.5 flex-wrap px-1">
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
