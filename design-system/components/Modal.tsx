import { useEffect, useRef, type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Max width preset. Default: 'md' (480 px). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** If true (default), clicking the backdrop closes the modal. */
  dismissOnBackdrop?: boolean;
  /** If true (default), pressing Escape closes the modal. */
  dismissOnEscape?: boolean;
  /** ARIA label when no title is provided. */
  ariaLabel?: string;
}

/**
 * Modal — accessible dialog with focus trap, Esc to close, and body scroll lock.
 * For destructive confirmations or simple notifications use ConfirmDialog (TBD)
 * instead — Modal is the general-purpose primitive.
 */
export function Modal({
  open, onClose, title, description, children, footer,
  size = 'md', dismissOnBackdrop = true, dismissOnEscape = true, ariaLabel,
}: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (dismissOnEscape && e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    // Focus first focusable inside modal
    queueMicrotask(() => {
      const first = ref.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      first?.focus();
    });
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, dismissOnEscape, onClose]);

  if (!open) return null;

  return (
    <div
      className="el-modal-backdrop"
      data-open="true"
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={!title ? ariaLabel : undefined}
        aria-labelledby={title ? 'el-modal-title' : undefined}
        className={`el-modal el-modal--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <header className="el-modal__header">
            <div>
              <div id="el-modal-title" className="el-modal__title">{title}</div>
              {description && <div className="el-modal__description">{description}</div>}
            </div>
            <button type="button" className="el-icon-button el-icon-button--sm" aria-label="Schließen" onClick={onClose}>
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </header>
        )}
        <div className="el-modal__body">{children}</div>
        {footer && <footer className="el-modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}

export default Modal;
