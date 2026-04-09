import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, X } from 'lucide-react';
import Modal from './Modal';
import InputRow from './InputRow';
import { RULE_PROVIDER_TEMPLATES } from '../constants/templates';

let globalAclCache = null;

const COMMON_ACL_FALLBACKS = [
  { name: 'BanAD', desc: '广告拦截' }, { name: 'BanProgramAD', desc: '应用内广告' }, { name: 'Microsoft', desc: '微软' },
  { name: 'Bing', desc: '必应' }, { name: 'Google', desc: '谷歌' }, { name: 'Netflix', desc: 'Netflix' },
  { name: 'YouTube', desc: 'YouTube' }, { name: 'Telegram', desc: 'Telegram' }, { name: 'OpenAi', desc: 'OpenAI' }
];

function RuleProviderEditorModal({ providerName, providerData, initialTarget, allTargetNames, onClose, onSave, showAlert }) {
  const [name, setName] = useState(providerName);
  const [data, setData] = useState(providerData);
  const [target, setTarget] = useState(initialTarget || '');

  const [searchInput, setSearchInput] = useState('');
  const [aclTemplates, setAclTemplates] = useState(globalAclCache || []);
  const [loadingAcl, setLoadingAcl] = useState(!globalAclCache);

  useEffect(() => {
    if (globalAclCache) return;
    const fetchAcl = async () => {
      setLoadingAcl(true);
      try {
        const res = await fetch('https://data.jsdelivr.com/v1/package/gh/ACL4SSR/ACL4SSR@master');
        if (!res.ok) throw new Error('API Limit');
        const json = await res.json();

        const clashDir = json.files.find(f => f.name === 'Clash');
        if (!clashDir) throw new Error('No Clash directory');
        const rulesetDir = clashDir.files.find(f => f.name === 'Ruleset');
        if (!rulesetDir) throw new Error('No Ruleset directory');

        const items = rulesetDir.files.filter(f => f.type === 'file' && f.name.endsWith('.list')).map(f => {
          const base = f.name.replace('.list', '');
          const foundDesc = COMMON_ACL_FALLBACKS.find(cb => cb.name.toLowerCase() === base.toLowerCase());
          return {
            name: base,
            desc: foundDesc ? foundDesc.desc : '',
            fileName: f.name
          };
        });

        items.sort((a, b) => {
           const aIsCommon = !!a.desc;
           const bIsCommon = !!b.desc;
           if (aIsCommon && !bIsCommon) return -1;
           if (!aIsCommon && bIsCommon) return 1;
           return a.name.localeCompare(b.name);
        });

        globalAclCache = items;
        setAclTemplates(items);
      } catch(e) {
        const items = COMMON_ACL_FALLBACKS.map(f => ({
          name: f.name, desc: f.desc, fileName: `${f.name}.list`
        }));
        globalAclCache = items;
        setAclTemplates(items);
      } finally { setLoadingAcl(false); }
    };
    fetchAcl();
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);

    const builtinMatch = RULE_PROVIDER_TEMPLATES.find(t => `[内置] ${t.label}` === val);
    if (builtinMatch) {
       if (builtinMatch.name) setName(builtinMatch.name);
       setData(JSON.parse(JSON.stringify(builtinMatch.data)));
       return;
    }

    const aclMatch = aclTemplates.find(t => `ACL4SSR: ${t.name}${t.desc ? ` (${t.desc})` : ''}` === val);
    if (aclMatch) {
       setName(aclMatch.name);
       setData({
         type: 'http', behavior: 'classical', format: 'text',
         url: `https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/${aclMatch.fileName}`,
         path: `./rule_provider/${aclMatch.fileName}`,
         interval: 86400
       });
       return;
    }
  };

  const handleSave = () => {
    if (!name.trim()) return showAlert("保存失败：规则集名称不能为空");
    if (data.type === 'http' && !data.url.trim()) return showAlert("保存失败：在线规则集 URL 不能为空");
    if (!data.path.trim()) return showAlert("保存失败：保存路径 (path) 不能为空");
    let finalPath = data.path;
    if (data.format === 'mrs' && !finalPath.endsWith('.mrs')) finalPath = `./rule_provider/${name}.mrs`;
    if (data.format === 'text' && !finalPath.endsWith('.list')) finalPath = `./rule_provider/${name}.list`;
    if (data.format === 'yaml' && !finalPath.endsWith('.yaml')) finalPath = `./rule_provider/${name}.yaml`;
    let result = { type: data.type, behavior: data.behavior, format: data.format, path: finalPath };
    if (data.type === 'http') { result.url = data.url; result.interval = Number(data.interval) || 86400; }
    onSave(name.trim(), result, target);
  };

  return (
    <Modal title="编辑规则集 (Rule Provider)" onClose={onClose} onSave={handleSave} widthClass="max-w-2xl">
      <div className="space-y-6">

        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
          <label className="font-medium text-sm text-emerald-800 dark:text-emerald-300 block mb-2">快速应用常见模板 (推荐)</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              list="rule-templates"
              value={searchInput}
              onChange={handleSearchChange}
              disabled={loadingAcl}
              placeholder={loadingAcl ? "正在加载 ACL4SSR 列表..." : "搜索或选择模板自动填充下方参数 (如 Amazon, BanAD)..."}
              className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 text-sm disabled:opacity-50"
            />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="清除输入">
                <X className="w-4 h-4" />
              </button>
            )}
            <datalist id="rule-templates">
              {RULE_PROVIDER_TEMPLATES.map((tpl, idx) => (
                <option key={`builtin-${idx}`} value={`[内置] ${tpl.label}`} />
              ))}
              {aclTemplates.map((tpl, idx) => (
                <option key={`acl-${idx}`} value={`ACL4SSR: ${tpl.name}${tpl.desc ? ` (${tpl.desc})` : ''}`} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InputRow label="规则集名称 (如 youtube)" value={name} onChange={setName} />
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm text-slate-700 dark:text-slate-300">类型 (type)</label>
            <select value={data.type} onChange={e => setData({...data, type: e.target.value})} className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="http">http (在线订阅)</option><option value="file">file (本地文件)</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm text-slate-700 dark:text-slate-300">行为 (behavior)</label>
            <select value={data.behavior} onChange={e => setData({...data, behavior: e.target.value})} className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="domain">domain (纯域名)</option><option value="ipcidr">ipcidr (纯IP段)</option><option value="classical">classical (混合规则)</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm text-slate-700 dark:text-slate-300">格式 (format)</label>
            <select value={data.format} onChange={e => setData({...data, format: e.target.value})} className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="mrs">mrs (MetaCubeX 二进制)</option><option value="text">text (纯文本列表 .list)</option><option value="yaml">yaml (YAML格式)</option>
            </select>
          </div>
        </div>
        {data.type === 'http' && (
          <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border dark:border-slate-700">
            <InputRow label="下载地址 (url)" value={data.url || ''} onChange={v => setData({...data, url: v})} placeholder="https://raw.githubusercontent.com/..." />
            <InputRow label="更新间隔 (interval，秒)" value={data.interval || 86400} onChange={v => setData({...data, interval: v})} type="number" />
          </div>
        )}
        <InputRow label="本地保存路径 (path，保存时将自动修正后缀)" value={data.path} onChange={v => setData({...data, path: v})} placeholder="./rule_provider/文件名" />
        <div className="flex flex-col gap-2 pt-4 border-t dark:border-slate-800">
          <label className="font-medium text-sm text-slate-700 dark:text-slate-300">关联策略组 / 出站 (Rule-Set Target)</label>
          <select value={target} onChange={e => setTarget(e.target.value)} className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono">
            <option value="">-- 不关联 (仅添加规则集源) --</option>
            {allTargetNames.map(tName => <option key={tName} value={tName}>{String(tName)}</option>)}
          </select>
          <p className="text-xs text-slate-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />选择后，保存时将自动在路由规则(Rules)中生成/更新对应的引用配置。</p>
        </div>
      </div>
    </Modal>
  );
}

export default RuleProviderEditorModal;
