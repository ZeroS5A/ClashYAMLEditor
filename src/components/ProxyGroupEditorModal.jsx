import React, { useState } from 'react';
import { GripVertical, X, AlertCircle } from 'lucide-react';
import Modal from './Modal';
import InputRow from './InputRow';

function ProxyGroupEditorModal({ group, allAvailableNames, onClose, onSave, showAlert }) {
  const [data, setData] = useState({
    name: group.name || '', type: group.type || 'select', url: group.url || 'http://www.gstatic.com/generate_204', interval: group.interval || 300, proxies: group.proxies ? [...group.proxies] : []
  });

  const [draggedProxyIdx, setDraggedProxyIdx] = useState(null);

  const safeAvailableNames = allAvailableNames.filter(n => n !== group.name);

  const handleSave = () => {
    if (!data.name.trim()) return showAlert('保存失败：策略组名称不能为空');
    let result = { name: data.name.trim(), type: data.type, proxies: data.proxies };
    if (['url-test', 'fallback', 'load-balance'].includes(data.type)) { result.url = data.url; result.interval = Number(data.interval); }
    onSave(result);
  };

  const removeProxy = (idx) => setData({...data, proxies: data.proxies.filter((_, i) => i !== idx)});
  const handleAddProxy = (e) => {
    const val = e.target.value;
    if (val && !data.proxies.includes(val)) setData({...data, proxies: [...data.proxies, val]});
    e.target.value = '';
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
              <option value="select">select (手动选择)</option><option value="url-test">url-test (自动测速)</option><option value="fallback">fallback (故障转移)</option><option value="load-balance">load-balance (负载均衡)</option><option value="relay">relay (链式代理)</option>
            </select>
          </div>
        </div>

        {['url-test', 'fallback', 'load-balance'].includes(data.type) && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
            <InputRow label="测速链接 (url)" value={data.url} onChange={v => setData({...data, url: v})} />
            <InputRow label="测速间隔秒数 (interval)" type="number" value={data.interval} onChange={v => setData({...data, interval: v})} />
          </div>
        )}

        <div className="border-t dark:border-slate-800 pt-6">
          <h3 className="font-bold text-lg mb-4 flex items-center justify-between">
            组内节点列表 (proxies) <span className="text-sm font-normal text-slate-500">共 {data.proxies.length} 个</span>
          </h3>
          <div className="mb-4">
            <select onChange={handleAddProxy} defaultValue="" className="w-full p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 outline-none focus:border-indigo-500 text-sm">
              <option value="" disabled>➕ 选择并添加 节点/策略组 到此列表...</option>
              {safeAvailableNames.filter(n => !data.proxies.includes(n)).map(name => <option key={name} value={name}>{String(name)}</option>)}
            </select>
          </div>
          <div className="border dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
            {data.proxies.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">此策略组目前没有包含任何节点，请从上方添加。</div>
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
