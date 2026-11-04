/**
 * Promise-based confirmation dialogs and short notices, rendered by <DialogHost />.
 * Replaces window.confirm / window.alert so prompts match the app, read well with
 * screen readers, and can be dismissed from the keyboard.
 */

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Names the action itself, e.g. "Delete task", never "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive actions get a warning style and start with Cancel focused. */
  destructive?: boolean;
}

export type NoticeTone = 'error' | 'info';

export interface ConfirmRequest extends ConfirmOptions {
  id: number;
  resolve: (confirmed: boolean) => void;
}

export interface Notice {
  id: number;
  message: string;
  tone: NoticeTone;
}

type Listener = {
  onConfirm: (req: ConfirmRequest) => void;
  onNotice: (notice: Notice) => void;
};

let listener: Listener | null = null;
let nextId = 1;

export function registerDialogHost(l: Listener): () => void {
  listener = l;
  return () => {
    if (listener === l) listener = null;
  };
}

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (!listener) {
    // No host mounted (early boot): never act on a prompt nobody could see.
    console.warn('confirmAction called before <DialogHost /> mounted; treating as cancelled.');
    return Promise.resolve(false);
  }
  const host = listener;
  return new Promise<boolean>(resolve => {
    host.onConfirm({ ...options, id: nextId++, resolve });
  });
}

export function notify(message: string, tone: NoticeTone = 'info'): void {
  if (!listener) {
    console[tone === 'error' ? 'error' : 'info'](message);
    return;
  }
  listener.onNotice({ id: nextId++, message, tone });
}
