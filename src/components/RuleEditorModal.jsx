import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Save } from 'lucide-react';
import Modal from './Modal';
import InputRow from './InputRow';

function RuleEditorModal({ ruleData, isNew, allTargetNames, allProviderNames, onClose, onSave, showAlert }) {
  const [type, setType] = useState(ruleData.type);
  const [payload, setPayload] = useState(ruleData.payload);
  const [target, setTarget] = useState(ruleData.target || 'DIRECT');
  const [extra, setExtra] = useState(ruleData.extra || '');

  const isRuleSet = type === 'RULE-SET', isMatch = type === 'MATCH';

  const handleSave = (actionType) => {
    if (!isMatch && !payload.trim()) return showAlert("保存失败：匹配内容不能为空");
    if (!target.trim()) return showAlert("保存失败：策略组/节点目标不能为空");
    let finalString = isMatch ? `MATCH,${target}` : `${type},${payload},${target}`;
    if (extra.trim()) finalString += `,${extra}`;
    onSave(finalString, actionType);
  };

  const customFooter = (
    <div className="p-5 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
      <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">取消</button>
      {isNew ? (
        <>
          <button onClick={() => handleSave('bottom')} className="px-4 py-2 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-2"><ArrowDown className="w-4 h-4" /> 扩展</button>
          <button onClick={() => handleSave('top')} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-500/30"><ArrowUp className="w-4 h-4" /> 优先</button>
        </>
      ) : (
        <button onClick={() => handleSave('update')} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-500/30"><Save className="w-4 h-4" /> 保存修改</button>
      )}
    </div>
  );

  return (
    <Modal title={isNew ? "添加路由规则" : "编辑路由规则"} onClose={onClose} customFooter={customFooter} widthClass="max-w-xl">
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm text-slate-700 dark:text-slate-300">规则类型 (Type)</label>
          <select value={type} onChange={e => { setType(e.target.value); if (e.target.value === 'MATCH') setPayload(''); }} className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm">
            <option value="RULE-SET">RULE-SET (引用规则集)</option><option value="DOMAIN-SUFFIX">DOMAIN-SUFFIX (域名后缀)</option><option value="DOMAIN-KEYWORD">DOMAIN-KEYWORD (域名关键字)</option><option value="DOMAIN">DOMAIN (完整域名)</option><option value="IP-CIDR">IP-CIDR (IP段)</option><option value="GEOIP">GEOIP (国家/地区IP)</option><option value="DST-PORT">DST-PORT (目标端口)</option><option value="PROCESS-NAME">PROCESS-NAME (进程名)</option><option value="MATCH">MATCH (全匹配/兜底)</option>
          </select>
        </div>
        {!isMatch && (
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm text-slate-700 dark:text-slate-300">匹配内容 / Payload {isRuleSet && <span className="text-blue-500 font-normal">(请选择)</span>}</label>
            {isRuleSet ? (
              <select value={payload} onChange={e => setPayload(e.target.value)} className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm">
                <option value="" disabled>-- 选择规则集 --</option>
                {allProviderNames.map(name => <option key={name} value={name}>{String(name)}</option>)}
                {allProviderNames.length === 0 && <option value="" disabled>暂无规则集，请先添加</option>}
              </select>
            ) : (
              <input type="text" value={payload} onChange={e => setPayload(e.target.value)} placeholder={type.startsWith('DOMAIN') ? "如: google.com" : "如: 192.168.0.0/16"} className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
            )}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm text-slate-700 dark:text-slate-300">目标策略组/节点 (Target)</label>
          <select value={target} onChange={e => setTarget(e.target.value)} className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm">
            {allTargetNames.map(name => <option key={name} value={name}>{String(name)}</option>)}
          </select>
        </div>
        <InputRow label="附加参数 (可选, 如 no-resolve)" value={extra} onChange={setExtra} placeholder="留空即可" />
      </div>
    </Modal>
  );
}

export default RuleEditorModal;
