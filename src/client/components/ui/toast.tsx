import * as React from "react";
import { cn } from "../../lib/utils";

const ToastContext = React.createContext<{
  toast: (props: { title?: string; description?: string; variant?: "default" | "success" | "error" | "warning" }) => void;
}>({ toast: () => {} });

export function useToast() {
  return React.useContext(ToastContext);
}

interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant: "default" | "success" | "error" | "warning";
  visible: boolean;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((props: { title?: string; description?: string; variant?: "default" | "success" | "error" | "warning" }) => {
    const id = Math.random().toString(36).slice(2);
    const newToast: ToastItem = {
      id,
      title: props.title,
      description: props.description,
      variant: props.variant || "default",
      visible: true,
    };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, visible: false } : t));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-12 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300",
              t.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
              t.variant === "success" && "bg-(--color-online)/10 border-(--color-online)/30 text-(--color-online)",
              t.variant === "error" && "bg-(--destructive)/10 border-(--destructive)/30 text-(--destructive)",
              t.variant === "warning" && "bg-(--color-cue)/10 border-(--color-cue)/30 text-(--color-cue)",
              t.variant === "default" && "bg-(--card) border-(--border) text-(--foreground)"
            )}
          >
            {t.title && <div className="text-xs font-semibold">{t.title}</div>}
            {t.description && <div className="text-[10px] opacity-80">{t.description}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}