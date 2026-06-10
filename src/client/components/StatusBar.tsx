interface StatusBarProps {
  locale: string;
}

export function StatusBar({ locale }: StatusBarProps) {
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
    </footer>
  );
}
