import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import InputRow from '../common/InputRow';
import JsonFields from '../common/JsonFields';
import { RULE_PROVIDER_TEMPLATES } from '../../constants/templates';
import { omitFields, parseExtraFields } from '../../utils/editing';
import { fetchText } from '../../utils/network';

let aclCache;
const fields = ['type', 'behavior', 'format', 'url', 'path', 'interval'];
export default function RuleProviderEditorModal({ providerName, providerData, boundTargets = [], allTargetNames, onClose, onSave, showAlert }) {
  const [name, setName] = useState(providerName), [data, setData] = useState({ ...providerData });
  const [extra, setExtra] = useState(() => JSON.stringify(omitFields(providerData, fields), null, 2));
  const [binding, setBinding] = useState({ mode: 'keep', target: '' });
  const [templates, setTemplates] = useState(aclCache || []), [search, setSearch] = useState('');
  useEffect(() => {
    if (aclCache) return;
    const controller = new AbortController();
    fetchText('https://data.jsdelivr.com/v1/package/gh/ACL4SSR/ACL4SSR@master', { signal: controller.signal, timeout: 8000 }).then(text => {
      const root = JSON.parse(text), directory = root.files?.find(f => f.name === 'Clash')?.files?.find(f => f.name === 'Ruleset');
      aclCache = (directory?.files || []).filter(f => f.name.endsWith('.list')).map(f => f.name);
      if (!controller.signal.aborted) setTemplates(aclCache);
    }).catch(() => { if (!controller.signal.aborted) setTemplates(['BanAD.list', 'YouTube.list', 'Telegram.list', 'Netflix.list']); });
    return () => controller.abort();
  }, []);
  const applyTemplate = value => {
    setSearch(value);
    const template = RULE_PROVIDER_TEMPLATES.find(t => t.label === value);
    if (template) { if (template.name) setName(template.name); setData({ ...template.data }); setExtra('{}'); }
    else if (templates.includes(value)) { setName(value.slice(0, -5)); setData({ type: 'http', behavior: 'classical', format: 'text', url: `https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/${value}`, path: `./rule_provider/${value}`, interval: 86400 }); setExtra('{}'); }
  };
  const update = (key, value) => setData(prev => ({ ...prev, [key]: value }));
  const save = () => {
    try {
      if (!name.trim() || /[,\r\n]/.test(name)) throw new Error('名称不能为空或包含分隔符');
      const result = { ...parseExtraFields(extra, fields) };
      for (const field of fields) if (data[field] !== undefined && data[field] !== '') result[field] = field === 'interval' ? Number(data[field]) : data[field];
      if (result.format === 'mrs' && result.behavior === 'classical') throw new Error('MRS 仅支持 domain／ipcidr');
      if (result.type === 'http' && !result.url?.trim()) throw new Error('HTTP 类型需要 URL');
      if (result.type === 'file' && !result.path?.trim()) throw new Error('文件类型需要 path');
      if (result.type === 'inline' && !Array.isArray(result.payload)) throw new Error('inline 类型需要高级参数中的 payload 列表');
      onSave(name.trim(), result, binding);
    } catch (e) { showAlert(`规则集未保存：${e.message}`); }
  };
  return <Modal title="编辑规则集" onClose={onClose} onSave={save}><div className="space-y-5">
    <label className="block text-sm">应用模板（会替换当前表单）<input value={search} onChange={e => applyTemplate(e.target.value)} list="rule-provider-templates" className="block w-full p-3 border rounded bg-transparent" placeholder="搜索模板或输入 ACL4SSR 文件名" /><datalist id="rule-provider-templates">{RULE_PROVIDER_TEMPLATES.map(t => <option key={t.label} value={t.label} />)}{templates.map(t => <option key={t} value={t} />)}</datalist></label>
    <div className="grid grid-cols-2 gap-4"><InputRow label="规则集名称" value={name} onChange={setName} />{[['type', ['http', 'file', 'inline']], ['behavior', ['domain', 'ipcidr', 'classical']], ['format', ['yaml', 'text', 'mrs']]].map(([key, options]) => <label key={key} className="text-sm font-medium">{key}<select value={data[key] ?? (key === 'format' ? '' : '')} onChange={e => update(key, e.target.value)} className="block w-full p-3 border rounded bg-transparent"><option value="">未设置</option>{options.map(v => <option key={v} disabled={key === 'format' && v === 'mrs' && data.behavior === 'classical'}>{v}</option>)}</select></label>)}</div>
    {data.type === 'http' && <><InputRow label="URL" value={data.url ?? ''} onChange={v => update('url', v)} /><InputRow label="更新间隔秒数（留空使用默认）" value={data.interval ?? ''} onChange={v => update('interval', v)} /></>}
    <InputRow label="缓存／文件路径（保留原目录与后缀；HTTP 可留空）" value={data.path ?? ''} onChange={v => update('path', v)} />
    <p className="text-xs text-slate-500">已有直接路由关联：{boundTargets.join('、') || '无'}。组合规则与 DNS 引用在配置体检／规则页面管理。</p>
    <label className="block text-sm">直接 RULE-SET 路由关联<select value={binding.mode === 'set' ? binding.target : binding.mode} onChange={e => setBinding(['keep', 'remove'].includes(e.target.value) ? { mode: e.target.value, target: '' } : { mode: 'set', target: e.target.value })} className="block w-full p-3 border rounded bg-transparent"><option value="keep">保留现有关联</option><option value="remove">解除全部直接路由关联</option>{allTargetNames.map(n => <option key={n} value={n}>关联至 {n}</option>)}</select></label>
    <JsonFields value={extra} onChange={setExtra} help="保留下载出站 proxy、header、inline payload、size-limit 及所有其他字段。" />
  </div></Modal>;
}
