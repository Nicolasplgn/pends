"use client";

// "Pulso" do Painel: dinheiro e pendências mês a mês no mesmo gráfico.
// Barras = entradas e saídas (R$), linha ciano = saldo do mês (R$),
// linhas no eixo da direita = pendências criadas e concluídas.

import { useMemo, useState } from "react";
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import type { FinanceSnapshot, KanbanColumn } from "../../types";
import { MONTH_NAMES } from "../../types";

interface PulseChartProps {
  finance: FinanceSnapshot | null;
  columns: KanbanColumn[];
  selectedMonth: number;
  selectedYear: number;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compact = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(Math.round(v));

type Series = "dinheiro" | "pendencias" | "tudo";

export function PulseChart({ finance, columns, selectedMonth, selectedYear }: PulseChartProps) {
  const [series, setSeries] = useState<Series>("tudo");

  const data = useMemo(() => {
    const cards = columns.flatMap((c) => c.cards.map((card) => ({ ...card, isDone: c.isDone })));
    const months = [...(finance?.history ?? []), ...(finance?.outlook ?? [])];
    // 3 meses para trás, o mês escolhido e 3 para frente
    return Array.from({ length: 7 }).map((_, i) => {
      const offset = i - 3;
      const d = new Date(selectedYear, selectedMonth + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const inMonth = (v: Date | string | null | undefined) => {
        if (!v) return false;
        const x = new Date(v);
        return x.getFullYear() === y && x.getMonth() === m;
      };
      const h = months.find((x) => x.year === y && x.month === m);
      return {
        offset,
        name: `${MONTH_NAMES[m].slice(0, 3)}${m === 0 ? `/${String(y).slice(2)}` : ""}${offset > 0 ? "*" : ""}`,
        entradas: h?.income ?? 0,
        saidas: h?.expense ?? 0,
        saldo: h?.balance ?? 0,
        criadas: cards.filter((c) => inMonth(c.createdAt)).length,
        concluidas: cards.filter((c) => (c.completed || c.isDone) && inMonth(c.completedAt ?? (c.isDone ? c.updatedAt : null))).length,
        prazos: cards.filter((c) => !c.completed && !c.isDone && inMonth(c.dueDate)).length,
      };
    });
  }, [finance, columns, selectedMonth, selectedYear]);

  const insights = useMemo(() => {
    const cur = data.find((d) => d.offset === 0)!;
    const past = data.filter((d) => d.offset < 0);
    const ahead = data.filter((d) => d.offset > 0);
    const avg = (k: "saidas" | "concluidas") => (past.length ? past.reduce((s, d) => s + d[k], 0) / past.length : 0);
    const avgOut = avg("saidas");
    const avgDone = avg("concluidas");
    const aheadOut = ahead.reduce((s, d) => s + d.saidas, 0);
    const open = columns.reduce((s, c) => s + (c.isDone ? 0 : c.cards.filter((x) => !x.completed).length), 0);
    const flow = cur.concluidas - cur.criadas;
    return [
      {
        label: "Saídas vs média",
        value: avgOut > 0 ? `${cur.saidas >= avgOut ? "+" : ""}${Math.round(((cur.saidas - avgOut) / avgOut) * 100)}%` : "—",
        hint: `média de ${brl(avgOut)}`,
        tone: avgOut > 0 && cur.saidas > avgOut * 1.1 ? "text-rose-400" : "text-emerald-400",
      },
      {
        label: "Saldo do mês",
        value: brl(cur.saldo),
        hint: `próx. 3 meses: ${brl(aheadOut)} já comprometidos`,
        tone: cur.saldo < 0 ? "text-rose-400" : "text-cyan-300",
      },
      {
        label: "Ritmo de entrega",
        value: `${cur.concluidas} feitas`,
        hint: avgDone > 0 ? `média de ${avgDone.toFixed(1)}/mês` : "primeiro mês com dados",
        tone: cur.concluidas >= avgDone ? "text-violet-300" : "text-amber-300",
      },
      {
        label: "Fila de pendências",
        value: `${open} abertas`,
        hint: flow >= 0 ? `fila diminuiu ${flow} no mês` : `fila cresceu ${-flow} no mês`,
        tone: flow >= 0 ? "text-emerald-400" : "text-amber-300",
      },
    ];
  }, [data, columns]);
  const currentName = data.find((d) => d.offset === 0)?.name;

  const showMoney = series !== "pendencias";
  const showTasks = series !== "dinheiro";

  return (
    <div className="bg-[#0b101f] border border-slate-800/90 rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} className="text-cyan-400" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-black">Pulso · 3 meses para trás e 3 para frente</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">Dinheiro e pendências no mesmo compasso</h3>
        </div>
        <div className="flex items-center bg-[#070b14] border border-slate-800 p-1 rounded-2xl self-start">
          {([["tudo", "Tudo"], ["dinheiro", "Dinheiro"], ["pendencias", "Pendências"]] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSeries(k)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                series === k ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-white"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
        {insights.map((i) => (
          <div key={i.label} className="bg-[#070b14] border border-slate-800 rounded-2xl p-3 min-w-0">
            <div className="text-[10px] font-mono uppercase text-slate-500 truncate">{i.label}</div>
            <div className={`text-lg sm:text-xl font-mono font-black truncate ${i.tone}`}>{i.value}</div>
            <div className="text-[10px] text-slate-500 truncate">{i.hint}</div>
          </div>
        ))}
      </div>

      <p className="relative text-[10px] font-mono text-slate-500 mb-1">* meses futuros: só o que já está lançado (contas, faturas, parcelas e prazos).</p>
      <div className="relative h-80 sm:h-96 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pulse-in" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.35} />
              </linearGradient>
              <linearGradient id="pulse-out" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis yAxisId="money" hide={!showMoney} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={compact} width={40} />
            <YAxis yAxisId="tasks" hide={!showTasks} orientation="right" stroke="#a78bfa" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.06)" }}
              contentStyle={{ backgroundColor: "rgba(10,15,29,0.92)", border: "1px solid #334155", borderRadius: 14, fontSize: 12 }}
              labelStyle={{ color: "#fff", fontWeight: 700 }}
              formatter={(value, name) => {
                const n = Number(value);
                return [["Entradas", "Saídas", "Saldo"].includes(String(name)) ? brl(n) : n, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
            {showMoney && <ReferenceLine yAxisId="money" y={0} stroke="#334155" />}
            {currentName && (
              <ReferenceLine
                yAxisId={showMoney ? "money" : "tasks"}
                x={currentName}
                stroke="#22d3ee"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: "agora", position: "insideTop", fill: "#22d3ee", fontSize: 10 }}
              />
            )}
            {showMoney && <Bar yAxisId="money" dataKey="entradas" name="Entradas" fill="url(#pulse-in)" radius={[6, 6, 0, 0]} maxBarSize={28} />}
            {showMoney && <Bar yAxisId="money" dataKey="saidas" name="Saídas" fill="url(#pulse-out)" radius={[6, 6, 0, 0]} maxBarSize={28} />}
            {showMoney && <Line yAxisId="money" type="monotone" dataKey="saldo" name="Saldo" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, fill: "#22d3ee" }} activeDot={{ r: 6 }} />}
            {showTasks && <Line yAxisId="tasks" type="monotone" dataKey="concluidas" name="Concluídas" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 3 }} />}
            {showTasks && <Line yAxisId="tasks" type="monotone" dataKey="criadas" name="Criadas" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5 }} />}
            {showTasks && <Line yAxisId="tasks" type="monotone" dataKey="prazos" name="Prazos abertos" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2.5 }} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
