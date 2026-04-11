import React from 'react';
import { Server, Link as LinkIcon, Plus, Edit, Trash2 } from 'lucide-react';
import ScrollingText from './ScrollingText';

const TabProxies = ({ proxies, setLinkModalVisible, setEditingProxy, deleteProxy }) => (
  <div className="pb-8">
    <div className="sticky top-0 z-20 bg-slate-100/90 dark:bg-slate-950/90 backdrop-blur-md px-4 md:px-8 py-4 mb-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <h2 className="text-2xl font-bold flex items-center gap-2"><Server className="w-6 h-6 text-blue-500" /> 节点管理 ({proxies.length})</h2>
      <div className="flex gap-2">
        <button onClick={() => setLinkModalVisible(true)} className="px-4 py-2 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 dark:bg-slate-900 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 transition-colors"><LinkIcon className="w-4 h-4" /> 通过链接导入/更新节点</button>
        <button onClick={() => setEditingProxy({ originalName: null, data: { name: '新节点', type: 'ss', server: '1.2.3.4', port: 443 } })} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"><Plus className="w-4 h-4" /> 添加单个节点</button>
      </div>
    </div>
    <div className="px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {proxies.map((proxy, idx) => (
        <div key={idx} className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-hidden mb-4">
            <ScrollingText text={String(proxy.name)} className="font-bold text-lg text-slate-800 dark:text-white mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono truncate" title={`${String(proxy.server)}:${String(proxy.port)}`}>
              {String(proxy.server)}:{String(proxy.port)}
            </p>
          </div>
          <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/60">
            <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-md uppercase shrink-0">
              {String(proxy.type)}
            </span>
            <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditingProxy({ originalName: proxy.name, data: JSON.parse(JSON.stringify(proxy)) })} className="p-1.5 text-slate-400 hover:text-blue-500 bg-slate-50 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors" title="编辑"><Edit className="w-4 h-4" /></button>
              <button onClick={() => deleteProxy(proxy.name)} className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors" title="删除"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      ))}
      {proxies.length === 0 && <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed dark:border-slate-800 rounded-2xl">暂无节点，请添加、粘贴链接或导入配置</div>}
    </div>
  </div>
);

export default TabProxies;
