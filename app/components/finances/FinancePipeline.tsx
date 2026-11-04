"use client";

import { Wallet, CheckCircle2, Circle, Calendar, Coins } from "lucide-react";
import { isCardOverdue } from "../../types";

interface FinancePipelineProps {
  columns: any[];
  modules: any[];
  onToggleComplete: (cardId: string) => Promise<void>;
  onCardClick: (cardId: string) => void;
}

export function FinancePipeline({
  columns,
  onToggleComplete,
  onCardClick,
}: FinancePipelineProps) {
  return (
    <div className="flex-1 p-4 sm:p-8 overflow-x-auto flex gap-5 items-start">
      {columns.map((col) => {
        // FILTRO CIRÚRGICO: Apenas cards criados pelas Rotinas ou com R$ no título
        const financeCards = col.cards.filter((card: any) => {
          const hasRecurringId = card.recurringTaskId !== null && card.recurringTaskId !== undefined;
          const hasMoneyPattern = /R\$\s*[\d.,]+/.test(card.title || "");
          return hasRecurringId || hasMoneyPattern;
        });

        // Somatório exato das faturas da coluna
        const columnTotalAmount = financeCards.reduce((sum: number, card: any) => {
          const match = card.title.match(/R\$\s*([\d.,]+)/);
          if (match) {
            const cleanVal = parseFloat(match[1].replace(/\./g, "").replace(",", "."));
            return sum + (isNaN(cleanVal) ? 0 : cleanVal);
          }
          return sum;
        }, 0);

        return (
          <div 
            key={col.id}
            className={`w-80 shrink-0 bg-[#0f172a] border rounded-3xl flex flex-col max-h-full shadow-2xl ${
              col.isDone ? "border-emerald-800/60 bg-[#0b1424]/40" : "border-slate-800"
            }`}
          >
            {/* CABEÇALHO DA COLUNA FINANCEIRA */}
            <div className="p-4 font-bold text-xs uppercase tracking-wider text-slate-400 font-mono flex flex-col gap-2 border-b border-slate-800/80 bg-[#0a0f1d] rounded-t-3xl">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">{col.title}</span>
                <span className="bg-slate-800 text-cyan-400 px-2 py-0.5 rounded-full text-[11px] font-mono">
                  {financeCards.length}
                </span>
              </div>
              
              <div className={`text-[11px] font-mono px-2.5 py-1.5 rounded-xl flex items-center justify-between shadow-inner ${
                columnTotalAmount > 0 
                  ? "text-emerald-400 bg-emerald-950/40 border border-emerald-800/60" 
                  : "text-slate-500 bg-slate-900 border border-slate-800"
              }`}>
                <div className="flex items-center gap-1.5">
                  <Wallet size={13} />
                  <span>Subtotal:</span>
                </div>
                <span>{columnTotalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            {/* LISTA DE FATURAS */}
            <div className="p-3 overflow-y-auto flex-1 min-h-75 space-y-2.5">
              {financeCards.map((card: any) => {
                const overdue = isCardOverdue(card.dueDate, card.completed);
                
                // Extrair o valor em R$ do título para exibir em destaque verde
                const moneyMatch = card.title.match(/(R\$\s*[\d.,]+)/);
                const titleWithoutMoney = card.title.replace(/\(R\$\s*[\d.,]+\)/, "").trim();

                return (
                  <div
                    key={card.id}
                    onClick={() => onCardClick(card.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      card.completed 
                        ? "bg-[#0b1424] border-emerald-500/40 opacity-75" 
                        : overdue
                          ? "bg-[#180d12] border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                          : "bg-[#121829] border-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onToggleComplete(card.id);
                        }}
                        className="text-slate-500 hover:text-emerald-400 cursor-pointer"
                      >
                        {card.completed ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Circle size={16} />}
                      </button>

                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase font-mono flex items-center gap-1 ${
                        card.completed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}>
                        <Coins size={10} /> Conta
                      </span>
                    </div>

                    <h4 className={`font-semibold text-sm mb-1 leading-snug ${card.completed ? "line-through text-slate-500" : "text-white"}`}>
                      {titleWithoutMoney || card.title}
                    </h4>

                    {moneyMatch && !card.completed && (
                      <div className="text-[13px] font-black font-mono text-emerald-400 mt-1 mb-2">
                        {moneyMatch[1]}
                      </div>
                    )}

                    {card.dueDate && (
                      <div className={`text-[10px] flex items-center gap-1.5 font-mono pt-2 border-t border-slate-800/80 ${
                        overdue ? "text-red-400 font-bold" : "text-slate-400"
                      }`}>
                        <Calendar size={11} className={overdue ? "text-red-400" : "text-emerald-400"}/> 
                        {overdue ? `Venceu: ${new Date(card.dueDate).toLocaleDateString('pt-BR')}` : `Vence em: ${new Date(card.dueDate).toLocaleDateString('pt-BR')}`}
                      </div>
                    )}
                  </div>
                );
              })}

              {financeCards.length === 0 && (
                <div className="text-center py-16 text-slate-600 font-mono text-xs border-2 border-dashed border-slate-800/60 rounded-2xl m-1">
                  Nenhuma conta nesta etapa.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}