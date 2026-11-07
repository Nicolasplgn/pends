"use client";

import { useEffect, useState } from "react";
import { Target, Plus, Pencil, Trash2, X, PiggyBank, ArrowDownToLine } from "lucide-react";
import { contributeGoal, createGoal, deleteGoal, updateGoal } from "@/app/actions";
import type { FinanceOverview } from "../../types";
import { MONTH_NAMES } from "../../types";
import { brl, moneyToInput, parseMoney, toInputDate } from "./format";
import { Bar, EmptyState, IconBtn, Panel } from "./ui";

type Goal = FinanceOverview["goals"][number];

const COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EC4899", "#06B6D4", "#F43F5E"];

interface Props {
  goals: Goal[];
  onChanged: (message: string) => void;
}

export function FinanceGoals({ goals, onChanged }: Props) {
  const [modal, setModal] = useState<{ open: boolean; goal: Goal | null }>({ open: false, goal: null });
  const [confirmDel, setConfirmDel] = useState<Goal | null>(null);

  const saved = goals.reduce((s, g) => s + g.saved, 0);
  const target = goals.reduce((s, g) => s + g.target, 0);
  const monthly = goals.filter((g) => g.active && g.remaining > 0).reduce((s, g) => s + (g.monthly ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Guardado nas metas" value={brl(saved)} tone="text-emerald-400" />
        <Stat label="Falta para todas" value={brl(Math.max(target - saved, 0))} tone="text-slate-200" />
        <Stat label="Aporte planejado / mês" value={brl(monthly)} tone="text-blue-300" />
      </div>

      <Panel
        title="Metas e reservas"
        icon={<Target size={14} className="text-emerald-400" />}
        right={
          <button
            type="button"
            onClick={() => setModal({ open: true, goal: null })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-[11px] font-bold hover:bg-slate-700 cursor-pointer"
          >
            <Plus size={12} /> Nova meta
          </button>
        }
      >
        {goals.length === 0 ? (
          <EmptyState>
            Crie caixinhas como Reserva de emergência, Viagem ou Notebook novo.<br />
            O aporte mensal entra na projeção dos próximos meses.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onEdit={() => setModal({ open: true, goal: g })}
                onDelete={() => setConfirmDel(g)}
                onChanged={onChanged}
              />
            ))}
          </div>
        )}
      </Panel>

      {modal.open && <GoalModal goal={modal.goal} onClose={() => setModal({ open: false, goal: null })} onSaved={onChanged} />}

      {confirmDel && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4" onClick={() => setConfirmDel(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Excluir a meta “{confirmDel.title}”?</h3>
            <p className="text-xs text-slate-400">Os lançamentos de aporte já feitos continuam no financeiro.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 rounded-lg border border-slate-800 text-xs text-slate-400 cursor-pointer">Cancelar</button>
              <button
                onClick={async () => {
                  await deleteGoal(confirmDel.id);
                  setConfirmDel(null);
                  onChanged("Meta excluída");
                }}
                className="px-4 py-2 rounded-lg bg-rose-500/20 border border-rose-500 text-rose-200 text-xs font-bold cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal: g, onEdit, onDelete, onChanged }: { goal: Goal; onEdit: () => void; onDelete: () => void; onChanged: (m: string) => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const pct = g.target > 0 ? Math.min(Math.round((g.saved / g.target) * 100), 100) : 0;
  const done = g.remaining <= 0;

  async function move(sign: 1 | -1) {
    const v = parseMoney(value);
    if (!(v > 0)) return;
    setBusy(true);
    try {
      await contributeGoal(g.id, sign * v, true);
      setValue("");
      onChanged(sign > 0 ? `Aporte de ${brl(v)} em ${g.title}` : `Resgate de ${brl(v)} de ${g.title}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-xl border bg-[#050811] p-4 space-y-3 ${done ? "border-emerald-500/40" : "border-slate-800"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-white truncate">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
            {g.title}
            {done && <span className="text-[10px] text-emerald-400 font-mono">✓ concluída</span>}
          </p>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            {brl(g.saved)} de {brl(g.target)} · {pct}%
          </p>
        </div>
        <div className="flex shrink-0">
          <IconBtn title="Editar" onClick={onEdit}><Pencil size={13} /></IconBtn>
          <IconBtn title="Excluir" danger onClick={onDelete}><Trash2 size={13} /></IconBtn>
        </div>
      </div>

      <Bar value={g.saved} max={g.target} color={g.color} />

      <div className="text-[10px] font-mono text-slate-400 space-y-0.5">
        {!done && g.monthly ? (
          <p>
            {brl(g.monthly)}/mês → chega lá em{" "}
            <b className="text-slate-200">
              {g.eta ? `${MONTH_NAMES[new Date(g.eta).getUTCMonth()].slice(0, 3)}/${new Date(g.eta).getUTCFullYear()}` : "—"}
            </b>{" "}
            ({g.monthsLeft} {g.monthsLeft === 1 ? "mês" : "meses"})
          </p>
        ) : !done ? (
          <p>Sem aporte mensal definido.</p>
        ) : null}
        {g.deadline && !done && g.neededMonthly !== null && (
          <p className={g.monthly && g.monthly >= g.neededMonthly ? "text-emerald-500" : "text-amber-400"}>
            Para bater até {new Date(g.deadline).toLocaleDateString("pt-BR", { timeZone: "UTC", month: "short", year: "numeric" })}: {brl(g.neededMonthly)}/mês
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">R$</span>
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void move(1)}
            placeholder={g.monthly ? moneyToInput(g.monthly) : "0,00"}
            className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white font-mono outline-none focus:border-emerald-500"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void move(1)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-bold disabled:opacity-50 cursor-pointer"
          title="Guardar (vira uma saída paga na categoria Metas)"
        >
          <PiggyBank size={12} /> Guardar
        </button>
        <button
          type="button"
          disabled={busy || g.saved <= 0}
          onClick={() => void move(-1)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-[11px] disabled:opacity-40 cursor-pointer"
          title="Resgatar (vira uma entrada recebida)"
        >
          <ArrowDownToLine size={12} /> Resgatar
        </button>
      </div>
    </div>
  );
}

function GoalModal({ goal, onClose, onSaved }: { goal: Goal | null; onClose: () => void; onSaved: (m: string) => void }) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [target, setTarget] = useState(moneyToInput(goal?.target));
  const [saved, setSaved] = useState(moneyToInput(goal?.saved ?? 0));
  const [monthly, setMonthly] = useState(moneyToInput(goal?.monthly));
  const [deadline, setDeadline] = useState(toInputDate(goal?.deadline));
  const [color, setColor] = useState(goal?.color ?? COLORS[0]);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = parseMoney(target);
    if (!title.trim() || !(t > 0)) return setError("Informe nome e valor alvo.");
    const data = {
      title,
      target: t,
      saved: parseMoney(saved) || 0,
      monthly: monthly.trim() ? parseMoney(monthly) : null,
      deadline: deadline || null,
      color,
    };
    try {
      if (goal) await updateGoal(goal.id, data);
      else await createGoal(data);
      onSaved(goal ? "Meta atualizada" : "Meta criada");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }

  const input = "w-full bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500";
  const label = "text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">{goal ? "Editar meta" : "Nova meta"}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div>
          <label className={label}>Nome</label>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reserva de emergência" className={input} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Valor alvo</label>
            <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10.000,00" className={`${input} font-mono`} />
          </div>
          <div>
            <label className={label}>Já guardado</label>
            <input inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} className={`${input} font-mono`} />
          </div>
          <div>
            <label className={label}>Aporte por mês</label>
            <input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="opcional" className={`${input} font-mono`} />
          </div>
          <div>
            <label className={label}>Prazo</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`${input} scheme-dark`} />
          </div>
        </div>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full cursor-pointer ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#0a0f1d]" : ""}`}
              style={{ backgroundColor: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-800 text-xs text-slate-400 cursor-pointer">Cancelar</button>
          <button type="submit" className="px-5 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer">Salvar</button>
        </div>
      </form>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0a0f1d] p-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">{label}</p>
      <p className={`text-xl font-bold font-mono mt-1 ${tone}`}>{value}</p>
    </div>
  );
}
