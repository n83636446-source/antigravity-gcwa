'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ActionWarningState = { key: string; title: string; message: string } | null;

// TEMPORARY DIAGNOSTIC (remove after investigation)
const bubbleNow = () => Math.round(performance.now());
const describeBubbleTarget = (e: { detail: { originalEvent: Event } }) => {
  const t = e.detail.originalEvent.target as HTMLElement | null;
  return `${t?.tagName ?? '?'} | ${(t?.getAttribute?.('class') ?? '').slice(0, 60)} | ${(t?.textContent ?? '').slice(0, 30)}`;
};

export function useActionWarning(durationMs = 6000) {
  const [warning, setWarning] = React.useState<ActionWarningState>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWarning = React.useCallback(() => {
    console.log('[bubble] clearWarning called', bubbleNow(), new Error().stack?.split('\n').slice(1, 5).join(' <- '));
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setWarning(null);
  }, []);

  const showWarning = React.useCallback(
    (key: string, message: string, title = 'Action impossible') => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setWarning({ key, title, message });
      console.log('[bubble] show', key, bubbleNow());
      timerRef.current = setTimeout(() => {
        console.log('[bubble] timer expired', key, bubbleNow());
        setWarning(null);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs]
  );

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { warning, showWarning, clearWarning };
}

export function ActionWarning({
  id,
  warning,
  onClose,
  children,
}: {
  id: string;
  warning: ActionWarningState;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const open = warning?.key === id;
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        console.log('[bubble] onOpenChange', id, next, bubbleNow());
        if (!next) onClose();
      }}
    >
      <PopoverPrimitive.Anchor asChild>
        <div className="inline-flex">{children}</div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="end"
          sideOffset={8}
          role="alert"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onFocusOutside={(e) => console.log('[bubble] focus outside', id, bubbleNow(), describeBubbleTarget(e))}
          onPointerDownOutside={(e) => console.log('[bubble] pointer down outside', id, bubbleNow(), describeBubbleTarget(e))}
          onInteractOutside={(e) => console.log('[bubble] interact outside', id, bubbleNow(), describeBubbleTarget(e))}
          onEscapeKeyDown={() => console.log('[bubble] escape key', id, bubbleNow())}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'z-50 w-72 max-w-[90vw] rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 shadow-md outline-none',
            'dark:border-red-900 dark:bg-red-950 dark:text-red-100',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold leading-none">{warning?.title}</p>
              <p>{warning?.message}</p>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
