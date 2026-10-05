import React from 'react';
import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';
import useDialogFocus from '../../hooks/useDialogFocus';

const Modal = ({ title, subtitle, icon: Icon, children, onClose, onSave, saveText = "保存", widthClass = "max-w-3xl", customFooter }) => {
  const ref = useDialogFocus(onClose);
  return createPortal(
  <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
    <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full min-w-0 ${widthClass} max-h-[90dvh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
      <div className="flex justify-between items-center gap-3 p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 shrink-0"><Icon className="w-5 h-5" /></div>}
          <div className="min-w-0"><h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white break-words">{title}</h2>{subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}</div>
        </div>
        <button type="button" aria-label="关闭弹窗" onClick={onClose} className="p-1.5 rounded-lg shrink-0 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 min-w-0 custom-scrollbar">
        {children}
      </div>
      {customFooter ? customFooter : (
        <div className="p-4 sm:p-5 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
            取消
          </button>
          <button onClick={onSave} className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Save className="w-4 h-4" /> {saveText}
          </button>
        </div>
      )}
    </div>
  </div>, document.body
);
};

export default Modal;
