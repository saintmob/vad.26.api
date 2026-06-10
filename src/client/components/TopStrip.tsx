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
      <div className="flex items-center gap-3">
        <div className="mark" style={{ width: 32, height: 32, fontSize: 14, borderRadius: 6 }}>
          V
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[14px] font-bold tracking-tight">{ui.app.title}</span>
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{ui.app.subtitle}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 min-w-0">
        <span className="flex items-center gap-1.5">
          <i className={`dot ${connectionMeta[connection]}`} style={{ width: 7, height: 7 }} />
          <span className="text-[11px] text-muted-foreground font-medium">{ui.status[connection]}</span>
        </span>
        <span className="text-[11px] text-muted-foreground font-mono font-medium">{showId}</span>
        <span className="text-[11px] font-medium text-foreground">{showStatusLabel}</span>

        <span className="h-4 w-px bg-(--border)" aria-hidden />

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

        <span className="h-4 w-px bg-(--border)" aria-hidden />

        <span
          className={`text-[11px] tabular-nums font-medium ${syncStatus === "error" ? "text-(--destructive)" : "text-muted-foreground"}`}
          title={syncLabel}
        >
          {syncLabel}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums opacity-75 font-medium">
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
