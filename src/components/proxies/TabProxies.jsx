import { useState, useMemo } from 'react';
import { Server, Plus, Edit, Trash2, Share2 } from 'lucide-react';
import ProxyShareModal from './ProxyShareModal';
import ProxyEditorModal from './ProxyEditorModal';
import LinkImportModal from './LinkImportModal';
import VirtualList from '../common/VirtualList';
import { parseProxyLink } from '../../utils/parser';
import { generateShareLink } from '../../utils/shareLink';
import { deleteOutbounds, replaceOutbound, outboundReferences } from '../../utils/references';
import { nameError, validateConfig } from '../../utils/validation';
import { mergeProxies } from '../../utils/editing';
import { copyText } from '../../utils/clipboard';

export default function TabProxies({ config, setConfig, showAlert, showConfirm, showToast, target }) {
  const proxies = config.proxies;
  const [editing, setEditing] = useState(null), [importing, setImporting] = useState(false);
  const [share, setShare] = useState(null), [selected, setSelected] = useState(new Set());
  const existingNames = useMemo(() => new Set(proxies.map(p => p.name)), [proxies]);
  const activeSelected = useMemo(() => new Set([...selected].filter(n => existingNames.has(n))), [selected, existingNames]);
  const save = data => {
    const original = editing.originalName, error = nameError(config, data.name, original, 'proxies');
    if (error) return showAlert(error);
    let next = { ...config, proxies: original ? proxies.map(p => p.name === original ? data : p) : [...proxies, data] };
    if (original && original !== data.name) next = replaceOutbound(next, original, data.name);
    const index = next.proxies.findIndex(p => p.name === data.name);
    const errors = validateConfig(next, target).filter(i => i.level === 'error' && (i.path.startsWith(`proxies[${index}]`) || i.message.includes('循环引用')));
    if (errors.length) return showAlert(errors.map(i => i.message).join('\n'));
    setConfig(next); setEditing(null); showToast('节点已保存');
  };
  const confirmDelete = names => {
    if (!names.size) return showAlert('请先选择节点');
    const refs = [...names].flatMap(n => outboundReferences(config, n));
    showConfirm(`删除 ${names.size} 个节点？\n组内引用将移除，其他出站引用将替换为 DIRECT。\n受影响：${refs.slice(0, 10).join('、') || '无'}\n可以撤销恢复。`, () => { setConfig(prev => deleteOutbounds(prev, names)); setSelected(new Set()); showToast('节点已删除'); });
  };
  const importLinks = (incoming, mode) => {
    if (incoming.some(p => !p.name.trim() || /[,\r\n]/.test(p.name))) return showAlert('节点名称不能为空或包含分隔符，请返回预览修正');
    const result = mergeProxies(config, incoming, mode);
    setConfig(result.config); setImporting(false); showToast(`新增 ${result.added}，更新 ${result.updated}；请查看配置体检`);
  };
  const openShare = proxy => { try { setShare({ proxy, link: generateShareLink(proxy) }); } catch (e) { setShare({ proxy, error: e.message }); } };
  const copy = async text => { try { await copyText(text); showToast('已复制'); } catch (e) { showAlert(e.message); } };
  const toggle = name => setSelected(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });
  const renderProxy = (proxy, i) => <div key={`${proxy.name}-${i}`} className="h-full p-4 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl flex flex-col justify-between">
    <div className="flex items-start gap-3"><input type="checkbox" aria-label={`选择 ${proxy.name}`} checked={activeSelected.has(proxy.name)} onChange={() => toggle(proxy.name)} className="mt-1" /><div className="min-w-0"><h3 className="font-bold truncate" title={proxy.name}>{proxy.name}</h3><p className="text-xs font-mono text-slate-500 mt-2 truncate">{proxy.server}:{proxy.port}</p></div></div>
    <div className="flex items-center justify-between gap-3 mt-4"><span className="text-xs uppercase font-bold text-blue-500">{proxy.type}</span><div className="flex gap-2"><button aria-label={`分享 ${proxy.name}`} onClick={() => openShare(proxy)} className="p-2 border rounded"><Share2 className="w-4 h-4" /></button><button aria-label={`编辑 ${proxy.name}`} onClick={() => setEditing({ originalName: proxy.name, data: proxy })} className="p-2 border rounded"><Edit className="w-4 h-4" /></button><button aria-label={`删除 ${proxy.name}`} onClick={() => confirmDelete(new Set([proxy.name]))} className="p-2 border rounded text-red-500"><Trash2 className="w-4 h-4" /></button></div></div>
  </div>;
  return <div className="p-4 md:p-8 space-y-5">
    <div className="flex justify-between gap-3 flex-wrap"><h2 className="text-2xl font-bold flex items-center gap-2"><Server className="text-blue-500" />节点管理 ({proxies.length})</h2><div className="flex gap-2 flex-wrap"><button onClick={() => setEditing({ originalName: null, data: { name: '新节点', type: 'ss', server: '', port: 443 } })} className="px-4 py-2 bg-blue-600 text-white rounded-lg"><Plus className="inline w-4 h-4" />添加节点</button><button onClick={() => setImporting(true)} className="px-4 py-2 border rounded-lg">导入／更新节点</button></div></div>
    <div className="flex gap-2 flex-wrap items-center text-sm"><span>已选 {activeSelected.size}</span><button onClick={() => setSelected(activeSelected.size === proxies.length ? new Set() : new Set(proxies.map(p => p.name)))} className="px-3 py-1 border rounded">全选／全不选</button><button disabled={!activeSelected.size} onClick={() => confirmDelete(activeSelected)} className="px-3 py-1 border rounded text-red-500 disabled:opacity-30">删除选中</button><button disabled={!proxies.length} onClick={() => confirmDelete(existingNames)} className="px-3 py-1 border rounded text-red-500 disabled:opacity-30">清空全部</button></div>
    {proxies.length > 100 ? <VirtualList items={proxies} height={600} rowHeight={160} renderItem={renderProxy} /> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{proxies.map(renderProxy)}</div>}
    {!proxies.length && <p className="text-center p-12 text-slate-400">暂无节点，请添加或导入配置</p>}
    {editing && <ProxyEditorModal proxy={editing.data} onClose={() => setEditing(null)} onSave={save} showAlert={showAlert} parseProxyLink={parseProxyLink} />}
    {importing && <LinkImportModal existingProxies={proxies} onImport={importLinks} onClose={() => setImporting(false)} />}
    {share && <ProxyShareModal share={share} onClose={() => setShare(null)} onCopy={copy} />}
  </div>;
}
