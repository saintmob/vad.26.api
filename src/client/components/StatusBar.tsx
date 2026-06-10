import type { UiCopy, SyncStatus } from "../data/i18n";

interface StatusBarProps {
  lastAck: string;
  syncStatus: SyncStatus;
  locale: string;
  ui: UiCopy;
}

export function StatusBar({ lastAck, syncStatus, locale, ui }: StatusBarProps) {
  const ackDot = syncStatus === "error" ? "err" : syncStatus === "sending" ? "warn" : "ok";
  const ackText = lastAck === "Waiting for control activity" ? ui.status.waiting : lastAck;

  return (
    <footer className="bottom-strip" aria-label="Status bar">
      <div className="kbd-hints flex items-center gap-3 text-[10px] text-muted-foreground font-medium">
        <kbd>Space</kbd>
        <span className="opacity-70">{locale === "zh" ? "播放/暂停" : "play/pause"}</span>
        <kbd>S</kbd>
        <span className="opacity-70">{locale === "zh" ? "停止" : "stop"}</span>
        <kbd>1-3</kbd>
        <span className="opacity-70">{locale === "zh" ? "选屏" : "select"}</span>
      </div>

      <div className="footer-ack" title={lastAck}>
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground shrink-0">
          {ui.metrics.lastAck}
        </span>
        <i className={`dot ${ackDot}`} style={{ width: 7, height: 7 }} />
        <span className="footer-ack-text">{ackText}</span>
      </div>
    </footer>
  );
}
