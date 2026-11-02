import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "../utils/cn";
import { Modal } from "./ui";
import { Button } from "./ui";

/* ───────────── Toasts ───────────── */
type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}
interface FeedbackCtx {
  toast: (message: string, tone?: ToastTone) => void;
  confirm: (opts: { title: string; message?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}

const Ctx = createContext<FeedbackCtx>({ toast: () => {}, confirm: async () => false });
export const useFeedback = () => useContext(Ctx);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const [dialog, setDialog] = useState<null | {
    title: string;
    message?: string;
    confirmLabel?: string;
    danger?: boolean;
    resolve: (v: boolean) => void;
  }>(null);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const confirm = useCallback<FeedbackCtx["confirm"]>(
    (opts) => new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })),
    [],
  );

  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  const icons = {
    success: <CheckCircle2 size={18} className="text-green shrink-0" />,
    error: <XCircle size={18} className="text-red shrink-0" />,
    info: <Info size={18} className="text-accent shrink-0" />,
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:top-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="anim-toast glass pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line px-4 py-3 text-[14px] font-medium text-ink shadow-[var(--shadow-lg)]"
          >
            {icons[t.tone]}
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
      <Modal
        open={!!dialog}
        onClose={() => close(false)}
        size="sm"
        hideHeader
        footer={
          <div className="flex w-full gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={dialog?.danger ? "danger" : "primary"} className="flex-1" onClick={() => close(true)}>
              {dialog?.confirmLabel || "Confirm"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center px-2 pt-2 text-center">
          <div
            className={cn(
              "mb-3 flex h-12 w-12 items-center justify-center rounded-full",
              dialog?.danger ? "bg-red-soft text-red" : "bg-accent-soft text-accent",
            )}
          >
            <AlertTriangle size={22} />
          </div>
          <h3 className="text-[17px] font-semibold text-ink">{dialog?.title}</h3>
          {dialog?.message && <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">{dialog.message}</p>}
        </div>
      </Modal>
    </Ctx.Provider>
  );
}
