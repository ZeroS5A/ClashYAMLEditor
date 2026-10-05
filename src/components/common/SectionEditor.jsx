import { useState } from 'react';
import JsonFields from './JsonFields';
import { omitFields, parseExtraFields } from '../../utils/editing';
import { normalizeConfig } from '../../utils/configShape';

const css = 'w-full p-3 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-950 text-sm';
const displayValue = (value, type) => value === undefined ? '' : type === 'list' ? value.join('\n') : type === 'json' ? JSON.stringify(value, null, 2) : String(value);

// Track only touched fields so opening a form cannot introduce defaults or erase omitted keys.
export default function SectionEditor({ title, description, config, section, fields, setConfig, showAlert, advanced = true }) {
  const original = section ? config[section] : config;
  const value = original || {};
  const [draft, setDraft] = useState(null);
  const current = draft?.base === original ? draft : null;
  const names = fields.map(f => f.key);
  const extras = current?.extras ?? JSON.stringify(omitFields(value, names), null, 2);
  const change = (key, text) => setDraft({ base: original, changes: { ...(current?.changes || {}), [key]: text }, extras: current?.extras });
  const save = () => {
    try {
      const result = advanced ? { ...parseExtraFields(extras, names), ...Object.fromEntries(names.filter(k => Object.hasOwn(value, k)).map(k => [k, value[k]])) } : { ...value };
      for (const [key, text] of Object.entries(current?.changes || {})) {
        if (text === '') { delete result[key]; continue; }
        const field = fields.find(f => f.key === key);
        result[key] = field.type === 'number' ? Number(text) : field.type === 'boolean' ? text === 'true' : field.type === 'list' ? text.split('\n').map(v => v.trim()).filter(Boolean) : field.type === 'json' ? JSON.parse(text) : text;
        if (field.type === 'number' && !Number.isFinite(result[key])) throw new Error(`${key}: 数字格式无效`);
      }
      const next = section ? { ...config, [section]: result } : result;
      const shape = normalizeConfig(next); if (!shape.ok) throw new Error(shape.error);
      setConfig(shape.config); setDraft(null);
    } catch (e) { showAlert(`设置未保存：${e.message}`); }
  };
  return <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-6 space-y-4">
    <h2 className="text-xl font-bold">{title}</h2><p className="text-sm text-slate-500">{description}</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{fields.map(field => {
      const text = current?.changes?.[field.key] ?? displayValue(field.key === 'mode' && typeof value[field.key] === 'string' ? value[field.key].toLowerCase() : value[field.key], field.type);
      return <label key={field.key} className={`space-y-2 text-sm font-medium ${['list', 'json'].includes(field.type) ? 'md:col-span-2' : ''}`}><span>{field.label || field.key}</span>
        {field.type === 'boolean' || field.options ? <select value={text} onChange={e => change(field.key, e.target.value)} className={css}><option value="">未设置</option>{(field.options || ['true', 'false']).map(v => <option key={v} value={v}>{v}</option>)}</select>
          : ['list', 'json'].includes(field.type) ? <textarea aria-label={field.key} value={text} onChange={e => change(field.key, e.target.value)} className={`${css} h-28 font-mono`} placeholder={field.type === 'list' ? '每行一项，留空删除此字段' : 'JSON 对象或数组'} />
          : <input aria-label={field.key} type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'} value={text} onChange={e => change(field.key, e.target.value)} className={css} placeholder="未设置" />}
      </label>;
    })}</div>
    {advanced && <JsonFields value={extras} onChange={text => setDraft({ base: original, changes: current?.changes || {}, extras: text })} help="未展示字段会保留。这里可编辑其他高级设置；保存时会检查 JSON。" />}
    {draft && !current && <p className="text-amber-600 text-sm">配置已通过撤销或其他操作改变；表单已显示当前配置，请重新编辑。</p>}
    <button onClick={save} className="px-5 py-2 bg-blue-600 text-white rounded-lg">保存{title}</button>
  </div>;
}
