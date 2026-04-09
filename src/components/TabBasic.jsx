import React from 'react';
import { Settings } from 'lucide-react';

const InputRow = ({ label, value, onChange, type = "text", placeholder }) => (
  <div className="flex flex-col gap-2">
    <label className="font-medium text-sm">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      placeholder={placeholder}
      className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
    />
  </div>
);

const TabBasic = ({ config, updateBasicConfig }) => (
  <div className="p-4 md:p-8">
    <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-sm border dark:border-slate-800 p-6">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Settings className="w-6 h-6 text-slate-500" /> 基础通用设置</h2>
      <div className="space-y-5">
        <InputRow label="混合端口 (mixed-port)" value={config['mixed-port'] || ''} onChange={(val) => updateBasicConfig({'mixed-port': val})} type="number" />
        <InputRow label="HTTP 端口 (port)" value={config.port || ''} onChange={(val) => updateBasicConfig({port: val})} type="number" />
        <InputRow label="SOCKS 端口 (socks-port)" value={config['socks-port'] || ''} onChange={(val) => updateBasicConfig({'socks-port': val})} type="number" />
        <InputRow label="控制器 (external-controller)" value={config['external-controller'] || ''} onChange={(val) => updateBasicConfig({'external-controller': val})} type="text" placeholder="127.0.0.1:9090" />
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <label className="font-medium text-sm">允许局域网连接 (allow-lan)</label>
          <input type="checkbox" checked={!!config['allow-lan']} onChange={(e) => updateBasicConfig({'allow-lan': e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm">运行模式 (mode)</label>
            <select value={config.mode || 'Rule'} onChange={(e) => updateBasicConfig({mode: e.target.value})} className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="Rule">Rule (规则)</option>
              <option value="Global">Global (全局)</option>
              <option value="Direct">Direct (直连)</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm">日志级别 (log-level)</label>
            <select value={config['log-level'] || 'info'} onChange={(e) => updateBasicConfig({'log-level': e.target.value})} className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default TabBasic;
