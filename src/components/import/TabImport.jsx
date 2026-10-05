import React, { useState, useRef, useEffect } from 'react';
import { Upload, AlertCircle, Layers } from 'lucide-react';
import SubscriptionConverterModal from './SubscriptionConverterModal';
import { yamlAsync } from '../../utils/yamlAsync';
import { fetchText } from '../../utils/network';
import { MAX_TEXT_BYTES } from '../../utils/yaml';

export default function TabImport({ yamlText, setYamlText, parseError, setParseError, setConfig, showAlert, showToast, showConfirm, setActiveTab, sourceDraft, setSourceDraft, target }) {
  const fileInputRef = useRef(null), controllerRef = useRef(null);
  const [isParsing, setIsParsing] = useState(false), [converterModalVisible, setConverterModalVisible] = useState(false);
  useEffect(() => () => controllerRef.current?.abort(), []);
  const importContent = async (getContent) => {
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    setIsParsing(true); setParseError('');
    try {
      const text = await getContent(controller.signal);
      if (controller.signal.aborted) return;
      setYamlText(text);
      const config = await yamlAsync('parse', text, controller.signal);
      if (controller.signal.aborted) return;
      const commit = () => {
        if (controller.signal.aborted) return;
        setConfig(config); setSourceDraft(null);
        setConverterModalVisible(false); showToast('配置已导入，请查看配置体检结果'); setActiveTab('diagnostics');
      };
      if (sourceDraft) showConfirm('新配置已解析。导入会替换导出页中手动修改的 YAML，请确认已复制或下载需要保留的内容。', commit, '替换配置');
      else commit();
    } catch (e) { if (e.name !== 'AbortError') setParseError(e.message); }
    finally { if (controllerRef.current === controller) setIsParsing(false); }
  };
  const handleFileUpload = e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    if (file.size > MAX_TEXT_BYTES) return setParseError('文件超过 20 MiB，请拆分规则集');
    importContent(() => file.text());
  };
  return <div className="p-4 md:p-8">
    {converterModalVisible && <SubscriptionConverterModal onClose={() => setConverterModalVisible(false)} onConvert={url => importContent(signal => fetchText(url, { signal }))} showAlert={showAlert} defaultTarget={target.core === 'clash' ? 'clash' : 'clashmeta'} busy={isParsing} />}
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-6 space-y-4">
      <h2 className="text-2xl font-bold">导入配置</h2>
      <p className="text-sm text-slate-500">本地解析 YAML，结构错误会阻止导入并保留原配置。导入后请核对内核类别及体检结果。</p>
      <div className="flex gap-2 flex-wrap">
        <button disabled={isParsing} onClick={() => setConverterModalVisible(true)} className="text-sm px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg"><Layers className="inline w-4 h-4 mr-1" />订阅转换</button>
        <input type="file" accept=".yaml,.yml" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
        <button disabled={isParsing} onClick={() => fileInputRef.current?.click()} className="text-sm px-4 py-2 bg-blue-50 text-blue-600 rounded-lg"><Upload className="inline w-4 h-4 mr-1" />上传 YAML 文件</button>
      </div>
      <textarea aria-label="导入 YAML" value={yamlText} onChange={e => setYamlText(e.target.value)} className="w-full h-[55vh] font-mono text-sm p-4 border rounded-xl bg-slate-50 dark:bg-slate-950 dark:border-slate-800" spellCheck={false} />
      {parseError && <p role="alert" className="whitespace-pre-wrap text-sm text-red-600"><AlertCircle className="inline w-4 h-4 mr-1" />{parseError}</p>}
      <div className="flex gap-3"><button disabled={isParsing} onClick={() => importContent(() => yamlText)} className="flex-1 py-3 bg-blue-600 text-white rounded-xl disabled:opacity-40">{isParsing ? '正在获取／解析…' : '解析并导入'}</button>{isParsing && <button onClick={() => { controllerRef.current?.abort(); setIsParsing(false); }} className="px-4 border rounded-xl">取消</button>}</div>
    </div>
  </div>;
}
