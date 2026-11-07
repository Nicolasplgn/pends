"use client";

import { useMemo, useState, useRef } from "react";
import { Cpu, Eye, CheckCircle2, Circle, Calendar, Flame, Clock, Layers, ExternalLink } from "lucide-react";
import type { NeuralNode, NeuralCard } from "../../types";
import { isCardOverdue } from "../../types";

interface NeuralOrbitProps {
  moduleNodes: NeuralNode[];
  totalAllTasks: number;
  onSelectNode: (node: NeuralNode) => void;
  onToggleComplete: (cardId: string) => void;
  onCardClick?: (cardId: string) => void; // ✅ Adicionado para abrir a ficha ao clicar no card
}

export function NeuralOrbit({
  moduleNodes,
  totalAllTasks,
  onSelectNode,
  onToggleComplete,
  onCardClick,
}: NeuralOrbitProps) {
  // ✅ Salva o ID em vez do objeto inteiro (assim, quando o banco atualizar, a lista atualiza na hora)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hudTab, setHudTab] = useState<"urgent" | "deadlines" | "all">("urgent");
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Deriva o nó ativo em tempo real a partir do moduleNodes atualizado
  const activeNode = useMemo(() => {
    if (!hoveredNodeId) return null;
    return moduleNodes.find((n) => n.id === hoveredNodeId) || null;
  }, [moduleNodes, hoveredNodeId]);

  const handleMouseEnter = (nodeId: string) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setHoveredNodeId(nodeId);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredNodeId(null);
      setHudTab("urgent");
    }, 250);
  };

  const handleHudMouseEnter = () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  };

  const handleHudMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredNodeId(null);
      setHudTab("urgent");
    }, 250);
  };

  // Posicionamento inteligente
  const hudPosition = useMemo(() => {
    if (!activeNode) return null;
    const { x, y } = activeNode;
    const isLeft = x <= 360;
    const posX = isLeft ? x + 72 : x - 72;
    const transformX = isLeft ? "0%" : "-100%";

    let transformY = "-50%";
    if (y < 240) transformY = "-15%";
    else if (y > 480) transformY = "-82%";

    return {
      left: posX,
      top: y,
      transform: `translate(${transformX}, ${transformY})`,
    };
  }, [activeNode]);

  // Lista dinâmica baseada na aba clicada
  const displayedCards = useMemo(() => {
    if (!activeNode) return [];
    if (hudTab === "urgent") {
      return activeNode.cards.filter((c) => !c.completed && (c.priority === "Urgente" || c.priority === "Alta"));
    }
    if (hudTab === "deadlines") {
      return activeNode.cards.filter((c) => !c.completed && c.dueDate);
    }
    return activeNode.cards;
  }, [activeNode, hudTab]);

  return (
    <div className="flex-1 relative flex items-center justify-center overflow-hidden select-none p-4 sm:p-6">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0b1120_1px,transparent_1px),linear-gradient(to_bottom,#0b1120_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      <div className="absolute top-4 left-6 z-20 hidden sm:block">
        <p className="text-[11px] text-slate-500 font-mono">
          💡 Passe o mouse sobre um nó para explorar tarefas, marcar como feitas ou abrir detalhes.
        </p>
      </div>

      <div className="relative w-180 h-180 flex items-center justify-center shrink-0 scale-75 sm:scale-100">
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <circle cx="360" cy="360" r="230" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 8" className="opacity-60" />
          <circle cx="360" cy="360" r="140" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 6" className="opacity-40" />
          
          {moduleNodes.map((n) => {
            const isHovered = activeNode?.id === n.id;
            return (
              <g key={n.id}>
                <line 
                  x1="360" 
                  y1="360" 
                  x2={n.x} 
                  y2={n.y} 
                  stroke={n.color} 
                  strokeWidth={isHovered ? "3" : "1.5"} 
                  strokeOpacity={isHovered ? "0.9" : "0.35"} 
                  strokeDasharray={isHovered ? "0" : "6 4"}
                  className="transition-all duration-300" 
                />
                <circle cx={n.x} cy={n.y} r="28" fill={n.color} fillOpacity={isHovered ? "0.2" : "0.08"} />
              </g>
            );
          })}
        </svg>

        {/* NÚCLEO CENTRAL */}
        <div className="absolute z-10 flex flex-col items-center justify-center w-44 h-44 rounded-full bg-[#0a0f1d] border-2 border-blue-500/40 shadow-[0_0_50px_rgba(37,99,235,0.25)] backdrop-blur-md cursor-default">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 mb-2">
            <Cpu size={26} className="animate-pulse" />
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest">NÚCLEO CENTRAL</span>
          <span className="text-3xl font-mono font-black text-white">{totalAllTasks}</span>
          <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider mt-0.5">Pendências</span>
        </div>

        {/* NÓS DOS MÓDULOS */}
        {moduleNodes.map((node) => {
          const isHovered = activeNode?.id === node.id;
          return (
            <div 
              key={node.id}
              onMouseEnter={() => handleMouseEnter(node.id)}
              onMouseLeave={handleMouseLeave}
              onClick={() => onSelectNode(node)}
              style={{ 
                left: `${node.x}px`, 
                top: `${node.y}px`, 
                transform: "translate(-50%, -50%)", 
                borderColor: isHovered ? node.color : `${node.color}60`,
              }}
              className={`absolute z-20 group cursor-pointer flex flex-col items-center justify-center w-28 h-28 rounded-3xl bg-[#0f172a] border-2 shadow-2xl transition-all duration-300 ${
                isHovered ? "scale-110 z-40 ring-4 ring-offset-2 ring-offset-black" : "hover:scale-105"
              }`}
            >
              <div 
                className={`absolute inset-0 rounded-3xl blur-md transition-opacity ${
                  isHovered ? "opacity-60" : "opacity-20"
                }`}
                style={{ backgroundColor: node.color }}
              />

              <div className="w-3.5 h-3.5 rounded-full mb-1.5 shadow-sm" style={{ backgroundColor: node.color }} />
              
              <span className="text-[11px] font-bold text-white uppercase tracking-wider text-center font-mono leading-tight px-1.5 line-clamp-2">
                {node.title}
              </span>

              <span className="text-[10px] font-mono text-slate-400 mt-1">
                {node.total} tarefas
              </span>

              <div className="w-14 bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${node.percent}%`, backgroundColor: node.color }} />
              </div>
            </div>
          );
        })}

        {/* POPUP HOLOGRÁFICO INTERATIVO */}
        {activeNode && hudPosition && (
          <div 
            onMouseEnter={handleHudMouseEnter}
            onMouseLeave={handleHudMouseLeave}
            style={{
              position: "absolute",
              zIndex: 70,
              left: `${hudPosition.left}px`,
              top: `${hudPosition.top}px`,
              transform: hudPosition.transform,
              borderColor: `${activeNode.color}90`,
              boxShadow: `0 0 35px ${activeNode.color}25, 0 20px 50px rgba(0,0,0,0.95)`
            }}
            className="w-96 bg-[#0c1220]/95 border-2 rounded-3xl p-5 backdrop-blur-xl transition-all duration-200 animate-in fade-in zoom-in-95 flex flex-col"
          >
            {/* CABEÇALHO */}
            <div className="flex items-center justify-between border-b border-slate-800/90 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: activeNode.color }} />
                <h4 className="font-bold font-mono text-white text-sm uppercase tracking-wide">{activeNode.title}</h4>
              </div>
              <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-800/80 px-2 py-0.5 rounded-full">
                {activeNode.percent}% concluído
              </span>
            </div>

            {/* ABAS COM CLIQUE ATIVO */}
            <div className="flex items-center gap-2 mb-3 bg-[#070b14] p-1.5 rounded-2xl border border-slate-800">
              <button 
                type="button"
                onClick={() => setHudTab("urgent")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  hudTab === "urgent" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Flame size={12} /> Críticas
              </button>
              <button 
                type="button"
                onClick={() => setHudTab("deadlines")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  hudTab === "deadlines" ? "bg-red-500/20 text-red-300 border border-red-500/40" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Clock size={12} /> Prazos
              </button>
              <button 
                type="button"
                onClick={() => setHudTab("all")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  hudTab === "all" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Layers size={12} /> Todas ({activeNode.cards.length})
              </button>
            </div>

            {/* LISTA DE PENDÊNCIAS COM CLIQUE NO CARD & CHECKBOX ATIVO */}
            <div className="space-y-2 overflow-y-auto max-h-56 pr-1">
              {displayedCards.map((c) => {
                const overdue = isCardOverdue(c.dueDate, c.completed);
                return (
                  <div 
                    key={c.id} 
                    onClick={() => onCardClick && onCardClick(c.id)}
                    className="p-2.5 rounded-2xl bg-[#070b14] border border-slate-800/80 hover:border-slate-600 hover:bg-[#0c1424] text-xs flex items-start gap-2.5 transition-all cursor-pointer group"
                    title="Clique para abrir a ficha completa desta pendência"
                  >
                    {/* CHECKBOX COM STOP PROPAGATION */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleComplete(c.id);
                      }}
                      className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer shrink-0 mt-0.5"
                      title={c.completed ? "Reabrir tarefa" : "Marcar como concluída"}
                    >
                      {c.completed ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Circle size={16} className={overdue ? "text-red-400" : ""} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`font-semibold truncate ${c.completed ? "line-through text-slate-500" : overdue ? "text-red-200" : "text-slate-200"}`}>
                          {c.title}
                        </span>
                        <ExternalLink size={11} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[8px] font-mono px-1.5 py-0.2 rounded uppercase font-bold ${
                          c.completed ? "bg-emerald-950 text-emerald-400" :
                          overdue ? "bg-red-950 text-red-400 font-bold" : "bg-slate-800 text-slate-400"
                        }`}>
                          {c.completed ? "Concluído" : overdue ? "Vencida" : c.priority}
                        </span>

                        {c.dueDate && (
                          <span className={`text-[9px] font-mono flex items-center gap-1 ${overdue ? "text-red-400 font-bold" : "text-slate-500"}`}>
                            <Calendar size={10} />
                            {new Date(c.dueDate).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {displayedCards.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs font-mono">Nenhuma pendência nesta aba.</div>
              )}
            </div>

            {/* BOTÃO EXPANDIR GAVETA COMPLETA */}
            <div className="border-t border-slate-800/80 mt-3 pt-3 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500">Gaveta no celular ou tela cheia ➔</span>
              <button 
                type="button"
                onClick={() => onSelectNode(activeNode)}
                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl text-[10px] font-bold font-mono transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Eye size={12} />
                Expandir Módulo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}