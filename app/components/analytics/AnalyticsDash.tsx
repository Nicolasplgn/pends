"use client";

import { useMemo, useState } from "react";
import type { Module } from "@prisma/client";
import {
  FileText, Layers, TrendingUp, Clock, AlertTriangle, Calendar, Circle, ShieldCheck, Zap, Activity, ArrowUpRight, Flame, CheckCircle2, Hourglass, Target, Network, AlertCircle
} from "lucide-react";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area
} from "recharts";

import type { DashboardStats, FinanceSnapshot, KanbanColumn } from "../../types";
import { MONTH_NAMES, isCardOverdue } from "../../types";
import { ExecutiveReportModal } from "./ExecutiveReportModal";
import { DateNavigator } from "../shared/DateNavigator";

interface AnalyticsDashProps {
  stats: DashboardStats | null;
  modules: Module[];
  columns: KanbanColumn[];
  finance: FinanceSnapshot | null;
  selectedMonth: number;
  selectedYear: number;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onSelectMonthYear?: (month: number, year: number) => void;
  onToggleComplete: (cardId: string) => void;
  onOpenFinances: () => void;
}

// Helper: Calcula a diferença exata em dias
function getDaysDifference(targetDate: Date | string | null | undefined, fromDate: Date = new Date()): number | null {
  if (!targetDate) return null;
  const now = new Date(fromDate);
  now.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function AnalyticsDash({
  stats,
  modules,
  columns,
  finance,
  selectedMonth,
  selectedYear,
  onPrevMonth,
  onNextMonth,
  onSelectMonthYear,
  onToggleComplete,
  onOpenFinances,
}: AnalyticsDashProps) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [agendaFilter, setAgendaFilter] = useState<"urgent" | "overdue" | "all">("urgent");

  // ==========================================
  // 1. DATA PREPARATION (TELEMETRIA GERAL)
  // ==========================================

  const healthScore = useMemo(() => {
    if (!stats || stats.total === 0) return 100;
    const completionWeight = (stats.completionRate || 0) * 0.6;
    const overduePenalty = Math.min(40, (stats.overdue / stats.total) * 100 * 0.8);
    return Math.max(10, Math.round(completionWeight + (40 - overduePenalty)));
  }, [stats]);

  const activeWIP = useMemo(() => {
    return columns
      .filter((col) => !col.isDone && !/gelo|icebox|radar|espera|sem pressa/i.test(col.title))
      .reduce((sum, col) => sum + col.cards.filter((c) => !c.completed).length, 0);
  }, [columns]);

  const bottleneckColumn = useMemo(() => {
    const openCols = columns.filter((c) => !c.isDone && !/gelo|icebox|radar|espera|sem pressa/i.test(c.title));
    if (openCols.length === 0) return null;
    return openCols.reduce((prev, curr) => (curr.cards.length > prev.cards.length ? curr : prev));
  }, [columns]);

  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const financeHistory = useMemo(
    () => (finance?.history ?? []).map((h) => ({ ...h, name: MONTH_NAMES[h.month].slice(0, 3) })),
    [finance]
  );

  // ==========================================
  // 2. DATA PREPARATION (GRÁFICOS RECHARTS)
  // ==========================================

  // Gráfico de Área: Topografia do Pipeline (Visão de Acúmulo por Coluna)
  const pipelineTopographyData = useMemo(() => {
    return columns.map(col => ({
      name: col.title.replace(/[^\w\s\u00C0-\u00FF]/gi, "").trim() || col.title,
      tarefas: col.cards.filter(c => !c.completed).length, // Somente ativas
      isDone: col.isDone
    }));
  }, [columns]);

  // Gráfico de Pizza: Matriz de Prioridades
  const priorityDistribution = useMemo(() => {
    const counts = { Urgente: 0, Alta: 0, Normal: 0, Baixa: 0 };
    columns.forEach((col) => {
      if (col.isDone) return;
      col.cards.forEach((c) => {
        if (!c.completed) {
          if (counts[c.priority as keyof typeof counts] !== undefined) counts[c.priority as keyof typeof counts]++;
        }
      });
    });

    return [
      { name: "Urgente", value: counts.Urgente, color: "#EF4444" },
      { name: "Alta", value: counts.Alta, color: "#F59E0B" },
      { name: "Normal", value: counts.Normal, color: "#3B82F6" },
      { name: "Baixa", value: counts.Baixa, color: "#64748B" },
    ].filter((p) => p.value > 0);
  }, [columns]);

  // Gráfico de Barras: Timeline de 14 Dias
  const upcomingTimelineData = useMemo(() => {
    const timelineMap: Record<number, number> = {};
    for (let i = 0; i <= 14; i++) timelineMap[i] = 0;

    columns.forEach((col) => {
      col.cards.forEach((c) => {
        if (!c.completed && !col.isDone && c.dueDate) {
          const diff = getDaysDifference(c.dueDate);
          if (diff !== null && diff >= 0 && diff <= 14) {
            timelineMap[diff] += 1;
          }
        }
      });
    });

    return Object.entries(timelineMap).map(([day, val]) => ({
      dia: day === "0" ? "Hoje" : day === "1" ? "Amanhã" : `+${day}d`,
      tarefas: val,
    }));
  }, [columns]);

  // ==========================================
  // 3. DATA PREPARATION (LISTAS INTELIGENTES)
  // ==========================================

  const allOpenCards = useMemo(() => {
    const list: (KanbanColumn["cards"][number] & { colTitle: string })[] = [];
    columns.forEach((col) => {
      if (col.isDone) return;
      col.cards.forEach((card) => {
        if (!card.completed) list.push({ ...card, colTitle: col.title });
      });
    });
    return list;
  }, [columns]);

  const urgentCards = useMemo(() => {
    return allOpenCards.filter(c => c.priority === "Urgente" || c.priority === "Alta").sort((a, b) => {
      const daysA = getDaysDifference(a.dueDate) ?? 999;
      const daysB = getDaysDifference(b.dueDate) ?? 999;
      return daysA - daysB;
    });
  }, [allOpenCards]);

  const overdueCards = useMemo(() => {
    return allOpenCards.filter(c => isCardOverdue(c.dueDate, c.completed)).sort((a, b) => {
      const daysA = getDaysDifference(a.dueDate) ?? -999;
      const daysB = getDaysDifference(b.dueDate) ?? -999;
      return daysA - daysB;
    });
  }, [allOpenCards]);

  const displayAgendaList = agendaFilter === "urgent" ? urgentCards : agendaFilter === "overdue" ? overdueCards : allOpenCards;

  // AGING RADAR: As 5 tarefas mais antigas paradas no sistema
  const agingCards = useMemo(() => {
    return [...allOpenCards]
      .map(c => ({
        ...c,
        daysOpen: Math.abs(getDaysDifference(c.createdAt) ?? 0)
      }))
      .sort((a, b) => b.daysOpen - a.daysOpen)
      .slice(0, 5);
  }, [allOpenCards]);


  // ==========================================
  // RENDERIZAÇÃO
  // ==========================================

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050811] text-cyan-400 font-mono text-sm animate-pulse">
        <Network size={20} className="mr-2" /> Inicializando Telemetria Neural...
      </div>
    );
  }

  // Estilo customizado para o Tooltip do Recharts (Glassmorphism)
  const customTooltipStyle = {
    backgroundColor: "rgba(10, 15, 29, 0.85)",
    backdropFilter: "blur(12px)",
    borderColor: "rgba(51, 65, 85, 0.5)",
    borderRadius: "16px",
    color: "#fff",
    fontSize: "12px",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
    padding: "12px"
  };

  return (
    <div className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto space-y-4 sm:space-y-6 bg-[#050811] text-slate-200">
      
      {/* MODAL DE RELATÓRIO EXECUTIVO OFICIAL */}
      <ExecutiveReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        stats={stats}
        modules={modules}
        columns={columns}
        finance={finance}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      {/* HEADER DE TELEMETRIA COM SELETOR TEMPORAL */}
      <div className="bg-linear-to-r from-[#0b101f] to-[#070b14] border border-slate-800/90 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-black">
              GRAFANA INTELLIGENCE // LIVE
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Central de Controle & Telemetria
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-1">
            Visão topográfica de fluxos, análise preditiva de prazos e auditoria de retenção.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onPrevMonth && onNextMonth && (
            <DateNavigator
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onPrevMonth={onPrevMonth}
              onNextMonth={onNextMonth}
              onSelectMonthYear={onSelectMonthYear}
            />
          )}

          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="px-5 py-2.5 bg-cyan-600/10 hover:bg-cyan-600 text-cyan-400 hover:text-white border border-cyan-500/30 rounded-2xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-pointer"
          >
            <FileText size={15} />
            <span className="hidden sm:inline">Relatório PDF</span>
          </button>
        </div>
      </div>

      {/* BLOCO 1: SUPER KPIS DE SAÚDE DO NEGÓCIO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* HEALTH SCORE */}
        <div className="bg-[#0b101f] p-4 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all min-w-0">
          <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-20 ${healthScore >= 75 ? "bg-emerald-500" : healthScore >= 50 ? "bg-amber-500" : "bg-red-500"}`} />
          <div className="flex justify-between items-start mb-2 relative z-10">
            <span className="text-[11px] font-mono uppercase text-slate-400">Saúde do Sistema</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              healthScore >= 75 ? "bg-emerald-500/15 text-emerald-400" :
              healthScore >= 50 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"
            }`}>
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className={`text-3xl sm:text-4xl font-mono font-black ${
              healthScore >= 75 ? "text-emerald-400" : healthScore >= 50 ? "text-amber-400" : "text-red-400"
            }`}>
              {healthScore}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono uppercase tracking-wider relative z-10">
            {healthScore >= 75 ? "Fluxo Otimizado" : "Requer Atenção"}
          </div>
        </div>

        {/* TAXA DE ENTREGA */}
        <div className="bg-[#0b101f] p-4 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all min-w-0">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-mono uppercase text-slate-400">Taxa de Conversão</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-mono font-black text-white">{stats.completionRate}%</div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono uppercase tracking-wider">
            {stats.completed} de {stats.total} tarefas
          </div>
        </div>

        {/* WORK IN PROGRESS */}
        <div className="bg-[#0b101f] p-4 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all min-w-0">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-mono uppercase text-cyan-400 font-bold">WIP Ativo</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Zap size={16} />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-mono font-black text-cyan-400">{activeWIP}</div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono uppercase tracking-wider">
            Excluindo fila de espera (gelo)
          </div>
        </div>

        {/* ALERTA CRÍTICO */}
        <div className="bg-[#0b101f] p-5 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group hover:border-red-900/50 transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-mono uppercase text-red-400">Atenção Imediata</span>
            <div className="w-8 h-8 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className={`text-3xl sm:text-4xl font-mono font-black ${stats.overdue + stats.urgent > 0 ? "text-red-400 animate-pulse" : "text-slate-500"}`}>
            {stats.overdue + stats.urgent}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono uppercase tracking-wider">
            {stats.overdue} vencidas • {stats.urgent} urgentes
          </div>
        </div>
      </div>

      {/* BLOCO 2: TOPOGRAFIA DO PIPELINE E MATRIZ DE PRIORIDADE */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* GRÁFICO DE ÁREA: TOPOGRAFIA DO PIPELINE (Carga de trabalho acumulada por coluna) */}
        <div className="xl:col-span-2 bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                <Network size={16} className="text-blue-400" />
                <span>Topografia do Pipeline (Distribuição de Carga)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-sans">
                Visualize onde o trabalho está se acumulando ao longo do seu fluxo de Kanban.
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            {pipelineTopographyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pipelineTopographyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTarefas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={customTooltipStyle} cursor={{ stroke: '#334155', strokeWidth: 1, strokeDasharray: '5 5' }} />
                  <Area 
                    type="monotone" 
                    dataKey="tarefas" 
                    name="Pendências Ativas" 
                    stroke="#3B82F6" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorTarefas)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 font-mono text-xs">Sem dados no pipeline.</div>
            )}
          </div>
        </div>

        {/* DONUT: MATRIZ DE ESFORÇO & DIAGNÓSTICO */}
        <div className="bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono mb-1 flex items-center gap-2">
              <Target size={16} className="text-amber-400" />
              <span>Matriz de Esforço</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-sans mb-3">
              Fatia de prioridade das tarefas abertas.
            </p>
          </div>

          <div className="h-44 w-full flex items-center justify-center mb-4">
            {priorityDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={45}
                    paddingAngle={5}
                    stroke="none"
                  >
                    {priorityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-600 font-mono text-xs">Sem tarefas ativas</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-800/80">
            {priorityDistribution.map((p) => (
              <div key={p.name} className="flex items-center gap-1.5 text-xs font-mono bg-[#070a12] p-1.5 rounded-lg border border-slate-800/50">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-slate-400 flex-1">{p.name}</span>
                <span className="text-white font-bold">{p.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* BLOCO 3: AGENDA TÁTICA (HOJE/AMANHÃ) E TIMELINE PREDITIVA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* AGENDA TÁTICA DE AÇÃO DIRETA */}
        <div className="bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                  <Activity size={16} className="text-emerald-400" />
                  <span>Terminal de Ação Rápida</span>
                </h3>
              </div>

              <div className="flex items-center bg-[#070b14] border border-slate-800 p-1 rounded-2xl shrink-0">
                <button
                  type="button"
                  onClick={() => setAgendaFilter("urgent")}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    agendaFilter === "urgent" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "text-slate-500 hover:text-white"
                  }`}
                >
                  <Flame size={12} /> Urgentes
                </button>
                <button
                  type="button"
                  onClick={() => setAgendaFilter("overdue")}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    agendaFilter === "overdue" ? "bg-red-500/20 text-red-300 border border-red-500/40" : "text-slate-500 hover:text-white"
                  }`}
                >
                  <Clock size={12} /> Atrasos
                </button>
                <button
                  type="button"
                  onClick={() => setAgendaFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    agendaFilter === "all" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-500 hover:text-white"
                  }`}
                >
                  <Layers size={12} /> Todas
                </button>
              </div>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-72 pr-1">
              {displayAgendaList.map((card) => {
                const isOver = isCardOverdue(card.dueDate, card.completed);
                const daysDiff = getDaysDifference(card.dueDate);
                return (
                  <div 
                    key={card.id}
                    className="p-3 bg-linear-to-r from-[#070b14] to-transparent border border-slate-800/90 rounded-2xl flex items-center justify-between gap-3 text-xs group hover:border-slate-600 transition-all"
                  >
                    <div className="flex items-center gap-3 truncate flex-1">
                      <button
                        type="button"
                        onClick={() => onToggleComplete(card.id)}
                        className="text-slate-500 hover:text-emerald-400 cursor-pointer shrink-0 transition-all hover:scale-110"
                        title="Concluir Imediatamente"
                      >
                        <Circle size={18} />
                      </button>
                      
                      <div className="truncate">
                        <span className={`font-semibold truncate block text-sm ${isOver ? "text-red-200" : "text-slate-200 group-hover:text-cyan-300"}`}>
                          {card.title}
                        </span>
                        <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-slate-500">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: card.module?.color || "#3B82F6" }} />
                          <span className="truncate">{card.module?.title || "Geral"} • <strong className="text-slate-400">{card.colTitle}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg font-mono uppercase ${
                        card.priority === "Urgente" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        card.priority === "Alta" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                        "bg-slate-900 text-slate-500 border border-slate-800"
                      }`}>
                        {card.priority}
                      </span>
                      {card.dueDate && (
                        <span className={`text-[10px] font-mono flex items-center gap-1 ${
                          isOver ? "text-red-400 font-bold" : daysDiff === 0 ? "text-amber-400 font-bold animate-pulse" : "text-slate-400"
                        }`}>
                          <Calendar size={11} />
                          {isOver ? "Vencida" : daysDiff === 0 ? "Vence Hoje" : daysDiff === 1 ? "Amanhã" : `Daqui ${daysDiff}d`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {displayAgendaList.length === 0 && (
                <div className="text-center py-12 text-emerald-400 font-mono text-xs bg-emerald-950/10 border border-emerald-900/30 rounded-3xl">
                  ✓ Tudo limpo e sob controle na sua fila tática!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TIMELINE PREDITIVA DE VENCIMENTOS (BARCHART) */}
        <div className="bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                <TrendingUp size={16} className="text-cyan-400" />
                <span>Radar Preditivo de Esforço (14 Dias)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-sans">
                Antecipe o volume de vencimentos das próximas semanas.
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            {upcomingTimelineData.some(d => d.tarefas > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={upcomingTimelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="dia" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={customTooltipStyle}
                    formatter={(value) => [`${value} tarefas vencendo`, "Volume"]}
                  />
                  <Bar dataKey="tarefas" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={25}>
                    {upcomingTimelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.dia === "Hoje" || entry.dia === "Amanhã" ? "#F59E0B" : "#3B82F6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs text-center px-6">
                Nenhuma tarefa mapeada com data de vencimento nos próximos 14 dias.
              </div>
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-4 text-center">
            * Barras <span className="text-amber-400 font-bold">Laranjas</span> indicam esforço alto nas próximas 48h.
          </div>
        </div>

      </div>

      {/* BLOCO 4: AGING RADAR E GARGALOS DE ENGENHARIA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* AGING: AUDITORIA DE TAREFAS VELHAS */}
        <div className="lg:col-span-2 bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                <Hourglass size={16} className="text-amber-400" />
                <span>Auditoria de Envelhecimento (Aging Radar)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-sans">
                As pendências mais antigas do sistema que continuam abertas.
              </p>
            </div>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2.5 py-1 rounded-xl font-bold hidden sm:block">
              TOP 5 ANTIGAS
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {agingCards.map((c, index) => (
              <div key={c.id} className="p-3.5 bg-[#070b14] border border-slate-800/90 rounded-2xl flex items-center justify-between gap-4 group hover:border-slate-600 transition-colors">
                <div className="flex items-center gap-3 truncate flex-1 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-mono font-bold text-slate-400 shrink-0">
                    {index + 1}
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: c.module?.color ?? "#64748b" }} />
                  <div className="truncate">
                    <span className="font-semibold text-slate-200 truncate block text-sm">{c.title}</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Na etapa: <strong className="text-slate-400">{c.colTitle}</strong> • Módulo: {c.module?.title ?? "Geral"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-xl border ${
                    c.daysOpen >= 30 ? "bg-red-500/10 text-red-400 border-red-500/30" :
                    c.daysOpen >= 14 ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                    "bg-slate-900 text-slate-400 border-slate-800"
                  }`}>
                    {c.daysOpen === 0 ? "Criada hoje" : `Aberta há ${c.daysOpen} dias`}
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => onToggleComplete(c.id)}
                    className="text-slate-600 hover:text-emerald-400 cursor-pointer transition-transform hover:scale-110"
                    title="Concluir pendência e remover da lista"
                  >
                    <CheckCircle2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            {agingCards.length === 0 && (
              <div className="text-center py-10 text-emerald-400 font-mono text-xs bg-emerald-950/10 border border-emerald-900/30 rounded-3xl">
                ✓ Nenhuma pendência antiga abandonada no fluxo!
              </div>
            )}
          </div>
        </div>

        {/* ADVISOR DE GARGALOS & RESUMO FINANCEIRO */}
        <div className="bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono">Gargalo do Sistema</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">DIAGNÓSTICO</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#070b14] border border-slate-800 mb-5 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-16 h-16 bg-amber-500/10 blur-2xl" />
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1.5 relative z-10">Etapa com mais Retenção</span>
              <div className="text-lg font-bold text-white flex items-center gap-2 relative z-10">
                <span className="truncate">{bottleneckColumn ? bottleneckColumn.title : "Nenhum"}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 font-mono border border-amber-500/30 shrink-0">
                  {bottleneckColumn ? `${bottleneckColumn.cards.length} cards` : "0"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2.5 font-sans leading-relaxed relative z-10">
                {bottleneckColumn && bottleneckColumn.cards.length >= 6
                  ? "Atenção: Esta etapa está acumulando muito trabalho. Tente desovar essas tarefas antes de puxar novas para a fila."
                  : "Seu fluxo de Kanban está leve e equilibrado. Continue assim!"}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#070b14] border border-slate-800 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute right-0 bottom-0 w-16 h-16 bg-emerald-500/10 blur-2xl" />
              <div className="relative z-10 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Saldo do mês</span>
                    <div className={`text-2xl font-black font-mono ${finance && finance.balance < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {finance ? brl(finance.balance) : "—"}
                    </div>
                  </div>
                  {finance?.expenseChangePct !== null && finance?.expenseChangePct !== undefined && (
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                        finance.expenseChangePct > 0
                          ? "text-rose-300 border-rose-500/40 bg-rose-500/10"
                          : "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
                      }`}
                      title="Variação dos gastos vs. mês anterior"
                    >
                      gastos {finance.expenseChangePct > 0 ? "+" : ""}{finance.expenseChangePct}%
                    </span>
                  )}
                </div>
                {finance && (
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                    <div><span className="text-slate-500 block">Entradas</span><b className="text-emerald-400">{brl(finance.income)}</b></div>
                    <div><span className="text-slate-500 block">Saídas</span><b className="text-rose-400">{brl(finance.expense)}</b></div>
                    <div><span className="text-slate-500 block">A pagar</span><b className="text-amber-400">{brl(finance.pending)}</b></div>
                  </div>
                )}
                {financeHistory.length > 0 && (
                  <div className="h-28 -mx-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={financeHistory} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#475569" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                        <Tooltip
                          contentStyle={customTooltipStyle}
                          formatter={(v, n) => [brl(Number(v)), n === "income" ? "Entradas" : "Saídas"]}
                        />
                        <Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={14} />
                        <Bar dataKey="expense" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onOpenFinances}
                className="mt-3.5 text-[11px] font-mono font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors relative z-10 w-fit"
              >
                <span>Abrir Finanças</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}