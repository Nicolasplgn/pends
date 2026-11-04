"use client";

import { useMemo } from "react";
import { Wallet, TrendingDown, CheckCircle, PieChart as PieIcon, LineChart, Coins } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface FinanceDashboardProps {
  recurringTasks: any[];
  selectedMonth: number;
  selectedYear: number;
}

export function FinanceDashboard({
  recurringTasks,
  selectedMonth, // ✅ Adicionado nas desestruturações das Props
  selectedYear,
}: FinanceDashboardProps) {
  const totalMensal = recurringTasks.reduce((acc, r) => acc + (r.amount || 0), 0);
  const paidTasks = recurringTasks.filter(r => {
    // Se a recurring task tiver algum card no Kanban que esteja completo no mês atual, consideramos paga
    const hasPaidCard = r.cards?.some((c: any) => (c.completed || c.column?.isDone) && new Date(c.createdAt).getMonth() === selectedMonth);
    return hasPaidCard;
  });

  const categoryData = useMemo(() => {
    const map: Record<string, { name: string; amount: number; color: string }> = {};
    // Filtra para garantir que só computamos tarefas que ainda existem
    recurringTasks.forEach((task) => {
      // Adicione esta checagem de segurança
      if (!task) return; 
      
      const modName = task.module?.title || "Geral / Pessoal";
      const color = task.module?.color || "#F59E0B";
      if (!map[modName]) {
        map[modName] = { name: modName, amount: 0, color };
      }
      map[modName].amount += (task.amount || 0);
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [recurringTasks]);

  const timelineData = useMemo(() => {
    const daysMap: Record<number, number> = {};
    recurringTasks.forEach((task) => {
      const day = task.dueDay || 1;
      if (!daysMap[day]) daysMap[day] = 0;
      daysMap[day] += (task.amount || 0);
    });
    return Object.entries(daysMap).map(([day, val]) => ({
      dia: `Dia ${day}`,
      valor: val,
    })).sort((a, b) => parseInt(a.dia.replace("Dia ", "")) - parseInt(b.dia.replace("Dia ", "")));
  }, [recurringTasks]);

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-6">
      
      {/* 4 KPIS BANCÁRIOS SUPERIORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* TOTAL PREVISTO */}
        {/* ✅ Classe bg-gradient-to-br corrigida para bg-linear-to-br (Tailwind v4) */}
        <div className="bg-linear-to-br from-[#0b101f] to-[#070b14] p-5 sm:p-6 rounded-3xl border border-emerald-900/40 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="flex justify-between items-start mb-3 relative z-10">
            <span className="text-[11px] font-mono font-bold uppercase text-slate-400">Total Previsto</span>
            <div className="w-8 h-8 rounded-full bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              <Wallet size={14} />
            </div>
          </div>
          <div className="text-3xl font-mono font-black text-emerald-400 relative z-10">
            {totalMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-[10px] text-emerald-500/60 mt-1 font-mono uppercase tracking-wider relative z-10">Orçamento Bruto</div>
        </div>

        {/* MÉDIA DIÁRIA DE SAÍDA */}
        <div className="bg-[#0b101f] p-5 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-mono font-bold uppercase text-slate-400">Média por Conta</span>
            <div className="w-8 h-8 rounded-full bg-cyan-950/60 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <TrendingDown size={14} />
            </div>
          </div>
          <div className="text-3xl font-mono font-black text-white">
            {(recurringTasks.length > 0 ? totalMensal / recurringTasks.length : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono uppercase tracking-wider">Ticket Médio</div>
        </div>

        {/* CONTAS MAPEADAS */}
        <div className="bg-[#0b101f] p-5 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-mono font-bold uppercase text-slate-400">Contas Mapeadas</span>
            <div className="w-8 h-8 rounded-full bg-blue-950/60 border border-blue-800/80 flex items-center justify-center text-blue-400">
              <Coins size={14} />
            </div>
          </div>
          <div className="text-3xl font-mono font-black text-white">{recurringTasks.length}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono uppercase tracking-wider">Planilha Base</div>
        </div>

        {/* STATUS DE QUITAÇÃO */}
        <div className="bg-[#0b101f] p-5 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-mono font-bold uppercase text-amber-400">Contas Pagas</span>
            <div className="w-8 h-8 rounded-full bg-amber-950/60 border border-amber-800/80 flex items-center justify-center text-amber-400">
              <CheckCircle size={14} />
            </div>
          </div>
          <div className="text-3xl font-mono font-black text-amber-400">
            {paidTasks.length} <span className="text-sm text-slate-500">/ {recurringTasks.length}</span>
          </div>
          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${recurringTasks.length > 0 ? (paidTasks.length / recurringTasks.length) * 100 : 0}%` }} />
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* GRÁFICO DE PIZZA (DONUT DE DESPESAS) */}
        <div className="bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl flex flex-col">
          <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono mb-6 flex items-center gap-2">
            <PieIcon size={16} className="text-blue-400" />
            <span>Fatia do Orçamento por Módulo</span>
          </h3>

          <div className="flex-1 flex flex-col sm:flex-row items-center gap-6">
            <div className="h-48 w-48 shrink-0">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={65}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "12px", color: "#fff", fontSize: "12px", fontFamily: "monospace" }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-full border-4 border-dashed border-slate-800 flex items-center justify-center text-slate-600 font-mono text-[10px]">
                  Sem dados
                </div>
              )}
            </div>

            <div className="flex-1 w-full space-y-3">
              {categoryData.slice(0, 4).map((cat, i) => (
                <div key={i} className="flex items-center justify-between bg-[#070b14] p-3 rounded-2xl border border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shadow-md" style={{ backgroundColor: cat.color }} />
                    <span className="text-xs font-semibold text-slate-300 truncate max-w-32">{cat.name}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white">
                    {cat.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* GRÁFICO DE BARRAS (TIMELINE DE VENCIMENTOS) */}
        <div className="bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl flex flex-col">
          <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono mb-6 flex items-center gap-2">
            <LineChart size={16} className="text-emerald-400" />
            <span>Picos de Saída (Volume por Dia)</span>
          </h3>

          {/* ✅ Classe min-h-[220px] corrigida para min-h-55 */}
          <div className="flex-1 w-full min-h-55">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="dia" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
                  <Tooltip 
                    cursor={{ fill: '#1e293b', opacity: 0.4 }}
                    formatter={(value: any) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "12px", color: "#fff", fontSize: "12px", fontFamily: "monospace" }}
                  />
                  <Bar dataKey="valor" fill="#10B981" radius={[4, 4, 0, 0]} barSize={30}>
                    {timelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.valor > (totalMensal / 3) ? "#ef4444" : "#10B981"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
                Nenhum dia de vencimento mapeado.
              </div>
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-4 text-center">
            * Barras <span className="text-red-400 font-bold">vermelhas</span> indicam dias críticos com alta concentração de vencimentos.
          </div>
        </div>

      </div>
    </div>
  );
}