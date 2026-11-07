"use client";

import { useState } from "react";
import type { Module } from "@prisma/client";
import { 
  FileSpreadsheet, Award, Layers, Wallet, ShieldAlert, Check, Copy, Printer, X 
} from "lucide-react";
import type { DashboardStats, FinanceSnapshot, KanbanColumn } from "../../types";
import { MONTH_NAMES, isCardOverdue } from "../../types";

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: DashboardStats | null;
  modules: Module[];
  columns: KanbanColumn[];
  finance: FinanceSnapshot | null;
  selectedMonth: number;
  selectedYear: number;
}

export function ExecutiveReportModal({
  isOpen,
  onClose,
  stats,
  columns,
  finance,
  selectedMonth,
  selectedYear,
}: ExecutiveReportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !stats) return null;

  // Desestruturação segura para garantir imutabilidade e tipagem
  const { total: totalTasks, completed: totalCompleted, completionRate, inProgress, todo, moduleMetrics } = stats;

  const overdueCards = columns.flatMap((col) =>
    col.cards.filter((card) => !card.completed && !col.isDone && isCardOverdue(card.dueDate))
  );
  const urgentCards = columns.flatMap((col) =>
    col.cards.filter((card) => !card.completed && !col.isDone && (card.priority === "Urgente" || card.priority === "Alta"))
  );
  const totalFinancial = finance?.expense ?? 0;
  const topExpenses = finance?.topExpenses ?? [];

  function handlePrint() {
    window.print();
  }

  function handleCopySummary() {
    const summary = `
========================================
📋 RELATÓRIO EXECUTIVO PENDS
Data: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}
Usuário: Nicolas Gonçalves
========================================

📊 TELEMETRIA DE PRODUTIVIDADE:
- Total de Tarefas: ${totalTasks}
- Concluídas: ${totalCompleted} (${completionRate}%)
- Em Andamento: ${inProgress + todo}
- Atrasadas / Vencidas: ${overdueCards.length}
- Alta Prioridade / Urgentes: ${urgentCards.length}

💰 CONTROLE FINANCEIRO (${MONTH_NAMES[selectedMonth]}/${selectedYear}):
- Entradas: ${(finance?.income ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
- Saídas: ${totalFinancial.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
- Saldo: ${(finance?.balance ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
- A pagar: ${(finance?.pending ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}

📂 CARGA POR MÓDULO DE VIDA:
${moduleMetrics.map((m) => `• ${m.title}: ${m.done}/${m.total} (${m.percent}%) - ${m.pending} pendentes`).join("\n")}

⚠️ RISCOS E ATENÇÃO IMEDIATA:
${overdueCards.length > 0 ? overdueCards.map((c) => `[VENCIDA] ${c.title} (Prazo: ${c.dueDate ? new Date(c.dueDate).toLocaleDateString("pt-BR") : "Sem prazo"})`).join("\n") : "✓ Nenhuma pendência vencida."}
========================================
`.trim();

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b101f] border border-blue-900/40 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER DO RELATÓRIO */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-[#070b14] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full">
                  DIAGNÓSTICO OFICIAL
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Emitido em {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight font-sans mt-0.5">
                Relatório Executivo Pends // Telemetria & Finanças
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
              title="Copiar resumo em texto"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              <span className="hidden sm:inline">{copied ? "Copiado!" : "Copiar"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              title="Imprimir ou Salvar em PDF"
            >
              <Printer size={16} />
              <span className="hidden sm:inline">PDF / Imprimir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CORPO DO DOCUMENTO */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 text-sm font-sans bg-[#050811]">
          
          {/* SÍNTESE EM NÚMEROS */}
          <div>
            <h4 className="text-xs font-bold uppercase font-mono text-cyan-400 tracking-wider mb-3 flex items-center gap-1.5">
              <Award size={14} /> 1. Painel Geral de Desempenho
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0b101f] p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Total de Tarefas</span>
                <span className="text-2xl font-black font-mono text-white">{totalTasks}</span>
              </div>
              <div className="bg-[#0b101f] p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Taxa de Conclusão</span>
                <span className="text-2xl font-black font-mono text-emerald-400">{completionRate}%</span>
                <span className="text-[10px] text-slate-500 block font-mono mt-0.5">{totalCompleted} entregues</span>
              </div>
              <div className="bg-[#0b101f] p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Em Andamento</span>
                <span className="text-2xl font-black font-mono text-cyan-400">{inProgress + todo}</span>
                <span className="text-[10px] text-slate-500 block font-mono mt-0.5">{inProgress} ativas</span>
              </div>
              <div className="bg-[#0b101f] p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-red-400 block mb-1">Atrasadas / Críticas</span>
                <span className="text-2xl font-black font-mono text-red-400">{overdueCards.length + urgentCards.length}</span>
                <span className="text-[10px] text-red-400/80 block font-mono mt-0.5">{overdueCards.length} vencidas</span>
              </div>
            </div>
          </div>

          {/* BALANÇO POR MÓDULO */}
          <div>
            <h4 className="text-xs font-bold uppercase font-mono text-cyan-400 tracking-wider mb-3 flex items-center gap-1.5">
              <Layers size={14} /> 2. Distribuição por Módulo de Vida
            </h4>
            <div className="bg-[#0b101f] rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#070b14] text-[10px] font-mono uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Módulo</th>
                    <th className="p-3.5">Total</th>
                    <th className="p-3.5">Concluídas</th>
                    <th className="p-3.5">Pendentes</th>
                    <th className="p-3.5 text-right">Progresso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {moduleMetrics.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-900/40">
                      <td className="p-3.5 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                        <span className="font-bold text-white font-sans">{m.title}</span>
                      </td>
                      <td className="p-3.5 text-slate-300">{m.total}</td>
                      <td className="p-3.5 text-emerald-400 font-bold">{m.done}</td>
                      <td className="p-3.5 text-amber-400">{m.pending}</td>
                      <td className="p-3.5 text-right font-bold text-cyan-400">{m.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* BALANÇO FINANCEIRO */}
          <div>
            <h4 className="text-xs font-bold uppercase font-mono text-cyan-400 tracking-wider mb-3 flex items-center gap-1.5">
              <Wallet size={14} /> 3. Projeção Financeira Integrada ({MONTH_NAMES[selectedMonth]}/{selectedYear})
            </h4>
            <div className="bg-[#0b101f] p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-mono text-slate-400 block mb-1">Saídas do Período</span>
                <span className="text-3xl font-black font-mono text-emerald-400">
                  {totalFinancial.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
                <span className="text-[10px] font-mono text-slate-500 block mt-1">
                  Entradas {(finance?.income ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · saldo {(finance?.balance ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {topExpenses.slice(0, 4).map((r, i) => (
                  <div key={`${r.description}-${i}`} className="p-2.5 rounded-xl bg-[#070b14] border border-slate-800 text-xs font-mono">
                    <span className="text-slate-400 block text-[10px] truncate max-w-32">{r.description}</span>
                    <span className="text-emerald-400 font-bold">
                      {r.amount ? r.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MATRIZ DE RISCO / VENCIDAS */}
          <div>
            <h4 className="text-xs font-bold uppercase font-mono text-red-400 tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldAlert size={14} /> 4. Matriz de Atenção (Vencidas e Críticas)
            </h4>
            <div className="space-y-2">
              {overdueCards.map((c) => (
                <div key={c.id} className="p-3 rounded-xl bg-[#160b10] border border-red-500/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-red-200 block">{c.title}</span>
                    <span className="text-[10px] font-mono text-red-400">
                      Módulo: {c.module?.title || "Geral"} • Venceu em: {c.dueDate ? new Date(c.dueDate).toLocaleDateString("pt-BR") : ""}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-bold uppercase bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded">
                    ⚠️ Vencida
                  </span>
                </div>
              ))}

              {overdueCards.length === 0 && (
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-400 text-xs font-mono flex items-center gap-2">
                  <Check size={16} /> Nenhuma pendência em atraso no sistema. Excelente gestão de cronograma!
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RODAPÉ */}
        <div className="p-4 bg-[#070b14] border-t border-slate-800 flex justify-between items-center shrink-0">
          <span className="text-[10px] font-mono text-slate-500">
            Pends ERP // Relatório gerado com isolamento de schema PostgreSQL
          </span>
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold rounded-xl cursor-pointer"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
}