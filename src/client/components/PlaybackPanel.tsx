import { Play, Pause, Square, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import type { ControlCommand } from "../../types";
import type { UiCopy } from "../data/i18n";
import { visualScenes, bpmOptions } from "../data/constants";

interface PlaybackPanelProps {
  sendControl: (module: ControlCommand["module"], command: string, target: string, value?: unknown) => Promise<void>;
  showId: string;
  showStatus: "standby" | "running" | "paused" | "ended";
  bpm: number;
  currentScene: string;
  locale: string;
  ui: UiCopy;
}

export function PlaybackPanel({
  sendControl,
  showId,
  showStatus,
  bpm,
  currentScene,
  locale,
  ui
}: PlaybackPanelProps) {
  const transport = [
    { key: "play", icon: Play, label: ui.actions.play, active: showStatus === "running" },
    { key: "pause", icon: Pause, label: ui.actions.pause, active: showStatus === "paused" },
    { key: "stop", icon: Square, label: ui.actions.stop, active: showStatus === "ended" },
    { key: "reset", icon: RotateCcw, label: ui.actions.reset, active: false }
  ] as const;

  return (
    <div className="module module-playback">
      <div className="module-head">
        <h2 className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[--color-dj]" />
          {locale === "zh" ? "播放" : "Playback"}
        </h2>
      </div>
      <div className="controls">
        <div className="btn-grid four">
          {transport.map(({ key, icon: Icon, label, active }) => (
            <Button
              key={key}
              size="sm"
              variant={active ? "default" : "outline"}
              className="h-10 flex-col gap-0.5 text-[10px] font-semibold"
              onClick={() => sendControl("show", key, showId)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>

        <div className="label"><span>{ui.metrics.bpm}</span></div>
        <div className="btn-grid six">
          {bpmOptions.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={bpm === value ? "default" : "outline"}
              className="h-7 text-[11px] tabular-nums"
              onClick={() => sendControl("show", "setBpm", showId, value)}
            >
              {value}
            </Button>
          ))}
        </div>

        <div className="label"><span>{ui.visual.scene}</span></div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {visualScenes.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`scene-tag ${currentScene === s.id ? "active" : ""}`}
              onClick={() => sendControl("visual", "setScene", "visual-main", s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
