"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "error" | "success" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  /** Non-blocking replacement for window.confirm(). */
  confirm: (message: string, confirmLabel?: string) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_MS: Record<ToastKind, number> = { error: 6_000, success: 3_000, info: 4_000 };
const MAX_TOASTS = 4;

const kindClasses: Record<ToastKind, string> = {
  error: "bg-red-600 text-white",
  success: "bg-emerald-600 text-white",
  info: "bg-zinc-800 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, kind, message }]);
      setTimeout(() => dismiss(id), TOAST_MS[kind]);
    },
    [dismiss]
  );

  const confirm = useCallback(
    (message: string, confirmLabel = "Confirm") =>
      new Promise<boolean>((resolve) => {
        setConfirmReq((prev) => {
          prev?.resolve(false);
          return { message, confirmLabel, resolve };
        });
      }),
    []
  );

  const answer = useCallback(
    (ok: boolean) => {
      confirmReq?.resolve(ok);
      setConfirmReq(null);
    },
    [confirmReq]
  );

  useEffect(() => {
    if (!confirmReq) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") answer(false);
      if (e.key === "Enter") answer(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmReq, answer]);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`flex items-start gap-3 rounded-md px-4 py-2.5 text-sm shadow-lg ${kindClasses[t.kind]}`}
          >
            <span className="flex-1 break-words">{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {confirmReq && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => answer(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-zinc-800 dark:text-zinc-100">{confirmReq.message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => answer(false)}
                className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => answer(true)}
                className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 text-sm"
              >
                {confirmReq.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
