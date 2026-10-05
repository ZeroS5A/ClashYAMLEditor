import { useState, useMemo } from 'react';
import { Layers, Search, ListChecks, GripVertical, ArrowUp, ArrowDown, X, SlidersHorizontal, ChevronDown, FolderOpen } from 'lucide-react';
import Modal from '../common/Modal';
import InputRow from '../common/InputRow';
import JsonFields from '../common/JsonFields';
import WrappingVirtualList from '../common/WrappingVirtualList';
import { omitFields, parseExtraFields } from '../../utils/editing';

const managed = ['name', 'type', 'proxies', 'use', 'url', 'interval'];
const typeLabels = { select: '手动选择', 'url-test': '自动测速', fallback: '故障转移', 'load-balance': '负载均衡', smart: '智能选择' };
const memberKey = name => name;
export default function ProxyGroupEditorModal({ group, allAvailableNames, providerNames = [], onClose, onSave, showAlert, target }) {
  const [data, setData] = useState({ name: group.name || '', type: group.type || 'select', proxies: group.proxies || [], use: group.use || [], url: group.url ?? '', interval: group.interval ?? '' });
  const [extra, setExtra] = useState(() => JSON.stringify(omitFields(group, managed), null, 2));
  const [search, setSearch] = useState(''), [dragged, setDragged] = useState(null);
  const names = useMemo(() => allAvailableNames.filter(n => n !== data.name && n.toLowerCase().includes(search.toLowerCase())), [allAvailableNames, data.name, search]);
  const selected = useMemo(() => new Set(data.proxies), [data.proxies]);
  const update = (key, value) => setData(prev => ({ ...prev, [key]: value }));
  const toggle = (key, name) => update(key, data[key].includes(name) ? data[key].filter(n => n !== name) : [...data[key], name]);
  const move = (from, to) => { if (to < 0 || to >= data.proxies.length || from === null) return; const next = [...data.proxies]; const [item] = next.splice(from, 1); next.splice(to, 0, item); update('proxies', next); setDragged(null); };
  const save = () => {
    try {
      if (!data.name.trim()) throw new Error('名称不能为空');
      const result = { ...parseExtraFields(extra, managed), name: data.name.trim(), type: data.type };
      for (const key of ['proxies', 'use']) if (data[key].length || Object.hasOwn(group, key)) result[key] = data[key];
      if (data.url !== '') result.url = data.url;
      if (data.interval !== '') { result.interval = Number(data.interval); if (!Number.isInteger(result.interval) || result.interval < 0) throw new Error('测速间隔必须为非负整数'); }
      onSave(result);
    } catch (e) { showAlert(`策略组未保存：${e.message}`); }
  };
  const types = [...new Set(['select', 'url-test', 'fallback', 'load-balance', ...(target?.core === 'smart' ? ['smart'] : []), data.type])];
  return <Modal title="编辑策略组" subtitle="配置分流方式、选择成员并调整优先顺序" icon={Layers} widthClass="max-w-4xl" onClose={onClose} onSave={save}><div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 bg-slate-50/60 dark:bg-slate-950/20 space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="w-4 h-4 text-indigo-500" />基本设置</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><InputRow label="策略组名称" value={data.name} onChange={v => update('name', v)} /><label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">类型<select value={data.type} onChange={e => update('type', e.target.value)} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500">{types.map(t => <option value={t} key={t}>{typeLabels[t] ? `${typeLabels[t]}（${t}）` : t}</option>)}</select></label></div>
    {data.type === 'relay' && <p className="text-amber-600 text-sm">relay 已废弃。原字段会保留；请按实际内核改用节点 dialer-proxy。</p>}
    {(['url-test', 'fallback', 'load-balance', 'smart'].includes(data.type) || group.url !== undefined || group.interval !== undefined) && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><InputRow label="测速地址（url）" value={data.url} onChange={v => update('url', v)} /><InputRow label="间隔秒数（留空不设置）" value={data.interval} onChange={v => update('interval', v)} /></div>}
    </section>
    <fieldset className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 min-w-0">
      <legend className="px-2 text-sm font-semibold"><span className="flex items-center gap-2"><FolderOpen className="w-4 h-4 text-indigo-500" />代理集合来源（use）</span></legend>
      <div className="flex flex-wrap gap-2">{providerNames.map(n => <label key={n} className={`inline-flex items-start gap-2 px-3 py-2 rounded-xl border max-w-full text-sm cursor-pointer transition-colors ${data.use.includes(n) ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-300' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-300'}`}><input type="checkbox" checked={data.use.includes(n)} onChange={() => toggle('use', n)} className="mt-1 accent-indigo-600 shrink-0" /><span className="break-all min-w-0">{n}</span></label>)}</div>
      {!providerNames.length && <p className="text-slate-500 text-xs">请先在高级设置 → 代理集合中添加订阅源。</p>}
    </fieldset>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section className="order-2 md:order-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/20 min-w-0 overflow-hidden">
        <div className="p-4 space-y-3"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold flex items-center gap-2"><Search className="w-4 h-4 text-blue-500" />可选成员</h3><span className="text-xs text-slate-400">{names.length} 项</span></div>
          <div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" /><input aria-label="搜索组成员" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索节点、内置出站或策略组" className="w-full py-2.5 pl-9 pr-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        </div>
        {names.length ? <WrappingVirtualList items={names} height={320} estimatedRowHeight={64} resetKey={search} itemKey={memberKey} label="可选组成员" renderItem={name => <div className="pb-2"><label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selected.has(name) ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' : 'bg-white border-slate-200 hover:border-blue-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-blue-700'}`}><input type="checkbox" aria-label={`选择成员 ${name}`} checked={selected.has(name)} onChange={() => toggle('proxies', name)} className="mt-1 accent-blue-600 shrink-0" /><span className="min-w-0 break-all text-sm leading-6">{name}</span></label></div>} /> : <div className="h-80 flex items-center justify-center text-sm text-slate-400">没有匹配的成员</div>}
        <p className="p-4 text-xs text-slate-400">勾选节点、内置出站或其他策略组以加入此组。</p>
      </section>
      <section className="order-1 md:order-2 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/10 min-w-0 overflow-hidden">
        <div className="p-4 space-y-3"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold flex items-center gap-2"><ListChecks className="w-4 h-4 text-indigo-500" />已选成员</h3><span className="rounded-full px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-xs font-semibold text-indigo-600 dark:text-indigo-300">{data.proxies.length}</span></div><p className="text-xs text-slate-500 dark:text-slate-400 min-h-10 leading-5">按当前顺序保存；拖拽卡片或使用箭头调整顺序。</p></div>
        {data.proxies.length ? <WrappingVirtualList items={data.proxies} height={320} estimatedRowHeight={92} itemKey={memberKey} label="已选组成员" renderItem={(name, i) => <div className="pb-2"><div draggable onDragStart={() => setDragged(i)} onDragEnd={() => setDragged(null)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); move(dragged, i); }} className={`p-3 rounded-xl border bg-white dark:bg-slate-900 transition-colors ${dragged === i ? 'border-indigo-400 opacity-50' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
          <div className="flex items-start gap-2"><span className="text-[11px] font-semibold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 rounded-md px-1.5 py-1 shrink-0">{String(i + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1 break-all text-sm leading-6" data-testid="selected-member-name">{name}</span><GripVertical className="w-4 h-4 text-slate-300 mt-1 shrink-0 cursor-grab" /></div>
          <div className="flex gap-1 mt-2 justify-end"><button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`上移 ${name}`} title="上移" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed"><ArrowUp className="w-4 h-4" /></button><button type="button" disabled={i === data.proxies.length - 1} onClick={() => move(i, i + 1)} aria-label={`下移 ${name}`} title="下移" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed"><ArrowDown className="w-4 h-4" /></button><button type="button" onClick={() => update('proxies', data.proxies.filter((_, idx) => idx !== i))} aria-label={`移除 ${name}`} title="移除成员" className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"><X className="w-4 h-4" /></button></div>
        </div></div>} /> : <div className="h-80 flex flex-col items-center justify-center gap-3 text-slate-400 p-5"><ListChecks className="w-8 h-8 text-indigo-200 dark:text-indigo-900" /><p className="text-sm">尚未选择成员</p><p className="text-xs text-center">从可选成员中勾选，或绑定上方的代理集合。</p></div>}
        <p className="p-4 text-xs text-slate-400">移除只会取消此组的引用，节点本身会保留。</p>
      </section>
    </div>
    <details className="group rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <summary className="flex items-center gap-2 p-4 cursor-pointer text-sm font-semibold list-none bg-slate-50/60 dark:bg-slate-950/20"><SlidersHorizontal className="w-4 h-4 text-slate-400" />高级参数<span className="font-normal text-xs text-slate-400 ml-auto">JSON</span><ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" /></summary>
      <div className="p-4 border-t border-slate-100 dark:border-slate-800"><JsonFields value={extra} onChange={setExtra} help="保留 tolerance、lazy、filter、负载均衡 strategy 及所有其他字段。无修改保存不会删除高级配置。" /></div>
    </details>
  </div></Modal>;
}
