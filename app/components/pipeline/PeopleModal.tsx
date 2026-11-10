"use client";

import { useMemo } from "react";
import { X, Users, Calendar } from "lucide-react";
import type { KanbanColumn } from "../../types";
import { isCardOverdue } from "../../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  columns: KanbanColumn[];
  onCardClick: (cardId: string) => void;
  onFilter: (assignee: string) => void;
  onReport?: (assignee: string) => void;
}

const ME = "Eu";

/** "Onde está cada coisa": pendências abertas agrupadas por responsável. */
export function PeopleModal({ isOpen, onClose, columns, onCardClick, onFilter, onReport }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, { id: string; title: string; column: string; dueDate: Date | null; overdue: boolean; color: string }[]>();
    for (const col of columns) {
      if (col.isDone) continue;
      for (const c of col.cards) {
        if (c.completed) continue;
        const who = c.assignee || ME;
        const list = map.get(who) ?? [];
        list.push({
          id: c.id,
          title: c.title,
          column: col.title,
          dueDate: c.dueDate ? new Date(c.dueDate) : null,
          overdue: isCardOverdue(c.dueDate, c.completed),
          color: c.module?.color ?? "#64748b",
        });
        map.set(who, list);
      }
    }
    return [...map.entries()]
      .map(([who, items]) => ({
        who,
        items: items.sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity)),
      }))
      .sort((a, b) => (a.who === ME ? 1 : b.who === ME ? -1 : a.who.localeCompare(b.who, "pt-BR")));
  }, [columns]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-slate-800 bg-[#0a0f1d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider font-mono">
            <Users size={15} className="text-violet-400" /> Com quem está cada coisa
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {groups.length === 0 && <p className="text-center text-xs text-slate-500 font-mono py-8">Nenhuma pendência aberta.</p>}
          {groups.map((g) => (
            <section key={g.who}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-2 text-xs font-bold text-white">
                  <Avatar name={g.who} />
                  {g.who === ME ? "Comigo" : g.who}
                  <span className="text-[10px] font-mono text-slate-500">{g.items.length}</span>
                </span>
                <span className="flex items-center gap-3">
                  {onReport && (
                    <button
                      type="button"
                      onClick={() => { onReport(g.who === ME ? "__me" : g.who); onClose(); }}
                      className="text-[10px] font-mono font-bold text-blue-300 hover:text-white underline underline-offset-2 cursor-pointer"
                    >
                      relatório
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { onFilter(g.who === ME ? "__me" : g.who); onClose(); }}
                    className="text-[10px] font-mono text-slate-400 hover:text-white underline underline-offset-2 cursor-pointer"
                  >
                    filtrar no quadro
                  </button>
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
                {g.items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { onClose(); onCardClick(c.id); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#050811] cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] text-slate-100 truncate">{c.title}</span>
                      <span className="block text-[10px] font-mono text-slate-500 truncate">{c.column}</span>
                    </span>
                    {c.dueDate && (
                      <span className={`flex items-center gap-1 text-[10px] font-mono shrink-0 ${c.overdue ? "text-red-400 font-bold" : "text-slate-500"}`}>
                        <Calendar size={10} />
                        {c.dueDate.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" })}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

const AVATAR_COLORS = ["#8B5CF6", "#06B6D4", "#F59E0B", "#EC4899", "#10B981", "#3B82F6"];

export function Avatar({ name, size = 20 }: { name: string; size?: number }) {
  const color = name === ME ? "#475569" : AVATAR_COLORS[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.45 }}
      title={name}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
