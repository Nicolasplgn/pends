"use client";

import { useMemo, useState } from "react";
import {
  Flame, Calendar, Circle, Zap, ArrowUpRight, AlertTriangle, ShieldAlert, Layers
} from "lucide-react";
import type { NeuralNode, NeuralCard } from "../../types";
import { isCardOverdue } from "../../types";

interface NeuralGridProps {
  moduleNodes: NeuralNode[];
  totalAllTasks: number;
  completedAllTasks: number;
  allUrgentCards: NeuralCard[];
  allOverdueCards: NeuralCard[];
  onSelectModule: (node: NeuralNode) => void;
  onToggleComplete: (cardId: string) => void;
  onCardClick?: (cardId: string) => void;
  onGoToPipeline?: (modId: string) => void;
  moduleSpend?: Record<string, { spent: number; budget: number | null }>;
}

// Calcula a diferença exata em dias entre hoje e o prazo
function getDaysDifference(dueDate: Date | string | null | undefined): number | null {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dueDate);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function getDeadlineBadge(dueDate: Date | string | null | undefined, completed?: boolean) {
  if (completed) {
    return { label: "✓ Feito", color: "bg-emerald-950 text-emerald-400 border-emerald-800" };
  }
  const days = getDaysDifference(dueDate);
  if (days === null) return null;

  if (days < 0) {
    return { 
      label: `⚠️ Atrasada (${Math.abs(days)}d)`, 
      color: "bg-red-500/20 text-red-300 border-red-500/50 animate-pulse font-bold" 
    };
  }
  if (days === 0) {
    return { 
      label: "🔥 VENCE HOJE", 
      color: "bg-red-600 text-white border-red-400 font-black animate-bounce" 
    };
  }
  if (days === 1) {
    return { 
      label: "⏰ AMANHÃ", 
      color: "bg-amber-500/25 text-amber-300 border-amber-500/50 font-bold" 
    };
  }
  if (days <= 7) {
    return { 
      label: `📅 Em ${days} dias`, 
      color: "bg-cyan-950 text-cyan-300 border-cyan-800/80" 
    };
  }
  return { 
    label: new Date(dueDate!).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), 
    color: "bg-slate-900 text-slate-400 border-slate-800" 
  };
}

export function NeuralGrid({
  moduleNodes,
  totalAllTasks,
  completedAllTasks,
  onSelectModule,
  onToggleComplete,
  onCardClick,
  onGoToPipeline,
  moduleSpend,
}: NeuralGridProps) {
  const [heroFilter, setHeroFilter] = useState<"week" | "risk" | "urgent">("week");

  // Todas as tarefas abertas do sistema
  const allOpenCards = useMemo(() => {
    return moduleNodes.flatMap((m) =>
      m.cards.filter((c) => !c.completed).map((c) => ({ ...c, modTitle: m.title, modColor: m.color }))
    );
  }, [moduleNodes]);

  // 1. TAREFAS DESTA SEMANA (Vencidas + Hoje + Próximos 7 dias)
  const thisWeekCards = useMemo(() => {
    return allOpenCards
      .filter((c) => {
        const days = getDaysDifference(c.dueDate);
        return days !== null && days <= 7;
      })
      .sort((a, b) => (getDaysDifference(a.dueDate) ?? 999) - (getDaysDifference(b.dueDate) ?? 999));
  }, [allOpenCards]);

  // 2. O QUE PODE DAR PROBLEMA (Vencidas + Vence Hoje/Amanhã + Urgentes paradas)
  const troubleCards = useMemo(() => {
    return allOpenCards
      .filter((c) => {
        const days = getDaysDifference(c.dueDate);
        const isLateOrSoon = days !== null && days <= 2;
        const isCriticalPriority = c.priority === "Urgente" || c.priority === "Alta";
        return isLateOrSoon || isCriticalPriority;
      })
      .sort((a, b) => {
        const daysA = getDaysDifference(a.dueDate) ?? 99;
        const daysB = getDaysDifference(b.dueDate) ?? 99;
        return daysA - daysB;
      });
  }, [allOpenCards]);

  // 3. URGENTES E ALTA PRIORIDADE
  const highPriorityCards = useMemo(() => {
    return allOpenCards.filter((c) => c.priority === "Urgente" || c.priority === "Alta");
  }, [allOpenCards]);

  const overdueCount = useMemo(() => {
    return allOpenCards.filter((c) => isCardOverdue(c.dueDate, c.completed)).length;
  }, [allOpenCards]);

  const dueTodayOrTomorrowCount = useMemo(() => {
    return allOpenCards.filter((c) => {
      const d = getDaysDifference(c.dueDate);
      return d === 0 || d === 1;
    }).length;
  }, [allOpenCards]);

  const activeHeroList =
    heroFilter === "week" ? thisWeekCards : heroFilter === "risk" ? troubleCards : highPriorityCards;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-[#050811]">
      
      {/* LINHA 1: BRIEFING TÁTICO DA SEMANA + RADAR DE PROBLEMAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* PAINEL CENTRAL: O QUE FAZER ESTA SEMANA & RISCOS (2 COLUNAS) */}
        <div className="lg:col-span-2 bg-[#0b101f] border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div>
            {/* TOPO DO BRIEFING */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
                    RADAR DE DECISÃO RÁPIDA
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {overdueCount > 0 
                    ? `⚠️ Atenção: ${overdueCount} pendência(s) atrasada(s) e ${thisWeekCards.length} para esta semana`
                    : dueTodayOrTomorrowCount > 0
                      ? `🔥 Foco Total: ${dueTodayOrTomorrowCount} entrega(s) vencem entre hoje e amanhã`
                      : `✓ Semana sob controle: ${thisWeekCards.length} entregas programadas nos próximos 7 dias`}
                </h3>
              </div>

              {/* ABAS RÁPIDAS DO BRIEFING */}
              <div className="flex items-center bg-[#070b14] border border-slate-800 p-1 rounded-2xl shrink-0 self-start">
                <button
                  type="button"
                  onClick={() => setHeroFilter("week")}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    heroFilter === "week" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Calendar size={12} />
                  <span>Esta Semana ({thisWeekCards.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeroFilter("risk")}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    heroFilter === "risk" ? "bg-red-500/20 text-red-300 border border-red-500/40" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <ShieldAlert size={12} className="text-red-400" />
                  <span>Risco ({troubleCards.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeroFilter("urgent")}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    heroFilter === "urgent" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Flame size={12} className="text-amber-400" />
                  <span>Críticas ({highPriorityCards.length})</span>
                </button>
              </div>
            </div>

            {/* LISTA INTERATIVA DE AÇÃO IMEDIATA */}
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-1">
              {activeHeroList.slice(0, 6).map((card) => {
                const badge = getDeadlineBadge(card.dueDate, card.completed);
                return (
                  <div
                    key={card.id}
                    onClick={() => onCardClick && onCardClick(card.id)}
                    className="p-3 rounded-2xl bg-[#070b14] border border-slate-800/90 hover:border-slate-600 flex items-center justify-between gap-3 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleComplete(card.id);
                        }}
                        className="text-slate-500 hover:text-emerald-400 cursor-pointer shrink-0"
                        title="Concluir agora"
                      >
                        <Circle size={16} />
                      </button>

                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: card.modColor }} 
                        title={card.modTitle}
                      />

                      <div className="truncate flex-1">
                        <span className="text-xs sm:text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors truncate block">
                          {card.title}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {card.modTitle} • Etapa: <strong className="text-slate-300">{card.columnTitle}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {badge && (
                        <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-lg border ${badge.color}`}>
                          {badge.label}
                        </span>
                      )}

                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase hidden sm:inline-block ${
                        card.priority === "Urgente" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        card.priority === "Alta" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                        "bg-slate-800 text-slate-400"
                      }`}>
                        {card.priority}
                      </span>
                    </div>
                  </div>
                );
              })}

              {activeHeroList.length === 0 && (
                <div className="text-center py-10 text-emerald-400/90 font-mono text-xs bg-[#070b14]/60 rounded-2xl border border-emerald-900/30">
                  ✓ Nenhuma pendência crítica ou vencendo nesta visualização! Tudo limpo.
                </div>
              )}
            </div>
          </div>

          {/* RODAPÉ DE MÉTRICAS RÁPIDAS */}
          <div className="grid grid-cols-4 gap-2 pt-4 mt-4 border-t border-slate-800/80 text-center font-mono">
            <div className="bg-[#070b14]/80 p-2 rounded-xl border border-slate-800/60">
              <span className="text-[9px] text-slate-400 uppercase block">Total Geral</span>
              <span className="text-sm font-bold text-white">{totalAllTasks}</span>
            </div>
            <div className="bg-[#070b14]/80 p-2 rounded-xl border border-slate-800/60">
              <span className="text-[9px] text-emerald-400 uppercase block">Feitas</span>
              <span className="text-sm font-bold text-emerald-400">{completedAllTasks}</span>
            </div>
            <div className="bg-[#070b14]/80 p-2 rounded-xl border border-slate-800/60">
              <span className="text-[9px] text-amber-400 uppercase block">P/ 7 Dias</span>
              <span className="text-sm font-bold text-amber-400">{thisWeekCards.length}</span>
            </div>
            <div className="bg-[#070b14]/80 p-2 rounded-xl border border-slate-800/60">
              <span className="text-[9px] text-red-400 uppercase block">Atrasadas</span>
              <span className={`text-sm font-bold ${overdueCount > 0 ? "text-red-400 animate-pulse" : "text-slate-500"}`}>
                {overdueCount}
              </span>
            </div>
          </div>
        </div>

        {/* CARD LATERAL: DIAGNÓSTICO "O QUE PODE DAR PROBLEMA" */}
        <div className="bg-[#0b101f] border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white uppercase font-mono">Alerta de Problemas</h4>
                  <span className="text-[10px] text-slate-400 font-mono">Diagnóstico de gargalos</span>
                </div>
              </div>
              <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                troubleCards.length > 0 ? "bg-red-950 text-red-400 border border-red-800 animate-pulse" : "bg-emerald-950 text-emerald-400"
              }`}>
                {troubleCards.length} alertas
              </span>
            </div>

            <div className="space-y-3">
              {/* ALERTA 1: VENCIDAS */}
              <div className={`p-3.5 rounded-2xl border ${
                overdueCount > 0 ? "bg-red-950/20 border-red-500/40" : "bg-[#070b14] border-slate-800/80"
              }`}>
                <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                  <span className={overdueCount > 0 ? "text-red-400" : "text-slate-400"}>1. Prazo Estourado</span>
                  <span className={overdueCount > 0 ? "text-red-300" : "text-emerald-400"}>
                    {overdueCount > 0 ? `${overdueCount} vencida(s)` : "✓ Zero"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {overdueCount > 0 
                    ? "Existem pendências ou contas com data vencida que podem gerar multa ou cobrança no trabalho."
                    : "Nenhuma tarefa com prazo vencido no momento."}
                </p>
              </div>

              {/* ALERTA 2: PRAZO NAS PRÓXIMAS 48H */}
              <div className={`p-3.5 rounded-2xl border ${
                dueTodayOrTomorrowCount > 0 ? "bg-amber-950/20 border-amber-500/40" : "bg-[#070b14] border-slate-800/80"
              }`}>
                <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                  <span className={dueTodayOrTomorrowCount > 0 ? "text-amber-400" : "text-slate-400"}>2. Janela de 48 Horas</span>
                  <span className={dueTodayOrTomorrowCount > 0 ? "text-amber-300" : "text-emerald-400"}>
                    {dueTodayOrTomorrowCount > 0 ? `${dueTodayOrTomorrowCount} entrega(s)` : "✓ Livre"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {dueTodayOrTomorrowCount > 0 
                    ? "Tarefas que vencem hoje ou amanhã. Priorize concluir estas antes de puxar novas demandas."
                    : "Sem vencimentos imediatos para hoje ou amanhã."}
                </p>
              </div>

              {/* ALERTA 3: MÓDULO MAIS SOBRECARREGADO */}
              {(() => {
                const busiest = [...moduleNodes].sort((a, b) => (b.total - b.completed) - (a.total - a.completed))[0];
                const openCount = busiest ? busiest.total - busiest.completed : 0;
                return (
                  <div className="p-3.5 rounded-2xl bg-[#070b14] border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                      <span className="text-blue-400">3. Maior Sobrecarga</span>
                      <span className="text-white">{busiest ? busiest.title : "-"}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {openCount > 0 
                        ? `Concentra ${openCount} tarefas em aberto (${busiest?.percent}% concluído).`
                        : "Todos os módulos estão zerados."}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/60 mt-4 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Monitoramento Pends</span>
            <Zap size={13} className="text-cyan-400" />
          </div>
        </div>

      </div>

      {/* LINHA 2: CARTÕES DOS MÓDULOS DE VIDA (ORDENADOS POR RISCO E PRAZO) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
            <Layers size={14} className="text-blue-400" />
            <span>Módulos de Vida // Visão Priorizada</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            * Mostra automaticamente as tarefas mais urgentes no topo
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {moduleNodes.map((node) => {
            const openCards = node.cards.filter((c) => !c.completed);
            const modOverdue = openCards.filter((c) => isCardOverdue(c.dueDate, c.completed)).length;
            const modThisWeek = openCards.filter((c) => {
              const d = getDaysDifference(c.dueDate);
              return d !== null && d >= 0 && d <= 7;
            }).length;
            const modUrgent = openCards.filter((c) => c.priority === "Urgente" || c.priority === "Alta").length;

            // Ordena as tarefas do módulo para mostrar sempre o que é mais crítico primeiro
            const prioritizedCards = [...openCards].sort((a, b) => {
              const overA = isCardOverdue(a.dueDate, a.completed) ? 0 : 1;
              const overB = isCardOverdue(b.dueDate, b.completed) ? 0 : 1;
              if (overA !== overB) return overA - overB;

              const daysA = getDaysDifference(a.dueDate) ?? 999;
              const daysB = getDaysDifference(b.dueDate) ?? 999;
              if (daysA !== daysB) return daysA - daysB;

              const weight = { Urgente: 0, Alta: 1, Normal: 2, Baixa: 3 };
              return (weight[a.priority as keyof typeof weight] ?? 2) - (weight[b.priority as keyof typeof weight] ?? 2);
            });

            return (
              <div 
                key={node.id}
                onClick={() => onSelectModule(node)}
                className={`bg-[#0b101f] border rounded-3xl p-5 shadow-xl flex flex-col justify-between cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl relative overflow-hidden group ${
                  modOverdue > 0 
                    ? "border-red-500/60 ring-1 ring-red-500/30" 
                    : modThisWeek > 0 || modUrgent > 0
                      ? "border-amber-500/40 hover:border-amber-500/70"
                      : "border-slate-800/90 hover:border-slate-600"
                }`}
              >
                <div 
                  className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-15 transition-opacity group-hover:opacity-35"
                  style={{ backgroundColor: node.color }}
                />

                <div>
                  {/* CABEÇALHO DO MÓDULO + TAG DE DIAGNÓSTICO */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="w-3.5 h-3.5 rounded-full shadow-md shrink-0" style={{ backgroundColor: node.color }} />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono truncate">
                        {node.title}
                      </h3>
                    </div>

                    {modOverdue > 0 ? (
                      <span className="text-[9px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full animate-pulse shrink-0">
                        🚨 {modOverdue} atrasada(s)
                      </span>
                    ) : modThisWeek > 0 ? (
                      <span className="text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full shrink-0">
                        📅 {modThisWeek} p/ semana
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/70 px-2 py-0.5 rounded-full shrink-0">
                        {node.percent}%
                      </span>
                    )}
                  </div>

                  {/* BARRA DE PROGRESSO */}
                  <div className="w-full bg-[#070b14] h-2 rounded-full overflow-hidden border border-slate-800/80 mb-3 p-0.5">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ width: `${node.percent}%`, backgroundColor: node.color }} 
                    />
                  </div>

                  {/* MINI RESUMO DE CARGA */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-3 px-1">
                    <span>Abertas: <strong className="text-white">{openCards.length}</strong></span>
                    <span>Críticas: <strong className={modUrgent > 0 ? "text-amber-400" : "text-slate-500"}>{modUrgent}</strong></span>
                    {moduleSpend?.[node.id] && moduleSpend[node.id].spent > 0 && (
                      <span title={moduleSpend[node.id].budget ? `Teto: R$ ${Math.round(moduleSpend[node.id].budget!)}` : "Gasto do mês"}>
                        💸{" "}
                        <strong
                          className={
                            moduleSpend[node.id].budget !== null && moduleSpend[node.id].spent > moduleSpend[node.id].budget!
                              ? "text-rose-400"
                              : "text-emerald-400"
                          }
                        >
                          {moduleSpend[node.id].spent.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                        </strong>
                        {moduleSpend[node.id].budget ? <span className="text-slate-500">/{Math.round(moduleSpend[node.id].budget!)}</span> : null}
                      </span>
                    )}
                    <span>Feitas: <strong className="text-emerald-400">{node.completed}</strong></span>
                  </div>

                  {/* PRÉVIA DAS 4 TAREFAS MAIS IMPORTANTES DO MÓDULO */}
                  <div className="space-y-2 mb-4">
                    {prioritizedCards.slice(0, 4).map((card) => {
                      const badge = getDeadlineBadge(card.dueDate, card.completed);
                      const overdue = isCardOverdue(card.dueDate, card.completed);
                      return (
                        <div 
                          key={card.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onCardClick) onCardClick(card.id);
                          }}
                          className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1 transition-all hover:scale-[1.01] ${
                            overdue 
                              ? "bg-[#180d12] border-red-500/50 hover:border-red-400" 
                              : "bg-[#070b14] border-slate-800 hover:border-slate-600"
                          }`}
                          title="Clique para abrir a ficha desta tarefa"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate flex-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleComplete(card.id);
                                }}
                                className="text-slate-500 hover:text-emerald-400 cursor-pointer shrink-0"
                                title="Concluir"
                              >
                                <Circle size={14} className={overdue ? "text-red-400" : ""} />
                              </button>
                              <span className={`font-semibold truncate ${overdue ? "text-red-200" : "text-slate-200"}`}>
                                {card.title}
                              </span>
                            </div>

                            <span className={`text-[8px] font-mono px-1.5 py-0.2 rounded uppercase font-bold shrink-0 ${
                              card.priority === "Urgente" ? "bg-red-500/20 text-red-400" :
                              card.priority === "Alta" ? "bg-amber-500/20 text-amber-400" :
                              "bg-slate-800 text-slate-400"
                            }`}>
                              {card.priority.slice(0, 3)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pl-5">
                            <span className="truncate">{card.columnTitle}</span>
                            {badge && (
                              <span className={`px-1.5 py-0.2 rounded border text-[8px] ${badge.color}`}>
                                {badge.label}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {openCards.length === 0 && (
                      <div className="text-center py-6 text-emerald-400/70 text-xs font-mono bg-[#070b14]/40 rounded-2xl border border-slate-800/50">
                        ✓ Tudo concluído neste módulo!
                      </div>
                    )}
                  </div>
                </div>

                {/* RODAPÉ DO MÓDULO */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onGoToPipeline) onGoToPipeline(node.id);
                    }}
                    className="text-[10px] font-mono font-bold text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                  >
                    Ir p/ Kanban ➔
                  </button>

                  <div className="flex items-center gap-1 text-xs font-mono font-bold text-white group-hover:text-blue-400 transition-colors">
                    <span>Ver Central ({node.total})</span>
                    <ArrowUpRight size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}