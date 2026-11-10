"use client";

import { useMemo, useState } from "react";
import { X, CalendarRange, AlertTriangle } from "lucide-react";
import type { KanbanColumn } from "../../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  columns: KanbanColumn[];
  onCardClick: (cardId: string) => void;
}

const DAY = 86400000;

function weekStart(offset: number) {
  const n = new Date();
  const dow = (n.getDay() + 6) % 7; // segunda = 0
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate() - dow + offset * 7);
}

const hours = (h: number) => (Number.isInteger(h) ? `${h} h` : `${h.toFixed(1).replace(".", ",")} h`);

/** Quanto cabe na semana: horas estimadas dos cards com prazo na semana × capacidade. */
export function WeekPlanModal({ isOpen, onClose, columns, onCardClick }: Props) {
  const [capacity, setCapacity] = useState<number>(() => {
    try { return Number(localStorage.getItem("pends:weekCapacity")) || 30; } catch { return 30; }
  });

  const weeks = useMemo(() => {
    const open = columns.flatMap((col) => (col.isDone ? [] : col.cards.filter((c) => !c.completed && !c.assignee).map((c) => ({ c, col }))));
    return [0, 1].map((offset) => {
      const start = weekStart(offset);
      const end = start + 7 * DAY;
      const late = offset === 0 ? open.filter(({ c }) => c.dueDate && new Date(c.dueDate).getTime() < start) : [];
      const inWeek = open.filter(({ c }) => {
        if (!c.dueDate) return false;
        const t = new Date(c.dueDate).getTime();
        return t >= start && t < end;
      });
      const items = [...late, ...inWeek];
      const planned = items.reduce((s, { c }) => s + (c.estimateHours ?? 0), 0);
      const spent = items.reduce((s, { c }) => s + (c.spentMinutes ?? 0), 0) / 60;
      const noEstimate = items.filter(({ c }) => !c.estimateHours).length;
      return { offset, start, items, planned, spent, noEstimate, lateCount: late.length };
    });
  }, [columns]);

  if (!isOpen) return null;

  function saveCapacity(v: number) {
    setCapacity(v);
    try { localStorage.setItem("pends:weekCapacity", String(v)); } catch {}
  }

  const fmtDay = (t: number) => new Date(t).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-slate-800 bg-[#0a0f1d] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider font-mono">
            <CalendarRange size={15} className="text-cyan-400" /> Planejamento da semana
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Minha capacidade por semana:
            <input type="number" min={1} max={80} value={capacity} onChange={(e) => saveCapacity(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 bg-[#050811] border border-slate-800 rounded-lg px-2 py-1 text-white text-sm outline-none" />
            horas
          </label>
          <p className="text-[10px] text-slate-500 font-mono -mt-3">Conta só o que está com você (não o que está com outra pessoa) e tem prazo na semana; atrasados entram na semana atual.</p>

          {weeks.map((w) => {
            const pct = Math.min((w.planned / capacity) * 100, 100);
            const over = w.planned > capacity;
            return (
              <section key={w.offset} className="space-y-2">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-white">{w.offset === 0 ? "Esta semana" : "Próxima semana"}</p>
                    <p className="text-[10px] font-mono text-slate-500">{fmtDay(w.start)} a {fmtDay(w.start + 6 * DAY)}</p>
                  </div>
                  <p className={`text-sm font-bold font-mono ${over ? "text-rose-400" : "text-cyan-300"}`}>
                    {hours(w.planned)} <span className="text-slate-500 font-normal">/ {capacity} h</span>
                  </p>
                </div>
                <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div className={`h-full rounded-full ${over ? "bg-rose-500" : "bg-cyan-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-500">
                  {w.offset === 0 && w.spent > 0 && <span>já gasto: {hours(Math.round(w.spent * 10) / 10)}</span>}
                  {w.noEstimate > 0 && <span className="text-amber-400 flex items-center gap-1"><AlertTriangle size={10} /> {w.noEstimate} sem estimativa</span>}
                  {w.lateCount > 0 && <span className="text-rose-400">{w.lateCount} atrasado(s) incluído(s)</span>}
                  {over && <span className="text-rose-400">passou {hours(Math.round((w.planned - capacity) * 10) / 10)} da capacidade</span>}
                </div>
                {w.items.length === 0 ? (
                  <p className="text-xs text-slate-600 font-mono py-2">Nada com prazo nessa semana.</p>
                ) : (
                  <div className="rounded-xl border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
                    {w.items.map(({ c, col }) => (
                      <button key={c.id} type="button" onClick={() => { onClose(); onCardClick(c.id); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#050811] cursor-pointer">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.project?.color ?? c.module?.color ?? "#64748b" }} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] text-slate-100 truncate">{c.title}</span>
                          <span className="block text-[10px] font-mono text-slate-500 truncate">{c.project?.title ? `${c.project.title} · ` : ""}{col.title}</span>
                        </span>
                        <span className={`text-[11px] font-mono shrink-0 ${c.estimateHours ? "text-slate-300" : "text-amber-400"}`}>
                          {c.estimateHours ? hours(c.estimateHours) : "? h"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
