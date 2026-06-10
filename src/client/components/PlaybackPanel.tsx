import { useEffect, useRef, useState } from "react";
import { Play, Pause, Square, RotateCcw, Shuffle, Send } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { ControlCommand } from "../../types";
import type { UiCopy } from "../data/i18n";
import { visualScenes, bpmOptions } from "../data/constants";

interface PlaybackPanelProps {
  sendControl: (module: ControlCommand["module"], command: string, target: string, value?: unknown) => Promise<void>;
  showId: string;
  showStatus: "standby" | "running" | "paused" | "ended";
  bpm: number;
  currentScene: string;
  visualText: string;
  locale: string;
  ui: UiCopy;
}

const RESET_CONFIRM_TIMEOUT_MS = 3000;

export function PlaybackPanel({
  sendControl,
  showId,
  showStatus,
  bpm,
  currentScene,
  visualText,
  locale,
  ui
}: PlaybackPanelProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [textDraft, setTextDraft] = useState(visualText);
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
  }, []);

  useEffect(() => {
    setTextDraft(visualText);
  }, [visualText]);

  const handleReset = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      confirmTimer.current = window.setTimeout(() => setConfirmingReset(false), RESET_CONFIRM_TIMEOUT_MS);
      return;
    }
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    setConfirmingReset(false);
    sendControl("show", "reset", showId);
  };

  const sendVisualText = () => {
    sendControl("visual", "setText", "visual-main", textDraft);
  };

  const transport = [
    { key: "play", icon: Play, label: ui.actions.play, active: showStatus === "running", command: () => sendControl("show", "play", showId) },
    { key: "pause", icon: Pause, label: ui.actions.pause, active: showStatus === "paused", command: () => sendControl("show", "pause", showId) },
    { key: "stop", icon: Square, label: ui.actions.stop, active: showStatus === "ended", command: () => sendControl("show", "stop", showId) },
    { key: "shuffle", icon: Shuffle, label: ui.actions.shuffle, active: false, command: () => sendControl("audio", "shuffleStyle", "audio-shuffle", true) }
  ];

  return (
    <div className="module module-playback">
      <div className="module-head">
        <h2 className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-(--color-dj)" />
          {locale === "zh" ? "播放" : "Playback"}
        </h2>
        <Button
          size="sm"
          variant={confirmingReset ? "destructive" : "outline"}
          className={`h-6 px-2 text-[10px] gap-1 ${confirmingReset ? "" : "text-(--destructive) border-(--destructive)/40 hover:bg-(--destructive)/10"}`}
          onClick={handleReset}
        >
          <RotateCcw className="h-3 w-3" />
          {confirmingReset ? ui.actions.confirmReset : ui.actions.reset}
        </Button>
      </div>
      <div className="controls">
        <div className="btn-grid four">
          {transport.map(({ key, icon: Icon, label, active, command }) => (
            <Button
              key={key}
              size="sm"
              variant={active ? "default" : "outline"}
              className="h-10 flex-col gap-0.5 text-[10px] font-semibold"
              onClick={command}
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

        <div className="vj-text-row">
          <Input
            value={textDraft}
            className="h-8 text-[11px]"
            placeholder={ui.visual.text}
            onChange={(event) => setTextDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                sendVisualText();
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-[11px] gap-1 shrink-0"
            onClick={sendVisualText}
          >
            <Send className="h-3.5 w-3.5" />
            {ui.actions.send}
          </Button>
        </div>
      </div>
    </div>
  );
}
