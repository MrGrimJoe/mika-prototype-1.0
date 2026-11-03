import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ModalOverlay } from '../ui/ModalOverlay';
import {
  registerDialogHost,
  type ConfirmRequest,
  type Notice,
} from '../../lib/dialogService';

const NOTICE_MS = 7000;

/** Mount once near the app root. Renders confirmation dialogs and notices from dialogService. */
export const DialogHost: React.FC = () => {
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(
    () =>
      registerDialogHost({
        onConfirm: req => setQueue(q => [...q, req]),
        onNotice: notice => {
          setNotices(n => [...n, notice]);
          window.setTimeout(() => setNotices(n => n.filter(x => x.id !== notice.id)), NOTICE_MS);
        },
      }),
    []
  );

  const current = queue[0];
  const settle = (confirmed: boolean) => {
    if (!current) return;
    current.resolve(confirmed);
    setQueue(q => q.slice(1));
  };

  return (
    <>
      {current && (
        <ModalOverlay
          key={current.id}
          onClose={() => settle(false)}
          className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 font-sans"
        >
          <div className="bg-surface border border-hairline rounded-xs max-w-sm w-full p-6 shadow-2xl">
            <h2 className="text-base font-bold text-ink mb-2">{current.title}</h2>
            <p className="text-sm text-ink-2 leading-relaxed mb-5">{current.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                autoFocus={current.destructive}
                onClick={() => settle(false)}
                className="px-4 py-2 text-sm font-medium text-ink-2 border border-hairline rounded-xs hover:bg-paper cursor-pointer"
              >
                {current.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                className={`px-4 py-2 text-sm font-medium rounded-xs cursor-pointer ${
                  current.destructive
                    ? 'bg-[#B91C1C] hover:bg-[#991B1B] text-white'
                    : 'bg-accent hover:bg-accent text-white'
                }`}
              >
                {current.confirmLabel}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 max-w-sm font-sans">
        {notices.map(n => (
          <div
            key={n.id}
            role={n.tone === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-3 p-3 pr-2 text-sm rounded-xs border shadow-lg ${
              n.tone === 'error'
                ? 'bg-st-pending-bg border-st-pending-border text-st-pending'
                : 'bg-surface border-hairline text-ink'
            }`}
          >
            <span className="flex-1 leading-relaxed">{n.message}</span>
            <button
              type="button"
              aria-label="Dismiss notice"
              onClick={() => setNotices(list => list.filter(x => x.id !== n.id))}
              className="p-1 rounded-xs hover:bg-black/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};
