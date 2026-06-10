import { Square, Grid3X3, Maximize, X } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { screenLayoutItems, getScreenLayoutStyle } from "../data/screenLayout";
import type { ScreenSelectionMode, SequenceStep } from "../data/constants";
import type { ScreenOwner } from "../../types";
import { screenSelectionModes, screenOwners, sequenceSteps } from "../data/constants";
import { makeActionKey, clampPoint, normalizeRect, rectsIntersect, dragBoxStyle } from "../lib/helpers";
import type { PerformanceState, ScreenRouteEntry } from "../../types";
import type { DragBox } from "../lib/helpers";
import { useRef, useCallback } from "react";
import type { UiCopy } from "../data/i18n";
import type { ControlCommand } from "../../types";

interface StageMapProps {
  screenRoutes: Record<string, ScreenRouteEntry>;
  routeClientsByScreenId: Map<string, PerformanceState["clients"][string][]>;
  screenSelectionMode: ScreenSelectionMode;
  selectedScreenId: string;
  selectedScreenIds: string[];
  sequenceOrderByScreen: Map<string, number>;
  sequenceGroupCount: number;
  sequenceStep: SequenceStep;
  pendingActions: Set<string>;
  dragBox: DragBox | null;
  ui: UiCopy;
  onScreenSelect: (screenId: string) => void;
  onSelectionModeChange: (mode: ScreenSelectionMode) => void;
  onClearSequence: () => void;
  onSequenceStepChange: (step: SequenceStep) => void;
  onDragBoxChange: (box: DragBox | null) => void;
  onAddSequence: (screenIds: string[]) => void;
  sendControl: (module: ControlCommand["module"], command: string, target: string, value?: unknown) => Promise<void>;
}

export function StageMap({
  screenRoutes,
  routeClientsByScreenId,
  screenSelectionMode,
  selectedScreenId,
  selectedScreenIds,
  sequenceOrderByScreen,
  sequenceGroupCount,
  sequenceStep,
  pendingActions,
  dragBox,
  ui,
  onScreenSelect,
  onSelectionModeChange,
  onClearSequence,
  onSequenceStepChange,
  onDragBoxChange,
  onAddSequence,
  sendControl
}: StageMapProps) {
  const screenGridRef = useRef<HTMLDivElement | null>(null);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (screenSelectionMode !== "box" || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onDragBoxChange(clampPoint(event.clientX - rect.left, event.clientY - rect.top, rect));
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [screenSelectionMode, onDragBoxChange]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragBox || screenSelectionMode !== "box") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = clampPoint(event.clientX - rect.left, event.clientY - rect.top, rect);
    onDragBoxChange({ ...dragBox, currentX: point.currentX, currentY: point.currentY });
  }, [dragBox, screenSelectionMode, onDragBoxChange]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragBox || screenSelectionMode !== "box" || !screenGridRef.current) return;
    const gridRect = screenGridRef.current.getBoundingClientRect();
    const selectionRect = normalizeRect(dragBox);
    const selectedIds = Array.from(screenGridRef.current.querySelectorAll<HTMLButtonElement>("[data-screen-id]"))
      .filter((btn) => {
        const r = btn.getBoundingClientRect();
        return rectsIntersect(selectionRect, {
          left: r.left - gridRect.left,
          right: r.right - gridRect.left,
          top: r.top - gridRect.top,
          bottom: r.bottom - gridRect.top
        });
      })
      .map((btn) => btn.dataset.screenId)
      .filter(Boolean) as string[];
    onAddSequence(selectedIds);
    onDragBoxChange(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, [dragBox, screenSelectionMode, onAddSequence, onDragBoxChange]);

  const handleOwnerChange = (owner: ScreenOwner) => {
    for (const id of selectedScreenIds) {
      sendControl("interaction", "setScreenOwner", id, owner);
    }
  };

  const selectedOwners = new Set(
    selectedScreenIds.map((id) => screenRoutes[id]?.owner).filter(Boolean)
  );
  const sharedOwner = selectedOwners.size === 1 ? Array.from(selectedOwners)[0] : null;

  return (
    <div className="module module-stage h-full">
      <div className="module-head">
        <h2 className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-(--color-stage)" />
          {ui.interaction.screenMap}
        </h2>
        <div className="flex gap-1.5">
          {screenSelectionModes.map((mode) => {
            const Icon = mode.id === "solid" ? Square : mode.id === "dashed" ? Grid3X3 : Maximize;
            return (
              <Tooltip key={mode.id}>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={screenSelectionMode === mode.id ? "neutral" : "outline"}
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      onSelectionModeChange(mode.id);
                      onDragBoxChange(null);
                      if (mode.id === "solid") onClearSequence();
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{ui.screenSelectionModes[mode.id]}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
      <div className="stage-map">
        <div
          ref={screenGridRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => onDragBoxChange(null)}
        >
          {screenLayoutItems.map((screen) => {
            const route = screenRoutes[screen.id];
            const screenClients = routeClientsByScreenId.get(screen.id) || [];
            const isOnline = screenClients.length > 0;
            const isSelected = selectedScreenId === screen.id;
            const seqOrder = sequenceOrderByScreen.get(screen.id);
            return (
              <button
                key={screen.id}
                type="button"
                data-screen-id={screen.id}
                className={[
                  "screen-btn",
                  isSelected ? "selected" : "",
                  screen.id === "A1" ? "master" : "",
                  route?.owner ? `owner-${route.owner}` : "",
                  isOnline ? "is-online" : "is-offline",
                  seqOrder ? "sequenced" : "",
                  pendingActions.has(makeActionKey("interaction", "setScreen", screen.id)) ? "is-pending" : ""
                ].filter(Boolean).join(" ")}
                style={getScreenLayoutStyle(screen)}
                onClick={() => onScreenSelect(screen.id)}
                title={route?.url || route?.owner || screen.id}
              >
                <i className={`dot ${isOnline ? (isSelected ? "stage" : "ok") : ""}`} />
                <strong>
                  {screen.id}
                  {seqOrder ? <sup className="order-badge">{seqOrder}</sup> : null}
                </strong>
                <span>{ui.screenOwners[route?.owner || "unset"]}</span>
              </button>
            );
          })}
          {dragBox && <span className="selection-box" style={dragBoxStyle(dragBox)} />}
        </div>
      </div>
      <div className="stage-route-bar">
        <span className="stage-route-label">
          {selectedScreenIds.length > 1
            ? `${selectedScreenIds.length} screens`
            : selectedScreenIds[0]}
        </span>
        <div className="stage-route-owners">
          {screenOwners.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={sharedOwner === opt.value ? "stage" : "outline"}
              className="h-7 text-[11px]"
              onClick={() => handleOwnerChange(opt.value)}
            >
              {ui.screenOwners[opt.value]}
            </Button>
          ))}
        </div>
        {sequenceGroupCount > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              {ui.interaction.step}
            </span>
            {sequenceSteps.map((step) => (
              <Button
                key={step}
                size="sm"
                variant={sequenceStep === step ? "neutral" : "outline"}
                className="h-6 px-1.5 text-[10px] tabular-nums"
                onClick={() => onSequenceStepChange(step)}
              >
                {step}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[10px] gap-0.5 text-muted-foreground"
              title={ui.actions.clearSequence}
              onClick={onClearSequence}
            >
              <X className="h-3 w-3" /> {ui.actions.clearSequence}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
