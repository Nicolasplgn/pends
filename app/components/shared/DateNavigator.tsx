"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RotateCcw } from "lucide-react";
import { MONTH_NAMES } from "../../types";

interface DateNavigatorProps {
  selectedMonth: number;
  selectedYear: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectMonthYear?: (month: number, year: number) => void;
}

export function DateNavigator({
  selectedMonth,
  selectedYear,
  onPrevMonth,
  onNextMonth,
  onSelectMonthYear,
}: DateNavigatorProps) {
  const [showPicker, setShowPicker] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const isCurrentMonth = selectedMonth === currentMonth && selectedYear === currentYear;

  const years = [2025, 2026, 2027, 2028];

  function handleQuickSelect(m: number, y: number) {
    if (onSelectMonthYear) {
      onSelectMonthYear(m, y);
    }
    setShowPicker(false);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 bg-[#070b14] border border-slate-800 p-1 rounded-2xl shadow-md">
        
        {/* BOTÃO MÊS ANTERIOR */}
        <button
          type="button"
          onClick={onPrevMonth}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
          title="Mês anterior"
        >
          <ChevronLeft size={14} />
        </button>

        {/* NOME DO MÊS / ANO (CLIQUE P/ SALTO RÁPIDO) */}
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider text-white hover:text-cyan-400 hover:bg-slate-800/40 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
          title="Clique para escolher qualquer mês diretamente"
        >
          <CalendarIcon size={12} className="text-cyan-400" />
          <span>{MONTH_NAMES[selectedMonth]} / {selectedYear}</span>
        </button>

        {/* BOTÃO PRÓXIMO MÊS */}
        <button
          type="button"
          onClick={onNextMonth}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
          title="Próximo mês"
        >
          <ChevronRight size={14} />
        </button>

        {/* BOTÃO "HOJE" (SE NÃO ESTIVER NO MÊS ATUAL) */}
        {!isCurrentMonth && onSelectMonthYear && (
          <button
            type="button"
            onClick={() => handleQuickSelect(currentMonth, currentYear)}
            className="ml-1 px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 rounded-xl transition-all cursor-pointer flex items-center gap-1 animate-pulse"
            title="Voltar para o mês atual"
          >
            <RotateCcw size={10} />
            <span>Hoje</span>
          </button>
        )}
      </div>

      {/* POPOVER DE SALTO RÁPIDO DE MÊS E ANO */}
      {showPicker && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowPicker(false)} 
          />
          <div className="absolute top-full mt-2 left-0 z-50 w-72 bg-[#0b101f] border border-slate-700/80 rounded-3xl p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Salto Rápido</span>
              <div className="flex gap-1">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onSelectMonthYear && onSelectMonthYear(selectedMonth, y)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-all ${
                      selectedYear === y 
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" 
                        : "text-slate-500 hover:text-white"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {MONTH_NAMES.map((name, i) => {
                const isSelected = selectedMonth === i;
                const isNow = currentMonth === i && currentYear === selectedYear;

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleQuickSelect(i, selectedYear)}
                    className={`py-2 px-1 text-center rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      isSelected 
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" 
                        : isNow 
                          ? "bg-slate-800/80 text-cyan-300 border border-cyan-500/40" 
                          : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}