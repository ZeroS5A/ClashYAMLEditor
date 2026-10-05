export default function JsonFields({ label = '高级参数（JSON 对象）', value, onChange, help }) {
  return <label className="block space-y-2 text-sm font-medium">
    <span>{label}</span>
    {help && <p className="font-normal text-xs text-slate-500">{help}</p>}
    <textarea value={value} onChange={e => onChange(e.target.value)} className="w-full h-40 font-mono text-xs p-3 border rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-700" spellCheck={false} />
  </label>;
}
