import React from 'react';
import { WorkspaceCardItem } from '../data/workspaces';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  Brain,
  Scissors,
  FileText,
  BookOpen,
  BarChart3,
  Network,
  Calendar,
  Headphones,
  Compass,
  Target,
  Award,
  ArrowRight,
} from 'lucide-react';

interface WorkspaceCardProps {
  card: WorkspaceCardItem;
  onAction: (route: string) => void;
}

export const WorkspaceCard: React.FC<WorkspaceCardProps> = ({ card, onAction }) => {
  const { recordRecentTool } = useApp();

  const getIcon = (name: WorkspaceCardItem['iconName']) => {
    switch (name) {
      case 'Sparkles':
        return <Sparkles className="w-5 h-5" />;
      case 'Brain':
        return <Brain className="w-5 h-5" />;
      case 'Scissors':
        return <Scissors className="w-5 h-5" />;
      case 'FileText':
        return <FileText className="w-5 h-5" />;
      case 'BookOpen':
        return <BookOpen className="w-5 h-5" />;
      case 'BarChart3':
        return <BarChart3 className="w-5 h-5" />;
      case 'Network':
        return <Network className="w-5 h-5" />;
      case 'Calendar':
        return <Calendar className="w-5 h-5" />;
      case 'Headphones':
        return <Headphones className="w-5 h-5" />;
      case 'Compass':
        return <Compass className="w-5 h-5" />;
      case 'Target':
        return <Target className="w-5 h-5" />;
      case 'Award':
        return <Award className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  return (
    <div
      onClick={() => {
        recordRecentTool({
          id: card.id,
          title: card.title,
          route: card.route,
          iconName: card.iconName,
          suiteLabel: card.suiteLabel,
        });
        onAction(card.route);
      }}
      className={`cursor-pointer group relative flex flex-col justify-between p-6 rounded-2xl transition-all duration-200 shadow-lg ${
        card.isSpecial
          ? 'bg-gradient-to-br from-pink-950/50 via-slate-900 to-indigo-950/40 border-2 border-pink-500/50 hover:border-pink-400 hover:bg-slate-900 shadow-xl'
          : 'bg-[#0c1222]/90 border border-slate-800/80 hover:border-slate-700 hover:shadow-indigo-950/25'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-2.5 mb-3">
        {/* Left Feature Icon */}
        <div className={`p-2.5 sm:p-3 rounded-xl border group-hover:scale-105 transition-transform shrink-0 ${
          card.isSpecial
            ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
            : 'bg-slate-800/60 text-slate-300 border-slate-700/50'
        }`}>
          {getIcon(card.iconName)}
        </div>

        {/* Right Badges Container: Tier 1 on top, Tier 2 underneath */}
        <div className="flex flex-col items-end gap-1">
          {/* 1. Primary Suite Category Badge */}
          <span
            className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wider uppercase border shadow-sm ${
              card.suiteVariant === 'emerald'
                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40'
                : card.suiteVariant === 'indigo'
                ? 'bg-indigo-950/50 text-indigo-300 border-indigo-500/40'
                : card.suiteVariant === 'cyan'
                ? 'bg-cyan-950/50 text-cyan-300 border-cyan-500/40'
                : card.suiteVariant === 'pink'
                ? 'bg-pink-950/50 text-pink-300 border-pink-500/40'
                : 'bg-purple-950/50 text-purple-300 border-purple-500/40'
            }`}
          >
            {card.suiteLabel}
          </span>

          {/* 2. Functional Technical Sub-Badge */}
          {card.subTag && (
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold tracking-wide border ${
                card.subTagVariant === 'emerald'
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                  : card.subTagVariant === 'cyan'
                  ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/50'
                  : card.subTagVariant === 'purple'
                  ? 'bg-purple-950/40 text-purple-400 border-purple-800/50'
                  : card.subTagVariant === 'blue'
                  ? 'bg-blue-950/40 text-blue-400 border-blue-800/50'
                  : card.subTagVariant === 'pink'
                  ? 'bg-pink-950/40 text-pink-400 border-pink-800/50'
                  : card.subTagVariant === 'amber'
                  ? 'bg-amber-950/40 text-amber-400 border-amber-800/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {card.subTag}
            </span>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div>
        <h3 className={`text-base font-bold mb-2 group-hover:translate-x-0.5 transition-all leading-snug ${
          card.isSpecial ? 'text-white group-hover:text-pink-300' : 'text-slate-100 group-hover:text-indigo-300'
        }`}>
          {card.title}
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          {card.description}
        </p>
      </div>

      {/* Card Action Link with min 44px tap target */}
      <div className="pt-2">
        <span className={`text-xs font-semibold group-hover:translate-x-1 inline-flex items-center gap-1.5 min-h-[44px] py-2 transition-all ${
          card.isSpecial ? 'text-pink-400 group-hover:text-pink-300 font-bold' : 'text-indigo-400 group-hover:text-indigo-300'
        }`}>
          {card.actionLabel}
          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
        </span>
      </div>
    </div>
  );
};
