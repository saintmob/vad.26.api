import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ScrollArea } from "./ui/scroll-area";
import type { ScreenOwner } from "../../types";
import type { UiCopy } from "../data/i18n";
import { screenLayoutOrder } from "../data/screenLayout";
import { screenOwners, visualScenes } from "../data/constants";

interface RouteComposerDialogProps {
  open: boolean;
  name: string;
  draft: Record<string, { owner: ScreenOwner; scene: string }>;
  selectedScreenId: string;
  ui: UiCopy;
  locale: string;
  onOpenChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onSelectScreen: (screenId: string) => void;
  onOwnerChange: (screenId: string, owner: ScreenOwner) => void;
  onSceneChange: (screenId: string, scene: string) => void;
  onSave: () => void;
}

export function RouteComposerDialog({
  open,
  name,
  draft,
  selectedScreenId,
  ui,
  locale,
  onOpenChange,
  onNameChange,
  onSelectScreen,
  onOwnerChange,
  onSceneChange,
  onSave
}: RouteComposerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="text-sm">{ui.actions.newArrangement}</DialogTitle>
          <DialogDescription className="text-xs">
            {locale === "zh"
              ? "为每块屏幕指定归属，VJ 屏可单独指定场景。保存后立即生效。"
              : "Assign an owner per screen; VJ screens can pin a scene. Saving applies immediately."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold whitespace-nowrap">{ui.interaction.arrangementName}</span>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="h-7 text-[11px]"
              placeholder={locale === "zh" ? "输入名称" : "Enter a name"}
            />
          </div>

          <ScrollArea className="h-[320px] border border-[--border] rounded-[var(--radius)]">
            <div className="divide-y divide-[--border]">
              {screenLayoutOrder.map((screenId) => {
                const entry = draft[screenId] || { owner: "baofa" as ScreenOwner, scene: "Video Flow" };
                const isSelected = selectedScreenId === screenId;
                return (
                  <div
                    key={screenId}
                    className={`flex items-center gap-2 px-3 py-1.5 ${isSelected ? "bg-[--secondary]" : ""}`}
                    onClick={() => onSelectScreen(screenId)}
                  >
                    <span className="w-7 text-[11px] font-bold tabular-nums shrink-0">{screenId}</span>
                    <div className="flex gap-1 shrink-0">
                      {screenOwners.map((opt) => (
                        <Button
                          key={opt.value}
                          size="sm"
                          variant={entry.owner === opt.value ? "default" : "outline"}
                          className="h-6 px-2 text-[10px]"
                          onClick={() => onOwnerChange(screenId, opt.value)}
                        >
                          {ui.screenOwners[opt.value]}
                        </Button>
                      ))}
                    </div>
                    <div className="flex-1" />
                    {entry.owner === "vj" && (
                      <Select value={entry.scene} onValueChange={(scene) => onSceneChange(screenId, scene)}>
                        <SelectTrigger className="h-6 w-[150px] text-[10px] px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {visualScenes.map((scene) => (
                            <SelectItem key={scene.id} value={scene.id} className="text-[11px]">
                              {scene.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onOpenChange(false)}>
              {ui.actions.cancel}
            </Button>
            <Button size="sm" variant="default" className="h-7 text-[11px]" onClick={onSave} disabled={!name.trim()}>
              {ui.actions.save}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
