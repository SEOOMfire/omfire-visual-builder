"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Info,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type FeedbackTone = "success" | "info" | "warning" | "danger";

export interface FeedbackNotice {
  title: string;
  message?: string;
  tone?: FeedbackTone;
  duration?: number;
  action?: { label: string; onClick: () => void | Promise<void> };
}

interface FeedbackContextValue {
  notify: (notice: FeedbackNotice) => string;
  dismiss: (id: string) => void;
}

interface ActiveNotice extends FeedbackNotice {
  id: string;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const noticeIcons = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  danger: CircleAlert,
};

function FeedbackToast({ notice, onDismiss }: { notice: ActiveNotice; onDismiss: () => void }) {
  const tone = notice.tone ?? "success";
  const Icon = noticeIcons[tone];

  useEffect(() => {
    if (notice.duration === 0) return;
    const timer = window.setTimeout(onDismiss, notice.duration ?? 5000);
    return () => window.clearTimeout(timer);
  }, [notice.duration, onDismiss]);

  return (
    <section className={`feedback-toast is-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon className="feedback-toast-icon" size={19} aria-hidden="true" />
      <div className="feedback-toast-copy">
        <strong>{notice.title}</strong>
        {notice.message ? <p>{notice.message}</p> : null}
        {notice.action ? (
          <button
            type="button"
            onClick={() => {
              void notice.action?.onClick();
              onDismiss();
            }}
          >
            {notice.action.label}
          </button>
        ) : null}
      </div>
      <button type="button" className="feedback-toast-close" onClick={onDismiss} aria-label="Meldung schließen">
        <X size={15} />
      </button>
    </section>
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<ActiveNotice[]>([]);
  const dismiss = useCallback((id: string) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);
  const notify = useCallback((notice: FeedbackNotice) => {
    const id = crypto.randomUUID();
    setNotices((current) => [...current.slice(-3), { ...notice, id }]);
    return id;
  }, []);

  return (
    <FeedbackContext.Provider value={{ notify, dismiss }}>
      {children}
      <div className="feedback-region" aria-label="Benachrichtigungen">
        {notices.map((notice) => (
          <FeedbackToast key={notice.id} notice={notice} onDismiss={() => dismiss(notice.id)} />
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedback must be used inside FeedbackProvider");
  return context;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  tone = "danger",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [busy, onClose, open]);

  if (!open) return null;
  return createPortal(
    <div className="feedback-dialog-backdrop" onMouseDown={() => !busy && onClose()}>
      <section
        ref={dialogRef}
        className="feedback-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="feedback-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className={`feedback-dialog-icon is-${tone}`} aria-hidden="true">
          {tone === "danger" ? <AlertTriangle size={21} /> : <Info size={21} />}
        </span>
        <div>
          <h2 id="feedback-dialog-title">{title}</h2>
          <div className="feedback-dialog-message">{message}</div>
        </div>
        <div className="feedback-dialog-actions">
          <button ref={cancelRef} type="button" className="secondary-btn" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "danger-button" : "primary-button"}
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? <LoaderCircle className="spin" size={16} /> : null}
            {busy ? "Wird ausgeführt …" : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function PageSkeleton({ variant = "list" }: { variant?: "list" | "board" | "detail" }) {
  const columns = variant === "board" ? 3 : 1;
  return (
    <div className={`page-skeleton is-${variant}`} aria-label="Inhalt wird geladen" aria-busy="true">
      <span className="sr-only">Inhalt wird geladen</span>
      <div className="page-skeleton-heading">
        <i />
        <b />
        <span />
      </div>
      <div className="page-skeleton-grid" style={{ "--skeleton-columns": columns } as React.CSSProperties}>
        {Array.from({ length: columns }).map((_, column) => (
          <div className="page-skeleton-panel" key={column}>
            <b />
            {Array.from({ length: variant === "detail" ? 4 : 3 }).map((__, row) => <i key={row} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
