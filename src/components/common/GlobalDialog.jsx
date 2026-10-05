import useDialogFocus from '../../hooks/useDialogFocus';

export default function GlobalDialog({ dialog, onClose }) {
  const ref = useDialogFocus(onClose);
  return <div ref={ref} role="dialog" aria-modal="true" aria-label={dialog.title} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
      <div className="p-6"><h3 className="text-lg font-bold mb-2">{dialog.title}</h3><p className="text-sm text-slate-500 whitespace-pre-wrap break-words max-h-[50vh] overflow-y-auto">{dialog.message}</p></div>
      <div className="px-6 py-4 border-t flex justify-end gap-3">
        {dialog.type === 'confirm' && <button onClick={onClose} className="px-4 py-2 border rounded">取消</button>}
        <button onClick={() => { if (dialog.type === 'confirm') dialog.onConfirm?.(); onClose(); }} className="px-4 py-2 bg-blue-600 text-white rounded">确定</button>
      </div>
    </div>
  </div>;
}
