import React, { useState, useCallback, useEffect } from 'react';
import { Settings, Server, Layers, BookOpen, Upload, Download, Check, Undo2, Redo2, AlertCircle, X, ChevronDown } from 'lucide-react';

import GlobalDialog from './components/common/GlobalDialog';
import TabDns from './components/dns/TabDns';
import TabNetwork from './components/network/TabNetwork';
import TabProxyProviders from './components/proxy-providers/TabProxyProviders';
import TabDiagnostics from './components/diagnostics/TabDiagnostics';
import { DEFAULT_TARGET } from './utils/validation';
import useConfigPersistence from './hooks/useConfigPersistence';

import TabButton from './components/common/TabButton';
import ErrorBoundary from './components/common/ErrorBoundary';
import TabImport from './components/import/TabImport';
import TabExport from './components/export/TabExport';
import TabProxies from './components/proxies/TabProxies';
import TabGroups from './components/groups/TabGroups';
import TabRules from './components/rules/TabRules';
import TabBasic from './components/basic/TabBasic';

export default function App() {


  // ---- 共享状态 ----
  const [activeTab, setActiveTab] = useState('import');
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const advancedActive = ['dns', 'network', 'providers'].includes(activeTab);
  const navigateToTab = (tab) => {
    setActiveTab(tab);
    if (['dns', 'network', 'providers'].includes(tab)) setAdvancedExpanded(true);
  };
  const [yamlText, setYamlText] = useState('');
  const [parseError, setParseError] = useState('');
  const [target, setTargetState] = useState(() => { try { return { ...DEFAULT_TARGET, ...JSON.parse(localStorage.getItem('clash-editor:target') || '{}') }; } catch { return DEFAULT_TARGET; } });
  const setTarget = value => { setTargetState(value); try { localStorage.setItem('clash-editor:target', JSON.stringify(value)); } catch { /* Editing remains available. */ } };
  const [locationHint, setLocationHint] = useState('');

  // ---- 配置持久化 / 撤销重做 ----
  const {
    config, setConfig,
    undo, redo, canUndo, canRedo,
    dirty, status, saveError, remember, toggleRemember, retrySave, sourceDraft, setSourceDraft,
    pendingDraft, keepDraft, discardDraft,
  } = useConfigPersistence();

  // ---- 撤销/重做快捷键（Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z 或 Ctrl+Y）----
  useEffect(() => {
    const handler = (e) => {
      if (e.target instanceof Element && (e.target.closest('input, textarea, select, [contenteditable="true"]') || e.target.closest('[role="dialog"]'))) return;
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

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans">
      {/* ---- Toast 通知 ---- */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <Check className="w-5 h-5 text-green-400" /> {toast}
        </div>
      )}

      {/* ---- 全局对话框 ---- */}
      {dialog.isOpen && <GlobalDialog dialog={dialog} onClose={closeDialog} />}

      {/* ---- 主体布局 ---- */}
      <div className="w-full flex flex-col md:flex-row h-dvh relative">
        {/* 侧边栏 */}
        <div className="w-full md:w-64 max-h-[30dvh] md:max-h-none bg-white dark:bg-slate-900 shadow-sm border-r dark:border-slate-800 flex flex-col p-4 shrink-0 overflow-y-auto">
          <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3 md:mb-8 flex items-center gap-2">Clash YAML Editor</h1>
          <nav className="hidden md:flex flex-col gap-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 mt-2 px-3">导入</div>
            <TabButton active={activeTab === 'import'} onClick={() => setActiveTab('import')} icon={Upload} label="导入配置" />
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 mt-2 px-3">修改</div>
            <TabButton active={activeTab === 'proxies'} onClick={() => setActiveTab('proxies')} icon={Server} label="节点管理" count={config.proxies.length} />
            <TabButton active={activeTab === 'groups'} onClick={() => setActiveTab('groups')} icon={Layers} label="策略组管理" count={config['proxy-groups'].length} />
            <TabButton active={activeTab === 'rules'} onClick={() => setActiveTab('rules')} icon={BookOpen} label="规则管理" count={config.rules.length} />
            <TabButton active={activeTab === 'basic'} onClick={() => setActiveTab('basic')} icon={Settings} label="基础设置" />
            <div>
              <button
                type="button"
                aria-expanded={advancedExpanded}
                aria-controls="advanced-settings-menu"
                onClick={() => setAdvancedExpanded(expanded => !expanded)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${advancedActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
              >
                <Settings className="w-4 h-4" />
                高级设置
                <ChevronDown className={`ml-auto w-4 h-4 transition-transform ${advancedExpanded ? 'rotate-180' : ''}`} />
              </button>
              <div id="advanced-settings-menu" hidden={!advancedExpanded} className="ml-5 mt-1 pl-2 border-l border-slate-200 dark:border-slate-700 space-y-1">
                <TabButton active={activeTab === 'dns'} onClick={() => navigateToTab('dns')} icon={Settings} label="DNS 设置" />
                <TabButton active={activeTab === 'network'} onClick={() => navigateToTab('network')} icon={Settings} label="透明代理与 TUN" />
                <TabButton active={activeTab === 'providers'} onClick={() => navigateToTab('providers')} icon={Server} label="代理集合" count={Object.keys(config['proxy-providers'] || {}).length} />
              </div>
            </div>
            <TabButton active={activeTab === 'diagnostics'} onClick={() => setActiveTab('diagnostics')} icon={AlertCircle} label="配置体检" />
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 mt-2 px-3">导出</div>
            <TabButton active={activeTab === 'export'} onClick={() => setActiveTab('export')} icon={Download} label="导出配置" />
          </nav>
          <select aria-label="功能导航" className="md:hidden p-2 border rounded bg-transparent" value={activeTab} onChange={e => navigateToTab(e.target.value)}>
            {[['import','导入配置'],['proxies','节点管理'],['groups','策略组管理'],['rules','规则管理'],['basic','基础设置']].map(([id,label]) => <option key={id} value={id}>{label}</option>)}
            <optgroup label="高级设置">
              <option value="dns">DNS 设置</option>
              <option value="network">透明代理与 TUN</option>
              <option value="providers">代理集合</option>
            </optgroup>
            {[['diagnostics','配置体检'],['export','导出配置']].map(([id,label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>

        {/* 内容区 */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-slate-100 dark:bg-slate-950">

          {/* ---- 顶部工具条：撤销/重做 + 草稿恢复 + 保存状态 ---- */}
          <div aria-label="编辑工具栏" className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 md:px-6 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 shrink-0">
            <button onClick={undo} disabled={!canUndo} title="撤销 (Ctrl/Cmd+Z)"
              className="px-3 py-1.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
              <Undo2 className="w-4 h-4" /> 撤销
            </button>
            <button onClick={redo} disabled={!canRedo} title="重做 (Ctrl/Cmd+Shift+Z)"
              className="px-3 py-1.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
              <Redo2 className="w-4 h-4" /> 重做
            </button>
            </div>
            {pendingDraft && (
              <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-2 min-w-0 basis-[28rem]">
                <div className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span title={pendingDraft.savedAt ? `保存于 ${new Date(pendingDraft.savedAt).toLocaleString()}` : undefined}>
                    已从浏览器恢复上次未完成的编辑
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={keepDraft}
                    className="px-2 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors">
                    保留草稿
                  </button>
                  <button onClick={discardDraft}
                    className="px-2 py-1.5 rounded-lg text-xs font-medium text-amber-800 dark:text-amber-300 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1">
                    <X className="w-3.5 h-3.5" /> 丢弃并重新开始
                  </button>
                </div>
              </div>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={remember} onChange={e => toggleRemember(e.target.checked)} />记住草稿（含凭证）</label>
              <span role="status" className={saveError ? 'text-red-500' : dirty ? 'text-amber-600' : 'text-slate-500'}>{status}</span>
              {saveError && <button onClick={retrySave} className="underline">重试保存</button>}
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scrollbar relative">

          {locationHint && <div className="px-6 py-3 text-sm text-blue-600">定位：{locationHint}<button onClick={() => setLocationHint('')} className="ml-4 underline">清除</button></div>}
          <div className="flex-1 min-h-0"><ErrorBoundary
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
              setActiveTab={navigateToTab} sourceDraft={sourceDraft} showConfirm={showConfirm} setSourceDraft={setSourceDraft} target={target}
            />
          )}
          {activeTab === 'export' && <TabExport config={config} sourceDraft={sourceDraft} setSourceDraft={setSourceDraft} target={target} showAlert={showAlert} showToast={showToast} showConfirm={showConfirm} />}
          {activeTab === 'proxies' && (
            <TabProxies
              config={config} setConfig={setConfig} target={target} locationHint={locationHint}
              showAlert={showAlert} showConfirm={showConfirm} showToast={showToast}
            />
          )}
          {activeTab === 'groups' && (
            <TabGroups
              config={config} setConfig={setConfig} target={target} locationHint={locationHint}
              showAlert={showAlert} showConfirm={showConfirm} showToast={showToast}
            />
          )}
          {activeTab === 'rules' && (
            <TabRules
              config={config} setConfig={setConfig} target={target} locationHint={locationHint}
              showAlert={showAlert} showConfirm={showConfirm} showToast={showToast}
            />
          )}
          {activeTab === 'basic' && (
            <TabBasic config={config} setConfig={setConfig} showAlert={showAlert} target={target} setTarget={setTarget} />
          )}
          {activeTab === 'dns' && <TabDns config={config} setConfig={setConfig} showAlert={showAlert} />}
          {activeTab === 'network' && <TabNetwork config={config} setConfig={setConfig} showAlert={showAlert} />}
          {activeTab === 'providers' && <TabProxyProviders target={target} config={config} setConfig={setConfig} showAlert={showAlert} showConfirm={showConfirm} showToast={showToast} />}
          {activeTab === 'diagnostics' && <TabDiagnostics config={config} target={target} onNavigate={(tab, path) => { setLocationHint(path); navigateToTab(tab); }} />}
          </ErrorBoundary></div>
          </div>
        </div>
      </div>
    </div>
  );
}
