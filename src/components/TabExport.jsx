import React from 'react';
import { Download, Copy, ArrowRight, Check, Zap } from 'lucide-react';

const TabExport = ({ yamlText, setYamlText, handleExportText, copyToClipboard, handleDownloadFile, handleImportToClash }) => (
  <div className="p-4 md:p-8">
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-sm border dark:border-slate-800 p-6 flex flex-col h-full md:h-auto">
      <h2 className="text-2xl font-bold mb-4 flex items-center justify-between">
        生成导出
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportText} className="text-sm px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors" title="同步配置"><ArrowRight className="w-4 h-4" /> 刷新文本</button>
          <button onClick={copyToClipboard} className="text-sm px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors"><Copy className="w-4 h-4" /> 复制文本</button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 self-center"></div>
          <button onClick={handleDownloadFile} className="text-sm px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 rounded-lg flex items-center gap-2 transition-colors"><Download className="w-4 h-4" /> 下载文件</button>
          <button onClick={handleImportToClash} className="text-sm px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 rounded-lg flex items-center gap-2 transition-colors"><Zap className="w-4 h-4" /> 导入 Clash</button>
        </div>
      </h2>
      <div className="p-3 mb-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-sm flex items-center gap-2">
        <Check className="w-4 h-4" /> 可视化配置已成功转换为下方最新 YAML 文本。
      </div>
      <textarea value={yamlText} onChange={(e) => setYamlText(e.target.value)} className="w-full h-[55vh] font-mono text-sm p-4 border rounded-xl bg-slate-50 dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 outline-none custom-scrollbar whitespace-pre" />
    </div>
  </div>
);

export default TabExport;
