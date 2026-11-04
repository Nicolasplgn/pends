"use client";

import { useState } from "react";
import { Pencil, Check, X, ArrowDownToLine, Trash2 } from "lucide-react";
import { getTaskOverallStatus } from "../../types";

interface FinanceTableProps {
  recurringTasks: any[];
  onQuickUpdateAmount: (taskId: string, amount: number | null) => Promise<void>;
  onOpenHistory: (task: any) => void;
  onStartSpawn: (task: any) => void;
  onOpenRecurringModal: (task: any) => void;
  onDeleteRecurring: (taskId: string) => Promise<void>;
}

export function FinanceTable({
  recurringTasks,
  onQuickUpdateAmount,
  onOpenHistory,
  onStartSpawn,
  onOpenRecurringModal,
  onDeleteRecurring,
}: FinanceTableProps) {
  const [editingInlineId, setEditingInlineId] = useState<string | null>(null);
  const [inlineAmountInput, setInlineAmountInput] = useState<string>("");

  async function handleSaveInline(taskId: string) {
    const val = inlineAmountInput ? parseFloat(inlineAmountInput) : null;
    setEditingInlineId(null);
    setInlineAmountInput("");
    await onQuickUpdateAmount(taskId, val);
  }

  return (
    <div className="bg-[#0f172a] rounded-3xl border border-slate-800 shadow-xl overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-175">
        <thead className="bg-[#0b101d] text-[10px] font-bold text-slate-500 uppercase font-mono border-b border-slate-800">
          <tr>
            <th className="p-4">Título / Conta</th>
            <th className="p-4">Módulo</th>
            <th className="p-4">Dia Venc.</th>
            <th className="p-4">Valor Atual (1 Clique p/ Editar)</th>
            <th className="p-4">Status</th>
            <th className="p-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50 text-sm text-slate-300">
          {recurringTasks.map((task) => {
            const overallStatus = getTaskOverallStatus(task);
            const isEditingThis = editingInlineId === task.id;

            return (
              <tr key={task.id} className="hover:bg-[#121829] transition-colors">
                <td className="p-4 font-semibold text-slate-200">
                  {task.title}
                </td>
                <td className="p-4">
                  {task.module ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full font-mono" style={{ backgroundColor: `${task.module.color}20`, color: task.module.color }}>
                      {task.module.title}
                    </span>
                  ) : <span className="text-slate-600 text-xs">-</span>}
                </td>
                <td className="p-4 font-mono text-slate-400">{task.dueDay ? `Todo dia ${task.dueDay}` : "Variável"}</td>
                
                <td className="p-4 font-mono">
                  {isEditingThis ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        step="0.01"
                        autoFocus
                        placeholder="0.00"
                        value={inlineAmountInput}
                        onChange={(e) => setInlineAmountInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleSaveInline(task.id);
                          if (e.key === "Escape") setEditingInlineId(null);
                        }}
                        className="w-28 bg-[#070a12] border border-blue-500 p-1.5 rounded text-xs text-white outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => { void handleSaveInline(task.id); }}
                        className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                        title="Confirmar"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingInlineId(null)}
                        className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded cursor-pointer"
                        title="Cancelar"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => {
                        setEditingInlineId(task.id);
                        setInlineAmountInput(task.amount ? task.amount.toString() : "");
                      }}
                      className="group cursor-pointer inline-flex flex-col"
                      title="Clique para editar este valor na hora"
                    >
                      <div className="flex items-center gap-1.5">
                        {task.amount ? (
                          <span className="font-bold text-emerald-400 group-hover:underline">
                            {task.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono text-xs italic group-hover:underline">
                            Clique p/ definir saldo
                          </span>
                        )}
                        <Pencil size={11} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {task.updatedAt ? `Atualizado ${new Date(task.updatedAt).toLocaleDateString('pt-BR')}` : ""}
                      </span>
                    </div>
                  )}
                </td>
                
                <td className="p-4">
                  <button
                    type="button"
                    onClick={() => onOpenHistory(task)}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-full border font-mono flex items-center gap-1 cursor-pointer transition-all shadow-sm ${overallStatus.color}`}
                    title="Clique para ver o histórico de todos os meses"
                  >
                    <span>{overallStatus.label}</span>
                    <span className="text-slate-500 mx-0.5">:</span>
                    <span className="text-[9px] text-slate-300 underline font-sans">detalhes</span>
                  </button>
                </td>

                <td className="p-4 flex items-center justify-end gap-1.5">
                  <button 
                    type="button"
                    onClick={() => onStartSpawn(task)} 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-bold uppercase font-mono transition-colors cursor-pointer"
                  >
                    <ArrowDownToLine size={12}/> Lançar
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => onOpenRecurringModal(task)} 
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                    title="Configurações completas"
                  >
                    <Pencil size={14}/>
                  </button>

                  <button 
                    type="button"
                    onClick={() => onDeleteRecurring(task.id)} 
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={14}/>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}