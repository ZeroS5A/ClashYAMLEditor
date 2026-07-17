import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileJson, AlertCircle, Layers } from 'lucide-react';
import { DEFAULT_EMPTY_CONFIG } from '../constants/templates';
import SubscriptionConverterModal from './SubscriptionConverterModal';

const TabImport = ({ yamlText, setYamlText, parseError, setParseError, config, setConfig, showAlert, showToast, setActiveTab }) => {
  const fileInputRef = useRef(null);
  const [isParsing, setIsParsing] = useState(false);
  const [converterModalVisible, setConverterModalVisible] = useState(false);

  // ---- YAML 解析 ----
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
  }, [setConfig, setParseError, showToast, setActiveTab]);

  const handleImportText = useCallback(() => {
    applyYamlTextAsync(yamlText);
  }, [applyYamlTextAsync, yamlText]);

  // ---- 文件上传 ----
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

  // ---- 订阅转换 ----
  const handleConvertSubscription = useCallback(async (url) => {
    setIsParsing(true);
    try {
      const response = await fetch(url);
      const text = await response.text();
      setYamlText(text);
      applyYamlTextAsync(text);
      setConverterModalVisible(false);
    } catch (e) {
      showAlert("转换失败，请检查链接或网络状态。");
    } finally {
      setIsParsing(false);
    }
  }, [applyYamlTextAsync, setYamlText, showAlert]);

  return (
    <div className="p-4 md:p-8">
      {/* ---- 全屏加载遮罩 ---- */}
      {isParsing && (
        <div className="fixed inset-0 bg-slate-100/70 dark:bg-slate-900/70 backdrop-blur-sm z-[200] flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-lg font-bold text-slate-800 dark:text-white">正在解析配置，请稍候...</p>
        </div>
      )}

      {/* ---- 订阅转换弹窗 ---- */}
      {converterModalVisible && (
        <SubscriptionConverterModal
          onClose={() => setConverterModalVisible(false)}
          onConvert={handleConvertSubscription}
          showAlert={showAlert}
        />
      )}

      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-sm border dark:border-slate-800 p-6 flex flex-col h-full md:h-auto">
        <h2 className="text-2xl font-bold mb-4 flex items-center justify-between">
          解析配置
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setConverterModalVisible(true)} className="text-sm px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 rounded-lg flex items-center gap-2 transition-colors">
              <Layers className="w-4 h-4" /> 通过订阅转换
            </button>
            <input type="file" accept=".yaml,.yml" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="text-sm px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-lg flex items-center gap-2 transition-colors">
              <Upload className="w-4 h-4" /> 上传 YAML 文件
            </button>
          </div>
        </h2>

        <textarea value={yamlText} onChange={(e) => setYamlText(e.target.value)} placeholder="在此粘贴你的 YAML 内容..." className="w-full h-[60vh] font-mono text-sm p-4 border rounded-xl bg-slate-50 dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 outline-none custom-scrollbar whitespace-pre" />
        {parseError && (
          <div className="mt-4 p-4 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p className="text-sm font-medium">{parseError}</p>
          </div>
        )}
        <button onClick={handleImportText} disabled={isParsing} className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors shadow-md shadow-blue-500/20 flex items-center justify-center gap-2">
          <FileJson className="w-5 h-5" /> {isParsing ? '正在加速解析...' : '解析文本到可视化界面'}
        </button>
      </div>
    </div>
  );
};

export default TabImport;
