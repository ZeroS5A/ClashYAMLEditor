import React, { useState, useCallback, useEffect } from 'react';
import { Settings, Server, Layers, BookOpen, Upload, Download, Check, Undo2, Redo2, AlertCircle, X } from 'lucide-react';

import useYamlLoader from './hooks/useYamlLoader';
import useConfigPersistence from './hooks/useConfigPersistence';

import TabButton from './components/TabButton';
import ErrorBoundary from './components/ErrorBoundary';
import TabImport from './components/TabImport';
import TabExport from './components/TabExport';
import TabProxies from './components/TabProxies';
import TabGroups from './components/TabGroups';
import TabRules from './components/TabRules';
import TabBasic from './components/TabBasic';

export default function App() {
  const yamlLoaded = useYamlLoader();

  // ---- 共享状态 ----
  const [activeTab, setActiveTab] = useState('import');
  const [yamlText, setYamlText] = useState('');
  const [parseError, setParseError] = useState('');

  // ---- 配置持久化 / 撤销重做 ----
  const {
    config, setConfig,
    undo, redo, canUndo, canRedo,
    dirty,
    pendingDraft, keepDraft, discardDraft,
  } = useConfigPersistence();

  // ---- 撤销/重做快捷键（Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z 或 Ctrl+Y）----
  useEffect(() => {
    const handler = (e) => {
      const modifier = e.ctrlKey || e.metaKey;
      if (!modifier || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // ---- 全局 UI 状态 ----
  const [toast, setToast] = useState('');
  const [dialog, setDialog] = useState({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: null });

  // ---- UI 辅助函数 ----
  const showAlert = useCallback((message, title = "提示") =>
    setDialog({ isOpen: true, type: 'alert', title, message, onConfirm: null }), []);
  const showConfirm = useCallback((message, onConfirm, title = "确认操作") =>
    setDialog({ isOpen: true, type: 'confirm', title, message, onConfirm }), []);
  const closeDialog = useCallback(() =>
    setDialog(prev => ({ ...prev, isOpen: false })), []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  // ---- 加载中 ----
  if (!yamlLoaded) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">正在加载解析器...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans">
      {/* ---- Toast 通知 ---- */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <Check className="w-5 h-5 text-green-400" /> {toast}
        </div>
      )}

      {/* ---- 全局对话框 ---- */}
      {dialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{dialog.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{dialog.message}</p>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 border-t dark:border-slate-700">
              {dialog.type === 'confirm' && (
                <button onClick={closeDialog} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">取消</button>
              )}
              <button
                onClick={() => { if (dialog.type === 'confirm' && dialog.onConfirm) dialog.onConfirm(); closeDialog(); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${dialog.type === 'confirm' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >确定</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- 主体布局 ---- */}
      <div className="w-full flex flex-col md:flex-row h-screen relative">
        {/* 侧边栏 */}
        <div className="w-full md:w-64 bg-white dark:bg-slate-900 shadow-sm border-r dark:border-slate-800 flex flex-col p-4 shrink-0 overflow-y-auto">
          <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-8 flex items-center gap-2">Clash YAML Editor</h1>
          <nav className="flex flex-col gap-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 mt-2 px-3">导入</div>
            <TabButton active={activeTab === 'import'} onClick={() => setActiveTab('import')} icon={Upload} label="导入配置" />
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 mt-2 px-3">修改</div>
            <TabButton active={activeTab === 'proxies'} onClick={() => setActiveTab('proxies')} icon={Server} label="节点管理" count={config.proxies.length} />
            <TabButton active={activeTab === 'groups'} onClick={() => setActiveTab('groups')} icon={Layers} label="策略组管理" count={config['proxy-groups'].length} />
            <TabButton active={activeTab === 'rules'} onClick={() => setActiveTab('rules')} icon={BookOpen} label="规则管理" count={config.rules.length} />
            <TabButton active={activeTab === 'basic'} onClick={() => setActiveTab('basic')} icon={Settings} label="基础设置" />
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 mt-2 px-3">导出</div>
            <TabButton active={activeTab === 'export'} onClick={() => setActiveTab('export')} icon={Download} label="导出配置" />
          </nav>
        </div>

        {/* 内容区 */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-100 dark:bg-slate-950">

          {/* ---- 顶部工具条：撤销/重做 + 草稿状态 ---- */}
          <div className="shrink-0 flex items-center gap-2 px-4 md:px-6 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
            <button onClick={undo} disabled={!canUndo} title="撤销 (Ctrl/Cmd+Z)"
              className="px-3 py-1.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
              <Undo2 className="w-4 h-4" /> 撤销
            </button>
            <button onClick={redo} disabled={!canRedo} title="重做 (Ctrl/Cmd+Shift+Z)"
              className="px-3 py-1.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
              <Redo2 className="w-4 h-4" /> 重做
            </button>
            <span className={`ml-auto text-xs flex items-center gap-1.5 ${dirty ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
              {dirty ? (
                <><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> 正在保存到浏览器…</>
              ) : (
                <><span className="w-2 h-2 rounded-full bg-emerald-500" /> 已保存到浏览器</>
              )}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar relative">

          {/* ---- 本地草稿恢复提示 ---- */}
          {pendingDraft && (
            <div className="px-4 md:px-8 pt-4">
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl">
                <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    已从浏览器恢复上次未完成的编辑
                    {pendingDraft.savedAt ? `（保存于 ${new Date(pendingDraft.savedAt).toLocaleString()}）` : ''}。
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={keepDraft}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors">
                    保留草稿
                  </button>
                  <button onClick={discardDraft}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-amber-800 dark:text-amber-300 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5">
                    <X className="w-4 h-4" /> 丢弃并重新开始
                  </button>
                </div>
              </div>
            </div>
          )}

          <ErrorBoundary
            onReset={discardDraft}
            onHome={() => setActiveTab('import')}
            resetText="重置为空白配置"
          >
          {activeTab === 'import' && (
            <TabImport
              yamlText={yamlText} setYamlText={setYamlText}
              parseError={parseError} setParseError={setParseError}
              setConfig={setConfig}
              showAlert={showAlert} showToast={showToast}
              setActiveTab={setActiveTab}
            />
          )}
          {activeTab === 'export' && (
            <TabExport
              yamlText={yamlText} setYamlText={setYamlText}
              config={config}
              showAlert={showAlert} showToast={showToast}
            />
          )}
          {activeTab === 'proxies' && (
            <TabProxies
              config={config} setConfig={setConfig}
              showAlert={showAlert} showConfirm={showConfirm} showToast={showToast}
            />
          )}
          {activeTab === 'groups' && (
            <TabGroups
              config={config} setConfig={setConfig}
              showAlert={showAlert} showConfirm={showConfirm} showToast={showToast}
            />
          )}
          {activeTab === 'rules' && (
            <TabRules
              config={config} setConfig={setConfig}
              showAlert={showAlert} showConfirm={showConfirm} showToast={showToast}
            />
          )}
          {activeTab === 'basic' && (
            <TabBasic config={config} setConfig={setConfig} />
          )}
          </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
