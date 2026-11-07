"use client";

import { useCallback, useEffect, useState } from "react";
import type { Module } from "@prisma/client";
import { X, Repeat, Plus, Pencil, Trash2, Power } from "lucide-react";
import { createRoutine, deleteRecurringTask, getRoutines, toggleRecurringActive, updateRoutine } from "../../actions";

type Routine = Awaited<ReturnType<typeof getRoutines>>[number];

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const PRIORITIES = ["Baixa", "Normal", "Alta", "Urgente"];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  modules: Module[];
  onChanged: () => void;
}

export function RoutinesModal({ isOpen, onClose, modules, onChanged }: Props) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [editing, setEditing] = useState<Routine | "new" | null>(null);

  const load = useCallback(() => {
    getRoutines().then(setRoutines).catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const describe = (r: Routine) =>
    r.frequency === "WEEKLY" ? `Toda ${WEEKDAYS[r.weekday ?? 1].toLowerCase()}` : `Todo dia ${r.dueDay ?? 1}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-[#0a0f1d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-[#0a0f1d]">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider font-mono">
            <Repeat size={15} className="text-cyan-400" /> Rotinas
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-[11px] text-slate-500 font-mono">
            Tarefas que se repetem viram um card sozinhas, uma vez por semana ou por mês, na primeira etapa do pipeline.
          </p>

          {editing ? (
            <RoutineForm
              routine={editing === "new" ? null : editing}
              modules={modules}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                load();
                onChanged();
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-slate-700 hover:border-cyan-500/60 text-slate-400 hover:text-cyan-300 text-xs font-bold font-mono cursor-pointer"
            >
              <Plus size={14} /> Nova rotina
            </button>
          )}

          <div className="space-y-1">
            {routines.map((r) => (
              <div key={r.id} className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-800 bg-[#050811] ${r.active ? "" : "opacity-45"}`}>
                <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: r.module?.color ?? "#64748b" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-100 truncate">{r.title}</p>
                  <p className="text-[10px] font-mono text-slate-500">
                    {describe(r)} · {r.priority} · {r.module?.title ?? "Sem módulo"}
                    {!r.active && " · pausada"}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Btn title={r.active ? "Pausar" : "Reativar"} onClick={async () => { await toggleRecurringActive(r.id); load(); }}>
                    <Power size={13} />
                  </Btn>
                  <Btn title="Editar" onClick={() => setEditing(r)}>
                    <Pencil size={13} />
                  </Btn>
                  <Btn
                    title="Excluir"
                    danger
                    onClick={async () => {
                      if (!confirm(`Excluir a rotina "${r.title}"? Os cards já criados continuam no quadro.`)) return;
                      await deleteRecurringTask(r.id);
                      load();
                    }}
                  >
                    <Trash2 size={13} />
                  </Btn>
                </div>
              </div>
            ))}
            {routines.length === 0 && !editing && (
              <p className="text-center text-xs text-slate-600 font-mono py-6">Nenhuma rotina ainda.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`p-1.5 rounded-lg text-slate-500 hover:bg-slate-800 cursor-pointer ${danger ? "hover:text-rose-400" : "hover:text-white"}`}
    >
      {children}
    </button>
  );
}

function RoutineForm({
  routine, modules, onCancel, onSaved,
}: { routine: Routine | null; modules: Module[]; onCancel: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(routine?.title ?? "");
  const [frequency, setFrequency] = useState<"MONTHLY" | "WEEKLY">((routine?.frequency as "MONTHLY" | "WEEKLY") ?? "WEEKLY");
  const [dueDay, setDueDay] = useState(routine?.dueDay ?? 1);
  const [weekday, setWeekday] = useState(routine?.weekday ?? 1);
  const [moduleId, setModuleId] = useState(routine?.moduleId ?? modules[0]?.id ?? "");
  const [priority, setPriority] = useState(routine?.priority ?? "Normal");
  const [error, setError] = useState("");

  async function save() {
    if (!title.trim()) return setError("Dê um nome para a rotina.");
    const data = { title, frequency, dueDay, weekday, moduleId, priority };
    try {
      if (routine) await updateRoutine(routine.id, data);
      else await createRoutine(data);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }

  const input = "w-full bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-cyan-500";

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 space-y-3">
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Revisar e-mails da faculdade" className={input} />
      <div className="grid grid-cols-2 gap-1.5">
        {(["WEEKLY", "MONTHLY"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFrequency(f)}
            className={`py-1.5 rounded-lg border text-[11px] font-bold font-mono cursor-pointer ${
              frequency === f ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-200" : "border-slate-800 text-slate-500"
            }`}
          >
            {f === "WEEKLY" ? "Semanal" : "Mensal"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {frequency === "WEEKLY" ? (
          <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className={input}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        ) : (
          <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))} className={input} title="Dia do mês" />
        )}
        <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className={input}>
          <option value="">Sem módulo</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={input}>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400 cursor-pointer">Cancelar</button>
        <button type="button" onClick={() => void save()} className="px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold cursor-pointer">Salvar</button>
      </div>
    </div>
  );
}
