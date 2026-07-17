import React, { useState, useCallback, useMemo } from 'react';
import { Search, AlertCircle, PlusCircle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import Modal from './Modal';
import { parseProxyLink, fetchSubscriptionContent } from '../utils/parser';

// ---- 节点状态 ----
const STATUS = { NEW: 'new', UPDATE: 'update', ERROR: 'error' };

const statusConfig = {
  [STATUS.NEW]:    { label: '新增', icon: PlusCircle, badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  [STATUS.UPDATE]: { label: '更新', icon: RefreshCw,  badge: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  [STATUS.ERROR]:  { label: '失败', icon: AlertCircle, badge: 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400' },
};

export default function LinkImportModal({ existingProxies, onImport, onClose }) {
  const [step, setStep] = useState('input');
  const [linkText, setLinkText] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const [subErrors, setSubErrors] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [filter, setFilter] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [editingName, setEditingName] = useState(null);

  // ================================================================
  //  解析
  // ================================================================
  const handleParse = useCallback(async () => {
    const lines = linkText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;

    setStep('parsing');

    const subUrls = [], directLinks = [];
    lines.forEach(line => { (/^https?:\/\//i.test(line) ? subUrls : directLinks).push(line); });

    let allLinks = [];
    const subErrList = [];
    for (const url of subUrls) {
      try {
        const fetched = await fetchSubscriptionContent(url);
        allLinks.push(...fetched);
      } catch (e) { subErrList.push({ url, error: e.message }); }
    }
    allLinks.push(...directLinks);
    setSubErrors(subErrList);

    const items = [];
    allLinks.forEach((link, idx) => {
      try {
        const proxy = parseProxyLink(link);
        Object.keys(proxy).forEach(k => proxy[k] === undefined && delete proxy[k]);

        const id = `item-${idx}-${Math.random().toString(36).slice(2, 6)}`;
        // 仅按名称匹配
        const existIdx = existingProxies.findIndex(p => p.name === proxy.name);
        items.push({
          id,
          proxy,
          status: existIdx !== -1 ? STATUS.UPDATE : STATUS.NEW,
          oldName: existIdx !== -1 ? proxy.name : undefined,
        });
      } catch (e) {
        items.push({ id: `err-${idx}`, proxy: null, status: STATUS.ERROR, link: link.slice(0, 80), error: e.message });
      }
    });

    setParsedItems(items);
    const autoSelect = new Set();
    items.forEach(it => { if (it.status !== STATUS.ERROR) autoSelect.add(it.id); });
    setSelected(autoSelect);
    setStep('preview');
  }, [linkText, existingProxies]);

  // ================================================================
  //  选择
  // ================================================================
  const toggleItem = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected(new Set(filteredItems.map(it => it.id)));
  const selectNone = () => setSelected(new Set());
  const selectNew = () => setSelected(new Set(filteredItems.filter(it => it.status === STATUS.NEW).map(it => it.id)));

  // ================================================================
  //  名称编辑
  // ================================================================
  const startEditName = (item) => setEditingName({ id: item.id, value: item.proxy?.name || '' });
  const commitEditName = () => {
    if (editingName) {
      setParsedItems(prev => prev.map(it =>
        it.id === editingName.id && it.proxy
          ? { ...it, proxy: { ...it.proxy, name: editingName.value.trim() || it.proxy.name } }
          : it
      ));
      setEditingName(null);
    }
  };

  // ================================================================
  //  导入
  // ================================================================
  const handleImport = () => {
    const toImport = parsedItems
      .filter(it => selected.has(it.id) && it.proxy)
      .map(it => {
        const { _itemId, ...clean } = it.proxy;
        return { ...clean, _status: it.status, _oldName: it.oldName };
      });
    onImport(toImport);
  };

  // ================================================================
  //  过滤 & 统计
  // ================================================================
  const filteredItems = useMemo(() => {
    if (!filter.trim()) return parsedItems;
    const kw = filter.toLowerCase();
    return parsedItems.filter(it =>
      (it.proxy?.name || '').toLowerCase().includes(kw) ||
      (it.proxy?.server || '').toLowerCase().includes(kw) ||
      (it.link || '').toLowerCase().includes(kw)
    );
  }, [parsedItems, filter]);

  const stats = useMemo(() => {
    const s = { new: 0, update: 0, error: 0, total: parsedItems.length, selected: 0 };
    parsedItems.forEach(it => { s[it.status] = (s[it.status] || 0) + 1; });
    filteredItems.forEach(it => { if (selected.has(it.id)) s.selected++; });
    return s;
  }, [parsedItems, filteredItems, selected]);

  // ================================================================
  //  JSX
  // ================================================================
  const renderItemRow = (item) => {
    const cfg = statusConfig[item.status];
    const Icon = cfg.icon;
    const isEditing = editingName?.id === item.id;

    return (
      <div key={item.id} className={`flex items-center gap-3 px-4 py-2.5 border-b dark:border-slate-700/50 transition-colors ${
        selected.has(item.id) ? 'bg-blue-50/40 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
      }`}>
        <label className="shrink-0">
          <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleItem(item.id)}
            disabled={item.status === STATUS.ERROR}
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 disabled:opacity-30" />
        </label>
        <span className={`shrink-0 ${cfg.badge.split(' ')[0]} ${cfg.badge.split(' ')[1]}`} title={cfg.label}>
          <Icon className="w-3.5 h-3.5" />
        </span>

        {item.status === STATUS.ERROR ? (
          <div className="flex-1 min-w-0 text-sm">
            <span className="text-red-500 font-mono text-xs truncate block">{item.link}</span>
            <span className="text-red-400 text-[11px]">{item.error}</span>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input autoFocus value={editingName.value}
                  onChange={e => setEditingName({ ...editingName, value: e.target.value })}
                  onBlur={commitEditName}
                  onKeyDown={e => { if (e.key === 'Enter') commitEditName(); if (e.key === 'Escape') setEditingName(null); }}
                  className="w-full text-sm font-bold px-2 py-0.5 border border-blue-400 rounded bg-white dark:bg-slate-900 outline-none" />
              ) : (
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate cursor-pointer hover:text-blue-500 block"
                  onClick={() => startEditName(item)} title="点击编辑名称">
                  {item.proxy.name}
                </span>
              )}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                <span className="uppercase text-[10px] font-bold text-slate-500">{item.proxy.type}</span>
                <span>{item.proxy.server}:{item.proxy.port}</span>
              </div>
            </div>
          </>
        )}

        <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
      </div>
    );
  };

  return (
    <Modal title="通过链接批量导入/更新节点" onClose={onClose} widthClass="max-w-3xl"
      customFooter={
        <div className="p-5 border-t dark:border-slate-700 flex justify-between items-center gap-3 bg-slate-50 dark:bg-slate-800/50">
          <div className="text-sm text-slate-500">
            {step === 'preview' && <>已选 <b className="text-slate-700 dark:text-slate-200">{stats.selected}</b> / {stats.total} 条</>}
          </div>
          <div className="flex gap-3">
            {step === 'preview' && (
              <button onClick={() => { setStep('input'); setParsedItems([]); setSubErrors([]); setSelected(new Set()); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
                返回编辑
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">取消</button>
            {step === 'preview' ? (
              <button onClick={handleImport} disabled={stats.selected === 0}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-2">
                导入 {stats.selected} 条
              </button>
            ) : (
              <button onClick={handleParse} disabled={step === 'parsing' || !linkText.trim()}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-2">
                {step === 'parsing' ? '解析中...' : '解析链接'}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {step === 'input' && (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">支持粘贴多行节点链接，自动识别常用的分享格式。</p>
            <p className="text-xs text-blue-500 dark:text-blue-400">也支持粘贴 http/https 订阅链接，自动获取并解析批量节点。</p>
            <p className="text-xs text-amber-500 dark:text-amber-400">同名节点将被更新。</p>
            <textarea value={linkText} onChange={(e) => setLinkText(e.target.value)}
              placeholder={"vmess://...\ntrojan://...\nss://...\n\nhttps://example.com/sub"}
              className="w-full h-56 font-mono text-sm p-4 border rounded-xl bg-slate-50 dark:bg-slate-950 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none custom-scrollbar whitespace-pre-wrap" autoFocus />
          </>
        )}

        {step === 'parsing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-500">正在获取订阅并解析节点...</p>
          </div>
        )}

        {step === 'preview' && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-medium text-emerald-600"><PlusCircle className="w-3 h-3" /> 新增 {stats.new}</span>
              <span className="flex items-center gap-1 font-medium text-amber-600"><RefreshCw className="w-3 h-3" /> 更新 {stats.update}</span>
              {stats.error > 0 && (
                <span className="flex items-center gap-1 font-medium text-red-500"><AlertCircle className="w-3 h-3" /> 失败 {stats.error}</span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={selectAll} className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">全选</button>
              <button onClick={selectNew} className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">仅新增</button>
              <button onClick={selectNone} className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">全不选</button>
              <div className="flex-1" />
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="搜索..."
                  className="w-40 pl-7 pr-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="border dark:border-slate-700 rounded-xl overflow-hidden max-h-[45vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
              {filteredItems.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">没有匹配的节点</div>
              ) : (
                filteredItems.map(renderItemRow)
              )}
            </div>

            {(subErrors.length > 0 || stats.error > 0) && (
              <div className="border dark:border-slate-700 rounded-xl overflow-hidden">
                <button onClick={() => setShowErrors(!showErrors)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-500 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                  {showErrors ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <AlertCircle className="w-4 h-4" />
                  {subErrors.length + stats.error} 条错误详情
                </button>
                {showErrors && (
                  <div className="divide-y dark:divide-slate-700/50 max-h-40 overflow-y-auto custom-scrollbar">
                    {subErrors.map((e, i) => (
                      <div key={`sub-${i}`} className="px-4 py-2 text-xs">
                        <span className="text-red-500 font-mono">[订阅]</span>{' '}
                        <span className="text-slate-600 dark:text-slate-400 truncate">{e.url}</span>
                        <span className="text-red-400 ml-2">{e.error}</span>
                      </div>
                    ))}
                    {parsedItems.filter(it => it.status === STATUS.ERROR).map(it => (
                      <div key={it.id} className="px-4 py-2 text-xs">
                        <span className="text-red-500 font-mono">[解析]</span>{' '}
                        <span className="text-slate-600 dark:text-slate-400 font-mono truncate">{it.link}</span>
                        <span className="text-red-400 ml-2">{it.error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-slate-400">点击节点名称可编辑，取消勾选的节点不会被导入。</p>
          </>
        )}
      </div>
    </Modal>
  );
}
