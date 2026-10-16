import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import "./design.css";

export function ContextHelp({ title, description, example }: { title: string; description: string; example?: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });

  const reposition = useCallback(() => {
    const anchor = summaryRef.current?.getBoundingClientRect();
    const popup = popoverRef.current;
    if (!anchor || !popup) return;
    const gap = 8;
    const padding = 8;
    const width = Math.min(popup.getBoundingClientRect().width, window.innerWidth - padding * 2);
    const height = popup.getBoundingClientRect().height;
    let left = anchor.right + gap;
    if (left + width > window.innerWidth - padding) left = anchor.left - width - gap;
    left = Math.max(padding, Math.min(left, window.innerWidth - width - padding));
    const top = Math.max(padding, Math.min(anchor.top, window.innerHeight - height - padding));
    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && (detailsRef.current?.contains(target) || popoverRef.current?.contains(target))) return;
      if (detailsRef.current) detailsRef.current.open = false;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (detailsRef.current) detailsRef.current.open = false;
      setOpen(false);
      summaryRef.current?.focus();
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  return (
    <details
      ref={detailsRef}
      className="ds-help"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          detailsRef.current?.removeAttribute("open");
          setOpen(false);
          detailsRef.current?.querySelector("summary")?.focus();
        }
      }}
    >
      <summary ref={summaryRef} aria-label={`Ayuda sobre ${title}`} title={`Ayuda sobre ${title}`}>?</summary>
      {open && createPortal(<div ref={popoverRef} className="ds-help__popover" role="note" style={{ left: position.left, top: position.top }} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        <strong>{title}</strong>
        <p>{description}</p>
        {example && <code>{example}</code>}
        <span className="ds-help__close">Pulsa fuera o Escape para cerrar</span>
      </div>, document.body)}
    </details>
  );
}
