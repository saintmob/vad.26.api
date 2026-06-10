import { Save } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import type { PerformanceState } from "../../types";
import type { UiCopy, ThemeMode, LanguageMode } from "../data/i18n";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeMode: ThemeMode;
  languageMode: LanguageMode;
  token: string;
  screenPresentation: PerformanceState["modules"]["interaction"]["screenPresentation"];
  ui: UiCopy;
  locale: string;
  onThemeChange: (mode: ThemeMode) => void;
  onLanguageChange: (mode: LanguageMode) => void;
  onTokenChange: (token: string) => void;
  onAutoRedirectToggle: () => void;
  onSaveSnapshot: () => void;
}

const themeOptions: ThemeMode[] = ["system", "light", "dark"];
const languageOptions: LanguageMode[] = ["system", "zh", "en"];

export function SettingsDialog({
  open,
  onOpenChange,
  themeMode,
  languageMode,
  token,
  screenPresentation,
  ui,
  locale,
  onThemeChange,
  onLanguageChange,
  onTokenChange,
  onAutoRedirectToggle,
  onSaveSnapshot
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-sm">{ui.layout.systemSettings}</DialogTitle>
          <DialogDescription className="text-xs">
            {locale === "zh"
              ? "系统外观、语言和控制令牌集中在这里。"
              : "Theme, language, and control token."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="bg-(--secondary) border border-(--border) rounded-[var(--radius)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold">{ui.app.theme}</span>
            </div>
            <div className="flex gap-1 p-0.5 bg-(--background) rounded-[calc(var(--radius)-2px)]">
              {themeOptions.map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={themeMode === mode ? "neutral" : "ghost"}
                  className="flex-1 h-7 text-[11px]"
                  onClick={() => onThemeChange(mode)}
                >
                  {ui.theme[mode]}
                </Button>
              ))}
            </div>
          </div>

          <div className="bg-(--secondary) border border-(--border) rounded-[var(--radius)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold">{ui.app.language}</span>
            </div>
            <div className="flex gap-1 p-0.5 bg-(--background) rounded-[calc(var(--radius)-2px)]">
              {languageOptions.map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={languageMode === mode ? "neutral" : "ghost"}
                  className="flex-1 h-7 text-[11px]"
                  onClick={() => onLanguageChange(mode)}
                >
                  {ui.language[mode]}
                </Button>
              ))}
            </div>
          </div>

          <div className="bg-(--secondary) border border-(--border) rounded-[var(--radius)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold">{ui.app.token}</span>
              <span className="text-[9px] text-muted-foreground">
                {locale === "zh" ? "可选" : "Optional"}
              </span>
            </div>
            <Input
              value={token}
              onChange={(e) => onTokenChange(e.target.value)}
              type="password"
              className="h-7 text-[11px]"
              placeholder={locale === "zh" ? "输入控制令牌" : "Enter control token"}
            />
          </div>

          <div className="bg-(--secondary) border border-(--border) rounded-[var(--radius)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold">{ui.interaction.presentation}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{ui.interaction.autoRedirect}</span>
              </div>
              <Button
                size="sm"
                variant={screenPresentation.autoRedirect ? "default" : "outline"}
                className="h-7 text-[11px] min-w-[48px]"
                onClick={onAutoRedirectToggle}
              >
                {screenPresentation.autoRedirect ? "ON" : "OFF"}
              </Button>
            </div>
            <Separator className="my-1" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] text-muted-foreground">{ui.actions.save}</span>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={onSaveSnapshot}>
                <Save className="h-3 w-3" /> {ui.actions.save}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
