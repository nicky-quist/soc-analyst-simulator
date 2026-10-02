// Dialog focus handling

import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Focus trap
export function useDialogFocus(dialogRef, onClose, initialRef) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    (initialRef?.current || dialog?.querySelector(FOCUSABLE))?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const focusable = dialog.querySelectorAll(FOCUSABLE);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [dialogRef, initialRef]);
}
