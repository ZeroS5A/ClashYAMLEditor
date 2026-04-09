import React, { useState, useCallback, useMemo } from 'react';
import { Settings, Server, Layers, BookOpen, Upload, Download, Save, X, Check, AlertCircle } from 'lucide-react';

import useYamlLoader from './hooks/useYamlLoader';
import { DEFAULT_EMPTY_CONFIG } from './constants/templates';
import { parseProxyLink, parseRuleString } from './utils/parser';

import Modal from './components/Modal';
import TabButton from './components/TabButton';
import TabImport from './components/TabImport';
import TabExport from './components/TabExport';
import TabProxies from './components/TabProxies';
import TabGroups from './components/TabGroups';
import TabRules from './components/TabRules';
import TabBasic from './components/TabBasic';

import ProxyEditorModal from './components/ProxyEditorModal';
import ProxyGroupEditorModal from './components/ProxyGroupEditorModal';
import RuleProviderEditorModal from './components/RuleProviderEditorModal';
import RuleEditorModal from './components/RuleEditorModal';

export default function App() {
  const yamlLoaded = useYamlLoader();
  const [activeTab, setActiveTab] = useState('import');
  const [config, setConfig] = useState(DEFAULT_EMPTY_CONFIG);
  const [yamlText, setYamlText] = useState('');
  const [parseError, setParseError] = useState('');

  // 弹窗编辑状态
  const [editingProxy, setEditingProxy] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingProvider, setEditingProvider] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkText, setLinkText] = useState('');

  // 全局加载与提示状态
  const [isParsing, setIsParsing] = useState(false);
  const [toast, setToast] = useState('');
  const [dialog, setDialog] = useState({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: null });

  const showAlert = useCallback((message, title="提示") => setDialog({ isOpen: true, type: 'alert', title, message, onConfirm: null }), []);
  const showConfirm = useCallback((message, onConfirm, title="确认操作") => setDialog({ isOpen: true, type: 'confirm', title, message, onConfirm }), []);
  const closeDialog = useCallback(() => setDialog(prev => ({ ...prev, isOpen: false })), []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const applyYamlTextAsync = useCallback((text) => {
    setIsParsing(true);
    setParseError('');
    setTimeout(() => {
      try {
        const parsed = window.jsyaml.load(text);
        if (typeof parsed !== 'object' || parsed === null) throw new Error("无效的 YAML 格式");

        const safeConfig = {
          ...DEFAULT_EMPTY_CONFIG,
          ...parsed,
          proxies: parsed.proxies || [],
          'proxy-groups': parsed['proxy-groups'] || [],
          'rule-providers': parsed['rule-providers'] || {},
          rules: parsed.rules || []
        };

        setConfig(safeConfig);
        showToast('配置解析成功');
        setActiveTab('proxies');
      } catch (err) {
        setParseError("解析失败: " + err.message);
      } finally {
        setIsParsing(false);
      }
    }, 50);
  }, [showToast]);

  const handleImportText = useCallback(() => {
    applyYamlTextAsync(yamlText);
  }, [applyYamlTextAsync, yamlText]);

  const handleExportText = useCallback(() => {
    try {
      const dumped = window.jsyaml.dump(config, { indent: 2, lineWidth: -1, noRefs: true });
      setYamlText(dumped);
      showToast('已生成最新 YAML 文本');
    } catch (err) {
      setParseError("导出失败: " + err.message);
    }
  }, [config, showToast]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setYamlText(content);
      applyYamlTextAsync(content);
    };
    reader.onerror = () => setParseError("文件读取失败");
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleDownloadFile = () => {
    try {
      const dumped = window.jsyaml.dump(config, { indent: 2, lineWidth: -1, noRefs: true });
      const blob = new Blob([dumped], { type: 'text/yaml;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'config.yaml';
      link.click();
      URL.revokeObjectURL(link.href);
      showToast('已开始下载 config.yaml');
    } catch (err) {
      setParseError("下载失败: " + err.message);
    }
  };

  const copyToClipboard = () => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = yamlText;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
      showToast('已复制到剪贴板');
    } catch (err) {
      setParseError("复制失败: " + err.message);
    }
  };

  const handleImportLinks = useCallback(() => {
    const lines = linkText.split('\n').map(l => l.trim()).filter(l => l);
    let successCount = 0;

    setConfig(prev => {
      let newProxies = [...prev.proxies];
      lines.forEach(link => {
        try {
          const proxy = parseProxyLink(link);
          Object.keys(proxy).forEach(key => proxy[key] === undefined && delete proxy[key]);
          let finalName = proxy.name;
          let counter = 1;
          while(newProxies.some(p => p.name === finalName)) {
            finalName = `${proxy.name} ${counter++}`;
          }
          proxy.name = finalName;
          newProxies.push(proxy);
          successCount++;
        } catch (e) {
          console.warn("链接跳过:", link, e);
        }
      });
      return { ...prev, proxies: newProxies };
    });

    if (successCount > 0) {
      showToast(`成功解析导入 ${successCount} 个节点`);
      setLinkModalVisible(false);
      setLinkText('');
    } else {
      showAlert("未能成功解析任何节点。请检查链接格式。");
    }
  }, [linkText, showAlert, showToast]);

  const saveProxy = useCallback((originalName, proxyData) => {
    setConfig(prev => {
      let newProxies = [...prev.proxies];
      const newName = proxyData.name;
      if (originalName) {
        if (originalName !== newName && newProxies.some(p => p.name === newName)) {
          showAlert("保存失败：节点名称已存在！");
          return prev;
        }
        newProxies = newProxies.map(p => p.name === originalName ? proxyData : p);
      } else {
        if (newProxies.some(p => p.name === newName)) {
          showAlert("保存失败：节点名称已存在！");
          return prev;
        }
        newProxies.push(proxyData);
      }
      let newGroups = prev['proxy-groups'];
      if (originalName && originalName !== newName) {
        newGroups = prev['proxy-groups'].map(g => ({
          ...g, proxies: g.proxies?.map(pName => pName === originalName ? newName : pName) || []
        }));
      }
      showToast(`节点 [${newName}] 已保存`);
      return { ...prev, proxies: newProxies, 'proxy-groups': newGroups };
    });
    setEditingProxy(null);
  }, [showAlert, showToast]);

  const deleteProxy = useCallback((proxyName) => {
    showConfirm(`确定要彻底删除节点 [${proxyName}] 吗？`, () => {
      setConfig(prev => {
        const newProxies = prev.proxies.filter(p => p.name !== proxyName);
        const newGroups = prev['proxy-groups'].map(g => ({
          ...g, proxies: (g.proxies || []).filter(name => name !== proxyName)
        }));
        return { ...prev, proxies: newProxies, 'proxy-groups': newGroups };
      });
      showToast(`节点 [${proxyName}] 已删除`);
    });
  }, [showConfirm, showToast]);

  const saveGroup = useCallback((originalName, groupData) => {
    setConfig(prev => {
      let newGroups = [...prev['proxy-groups']];
      const newName = groupData.name;
      if (originalName) {
        if (originalName !== newName && newGroups.some(g => g.name === newName)) {
          showAlert("保存失败：策略组名称已存在！");
          return prev;
        }
        newGroups = newGroups.map(g => g.name === originalName ? groupData : g);
      } else {
        if (newGroups.some(g => g.name === newName)) {
          showAlert("保存失败：策略组名称已存在！");
          return prev;
        }
        newGroups.push(groupData);
      }
      if (originalName && originalName !== newName) {
        newGroups = newGroups.map(g => ({
          ...g, proxies: g.proxies?.map(pName => pName === originalName ? newName : pName) || []
        }));
      }
      showToast(`策略组 [${newName}] 已保存`);
      return { ...prev, 'proxy-groups': newGroups };
    });
    setEditingGroup(null);
  }, [showAlert, showToast]);

  const deleteGroup = useCallback((groupName) => {
    showConfirm(`确定要删除策略组 [${groupName}] 吗？\n(注意：规则 Rules 中对该组的引用可能需要您手动修改)`, () => {
      setConfig(prev => {
        const newGroups = prev['proxy-groups'].filter(g => g.name !== groupName);
        const cleanedGroups = newGroups.map(g => ({
          ...g, proxies: (g.proxies || []).filter(name => name !== groupName)
        }));
        return { ...prev, 'proxy-groups': cleanedGroups };
      });
      showToast(`策略组 [${groupName}] 已删除`);
    });
  }, [showConfirm, showToast]);

  const reorderGroups = useCallback((draggedIdx, targetIdx) => {
    setConfig(prev => {
      const newGroups = [...prev['proxy-groups']];
      const [item] = newGroups.splice(draggedIdx, 1);
      newGroups.splice(targetIdx, 0, item);
      return { ...prev, 'proxy-groups': newGroups };
    });
  }, []);

  const saveProvider = useCallback((originalName, name, data, targetName) => {
    if (!name) return showAlert("保存失败：规则集名称不能为空");
    setConfig(prev => {
      let newProviders = { ...prev['rule-providers'] };
      if (originalName && originalName !== name) delete newProviders[originalName];
      newProviders[name] = data;

      let newRules = [...prev.rules];
      if (originalName && originalName !== name) {
        newRules = newRules.map(r => {
          if (typeof r !== 'string') return r;
          return r.startsWith(`RULE-SET,${originalName},`) ? r.replace(`RULE-SET,${originalName},`, `RULE-SET,${name},`) : r;
        });
      }
      if (targetName) {
        const rulePrefix = `RULE-SET,${name},`;
        const existingIdx = newRules.findIndex(r => typeof r === 'string' && r.startsWith(rulePrefix));
        if (existingIdx !== -1) {
          const parts = newRules[existingIdx].split(',');
          parts[2] = targetName;
          newRules[existingIdx] = parts.join(',');
        } else {
          newRules.unshift(`RULE-SET,${name},${targetName}`);
        }
      }
      showToast(`规则集 [${name}] 已保存${targetName ? `，已绑定策略[${targetName}]` : ''}`);
      return { ...prev, 'rule-providers': newProviders, rules: newRules };
    });
    setEditingProvider(null);
  }, [showAlert, showToast]);

  const deleteProvider = useCallback((name) => {
    showConfirm(`确定要删除规则集 [${name}] 吗？\n(记得同步删除引用了该规则集的路由规则)`, () => {
      setConfig(prev => {
        let newProviders = { ...prev['rule-providers'] };
        delete newProviders[name];
        return { ...prev, 'rule-providers': newProviders };
      });
      showToast(`规则集 [${name}] 已删除`);
    });
  }, [showConfirm, showToast]);

  const saveRule = useCallback((originalIdx, ruleString, actionType) => {
    setConfig(prev => {
      let newRules = [...prev.rules];
      if (actionType === 'update') {
        newRules[originalIdx] = ruleString;
      } else if (actionType === 'top') {
        newRules.unshift(ruleString);
      } else if (actionType === 'bottom') {
        const matchIdx = newRules.findIndex(r => typeof r === 'string' && r.startsWith('MATCH,'));
        if (matchIdx !== -1) newRules.splice(matchIdx, 0, ruleString);
        else newRules.push(ruleString);
      }
      return { ...prev, rules: newRules };
    });
    setEditingRule(null);
    showToast("路由规则已保存");
  }, [showToast]);

  const deleteRule = useCallback((originalIdx) => {
    setConfig(prev => {
      let newRules = [...prev.rules];
      newRules.splice(originalIdx, 1);
      return { ...prev, rules: newRules };
    });
  }, []);

  const moveRuleToTop = useCallback((originalIdx) => {
    if (originalIdx === 0) return;
    setConfig(prev => {
      let newRules = [...prev.rules];
      const [item] = newRules.splice(originalIdx, 1);
      newRules.unshift(item);
      return { ...prev, rules: newRules };
    });
  }, []);

  const moveRuleToBottom = useCallback((originalIdx) => {
    setConfig(prev => {
      if (originalIdx === prev.rules.length - 1) return prev;
      let newRules = [...prev.rules];
      const [item] = newRules.splice(originalIdx, 1);
      const matchIdx = newRules.findIndex(r => typeof r === 'string' && r.startsWith('MATCH,'));
      if (matchIdx !== -1) newRules.splice(matchIdx, 0, item);
      else newRules.push(item);
      return { ...prev, rules: newRules };
    });
  }, []);

  const reorderRules = useCallback((draggedIdx, targetIdx) => {
    setConfig(prev => {
      let reordered = [...prev.rules];
      const [draggedItem] = reordered.splice(draggedIdx, 1);
      reordered.splice(targetIdx, 0, draggedItem);
      return { ...prev, rules: reordered };
    });
  }, []);

  const updateBasicConfig = useCallback((updates) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // 派生数据
  const allAvailableNodeNames = useMemo(() => [...config.proxies.map(p => p.name || 'Unknown'), ...config['proxy-groups'].map(g => g.name || 'Unknown')], [config.proxies, config['proxy-groups']]);
  const allTargetNames = useMemo(() => ['DIRECT', 'REJECT', ...allAvailableNodeNames], [allAvailableNodeNames]);
  const allProviderNames = useMemo(() => Object.keys(config['rule-providers'] || {}), [config['rule-providers']]);

  if (!yamlLoaded) return <div className="min-h-screen flex items-center justify-center text-slate-500">正在加载解析器...</div>;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans">
      {/* 状态与弹窗叠加层 (Simplified for brevity) */}
      {isParsing && <div className="fixed inset-0 bg-slate-100/70 dark:bg-slate-900/70 backdrop-blur-sm z-[200] flex flex-col items-center justify-center gap-4">正在解析配置...</div>}

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <Check className="w-5 h-5 text-green-400" /> {toast}
        </div>
      )}

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

      <div className="max-w-[1600px] w-full mx-auto flex flex-col md:flex-row h-screen relative">
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
            <TabButton active={activeTab === 'export'} onClick={() => { handleExportText(); setActiveTab('export'); }} icon={Download} label="导出配置" />
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-slate-100 dark:bg-slate-950">
          {activeTab === 'import' && <TabImport yamlText={yamlText} setYamlText={setYamlText} parseError={parseError} setParseError={setParseError} isParsing={isParsing} handleImportText={handleImportText} handleFileUpload={handleFileUpload} />}
          {activeTab === 'export' && <TabExport yamlText={yamlText} setYamlText={setYamlText} handleExportText={handleExportText} copyToClipboard={copyToClipboard} handleDownloadFile={handleDownloadFile} />}
          {activeTab === 'proxies' && <TabProxies proxies={config.proxies} setLinkModalVisible={setLinkModalVisible} setEditingProxy={setEditingProxy} deleteProxy={deleteProxy} />}
          {activeTab === 'groups' && <TabGroups groups={config['proxy-groups']} setEditingGroup={setEditingGroup} deleteGroup={deleteGroup} reorderGroups={reorderGroups} />}
          {activeTab === 'rules' && <TabRules providers={config['rule-providers']} rules={config.rules} setEditingProvider={setEditingProvider} deleteProvider={deleteProvider} setEditingRule={setEditingRule} deleteRule={deleteRule} moveRuleToTop={moveRuleToTop} moveRuleToBottom={moveRuleToBottom} reorderRules={reorderRules} />}
          {activeTab === 'basic' && <TabBasic config={config} updateBasicConfig={updateBasicConfig} />}
        </div>
      </div>

      {linkModalVisible && (
        <Modal title="通过链接批量导入节点" onClose={() => setLinkModalVisible(false)} onSave={handleImportLinks} saveText="解析并导入" widthClass="max-w-2xl">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">支持粘贴多行链接，自动识别常用的分享格式。</p>
          <textarea value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="vmess://...\ntrojan://...\nss://..." className="w-full h-48 font-mono text-sm p-4 border rounded-xl bg-slate-50 dark:bg-slate-950 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none custom-scrollbar whitespace-pre-wrap" />
        </Modal>
      )}
      {editingProxy && <ProxyEditorModal proxy={editingProxy.data} onClose={() => setEditingProxy(null)} onSave={(data) => saveProxy(editingProxy.originalName, data)} showAlert={showAlert} parseProxyLink={parseProxyLink} />}
      {editingGroup && <ProxyGroupEditorModal group={editingGroup.data} allAvailableNames={allAvailableNodeNames} onClose={() => setEditingGroup(null)} onSave={(data) => saveGroup(editingGroup.originalName, data)} showAlert={showAlert} />}
      {editingProvider && <RuleProviderEditorModal providerName={editingProvider.name} providerData={editingProvider.data} initialTarget={editingProvider.originalName ? (config.rules.find(r => typeof r === 'string' && r.startsWith(`RULE-SET,${editingProvider.originalName},`))?.split(',')[2] || '') : ''} allTargetNames={allTargetNames} onClose={() => setEditingProvider(null)} onSave={(name, data, targetName) => saveProvider(editingProvider.originalName, name, data, targetName)} showAlert={showAlert} />}
      {editingRule && <RuleEditorModal ruleData={editingRule.data} isNew={editingRule.idx === -1} allTargetNames={allTargetNames} allProviderNames={allProviderNames} onClose={() => setEditingRule(null)} onSave={(data, actionType) => saveRule(editingRule.idx, data, actionType)} showAlert={showAlert} />}
    </div>
  );
}
