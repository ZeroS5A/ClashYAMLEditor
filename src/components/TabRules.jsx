import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, GripVertical, Edit, Trash2, ArrowRight, ChevronsUp, ChevronsDown, AlertCircle, X } from 'lucide-react';
import { RULE_PROVIDER_TEMPLATES } from '../constants/templates';
import { parseRuleString } from '../utils/parser';

const TabRules = ({ providers, rules, setEditingProvider, deleteProvider, setEditingRule, deleteRule, moveRuleToTop, moveRuleToBottom, reorderRules }) => {
  const [ruleSearch, setRuleSearch] = useState('');
  const [visibleRuleCount, setVisibleRuleCount] = useState(100);
  const [draggedRuleIdx, setDraggedRuleIdx] = useState(null);

  useEffect(() => { setVisibleRuleCount(100); }, [ruleSearch]);

  const handleRuleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 200) {
      if (visibleRuleCount < filteredRules.length) setVisibleRuleCount(prev => prev + 50);
    }
  };

  const processedRules = useMemo(() => rules.map((r, index) => ({ ruleStr: typeof r === 'string' ? r : JSON.stringify(r), originalIndex: index })), [rules]);
  const filteredRules = useMemo(() => {
    if (!ruleSearch) return processedRules;
    const lowerSearch = ruleSearch.toLowerCase();
    return processedRules.filter(r => r.ruleStr.toLowerCase().includes(lowerSearch));
  }, [processedRules, ruleSearch]);
  const visibleRules = useMemo(() => filteredRules.slice(0, visibleRuleCount), [filteredRules, visibleRuleCount]);

  const handleDragStart = (e, originalIdx) => { if (ruleSearch) { e.preventDefault(); return; } setDraggedRuleIdx(originalIdx); };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, targetOriginalIdx) => {
    e.preventDefault();
    if (ruleSearch || draggedRuleIdx === null || draggedRuleIdx === targetOriginalIdx) return;
    reorderRules(draggedRuleIdx, targetOriginalIdx);
    setDraggedRuleIdx(null);
  };
  const handleDragEnd = () => setDraggedRuleIdx(null);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">规则集 (Providers) <span className="text-sm font-normal text-slate-400">({Object.keys(providers || {}).length})</span></h2>
          <button onClick={() => setEditingProvider({ originalName: null, name: 'new-provider', data: Object.assign({}, RULE_PROVIDER_TEMPLATES[0].data) })} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 text-sm transition-colors"><Plus className="w-4 h-4" /> 添加规则集</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(providers || {}).map(([name, data], idx) => {
              const matchedRule = rules.find(r => typeof r === 'string' && r.startsWith(`RULE-SET,${name},`));
              const matchedTarget = matchedRule ? matchedRule.split(',')[2] : null;
              return (
              <div key={idx} className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-4 rounded-xl shadow-sm flex flex-col justify-between group">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col max-w-[70%]">
                      <h3 className="font-bold text-md truncate pr-2" title={String(name)}>{String(name)}</h3>
                      {matchedTarget ? <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate"><ArrowRight className="w-3 h-3" /> 走 <b>{matchedTarget}</b></span> : <span className="text-[11px] text-slate-400 italic mt-0.5">未绑定策略组</span>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                      <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded uppercase">{String(data.behavior || '')}</span>
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded uppercase">{String(data.format || '')}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-4 truncate" title={data.url || data.path}>{data.type === 'http' ? data.url : `[本地] ${data.path}`}</p>
                <div className="flex gap-2 justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingProvider({ originalName: name, name, data: JSON.parse(JSON.stringify(data)) })} className="p-1.5 text-slate-400 hover:text-blue-500 bg-slate-50 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => deleteProvider(name)} className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              );
          })}
          {Object.keys(providers || {}).length === 0 && <div className="col-span-full py-8 text-center text-slate-400 border-2 border-dashed dark:border-slate-800 rounded-xl text-sm">暂无规则集配置，点击右上角添加。</div>}
        </div>
      </div>
      <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white shrink-0">路由规则 (Rules) <span className="text-sm font-normal text-slate-400">({filteredRules.length} / {rules.length})</span></h2>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="搜索规则内容、类型或策略组..." value={ruleSearch} onChange={e => setRuleSearch(e.target.value)} className="w-full pl-9 pr-10 py-2 border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-colors" />
              {ruleSearch && (
                <button type="button" onClick={() => setRuleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="清除搜索">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button onClick={() => setEditingRule({ idx: -1, data: parseRuleString("DOMAIN-SUFFIX,google.com,DIRECT") })} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 text-sm transition-colors shrink-0 shadow-sm"><Plus className="w-4 h-4" /> 添加规则</button>
          </div>
        </div>
        <div className="border dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm relative">
          {filteredRules.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">{ruleSearch ? '没有找到匹配的路由规则' : '暂无路由规则'}</div>
          ) : (
            <ul onScroll={handleRuleScroll} className="divide-y dark:divide-slate-800 h-[60vh] max-h-[600px] overflow-y-auto custom-scrollbar relative">
              {visibleRules.map((ruleObj) => {
                const parsed = parseRuleString(ruleObj.ruleStr);
                const originalIdx = ruleObj.originalIndex;
                const isDragging = draggedRuleIdx === originalIdx;

                return (
                  <li key={`rule-${originalIdx}`} draggable={!ruleSearch} onDragStart={(e) => handleDragStart(e, originalIdx)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, originalIdx)} onDragEnd={handleDragEnd} className={`flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group ${isDragging ? 'opacity-50 scale-[0.99] shadow-inner bg-slate-100 dark:bg-slate-800' : ''}`}>
                    <div className="flex items-center gap-2 overflow-hidden w-full">
                      {!ruleSearch && <GripVertical className="w-5 h-5 text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing hover:text-slate-500 shrink-0" />}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 overflow-hidden w-full flex-1">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded whitespace-nowrap min-w-[120px] text-center">{parsed.type}</span>
                        <span className="font-mono text-sm truncate flex-1" title={parsed.payload}>{parsed.payload || <span className="text-slate-400 italic">N/A</span>}</span>
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:block shrink-0" />
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs font-bold rounded truncate max-w-[150px]" title={parsed.target}>{parsed.target}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => moveRuleToTop(originalIdx)} disabled={originalIdx === 0 || !!ruleSearch} className="p-1.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 rounded transition-colors" title={ruleSearch ? "搜索下禁排序" : "置顶"}><ChevronsUp className="w-4 h-4" /></button>
                      <button onClick={() => moveRuleToBottom(originalIdx)} disabled={originalIdx === rules.length - 1 || !!ruleSearch} className="p-1.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 rounded transition-colors" title={ruleSearch ? "搜索下禁排序" : "置底"}><ChevronsDown className="w-4 h-4" /></button>
                      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                      <button onClick={() => setEditingRule({ idx: originalIdx, data: parsed })} className="p-1.5 text-slate-400 hover:text-blue-600 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => deleteRule(originalIdx)} className="p-1.5 text-red-400 hover:text-red-600 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </li>
                );
              })}
              {visibleRuleCount < filteredRules.length && <li className="p-4 flex items-center justify-center text-sm text-slate-400"><div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-2"></div>加载更多...</li>}
            </ul>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> 按住规则左侧图标可拖拽排序；置底操作会智能停在兜底规则 MATCH 之前。</p>
      </div>
    </div>
  );
};

export default TabRules;
