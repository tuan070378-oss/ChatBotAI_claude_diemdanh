import React from 'react';
import { cn } from '../../lib/utils';
import { Subject } from '../../types';

interface SubjectCardProps {
  subject: Subject;
  onClick: () => void;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({ subject, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-steel bg-white/80 dark:bg-navy-panel hover:border-fire-2 hover:shadow-md transition-all duration-200 text-left group focus-visible:ring-2 focus-visible:ring-fire-2 outline-none cursor-pointer w-full",
      )}
      aria-label={`Hỏi về môn ${subject.name}`}
      title={`Bắt đầu hỏi về ${subject.name}`}
    >
      <div className={cn("p-3 rounded-lg transition-transform group-hover:scale-105 shrink-0", subject.bg)}>
        <subject.icon className={cn("w-6 h-6", subject.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-heading font-bold text-sm sm:text-base text-gray-900 dark:text-white group-hover:fire-gradient-text truncate">{subject.name}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Bấm để bắt đầu trao đổi</p>
      </div>
    </button>
  );
};