import { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import SectionEditor from '../common/SectionEditor';
import { renameProviderReferences, deleteProvider } from '../../utils/references';
import VirtualList from '../common/VirtualList';
import { validateConfig } from '../../utils/validation';
import { normalizeConfig } from '../../utils/configShape';

export default function TabProxyProviders({ config, setConfig, showAlert, showConfirm, showToast, target }) {
  const [editing, setEditing] = useState(null), [name, setName] = useState('');
  const providers = Object.entries(config['proxy-providers'] || {});
  const open = (originalName, data) => { setName(originalName || '新订阅'); setEditing({ originalName, data }); };
  const save = next => {
    const newName = name.trim();
    if (!newName || /[,\r\n]/.test(newName)) return showAlert('名称不能为空或包含分隔符');
    if (newName !== editing.originalName && Object.hasOwn(config['proxy-providers'] || {}, newName)) return showAlert('代理集合名称已存在');
    let result = { ...config, 'proxy-providers': { ...config['proxy-providers'] } };
    if (editing.originalName) { delete result['proxy-providers'][editing.originalName]; if (newName !== editing.originalName) result = renameProviderReferences(result, editing.originalName, newName, 'proxy-providers'); }
    result['proxy-providers'] = { ...result['proxy-providers'], [newName]: next.provider };
    const shape = normalizeConfig(result);
    if (!shape.ok) return showAlert(shape.error);
    const errors = validateConfig(result, target).filter(i => i.level === 'error' && i.path.startsWith(`proxy-providers.${newName}.`));
    if (errors.length) return showAlert(errors.map(i => i.message).join('\n'));
    setConfig(result); setEditing(null); showToast('代理集合已保存，请在策略组中选择 use');
  };
  const remove = providerName => {
    const affected = config['proxy-groups'].filter(g => g.use?.includes(providerName)).map(g => g.name);
    showConfirm(`删除代理集合「${providerName}」？\n将移除策略组中的 use 引用：${affected.join('、') || '无'}。可以撤销恢复。`, () => setConfig(prev => deleteProvider(prev, providerName, 'proxy-providers')));
  };
  return <div className="p-4 md:p-8 space-y-5">
    <div className="flex items-center justify-between"><h2 className="text-2xl font-bold">代理集合 ({providers.length})</h2><button className="px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={() => open(null, { type: 'http', url: '', interval: 86400, 'health-check': { enable: true, url: 'https://www.gstatic.com/generate_204', interval: 300 } })}><Plus className="inline w-4 h-4" />添加代理集合</button></div>
    <p className="text-sm text-slate-500">Provider 由路由器下载并更新节点。策略组通过 use 引用集合。编辑时保留 header、override、过滤等高级设置。</p>
    <VirtualList items={providers} rowHeight={112} height={560} renderItem={([providerName, data]) => <div className="h-full p-4 border-b dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4"><div className="min-w-0"><h3 className="font-bold truncate">{providerName}</h3><p className="text-xs text-slate-500 mt-1">{data.type} · 更新间隔 {data.interval ?? '默认'} 秒</p><p className="text-xs font-mono truncate mt-1">{data.type === 'inline' ? `内联节点 ${data.payload?.length || 0} 个` : data.path || '按 URL 自动生成缓存路径'}</p></div><div className="flex gap-2 shrink-0"><button onClick={() => open(providerName, data)} aria-label={`编辑 ${providerName}`} className="p-2 border rounded"><Edit className="w-4 h-4" /></button><button onClick={() => remove(providerName)} aria-label={`删除 ${providerName}`} className="p-2 border rounded text-red-500"><Trash2 className="w-4 h-4" /></button></div></div>} itemKey={p => p[0]} />
    {editing && <Modal title="编辑代理集合" onClose={() => setEditing(null)} customFooter={<div />}><label className="block text-sm mb-4">集合名称<input aria-label="代理集合名称" value={name} onChange={e => setName(e.target.value)} className="block w-full p-3 border rounded bg-transparent" /></label><SectionEditor config={{ provider: editing.data }} section="provider" setConfig={save} showAlert={showAlert} title="代理集合参数" description="健康检查、覆写、请求头和内联节点使用 JSON 编辑；未知字段保留。" fields={[
      { key: 'type', options: ['http', 'file', 'inline'] }, { key: 'url' }, { key: 'path' }, { key: 'interval', type: 'number' }, { key: 'proxy', label: '订阅下载出站（proxy）' },
      { key: 'filter' }, { key: 'exclude-filter' }, { key: 'health-check', type: 'json' }, { key: 'override', type: 'json' }, { key: 'header', type: 'json' }, { key: 'payload', label: 'inline 节点列表（JSON 数组）', type: 'json' },
    ]} /></Modal>}
  </div>;
}
