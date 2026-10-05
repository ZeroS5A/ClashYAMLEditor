import { useState, useMemo } from 'react';
import { Layers, Plus, Edit, Trash2, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import ProxyGroupEditorModal from './ProxyGroupEditorModal';
import WrappingVirtualList from '../common/WrappingVirtualList';
import { replaceOutbound, deleteOutbounds, outboundReferences } from '../../utils/references';
import { BUILTIN_OUTBOUNDS, nameError, validateConfig } from '../../utils/validation';

export default function TabGroups({ config, setConfig, showAlert, showConfirm, showToast, target, locationHint }) {
  const groups = config['proxy-groups'];
  const [editing, setEditing] = useState(null), [dragged, setDragged] = useState(null);
  const [expandedMembers, setExpandedMembers] = useState(new Set());
  const [expandedProviders, setExpandedProviders] = useState(new Set());
  const toggleExpanded = (setExpanded, name) => setExpanded(previous => {
    const next = new Set(previous);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    return next;
  });
  const allNames = useMemo(() => [...BUILTIN_OUTBOUNDS, ...config.proxies.map(p => p.name), ...groups.map(g => g.name)], [config.proxies, groups]);
  const save = data => {
    const original = editing.originalName;
    const error = nameError(config, data.name, original, 'proxy-groups'); if (error) return showAlert(error);
    let next = { ...config, 'proxy-groups': original ? groups.map(g => g.name === original ? data : g) : [...groups, data] };
    if (original && original !== data.name) next = replaceOutbound(next, original, data.name);
    const errors = validateConfig(next, target).filter(i => i.level === 'error' && (i.message.includes('循环引用') || i.path.startsWith(`proxy-groups[${next['proxy-groups'].findIndex(g => g.name === data.name)}]`)));
    if (errors.length) return showAlert(errors.map(i => i.message).join('\n'));
    setConfig(next); setEditing(null); showToast('策略组已保存');
  };
  const remove = name => {
    const refs = outboundReferences(config, name);
    showConfirm(`删除策略组「${name}」？\n组成员引用将移除，其他出站引用将替换为 DIRECT。\n受影响：${refs.slice(0, 12).join('、') || '无'}\n可以撤销恢复。`, () => { setConfig(prev => deleteOutbounds(prev, new Set([name]), 'proxy-groups')); showToast('策略组已删除'); });
  };
  const move = (from, to) => {
    if (from === null || to < 0 || to >= groups.length || from === to) return;
    setConfig(prev => { const next = [...prev['proxy-groups']]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return { ...prev, 'proxy-groups': next }; }); setDragged(null);
  };
  return <div className="p-4 md:p-8 h-full min-h-[300px] flex flex-col gap-5">
    <div className="flex justify-between gap-3 flex-wrap"><h2 className="text-2xl font-bold flex items-center gap-2"><Layers className="text-indigo-500" />策略组管理 ({groups.length})</h2><button onClick={() => setEditing({ originalName: null, data: { name: '新策略组', type: 'select', proxies: [] } })} className="px-4 py-2 bg-indigo-600 text-white rounded-lg"><Plus className="inline w-4 h-4" />添加策略组</button></div>
    <p className="text-xs text-slate-500">支持拖拽或按钮排序。DIRECT、REJECT 等内置出站可直接选用；use 可绑定动态订阅。</p>
    <WrappingVirtualList items={groups} scrollToIndex={locationHint?.match(/^proxy-groups\[(\d+)\]/) ? Number(locationHint.match(/^proxy-groups\[(\d+)\]/)[1]) : undefined} height="100%" className="flex-1 min-h-0" estimatedRowHeight={248} testId="virtual-list" label="策略组列表" itemKey={group => group.name} renderItem={(group, i) => <div className="pb-3" data-testid="group-card">
      <div draggable onDragStart={() => setDragged(i)} onDragEnd={() => setDragged(null)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); move(dragged, i); }} className={`bg-white dark:bg-slate-900 border rounded-2xl flex flex-col overflow-hidden shadow-sm transition-colors ${dragged === i ? 'border-indigo-400 opacity-50' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800'}`}>
        <div className="px-4 pt-4 pb-3 flex items-start gap-3 shrink-0">
          <span className="max-w-[45%] px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-300 text-[11px] leading-5 font-semibold break-all shrink-0">{group.type}</span>
          <div className="min-w-0 flex-1"><h3 className="font-bold truncate" title={group.name}>{group.name}</h3><p className="text-xs text-slate-400 mt-1">{group.proxies?.length || 0} 个成员 · {group.use?.length || 0} 个代理集合</p></div>
        </div>
        <div className="px-4 pb-3 space-y-2">
          <div className="flex flex-wrap gap-1.5" aria-label={`${group.name} 的成员`}>
            {group.proxies?.length ? (expandedMembers.has(group.name) ? group.proxies : group.proxies.slice(0, 8)).map((name, index) => <span key={`${name}-${index}`} data-testid="group-member-tag" className={`inline-flex px-2.5 py-1.5 max-w-full rounded-lg border text-xs leading-5 break-all ${['DIRECT', 'REJECT', 'REJECT-DROP'].includes(name) ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900' : 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700'}`}>{name}</span>) : <span className="text-xs text-slate-400">尚未添加静态成员</span>}
            {group.proxies?.length > 8 && <button type="button" aria-expanded={expandedMembers.has(group.name)} onClick={() => toggleExpanded(setExpandedMembers, group.name)} className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40">{expandedMembers.has(group.name) ? '收起节点' : `还有 ${group.proxies.length - 8} 项，查看全部`}</button>}
          </div>
          {group.use?.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] text-slate-400">代理集合</span>{(expandedProviders.has(group.name) ? group.use : group.use.slice(0, 4)).map(name => <span key={name} className="max-w-full px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-300 text-[11px] break-all">{name}</span>)}{group.use.length > 4 && <button type="button" aria-expanded={expandedProviders.has(group.name)} onClick={() => toggleExpanded(setExpandedProviders, group.name)} className="text-xs text-indigo-500">{expandedProviders.has(group.name) ? '收起代理集合' : `查看其余 ${group.use.length - 4} 项`}</button>}</div>}
        </div>
        <div className="px-3 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/20 flex items-center justify-between gap-2 shrink-0">
          <span className="flex items-center gap-1 text-[11px] text-slate-400"><GripVertical className="w-3.5 h-3.5" />{String(i + 1).padStart(2, '0')}</span>
          <div className="flex gap-1.5"><button disabled={!i} onClick={() => move(i, i - 1)} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 disabled:opacity-25" aria-label={`上移 ${group.name}`}><ArrowUp className="w-3.5 h-3.5" /></button><button disabled={i === groups.length - 1} onClick={() => move(i, i + 1)} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 disabled:opacity-25" aria-label={`下移 ${group.name}`}><ArrowDown className="w-3.5 h-3.5" /></button><button onClick={() => setEditing({ originalName: group.name, data: group })} className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 text-xs font-medium flex items-center gap-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"><Edit className="w-3.5 h-3.5" />编辑</button><button onClick={() => remove(group.name)} className="px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />删除</button></div>
        </div>
      </div>
    </div>} />
    {editing && <ProxyGroupEditorModal group={editing.data} allAvailableNames={allNames} providerNames={Object.keys(config['proxy-providers'] || {})} target={target} onClose={() => setEditing(null)} onSave={save} showAlert={showAlert} />}
  </div>;
}
