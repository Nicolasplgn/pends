"use client";

// Menu "⋯" leve: abre ao clicar, fecha ao clicar fora, com Esc, ao rolar ou redimensionar.
// Renderiza no <body> com posição fixa, para não ser cortado pela rolagem das colunas.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
  /** Linha divisória antes deste item */
  separator?: boolean;
  /** Título de seção (item não clicável) */
  heading?: boolean;
  active?: boolean;
}

const WIDTH = 224;

export function Menu({
  trigger,
  items,
  align = "right",
  className = "",
  title,
}: {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  className?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxH: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function place() {
    if (!btnRef.current) return null;
    const r = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(8, Math.min(vw - WIDTH - 8, align === "right" ? r.right - WIDTH : r.left));
    const below = vh - r.bottom - 8;
    const above = r.top - 8;
    // Abre para cima quando falta espaço embaixo
    return below >= 260 || below >= above
      ? { left, top: r.bottom + 4, maxH: below - 4 }
      : { left, bottom: vh - r.top + 4, maxH: above - 4 };
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onScroll = (e: Event) => { if (!panelRef.current?.contains(e.target as Node)) close(); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { if (open) { setOpen(false); return; } setPos(place()); setOpen(true); }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
        aria-label={title}
        className="cursor-pointer"
      >
        {trigger}
      </button>
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: WIDTH, maxHeight: pos.maxH }}
            className="fixed z-80 overflow-y-auto rounded-xl border border-slate-700 bg-[#0b101f] shadow-2xl p-1"
          >
            {items.map((it, i) => (
              <div key={`${it.label}-${i}`}>
                {it.separator && <div className="my-1 h-px bg-slate-800" />}
                {it.heading ? (
                  <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">{it.label}</div>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={it.disabled}
                    onClick={() => { setOpen(false); it.onSelect(); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left cursor-pointer disabled:opacity-40 disabled:cursor-default ${
                      it.danger
                        ? "text-rose-300 hover:bg-rose-500/10"
                        : it.active
                          ? "text-white bg-slate-800"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {it.icon && <span className="shrink-0 text-slate-400">{it.icon}</span>}
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.hint && <kbd className="text-[10px] font-mono text-slate-500">{it.hint}</kbd>}
                  </button>
                )}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
