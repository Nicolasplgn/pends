"use client";

import { useState } from "react";
import type { Module } from "@prisma/client";
import { 
  Download, FileText, Layers, TrendingUp, Clock, AlertTriangle, 
  BarChart3, Calendar, Circle, CheckSquare, PieChart, Wallet 
} from "lucide-react";
import type { DashboardStats, KanbanColumn } from "../../types";
import { MONTH_NAMES, isCardOverdue } from "../../types";
import { ExecutiveReportModal } from "./ExecutiveReportModal";

interface AnalyticsDashProps {
  stats: DashboardStats | null;
  modules: Module[];
  columns: KanbanColumn[];
  recurringTasks: any[];
  selectedMonth: number;
  selectedYear: number;
  onToggleComplete: (cardId: string) => void;
  onOpenFinances: () => void;
}

export function AnalyticsDash({
  stats,
  modules,
  columns,
  recurringTasks,
  selectedMonth,
  selectedYear,
  onToggleComplete,
  onOpenFinances,
}: AnalyticsDashProps) {
  const [showReportModal, setShowReportModal] = useState(false);

  // Exportador CSV com download automático
  function handleExportCSV() {
    const rows: string[][] = [
      ["ID", "Título", "Módulo", "Prioridade", "Vencimento", "Status", "Descrição"]
    ];

    columns.forEach((col) => {
      col.cards.forEach((card) => {
        const isDone = card.completed || col.isDone;
        rows.push([
          card.id,
          `"${(card.title || "").replace(/"/g, '""')}"`,
          card.module?.title || "Geral",
          card.priority,
          card.dueDate ? new Date(card.dueDate).toLocaleDateString("pt-BR") : "Sem prazo",
          isDone ? "Concluída" : col.title,
          `"${(card.description || "").replace(/"/g, '""')}"`
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map((e) => e.join(";")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Relatorio_Pends_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const totalMensal = recurringTasks.reduce((acc, r) => acc + (r.amount || 0), 0);

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-sm">
        Carregando telemetria analítica...
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-6">
      
      {/* MODAL DE RELATÓRIO EXECUTIVO OFICIAL */}
      <ExecutiveReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        stats={stats}
        modules={modules}
        columns={columns}
        recurringTasks={recurringTasks}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      {/* CABEÇALHO DO ANALYTICS COM BOTÕES DE AÇÃO */}
      <div className="bg-[#0b101f] border border-slate-800/90 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold">
              PENDS // ANALYTICS INTELLIGENCE
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Painel de Desempenho & Diagnóstico
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Métricas de produtividade, auditoria de gargalos e geração de relatórios executivos.
          </p>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-[#070b14] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title="Baixar todas as pendências em arquivo .CSV para Excel"
          >
            <Download size={14} className="text-emerald-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            <FileText size={15} />
            <span>Gerar Relatório Executivo</span>
          </button>
        </div>
      </div>

      {/* TOP 4 KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0b101f] p-5 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-mono uppercase text-slate-400">Total de Pendências</span>
            <div className="w-8 h-8 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Layers size={16} />
            </div>
          </div>
          <div className="text-3xl font-mono font-black text-white">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-2 font-mono">Mapeadas no Kanban</div>
        </div>

        <div className="bg-[#0b101f] p-5 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-mono uppercase text-slate-400">Taxa de Conclusão</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-3xl font-mono font-black text-emerald-400">{stats.completionRate}%</div>
          <div className="text-[11px] text-slate-500 mt-2 font-mono">{stats.completed} entregues no total</div>
        </div>

        <div className="bg-[#0b101f] p-5 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-mono uppercase text-slate-400">Em Andamento</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-3xl font-mono font-black text-cyan-400">{stats.inProgress + stats.todo}</div>
          <div className="text-[11px] text-slate-500 mt-2 font-mono">{stats.inProgress} ativas // {stats.todo} a iniciar</div>
        </div>

        <div className="bg-[#0b101f] p-5 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-mono uppercase text-red-400">Atenção Crítica</span>
            <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className={`text-3xl font-mono font-black ${stats.overdue + stats.urgent > 0 ? "text-red-400 animate-pulse" : "text-slate-500"}`}>
            {stats.overdue + stats.urgent}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 font-mono">{stats.overdue} vencidas // {stats.urgent} urgentes</div>
        </div>
      </div>

      {/* CARGA POR MÓDULO & PRÓXIMOS PRAZOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CARGA POR MÓDULO */}
        <div className="lg:col-span-2 bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                <BarChart3 size={16} className="text-blue-400" />
                <span>Carga & Volume por Módulo</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-sans">
                Distribuição em tempo real do progresso das áreas de vida
              </p>
            </div>
            <span className="text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800 px-2.5 py-1 rounded-full">
              {stats.moduleMetrics.length} Módulos
            </span>
          </div>

          <div className="space-y-5">
            {stats.moduleMetrics.map((mod) => (
              <div key={mod.id} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: mod.color }}/>
                    <span className="font-semibold text-slate-200">{mod.title}</span>
                    <span className="text-slate-500 text-[11px] font-mono">({mod.total} tarefas)</span>
                  </div>
                  <div className="font-mono text-slate-400 text-xs">
                    <span className="text-emerald-400 font-bold">{mod.done}</span> / <span className="text-amber-400">{mod.pending}</span> ({mod.percent}%)
                  </div>
                </div>
                
                <div className="w-full bg-[#070b14] h-2.5 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
                  <div 
                    className="h-full rounded-full transition-all duration-500 shadow-sm" 
                    style={{ width: `${mod.percent}%`, backgroundColor: mod.color }} 
                  />
                </div>
              </div>
            ))}

            {stats.moduleMetrics.length === 0 && (
              <div className="text-center py-8 text-slate-600 font-mono text-xs">
                Nenhum módulo encontrado.
              </div>
            )}
          </div>
        </div>

        {/* AGENDA DE PRÓXIMOS PRAZOS INTERATIVA */}
        <div className="bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                <Calendar size={16} className="text-blue-400"/>
                <span>Próximos Prazos</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                AGENDA
              </span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-80 pr-1">
              {stats.upcomingDeadlines.map((item) => {
                const overdue = isCardOverdue(item.dueDate);
                return (
                  <div 
                    key={item.id} 
                    className={`p-3 rounded-2xl border flex items-center justify-between transition-colors ${
                      overdue ? "border-red-500/40 bg-red-950/10" : "bg-[#070b14] border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className={`text-xs font-semibold truncate ${overdue ? "text-red-300" : "text-slate-200"}`}>
                        {item.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: item.moduleColor }}>
                          {item.moduleName}
                        </span>
                        <span className={`text-[10px] font-mono ${overdue ? "text-red-400 font-bold" : "text-slate-400"}`}>
                          {item.dueDate ? new Date(item.dueDate).toLocaleDateString("pt-BR") : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${
                        overdue ? "bg-red-500/20 text-red-400 border border-red-500/40" :
                        item.priority === "Urgente" ? "bg-red-500/20 text-red-400" : "bg-slate-800 text-slate-400"
                      }`}>
                        {overdue ? "Vencida" : item.priority}
                      </span>
                      <button
                        type="button"
                        onClick={() => onToggleComplete(item.id)}
                        className="text-slate-500 hover:text-emerald-400 p-1 cursor-pointer transition-colors"
                        title="Concluir tarefa"
                      >
                        <Circle size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {stats.upcomingDeadlines.length === 0 && (
                <div className="text-center py-12 text-slate-600 font-mono text-xs">
                  Nenhum prazo cadastrado para os próximos dias.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/60 mt-4 text-[11px] font-mono text-slate-500 flex items-center justify-between">
            <span>Conclusão em 1 toque</span>
            <CheckSquare size={13} className="text-emerald-400" />
          </div>
        </div>

      </div>

      {/* SEÇÃO INFERIOR: DISTRIBUIÇÃO PIPELINE & CONTROLE FINANCEIRO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* DISTRIBUIÇÃO DO PIPELINE */}
        <div className="bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl">
          <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono mb-4 flex items-center gap-2">
            <PieChart size={16} className="text-cyan-400" />
            <span>Distribuição no Pipeline</span>
          </h3>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-3.5 bg-[#070b14] border border-slate-800 rounded-2xl text-center">
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">A Fazer</span>
              <span className="text-2xl font-bold font-mono text-slate-200">{stats.todo}</span>
              <span className="text-[10px] font-mono text-slate-500 block mt-1">
                {stats.total > 0 ? Math.round((stats.todo / stats.total) * 100) : 0}%
              </span>
            </div>
            <div className="p-3.5 bg-[#070b14] border border-slate-800 rounded-2xl text-center">
              <span className="text-[10px] font-mono uppercase text-cyan-400 block mb-1">Andamento</span>
              <span className="text-2xl font-bold font-mono text-cyan-400">{stats.inProgress}</span>
              <span className="text-[10px] font-mono text-slate-500 block mt-1">
                {stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%
              </span>
            </div>
            <div className="p-3.5 bg-[#070b14] border border-slate-800 rounded-2xl text-center">
              <span className="text-[10px] font-mono uppercase text-emerald-400 block mb-1">Concluídas</span>
              <span className="text-2xl font-bold font-mono text-emerald-400">{stats.completed}</span>
              <span className="text-[10px] font-mono text-slate-500 block mt-1">
                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* CONTROLE FINANCEIRO VINCULADO */}
        <div className="bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono mb-1 flex items-center gap-2">
              <Wallet size={16} className="text-emerald-400" />
              <span>Controle Financeiro Mensal</span>
            </h3>
            <div className="text-3xl font-black font-mono text-emerald-400 mt-2">
              {totalMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
            <span className="text-[11px] text-slate-400 font-mono mt-1 block">
              {recurringTasks.length} contas e rotinas ativas em {MONTH_NAMES[selectedMonth]}/{selectedYear}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenFinances}
            className="w-full sm:w-auto px-5 py-3 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-2xl text-xs font-bold font-mono transition-all cursor-pointer text-center shadow-lg"
          >
            Abrir Finanças ➔
          </button>
        </div>

      </div>

    </div>
  );
}