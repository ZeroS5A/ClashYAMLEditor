import { useEffect, useRef } from 'react';

export default function useDialogFocus(onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    const focusable = () => [...node.querySelectorAll('button, input, textarea, select, a[href], [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
    focusable()[0]?.focus();
    const handler = e => {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')].sort((a, b) => (Number(getComputedStyle(a).zIndex) || 0) - (Number(getComputedStyle(b).zIndex) || 0));
      if (dialogs.at(-1) !== node) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); }
      if (e.key === 'Tab') {
        const items = focusable(), first = items[0], last = items.at(-1);
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => { document.removeEventListener('keydown', handler, true); if (previous?.isConnected) previous.focus(); };
  }, []);
  return ref;
}
