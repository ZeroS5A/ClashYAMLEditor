import React, { useState } from 'react';
import { Link as LinkIcon, X, Plus, Trash2 } from 'lucide-react';
import Modal from './Modal';
import InputRow from './InputRow';
import { PROTOCOL_SCHEMAS } from '../constants/templates';

function ProxyEditorModal({ proxy, onClose, onSave, showAlert, parseProxyLink }) {
  const [basicInfo, setBasicInfo] = useState({
    name: proxy.name || '', type: proxy.type || 'ss', server: proxy.server || '', port: proxy.port || 443
  });
  const [quickLink, setQuickLink] = useState('');
  const [extraFields, setExtraFields] = useState(() => {
    const { name, type, server, port, ...rest } = proxy;
    return Object.keys(rest).map(k => {
      let val = rest[k], t = 'string';
      if (typeof val === 'number') t = 'number';
      if (typeof val === 'boolean') t = 'boolean';
      if (typeof val === 'object') { val = JSON.stringify(val); t = 'json'; }
      return { id: Math.random().toString(36).substring(2, 9), key: k, value: val, type: t };
    });
  });

  const handleQuickImport = () => {
    if (!quickLink.trim()) return;
    try {
      const proxyData = parseProxyLink(quickLink.trim());
      Object.keys(proxyData).forEach(key => proxyData[key] === undefined && delete proxyData[key]);
      setBasicInfo({ name: proxyData.name || basicInfo.name, type: proxyData.type || basicInfo.type, server: proxyData.server || basicInfo.server, port: proxyData.port || basicInfo.port });
      const { name, type, server, port, ...rest } = proxyData;
      const newExtraFields = Object.keys(rest).map(k => {
        let val = rest[k], t = 'string';
        if (typeof val === 'number') t = 'number';
        if (typeof val === 'boolean') t = 'boolean';
        if (typeof val === 'object') { val = JSON.stringify(val); t = 'json'; }
        return { id: Math.random().toString(36).substring(2, 9), key: k, value: val, type: t };
      });
      setExtraFields(newExtraFields);
      setQuickLink('');
      showAlert("节点链接解析成功，参数已自动填充覆盖！");
    } catch (e) {
      showAlert("无法解析链接: " + e.message);
    }
  };

  const handleExtraFieldChange = (id, fieldName, val) => setExtraFields(prev => prev.map(f => f.id === id ? { ...f, [fieldName]: val } : f));
  const addExtraField = (key = '', value = '', type = 'string') => setExtraFields(prev => [...prev, { id: Math.random().toString(36).substring(2, 9), key, value, type }]);
  const removeExtraField = (id) => setExtraFields(prev => prev.filter(f => f.id !== id));

  const handleSave = () => {
    if (!basicInfo.name.trim()) return showAlert('保存失败：节点名称不能为空');
    if (!basicInfo.server.trim()) return showAlert('保存失败：服务器地址不能为空');
    let result = { name: basicInfo.name.trim(), type: basicInfo.type.trim(), server: basicInfo.server.trim(), port: Number(basicInfo.port) };
    extraFields.forEach(f => {
      if (f.key.trim() === '') return;
      if (f.value === '' && PROTOCOL_SCHEMAS[basicInfo.type]?.some(s => s.key === f.key)) return;
      let val = f.value;
      try {
        if (f.type === 'number') val = Number(val);
        if (f.type === 'boolean') val = val === 'true' || val === true;
        if (f.type === 'json') val = JSON.parse(val);
      } catch (e) { console.warn(`[${f.key}] 转换 JSON 失败`); }
      result[f.key.trim()] = val;
    });
    onSave(result);
  };

  const currentSchema = PROTOCOL_SCHEMAS[basicInfo.type] || [];
  const schemaKeys = currentSchema.map(s => s.key);
  const schemaRenderList = currentSchema.map(schemaDef => ({ schemaDef, fieldData: extraFields.find(f => f.key === schemaDef.key) || null }));
  const otherFields = extraFields.filter(f => !schemaKeys.includes(f.key));

  return (
    <Modal title="编辑节点信息" onClose={onClose} onSave={handleSave}>
      <div className="space-y-6">
        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 flex gap-2 items-center shadow-sm">
          <LinkIcon className="w-5 h-5 text-blue-500 shrink-0" />
          <div className="relative flex-1">
            <input type="text" placeholder="在此粘贴节点链接 (如 trojan://, vmess://) 以快速覆盖下方参数..." value={quickLink} onChange={e => setQuickLink(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2.5 pl-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            {quickLink && (
              <button type="button" onClick={() => setQuickLink('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="清除输入">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button type="button" onClick={handleQuickImport} className="whitespace-nowrap px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0 shadow-sm shadow-blue-500/20">解析链接</button>
        </div>
        <div>
          <h3 className="font-bold text-lg mb-3">基础信息</h3>
          <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border dark:border-slate-700">
            <InputRow label="节点名称 (name)" value={basicInfo.name} onChange={v => setBasicInfo({...basicInfo, name: v})} />
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm text-slate-700 dark:text-slate-300">协议类型 (type)</label>
              <input type="text" value={basicInfo.type} onChange={e => setBasicInfo({...basicInfo, type: e.target.value})} list="proxy-types" className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
              <datalist id="proxy-types">{Object.keys(PROTOCOL_SCHEMAS).map(k => <option key={k} value={k}/>)}</datalist>
            </div>
            <InputRow label="服务器地址 (server)" value={basicInfo.server} onChange={v => setBasicInfo({...basicInfo, server: v})} />
            <InputRow label="端口 (port)" type="number" value={basicInfo.port} onChange={v => setBasicInfo({...basicInfo, port: v})} />
          </div>
        </div>
        {currentSchema.length > 0 && (
          <div>
            <h3 className="font-bold text-lg mb-3">协议参数 <span className="text-sm font-normal text-slate-500">({basicInfo.type})</span></h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/40 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              {schemaRenderList.map(item => {
                const val = item.fieldData ? item.fieldData.value : '';
                const type = item.schemaDef.type || 'string';
                const onChange = (newVal) => { item.fieldData ? handleExtraFieldChange(item.fieldData.id, 'value', newVal) : addExtraField(item.schemaDef.key, newVal, type); };
                return (
                  <div key={item.schemaDef.key} className="flex flex-col gap-2">
                    <label className="font-medium text-sm text-slate-700 dark:text-slate-300 truncate" title={item.schemaDef.label}>{item.schemaDef.label}</label>
                    {type === 'boolean' ? (
                      <select value={item.fieldData ? val.toString() : ''} onChange={(e) => { const v = e.target.value; onChange(v === '' ? '' : v === 'true'); }} className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                        <option value="">未设置 (留空)</option><option value="true">true</option><option value="false">false</option>
                      </select>
                    ) : (
                      <input type={type === 'number' ? 'number' : 'text'} value={val} onChange={(e) => onChange(e.target.value)} placeholder={type === 'json' ? 'JSON / 未设置' : '未设置'} className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm placeholder-slate-400/60" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <h3 className="font-bold text-lg mb-3 flex items-center justify-between">
            其他参数<button onClick={() => addExtraField('', '', 'string')} className="text-sm px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors"><Plus className="w-4 h-4"/> 新增参数</button>
          </h3>
          <div className="space-y-3">
            {otherFields.length === 0 && <p className="text-sm text-slate-400 italic">暂无额外参数</p>}
            {otherFields.map((field) => (
              <div key={field.id} className="flex gap-2 items-start">
                <input type="text" placeholder="键名" value={field.key} onChange={(e) => handleExtraFieldChange(field.id, 'key', e.target.value)} className="w-1/3 p-2.5 border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:border-blue-500 font-mono text-sm" />
                {field.type === 'boolean' ? (
                  <select value={field.value.toString()} onChange={(e) => handleExtraFieldChange(field.id, 'value', e.target.value === 'true')} className="flex-1 p-2.5 border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:border-blue-500 font-mono text-sm"><option value="true">true</option><option value="false">false</option></select>
                ) : (
                  <input type={field.type === 'number' ? 'number' : 'text'} placeholder={field.type === 'json' ? "填写JSON格式..." : "值"} value={field.value} onChange={(e) => handleExtraFieldChange(field.id, 'value', e.target.value)} className="flex-1 p-2.5 border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:border-blue-500 font-mono text-sm" />
                )}
                <select value={field.type} onChange={(e) => handleExtraFieldChange(field.id, 'type', e.target.value)} className="w-24 p-2.5 border rounded-lg bg-slate-50 text-xs dark:bg-slate-800 dark:border-slate-700 outline-none"><option value="string">字符串</option><option value="number">数字</option><option value="boolean">布尔</option><option value="json">JSON</option></select>
                <button onClick={() => removeExtraField(field.id)} className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default ProxyEditorModal;
