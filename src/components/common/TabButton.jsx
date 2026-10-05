import React from 'react';

const TabButton = ({ active, onClick, icon: Icon, label, count }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
    {count !== undefined && <span className="ml-auto text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{count}</span>}
  </button>
);

export default TabButton;
