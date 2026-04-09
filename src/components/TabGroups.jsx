import React, { useState } from 'react';
import { Layers, Plus, GripVertical, Edit, Trash2, AlertCircle } from 'lucide-react';

const TabGroups = ({ groups, setEditingGroup, deleteGroup, reorderGroups }) => {
  const [draggedIdx, setDraggedIdx] = useState(null);

  const onDragStart = (e, idx) => setDraggedIdx(idx);
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    reorderGroups(draggedIdx, targetIdx);
    setDraggedIdx(null);
  };
  const onDragEnd = () => setDraggedIdx(null);

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-20 bg-slate-100/90 dark:bg-slate-950/90 backdrop-blur-md px-4 md:px-8 py-4 mb-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Layers className="w-6 h-6 text-indigo-500" /> 策略组管理 ({groups.length})</h2>
        <button onClick={() => setEditingGroup({ originalName: null, data: { name: '新策略组', type: 'select', proxies: [] } })} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors"><Plus className="w-4 h-4" /> 添加策略组</button>
      </div>
      <div className="px-4 md:px-8 flex flex-col gap-4 pb-12">
        {groups.map((group, idx) => {
          const isDragging = draggedIdx === idx;
          return (
          <div
            key={`${group.name}-${idx}`}
            draggable
            onDragStart={(e) => onDragStart(e, idx)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, idx)}
            onDragEnd={onDragEnd}
            className={`bg-white dark:bg-slate-900 border dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all group-card ${isDragging ? 'opacity-50 scale-[0.99] shadow-inner bg-slate-50 dark:bg-slate-800/50' : ''}`}
          >
            <div className="flex flex-1 items-center gap-3 overflow-hidden">
              <GripVertical className="w-5 h-5 text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing hover:text-slate-500 shrink-0" />
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-lg truncate">{String(group.name)}</h3>
                  <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-md uppercase shrink-0">{String(group.type)}</span>
                </div>
                <div className="mt-1">
                  {(!group.proxies || group.proxies.length === 0) ? (
                    <span className="text-sm italic text-slate-400">包含节点: 无</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">包含节点:</span>
                      {group.proxies.slice(0, 8).map((p, pIdx) => {
                        const pStr = typeof p === 'string' ? p : JSON.stringify(p);
                        return <span key={pIdx} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded border dark:border-slate-700 truncate max-w-[150px]" title={pStr}>{pStr}</span>
                      })}
                      {group.proxies.length > 8 && <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs rounded border border-indigo-100 dark:border-indigo-800/50 font-medium whitespace-nowrap">+{group.proxies.length - 8} 更多</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0 border-t md:border-t-0 pt-4 md:pt-0 dark:border-slate-800 ml-8 md:ml-0">
              <button onClick={() => setEditingGroup({ originalName: group.name, data: JSON.parse(JSON.stringify(group)) })} className="px-4 py-2 flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white rounded-lg transition-colors"><Edit className="w-4 h-4" /> 编辑</button>
              <button onClick={() => deleteGroup(group.name)} className="px-4 py-2 flex items-center gap-2 text-sm text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /> 删除</button>
            </div>
          </div>
        )})}
        {groups.length === 0 && <div className="py-12 text-center text-slate-400 border-2 border-dashed dark:border-slate-800 rounded-2xl">暂无策略组</div>}
      </div>
      <p className="text-xs text-slate-500 flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" /> 按住策略组卡片左侧图标可上下拖拽排序</p>
    </div>
  );
};

export default TabGroups;
