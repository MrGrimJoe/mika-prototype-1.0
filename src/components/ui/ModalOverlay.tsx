import React, { useEffect, useId, useRef } from 'react';

export interface ModalOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Called when the person presses Escape. Omit for dialogs that must be completed. */
  onClose?: () => void;
  children?: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Only the topmost open dialog reacts to Escape and Tab.
const openDialogs: symbol[] = [];

/**
 * Backdrop + dialog semantics for Mika's modal panels.
 * Adds role="dialog", aria-modal, a label taken from the first heading, Escape to close,
 * a Tab focus trap, scroll lock, and focus restore on close.
 */
export const ModalOverlay: React.FC<ModalOverlayProps> = ({ onClose, children, ...rest }) => {
  const ref = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const token = Symbol('dialog');
    openDialogs.push(token);

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const heading = node.querySelector<HTMLElement>('h1, h2, h3');
    if (heading) {
      if (!heading.id) heading.id = headingId;
      node.setAttribute('aria-labelledby', heading.id);
    }

    // Move focus into the dialog unless something inside already has it (e.g. autoFocus).
    if (!node.contains(document.activeElement)) {
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      (first || node).focus();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== token) return;
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items: HTMLElement[] = (Array.prototype.slice.call(node.querySelectorAll(FOCUSABLE)) as HTMLElement[]).filter(
        (el: HTMLElement) => el.offsetParent !== null
      );
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const i = openDialogs.indexOf(token);
      if (i >= 0) openDialogs.splice(i, 1);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [headingId]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      {...rest}
      className={`${rest.className || ''} focus:outline-hidden`}
    >
      {children}
    </div>
  );
};
