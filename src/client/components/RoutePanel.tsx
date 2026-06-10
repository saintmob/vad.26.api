import { useEffect, useState } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import { Button } from "./ui/button";
import type { PerformanceState, ControlCommand } from "../../types";
import type { UiCopy } from "../data/i18n";
import { screenRoutePresets } from "../data/constants";

type EngineTab = "tree" | "firework";

interface RoutePanelProps {
  interaction: PerformanceState["modules"]["interaction"];
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
    sendControl("interaction", "setVisualMode", "visual-mode", tab);
  };

  const resetEngines = () => {
    onClearSequence();
    setActiveEngineTab("tree");
    sendControl("interaction", "resetTree", "engine-reset", true);
  };

  const treeIsStandby = interaction.mode === "idle" && interaction.treePhase === "idle" && interaction.treeGrowth <= 0;

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
              className="h-6 px-2 text-[10px] gap-1"
              onClick={resetEngines}
            >
              <RotateCcw className="h-3 w-3" />
              {ui.actions.reset}
            </Button>
          </div>
          <div className="engine-layout">
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
              </div>

              <div className="engine-content" role="tabpanel">
                {activeEngineTab === "tree" && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      className={`scene-tag ${treeIsStandby ? "active" : ""}`}
                      onClick={() => sendControl("interaction", "setTreeStandby", "tree-standby", true)}
                    >
                      {fireworkLabels.standby}
                    </button>
                    {["idle", "flow", "interaction", "climax"].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`scene-tag ${interaction.mode === mode && !(mode === "idle" && treeIsStandby) ? "active" : ""}`}
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
                      ["launching", fireworkLabels.launching]
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
            </div>

            <div className="sub-panel fish-panel">
              <div className="engine-tabs" aria-label={ui.interaction.fish}>
                <span className="engine-tab active is-static">{ui.interaction.fish}</span>
              </div>
              <div className="engine-content">
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
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
