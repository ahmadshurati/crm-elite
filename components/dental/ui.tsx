"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, X } from "lucide-react";
import { apiFetch, apiSend, type ApiResult } from "@/lib/dental/client";

/* =============================== Toasts =============================== */
type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };
type ToastApi = { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };

const ToastCtx = createContext<ToastApi>({ success: () => {}, error: () => {}, info: () => {} });
export const useToast = () => useContext(ToastCtx);

const TOAST_STYLE: Record<ToastKind, { bg: string; icon: typeof Info }> = {
  success: { bg: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 },
  error: { bg: "border-rose-200 bg-rose-50 text-rose-800", icon: AlertTriangle },
  info: { bg: "border-sky-200 bg-sky-50 text-sky-800", icon: Info },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => remove(id), kind === "error" ? 6000 : 3500);
  }, [remove]);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m: string) => push("success", m),
      error: (m: string) => push("error", m),
      info: (m: string) => push("info", m),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div dir="rtl" className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((t) => {
          const s = TOAST_STYLE[t.kind];
          const Icon = s.icon;
          return (
            <div key={t.id} className={`pointer-events-auto flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg ${s.bg}`} role="status">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => remove(t.id)} aria-label="إغلاق" className="opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* =============================== Confirm =============================== */
type ConfirmOpts = { title: string; message?: string; confirmText?: string; cancelText?: string; danger?: boolean };
const ConfirmCtx = createContext<(opts: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div dir="rtl" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={() => close(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${state.danger ? "bg-rose-50 text-rose-600" : "bg-[#E7F6F5] text-[#0F8B94]"}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-[#1F2937]">{state.title}</h3>
            </div>
            {state.message && <p className="mb-5 text-sm leading-6 text-[#64748B]">{state.message}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => close(false)} className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-bold text-[#64748B] hover:bg-[#F8FAFC]">{state.cancelText || "إلغاء"}</button>
              <button onClick={() => close(true)} className={`rounded-xl px-4 py-2 text-sm font-bold text-white ${state.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-[#0F8B94] hover:bg-[#0B6E75]"}`}>{state.confirmText || "تأكيد"}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

/* =============================== State views =============================== */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#94A3B8]">
      <Loader2 className="h-6 w-6 animate-spin" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function EmptyState({ title, hint, action, icon: Icon }: { title: string; hint?: string; action?: React.ReactNode; icon?: typeof Info }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {Icon && <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F5F9] text-[#94A3B8]"><Icon className="h-6 w-6" /></div>}
      <p className="text-base font-bold text-[#334155]">{title}</p>
      {hint && <p className="max-w-sm text-sm text-[#94A3B8]">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><AlertTriangle className="h-6 w-6" /></div>
      <p className="max-w-sm text-sm font-semibold text-[#475569]">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]">
          <RefreshCw className="h-4 w-4" /> إعادة المحاولة
        </button>
      )}
    </div>
  );
}

/** Declarative loading/error/empty gate. Renders children only when data is ready. */
export function StateView({
  loading, error, onRetry, isEmpty, empty, children, loadingLabel,
}: {
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  empty?: React.ReactNode;
  children: React.ReactNode;
  loadingLabel?: string;
}) {
  if (loading) return <Spinner label={loadingLabel} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (isEmpty) return <>{empty}</>;
  return <>{children}</>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm ${className}`}>{children}</div>;
}

/* =============================== Data hooks =============================== */
/**
 * GET hook with loading/error/data + reload. `url=null` skips fetching.
 * Refreshes are "silent": once data exists we keep showing it (no spinner flash),
 * and a failed background refresh keeps the last-known data instead of blanking the view.
 * The blocking spinner/error only appears on the very first load.
 */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<T | null>(null);
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; abortRef.current?.abort(); };
  }, []);

  const reload = useCallback(async () => {
    if (!url) return;
    // Cancel any in-flight request; only the latest one is allowed to write state.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++seqRef.current;
    const firstLoad = dataRef.current === null;
    if (firstLoad) setLoading(true);
    setError(null);
    const r = await apiFetch<T>(url, { signal: controller.signal });
    // Ignore stale responses (a newer request started) and post-unmount writes.
    // These guards run BEFORE any state write, so aborts we triggered never surface as errors;
    // anything reaching below is the latest, still-mounted request (a real result or real failure).
    if (!mountedRef.current || seq !== seqRef.current) return;
    if (r.ok) {
      dataRef.current = r.data;
      setData(r.data);
    } else if (firstLoad) {
      setError(r.error);
    }
    setLoading(false);
  }, [url]);

  useEffect(() => { reload(); }, [reload]);

  const setDataSync = useCallback((updater: T | null | ((cur: T | null) => T | null)) => {
    setData((cur) => {
      const next = typeof updater === "function" ? (updater as (c: T | null) => T | null)(cur) : updater;
      dataRef.current = next;
      return next;
    });
  }, []);

  return { data, loading, error, reload, setData: setDataSync };
}

/** Mutation runner: single-flight (prevents double submit), toast feedback, no throw. */
export function useMutation() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const run = useCallback(
    async <T,>(
      url: string,
      method: "POST" | "PATCH" | "PUT" | "DELETE",
      body?: unknown,
      opts: { success?: string; onError?: (r: Extract<ApiResult<T>, { ok: false }>) => void; silent?: boolean } = {}
    ): Promise<T | false> => {
      if (pendingRef.current) return false;
      pendingRef.current = true;
      setPending(true);
      const r = await apiSend<T>(url, method, body);
      pendingRef.current = false;
      setPending(false);
      if (r.ok) {
        if (opts.success) toast.success(opts.success);
        return (r.data ?? (true as unknown as T)) as T;
      }
      if (opts.onError) opts.onError(r);
      else if (!opts.silent) toast.error(r.error);
      return false;
    },
    [toast]
  );

  return { pending, run };
}

// Re-export common formatting so components import from one place.
export { fmtMoney, fmtDate, fmtDateTime, fmtTime, toDateTimeLocal } from "@/lib/dental/format";
export { apiFetch } from "@/lib/dental/client";
