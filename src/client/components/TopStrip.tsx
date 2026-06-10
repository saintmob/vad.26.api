import { Settings2 } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import type { ConnectionState } from "../useShowState";
import type { UiCopy, SyncStatus } from "../data/i18n";

export type ModulePortKey = "audio" | "visual" | "interaction";

interface TopStripProps {
  connection: ConnectionState;
  showStatusLabel: string;
  showId: string;
  ui: UiCopy;
  moduleOnline: Record<ModulePortKey, boolean>;
  syncStatus: SyncStatus;
  syncLabel: string;
  clientCount: number;
  onOpenSettings: () => void;
}

const connectionMeta: Record<ConnectionState, string> = {
  connected: "ok",
  connecting: "warn",
  offline: "err"
};

const modulePorts: Array<{ key: ModulePortKey; port: string }> = [
  { key: "audio", port: "4301" },
  { key: "visual", port: "4302" },
  { key: "interaction", port: "4303" }
];

export function TopStrip({
  connection,
  showStatusLabel,
  showId,
  ui,
  moduleOnline,
  syncStatus,
  syncLabel,
  clientCount,
  onOpenSettings
}: TopStripProps) {
  return (
    <header className="top-strip" aria-label="Status bar">
      <div className="flex items-center gap-2.5">
        <div className="mark" style={{ width: 28, height: 28, fontSize: 13, borderRadius: 7 }}>
          V
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-bold tracking-tight">{ui.app.title}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{ui.app.subtitle}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 min-w-0">
        <span className="flex items-center gap-1.5">
          <i className={`dot ${connectionMeta[connection]}`} style={{ width: 6, height: 6 }} />
          <span className="text-[10px] text-muted-foreground">{ui.status[connection]}</span>
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">{showId}</span>
        <span className="text-[10px] font-medium text-foreground/80">{showStatusLabel}</span>

        <span className="h-3.5 w-px bg-[--border]" aria-hidden />

        {modulePorts.map(({ key, port }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <span className={`port-light ${moduleOnline[key] ? "on" : ""}`}>
                <i aria-hidden />
                <span className="font-mono">{port}</span>
                <span className="port-name">{ui.modulePorts[key]}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {`${ui.modulePorts[key]} · ${moduleOnline[key] ? ui.status.connected : ui.status.offline}`}
            </TooltipContent>
          </Tooltip>
        ))}

        <span className="h-3.5 w-px bg-[--border]" aria-hidden />

        <span
          className={`text-[10px] tabular-nums ${syncStatus === "error" ? "text-[--destructive]" : "text-muted-foreground"}`}
          title={syncLabel}
        >
          {syncLabel}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums opacity-70">
          {clientCount}/20
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onOpenSettings}>
              <Settings2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{ui.layout.systemSettings}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
