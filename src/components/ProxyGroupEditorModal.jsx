import React, { useState, useMemo } from 'react';
import { GripVertical, X, AlertCircle, Search, Check } from 'lucide-react';
import Modal from './Modal';
import InputRow from './InputRow';

function ProxyGroupEditorModal({ group, allAvailableNames, onClose, onSave, showAlert }) {
  const [data, setData] = useState({
    name: group.name || '', type: group.type || 'select', url: group.url || 'http://www.gstatic.com/generate_204', interval: group.interval || 300, proxies: group.proxies ? [...group.proxies] : []
  });

  const [draggedProxyIdx, setDraggedProxyIdx] = useState(null);
  const [proxySearch, setProxySearch] = useState('');

  const safeAvailableNames = allAvailableNames.filter(n => n !== group.name);

  const filteredNames = useMemo(() => {
    if (!proxySearch.trim()) return safeAvailableNames;
    const kw = proxySearch.trim().toLowerCase();
    return safeAvailableNames.filter(n => String(n).toLowerCase().includes(kw));
  }, [safeAvailableNames, proxySearch]);

  const handleSave = () => {
    if (!data.name.trim()) return showAlert('保存失败：策略组名称不能为空');
    let result = { name: data.name.trim(), type: data.type, proxies: data.proxies };
    if (['url-test', 'fallback', 'load-balance', 'smart'].includes(data.type)) { result.url = data.url; result.interval = Number(data.interval); }
    onSave(result);
  };

  const removeProxy = (idx) => setData({...data, proxies: data.proxies.filter((_, i) => i !== idx)});
  const toggleProxy = (name) => {
    if (data.proxies.includes(name)) {
      setData({...data, proxies: data.proxies.filter(n => n !== name)});
    } else {
      setData({...data, proxies: [...data.proxies, name]});
    }
  };

  const onProxyDragStart = (e, idx) => setDraggedProxyIdx(idx);
  const onProxyDragOver = (e) => e.preventDefault();
  const onProxyDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedProxyIdx === null || draggedProxyIdx === targetIdx) return;
    const newProxies = [...data.proxies];
    const [dragged] = newProxies.splice(draggedProxyIdx, 1);
    newProxies.splice(targetIdx, 0, dragged);
    setData({...data, proxies: newProxies});
    setDraggedProxyIdx(null);
  };
  const onProxyDragEnd = () => setDraggedProxyIdx(null);

  return (
    <Modal title="编辑策略组" onClose={onClose} onSave={handleSave}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <InputRow label="策略组名称 (name)" value={data.name} onChange={v => setData({...data, name: v})} />
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm text-slate-700 dark:text-slate-300">类型 (type)</label>
            <select value={data.type} onChange={e => setData({...data, type: e.target.value})} className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
              <option value="select">select (手动选择)</option><option value="url-test">url-test (自动测速)</option><option value="fallback">fallback (故障转移)</option><option value="load-balance">load-balance (负载均衡)</option><option value="smart">smart (智能策略)</option><option value="relay">relay (链式代理)</option>
            </select>
          </div>
        </div>

        {['url-test', 'fallback', 'load-balance', 'smart'].includes(data.type) && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
            <InputRow label="测速链接 (url)" value={data.url} onChange={v => setData({...data, url: v})} />
            <InputRow label="测速间隔秒数 (interval)" type="number" value={data.interval} onChange={v => setData({...data, interval: v})} />
          </div>
        )}

        <div className="border-t dark:border-slate-800 pt-6">
          <h3 className="font-bold text-lg mb-4 flex items-center justify-between">
            组内节点列表 (proxies) <span className="text-sm font-normal text-slate-500">已选 {data.proxies.length} 个</span>
          </h3>

          {/* 复选样式选择器 */}
          <div className="mb-4 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800/50">
            <div className="p-2 border-b dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={proxySearch}
                onChange={e => setProxySearch(e.target.value)}
                placeholder="搜索节点/策略组..."
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="max-h-52 overflow-y-auto custom-scrollbar p-1">
              {filteredNames.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">无可用的节点或策略组</div>
              ) : (
                filteredNames.map(name => {
                  const checked = data.proxies.includes(name);
                  return (
                    <label
                      key={name}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${checked ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'}`}
                    >
                      <div className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="font-mono truncate">{String(name)}</span>
                      <input type="checkbox" checked={checked} onChange={() => toggleProxy(name)} className="sr-only" />
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* 已选列表（可拖拽排序） */}
          <div className="border dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
            {data.proxies.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">此策略组目前没有包含任何节点，请从上方勾选添加。</div>
            ) : (
              <ul className="divide-y dark:divide-slate-800 max-h-[300px] overflow-y-auto custom-scrollbar">
                {data.proxies.map((pName, idx) => {
                  const pStr = typeof pName === 'string' ? pName : JSON.stringify(pName);
                  const isDragging = draggedProxyIdx === idx;
                  return (
                    <li
                      key={`${pStr}-${idx}`}
                      draggable
                      onDragStart={(e) => onProxyDragStart(e, idx)}
                      onDragOver={onProxyDragOver}
                      onDrop={(e) => onProxyDrop(e, idx)}
                      onDragEnd={onProxyDragEnd}
                      className={`flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${isDragging ? 'opacity-50 bg-slate-100 dark:bg-slate-800' : ''}`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing hover:text-slate-500 shrink-0" />
                        <span className="font-mono text-sm pl-2 truncate">{pStr}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => removeProxy(idx)} className="p-1.5 text-red-400 hover:text-red-600 rounded transition-colors"><X className="w-5 h-5" /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2"><AlertCircle className="w-3 h-3 inline mr-1" />直接按住左侧图标拖动可调整策略组内的节点顺序</p>
        </div>
      </div>
    </Modal>
  );
}

export default ProxyGroupEditorModal;
