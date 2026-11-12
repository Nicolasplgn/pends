"use client";

import { useEffect, useState } from "react";
import type { Project } from "@prisma/client";
import { Timer, Square, Lock, ListChecks, Plus, X, FolderKanban } from "lucide-react";
import {
  addSpentMinutes, toggleCardTimer, updateCardPlanning, updateChecklist, type ChecklistItem,
} from "../../actions";
import type { CardDetails, KanbanColumn } from "../../types";

interface Props {
  card: CardDetails;
  projects: Project[];
  columns: KanbanColumn[];
  onChanged: () => void;
}

const label = "text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1";
const input = "w-full bg-[#070a12] border border-slate-800 p-2 rounded-xl text-xs text-white outline-none focus:border-blue-500";

export function fmtMinutes(m: number) {
  if (!m) return "0 min";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h} h${r ? ` ${r} min` : ""}` : `${r} min`;
}

export function CardPlanning({ card, projects, columns, onChanged }: Props) {
  const [projectId, setProjectId] = useState(card.projectId ?? "");
  const [estimate, setEstimate] = useState(card.estimateHours ? String(card.estimateHours).replace(".", ",") : "");
  const [blockedById, setBlockedById] = useState(card.blockedById ?? "");
  const [spent, setSpent] = useState(card.spentMinutes ?? 0);
  const [timerAt, setTimerAt] = useState<Date | null>(card.timerStartedAt ? new Date(card.timerStartedAt) : null);
  const [items, setItems] = useState<ChecklistItem[]>(((card.checklist as unknown) as ChecklistItem[] | null) ?? []);
  const [newItem, setNewItem] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // Relógio só enquanto o cronômetro roda
  useEffect(() => {
    if (!timerAt) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [timerAt]);

  const running = timerAt ? Math.max(0, Math.round((now - timerAt.getTime()) / 60000)) : 0;
  const totalSpent = spent + running;
  const est = Number(estimate.replace(",", ".")) || 0;
  const over = est > 0 && totalSpent / 60 > est;

  const candidates = columns.flatMap((col) =>
    col.cards.filter((c) => c.id !== card.id && !c.completed && !col.isDone).map((c) => ({ id: c.id, title: c.title, col: col.title }))
  );

  async function saveChecklist(next: ChecklistItem[]) {
    setItems(next);
    await updateChecklist(card.id, next);
    onChanged();
  }

  async function timer() {
    const r = await toggleCardTimer(card.id);
    setSpent(r.spentMinutes);
    setTimerAt(r.running ? new Date() : null);
    setNow(Date.now());
    onChanged();
  }

  async function add(min: number) {
    const total = await addSpentMinutes(card.id, min);
    setSpent(total);
    onChanged();
  }

  const done = items.filter((i) => i.done).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label}><span className="inline-flex items-center gap-1"><FolderKanban size={11} /> Projeto</span></label>
          <select
            className={`${input} cursor-pointer`}
            value={projectId}
            onChange={async (e) => {
              setProjectId(e.target.value);
              await updateCardPlanning(card.id, { projectId: e.target.value || null });
              onChanged();
            }}
          >
            <option value="">Sem projeto</option>
            {projects.filter((p) => p.active || p.id === projectId).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        <div>
          <label className={label}><span className="inline-flex items-center gap-1"><Lock size={11} /> Bloqueado por</span></label>
          <select
            className={`${input} cursor-pointer`}
            value={blockedById}
            onChange={async (e) => {
              setBlockedById(e.target.value);
              await updateCardPlanning(card.id, { blockedById: e.target.value || null });
              onChanged();
            }}
          >
            <option value="">Nada (livre)</option>
            {card.blockedBy && !candidates.some((c) => c.id === card.blockedBy!.id) && (
              <option value={card.blockedBy.id}>{card.blockedBy.title} (concluído)</option>
            )}
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.title} · {c.col}</option>)}
          </select>
        </div>
      </div>

      {/* HORAS */}
      <div className="rounded-xl border border-slate-800 bg-[#070a12] p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase font-mono">
            Estimativa
            <input
              inputMode="decimal"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              onBlur={async () => {
                await updateCardPlanning(card.id, { estimateHours: est || null });
                onChanged();
              }}
              placeholder="0"
              className="w-14 bg-[#050811] border border-slate-800 rounded-lg px-2 py-1 text-xs text-white text-right outline-none focus:border-blue-500 normal-case font-normal"
            />
            h
          </label>
          <span className={`text-[11px] font-mono ${over ? "text-rose-400 font-bold" : "text-slate-300"}`}>
            gasto: {fmtMinutes(totalSpent)}{est ? ` de ${String(est).replace(".", ",")} h` : ""}
          </span>
        </div>
        {est > 0 && (
          <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
            <div className={`h-full rounded-full ${over ? "bg-rose-500" : "bg-cyan-500"}`} style={{ width: `${Math.min((totalSpent / 60 / est) * 100, 100)}%` }} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void timer()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              timerAt ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse" : "bg-cyan-600 text-white hover:bg-cyan-500"
            }`}
          >
            {timerAt ? <><Square size={12} /> Parar ({fmtMinutes(running)})</> : <><Timer size={13} /> Iniciar cronômetro</>}
          </button>
          {[15, 30, 60].map((m) => (
            <button key={m} type="button" onClick={() => void add(m)} className="px-2 py-1.5 rounded-lg border border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white cursor-pointer">
              +{m === 60 ? "1 h" : `${m} min`}
            </button>
          ))}
          {spent > 0 && (
            <button type="button" onClick={() => void add(-15)} className="px-2 py-1.5 rounded-lg text-[11px] font-mono text-slate-500 hover:text-white cursor-pointer">
              −15 min
            </button>
          )}
        </div>
      </div>

      {/* CHECKLIST */}
      <div>
        <label className="text-[11px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5 mb-1.5">
          <ListChecks size={14} className="text-violet-400" /> Checklist {items.length > 0 && <span className="text-slate-500">{done}/{items.length}</span>}
        </label>
        {items.length > 0 && (
          <div className="h-1 rounded-full bg-slate-900 overflow-hidden mb-2">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${(done / items.length) * 100}%` }} />
          </div>
        )}
        <div className="space-y-1">
          {items.map((i) => (
            <div key={i.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#070a12]">
              <input
                type="checkbox"
                checked={i.done}
                onChange={() => void saveChecklist(items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)))}
                className="accent-violet-500 w-4 h-4 shrink-0 cursor-pointer"
                aria-label={i.text}
              />
              <span className={`flex-1 text-xs ${i.done ? "line-through text-slate-500" : "text-slate-200"}`}>{i.text}</span>
              <button
                type="button"
                onClick={() => void saveChecklist(items.filter((x) => x.id !== i.id))}
                className="p-1 text-slate-600 hover:text-rose-400 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                aria-label="Remover item"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newItem.trim()) {
                void saveChecklist([...items, { id: crypto.randomUUID().slice(0, 8), text: newItem.trim(), done: false }]);
                setNewItem("");
              }
            }}
            placeholder="Novo item e Enter (ex.: testar na tela, enviar pra revisão)"
            className={input}
          />
          <button
            type="button"
            disabled={!newItem.trim()}
            onClick={() => {
              void saveChecklist([...items, { id: crypto.randomUUID().slice(0, 8), text: newItem.trim(), done: false }]);
              setNewItem("");
            }}
            className="px-3 rounded-xl bg-slate-800 text-white disabled:opacity-40 cursor-pointer"
            aria-label="Adicionar item"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
