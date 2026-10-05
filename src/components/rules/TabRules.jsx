import { useState, useMemo, useDeferredValue } from 'react';
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Search, ListFilter, CopyMinus, ArrowUpToLine, ArrowDownToLine, GripVertical } from 'lucide-react';
import { RULE_PROVIDER_TEMPLATES } from '../../constants/templates';
import { parseRuleString, insertBeforeMatch, ruleProviderNames, deduplicateRules } from '../../utils/rules';
import { renameProviderReferences, deleteProvider } from '../../utils/references';
import { BUILTIN_OUTBOUNDS, validateConfig } from '../../utils/validation';
import RuleProviderEditorModal from './RuleProviderEditorModal';
import RuleEditorModal from './RuleEditorModal';
import WrappingVirtualList from '../common/WrappingVirtualList';
import VirtualGrid from '../common/VirtualGrid';

const ruleKey = rule => rule.index;
const orderButtonClass = 'p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 disabled:opacity-25 disabled:cursor-not-allowed transition-colors';

export default function TabRules({ config, setConfig, showAlert, showConfirm, showToast, target, locationHint = '' }) {
  const providers = config['rule-providers'], rules = config.rules, groups = config['proxy-groups'];
  const [provider, setProvider] = useState(null), [rule, setRule] = useState(null), [search, setSearch] = useState(''), [dragged, setDragged] = useState(null);
  const [providersExpanded, setProvidersExpanded] = useState(true);
  const providerEntries = useMemo(() => Object.entries(providers), [providers]);
  const deferred = useDeferredValue(search);
  const targets = useMemo(() => [...BUILTIN_OUTBOUNDS, ...config.proxies.map(p => p.name), ...groups.map(g => g.name)], [config.proxies, groups]);
  const processed = useMemo(() => {
    const firstIndices = new Map();
    return rules.map((text, index) => {
      const duplicateOf = firstIndices.get(text);
      if (duplicateOf === undefined) firstIndices.set(text, index);
      return { text, index, parsed: parseRuleString(text), lower: text.toLowerCase(), duplicateOf };
    });
  }, [rules]);
  const duplicateCount = useMemo(() => processed.filter(r => r.duplicateOf !== undefined).length, [processed]);
  const visible = useMemo(() => processed.filter(r => !deferred || r.lower.includes(deferred.toLowerCase())), [processed, deferred]);
  const listResetKey = useMemo(() => ({ processed, deferred }), [processed, deferred]);
  const locatedIndex = /^rules\[(\d+)\]$/.exec(locationHint)?.[1];
  const scrollToIndex = locatedIndex === undefined ? -1 : visible.findIndex(r => r.index === Number(locatedIndex));
  const bindings = useMemo(() => {
    const map = new Map();
    for (const { parsed: p } of processed) if (p.type === 'RULE-SET') { const name = p.payload.trim(); map.set(name, [...(map.get(name) || []), p.target]); }
    return map;
  }, [processed]);
  const saveProvider = (name, data, binding) => {
    const original = provider.originalName;
    if (name !== original && Object.hasOwn(providers, name)) return showAlert('规则集名称已存在；保存没有覆盖原定义');
    let next = { ...config, 'rule-providers': { ...providers } };
    if (original) { delete next['rule-providers'][original]; if (name !== original) next = renameProviderReferences(next, original, name); }
    next['rule-providers'] = { ...next['rule-providers'], [name]: data };
    const matches = text => { const p = parseRuleString(text); return p.type === 'RULE-SET' && p.payload.trim() === name; };
    if (binding.mode === 'remove') next.rules = next.rules.filter(r => !matches(r));
    if (binding.mode === 'set') {
      const hasRule = next.rules.some(matches);
      next.rules = next.rules.map(r => { if (!matches(r)) return r; const p = parseRuleString(r); return `RULE-SET,${name},${binding.target}${p.extra ? ',' + p.extra : ''}`; });
      if (!hasRule) next.rules = insertBeforeMatch(next.rules, `RULE-SET,${name},${binding.target}`);
    }
    const errors = validateConfig(next, target).filter(i => i.level === 'error' && i.path.startsWith(`rule-providers.${name}`));
    if (errors.length) return showAlert(errors.map(i => i.message).join('\n'));
    setConfig(next); setProvider(null); showToast('规则集已保存');
  };
  const removeProvider = name => showConfirm(`删除规则集「${name}」？\n引用它的直接／组合路由规则、DNS 和 TUN 引用也将移除。可以撤销恢复。`, () => { setConfig(prev => deleteProvider(prev, name)); showToast('规则集及引用已删除'); });
  const saveRule = (text, action) => {
    const p = parseRuleString(text);
    if (p.error) return showAlert(p.error);
    if (p.type !== 'SUB-RULE' && !targets.includes(p.target)) return showAlert('规则目标不存在');
    if (p.type === 'SUB-RULE' && !Object.hasOwn(config['sub-rules'] || {}, p.target)) return showAlert('子规则不存在');
    if (ruleProviderNames(text).some(n => !Object.hasOwn(providers, n))) return showAlert('规则集不存在');
    setConfig(prev => {
      let next = [...prev.rules];
      if (action === 'update') next[rule.index] = text;
      else if (action === 'top') next.unshift(text);
      else next = insertBeforeMatch(next, text);
      return { ...prev, rules: next };
    });
    setRule(null); showToast('规则已保存');
  };
  const move = (from, to) => {
    if (from === null || from === to) return;
    setConfig(prev => { const next = [...prev.rules]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return { ...prev, rules: next }; }); setDragged(null);
  };
  const bottom = index => setConfig(prev => { const next = [...prev.rules], [item] = next.splice(index, 1); return { ...prev, rules: parseRuleString(item).type === 'MATCH' ? [...next, item] : insertBeforeMatch(next, item) }; });
  const removeRule = r => showConfirm(`确定删除第 ${r.index + 1} 条路由规则？\n\n${r.text}\n\n删除后可撤销恢复。`, () => {
    setConfig(prev => ({ ...prev, rules: prev.rules.filter((_, i) => i !== r.index) }));
    showToast('路由规则已删除，可撤销恢复');
  }, '删除路由规则');
  const clearDuplicates = () => {
    if (!duplicateCount) return;
    setConfig(prev => {
      const next = deduplicateRules(prev.rules);
      return next === prev.rules ? prev : { ...prev, rules: next };
    });
    setDragged(null);
    showToast(`已清除 ${duplicateCount} 条重复规则，保留首次出现项；可撤销恢复`);
  };
  const renderProvider = ([name, data]) => <div className="h-full p-4 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl flex items-center justify-between gap-3"><div className="min-w-0"><h3 className="font-bold truncate" title={name}>{name}</h3><p className="text-xs text-slate-500 mt-2">{data.behavior} · {data.format || 'yaml'} · {data.type}</p><p className="text-xs text-indigo-500 mt-2 truncate">关联：{bindings.get(name)?.join('、') || '无直接路由关联'}</p></div><div className="flex gap-2 shrink-0"><button aria-label={`编辑规则集 ${name}`} onClick={() => setProvider({ originalName: name, name, data })} className="p-2 border rounded"><Edit className="w-4 h-4" /></button><button aria-label={`删除规则集 ${name}`} onClick={() => removeProvider(name)} className="p-2 border rounded text-red-500"><Trash2 className="w-4 h-4" /></button></div></div>;
  return <div className="p-4 md:p-8 h-full min-h-[400px] flex flex-col gap-4">
    <section className="shrink-0 min-h-0 max-h-[35%] flex flex-col gap-3" aria-label="规则集面板">
      <div className="flex justify-between items-center gap-3 shrink-0"><h2 className="text-xl font-bold"><button aria-expanded={providersExpanded} aria-controls="rule-provider-panel" onClick={() => setProvidersExpanded(expanded => !expanded)} className="flex items-center gap-2 text-left">{providersExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}规则集 ({providerEntries.length})<span className="text-xs font-normal text-slate-500">{providersExpanded ? '折叠' : '展开'}</span></button></h2><button onClick={() => setProvider({ originalName: null, name: 'new-provider', data: { ...RULE_PROVIDER_TEMPLATES[0].data } })} className="px-3 py-2 border rounded text-sm shrink-0"><Plus className="inline w-4 h-4" />添加规则集</button></div>
      <div id="rule-provider-panel" hidden={!providersExpanded} className={providersExpanded ? 'flex flex-col min-h-0' : 'hidden'}>
        {providersExpanded && <VirtualGrid items={providerEntries} itemKey={entry => entry[0]} renderItem={renderProvider} />}
      </div>
    </section>
    <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
      <h2 className="text-xl font-bold flex items-center gap-2"><ListFilter className="w-5 h-5 text-indigo-500 shrink-0" />路由规则 <span className="text-sm font-normal text-slate-400">({visible.length} / {rules.length})</span></h2>
      <div className="flex items-center gap-2 flex-wrap min-w-0 w-full lg:w-auto">
        <div className="relative min-w-0 w-full lg:w-60 lg:flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" /><input aria-label="搜索规则" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索类型、内容或出站" className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors" /></div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setRule({ index: -1, data: parseRuleString('DOMAIN-SUFFIX,example.com,DIRECT') })} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-sm transition-colors"><Plus className="w-4 h-4" />添加规则</button>
          <button aria-label="清除重复" disabled={!duplicateCount} title={duplicateCount ? `清除全部路由规则中 ${duplicateCount} 条完全相同的重复项，保留首次出现项，可撤销` : '暂无重复规则'} onClick={clearDuplicates} className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><CopyMinus className="w-4 h-4" />清除重复{duplicateCount > 0 && <span className="px-1.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 text-xs tabular-nums">{duplicateCount}</span>}</button>
        </div>
      </div>
    </div>
    <WrappingVirtualList items={visible} resetKey={listResetKey} scrollToIndex={scrollToIndex} height="100%" className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" estimatedRowHeight={40} itemKey={ruleKey} label="路由规则列表" testId="virtual-list" renderItem={r => <div data-testid="rule-row" data-located={r.index === Number(locatedIndex) || undefined} title={r.parsed.error || (r.duplicateOf !== undefined ? `与第 ${r.duplicateOf + 1} 条规则重复` : undefined)} draggable={!search} onDragStart={() => setDragged(r.index)} onDragEnd={() => setDragged(null)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!search) move(dragged, r.index); }} className={`h-10 flex items-center gap-1 px-2 md:px-3 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap transition-colors ${r.index === Number(locatedIndex) ? 'bg-blue-50 dark:bg-blue-950 ring-2 ring-inset ring-blue-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'} ${dragged === r.index ? 'opacity-50 bg-indigo-50 dark:bg-indigo-950/40' : ''}`}>
      <GripVertical aria-hidden="true" className={`w-3.5 h-3.5 shrink-0 text-slate-300 dark:text-slate-600 ${search ? '' : 'cursor-grab active:cursor-grabbing'}`} />
      <span data-testid="rule-order" className="shrink-0 text-right text-xs tabular-nums text-slate-400" style={{ width: `${String(rules.length).length + 1}ch` }}>{r.index + 1}.</span>
      <code data-testid="rule-text" title={r.text} className={`min-w-0 flex-1 truncate text-xs md:text-sm ${r.parsed.error ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>{r.text}</code>
      <div className="flex items-center gap-0.5 shrink-0 text-xs">
        <button disabled={!!search || !r.index} onClick={() => move(r.index, 0)} aria-label={`置顶规则 ${r.index + 1}`} title="置顶" className={orderButtonClass}><ArrowUpToLine className="w-3.5 h-3.5" /></button>
        <button disabled={!!search} onClick={() => bottom(r.index)} aria-label={`置底规则 ${r.index + 1}`} title="置底（MATCH 前）" className={orderButtonClass}><ArrowDownToLine className="w-3.5 h-3.5" /></button>
        <button aria-label={`编辑规则 ${r.index + 1}`} onClick={() => setRule({ index: r.index, data: r.parsed })} className="px-2 py-1.5 rounded text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40">编辑</button>
        <button aria-label={`删除规则 ${r.index + 1}`} onClick={() => removeRule(r)} className="px-2 py-1.5 rounded text-red-500 dark:text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300">删除</button>
      </div>
    </div>} />
    {!visible.length && <p className="text-sm text-slate-400 text-center">{search ? '没有找到匹配的规则' : '暂无路由规则，点击“添加规则”开始配置'}</p>}
    <p className="text-xs text-slate-500 shrink-0">规则按顺序匹配，置底会插入 MATCH 前。清除重复保留完整原文首次出现项，可撤销。</p>
    {provider && <RuleProviderEditorModal providerName={provider.name} providerData={provider.data} boundTargets={bindings.get(provider.originalName) || []} allTargetNames={targets} onClose={() => setProvider(null)} onSave={saveProvider} showAlert={showAlert} />}
    {rule && <RuleEditorModal ruleData={rule.data} isNew={rule.index === -1} allTargetNames={targets} allProviderNames={Object.keys(providers)} allSubRuleNames={Object.keys(config['sub-rules'] || {})} onClose={() => setRule(null)} onSave={saveRule} showAlert={showAlert} />}
  </div>;
}
