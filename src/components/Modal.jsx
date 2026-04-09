import React from 'react';
import { X, Save } from 'lucide-react';

const Modal = ({ title, children, onClose, onSave, saveText = "保存", widthClass = "max-w-3xl", customFooter }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
    <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full ${widthClass} max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
      <div className="flex justify-between items-center p-5 border-b dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{title}</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
        {children}
      </div>
      {customFooter ? customFooter : (
        <div className="p-5 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
            取消
          </button>
          <button onClick={onSave} className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Save className="w-4 h-4" /> {saveText}
          </button>
        </div>
      )}
    </div>
  </div>
);

export default Modal;
