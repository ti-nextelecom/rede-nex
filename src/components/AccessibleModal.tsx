import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

/** Portal, focus trap, Escape handling and scroll lock for existing custom dialogs. */
export function AccessibleModal({ title, onClose, children, className }: {
  title: string; onClose: () => void; children: ReactNode; className: string;
}) {
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <Dialog.Content className={className} aria-describedby={undefined}>
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
