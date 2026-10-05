import React, { useEffect, useState } from 'react';
import { Download, Copy, AlertCircle } from 'lucide-react';
import { yamlAsync } from '../../utils/yamlAsync';
import { validateConfig } from '../../utils/validation';
import { copyText, downloadText } from '../../utils/clipboard';

export default function TabExport({ config, sourceDraft, setSourceDraft, target, showAlert, showToast, showConfirm }) {
  const [snapshot, setSnapshot] = useState({ config: null, text: '' });
  const [error, setError] = useState('');
  const [inspection, setInspection] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    yamlAsync('dump', config, controller.signal).then(text => { setSnapshot({ config, text }); setError(''); }).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [config]);
  const ready = snapshot.config === config;
  const stale = sourceDraft && ready && sourceDraft.baseText !== snapshot.text;
  const text = sourceDraft?.text ?? snapshot.text;
  const canExport = ready || !!sourceDraft;

  // Diagnostics are advisory and never part of the copy/download path.
  useEffect(() => {
    if (!canExport) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const current = sourceDraft ? await yamlAsync('parse', text, controller.signal) : config;
        const issues = validateConfig(current, target);
        if (!controller.signal.aborted) setInspection({ text, target, issues });
      } catch (e) {
        if (!controller.signal.aborted) setInspection({ text, target, issues: [{ level: 'error', message: `YAML 解析提示：${e.message}` }] });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [canExport, config, sourceDraft, target, text]);
  const issues = inspection?.text === text && inspection.target === target ? inspection.issues : [];

  const exportConfig = async (download = false) => {
    if (!canExport) return;
    try { if (download) downloadText(text); else await copyText(text); showToast(download ? '已下载 config.yaml' : '已复制 YAML，可粘贴到 OpenClash'); }
    catch (e) { showAlert(e.message); }
  };
  const resetSource = () => showConfirm('将用编辑器中的最新配置替换下方手动修改的 YAML。', () => setSourceDraft(null), '恢复编辑器配置');
  return <div className="p-4 md:p-8"><div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-6 space-y-4">
    <h2 className="text-2xl font-bold">导出配置</h2>
    <p className="text-sm text-slate-500">点击“复制 YAML”，即可将下方内容粘贴到 OpenClash 中使用。也可以下载为 config.yaml 文件。检查结果仅供参考，不影响复制或下载。</p>
    <div className="flex gap-2 flex-wrap">
      <button disabled={!canExport} onClick={() => exportConfig()} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-40"><Copy className="inline w-4 h-4 mr-1" />复制 YAML</button>
      <button disabled={!canExport} onClick={() => exportConfig(true)} className="px-4 py-2 rounded border disabled:opacity-40"><Download className="inline w-4 h-4 mr-1" />下载 YAML</button>
      {sourceDraft && <button disabled={!ready} onClick={resetSource} className="px-4 py-2 rounded border disabled:opacity-40">恢复编辑器配置</button>}
    </div>
    {error && <p role="status" className="text-sm text-amber-600"><AlertCircle className="inline w-4 h-4 mr-1" />生成 YAML 失败：{error}</p>}
    {issues.length > 0 && <details className="text-sm text-amber-600">
      <summary className="cursor-pointer" role="status">发现 {issues.length} 项配置提示，仅供参考，仍可直接复制或下载</summary>
      <ul className="mt-2 list-disc pl-5 space-y-1">{issues.slice(0, 5).map((issue, i) => <li key={i}>{issue.path ? `${issue.path}: ` : ''}{issue.message}</li>)}</ul>
      {issues.length > 5 && <p className="mt-2">此处仅显示前 5 项。</p>}
    </details>}
    <p className="text-xs text-slate-500">可直接修改下方 YAML，复制和下载会保留文本原样；这里的手动修改仅用于导出，不会同步到其他编辑页面。</p>
    {stale && <p role="status" className="text-sm text-amber-600">其他页面的配置已更新。下方仍保留你手动修改的 YAML，复制和下载以此为准；如需最新配置，请点击“恢复编辑器配置”。</p>}
    <textarea aria-label="配置源码" disabled={!canExport} value={canExport ? text : '正在生成 YAML…'} onChange={e => setSourceDraft(e.target.value === snapshot.text ? null : { text: e.target.value, baseText: sourceDraft?.baseText ?? snapshot.text })} className="w-full h-[55vh] font-mono text-sm p-4 border rounded-xl bg-slate-50 dark:bg-slate-950 dark:border-slate-800" spellCheck={false} />
    {stale && <details><summary className="cursor-pointer text-sm">查看编辑器中的最新配置</summary><pre className="mt-3 text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto">{snapshot.text}</pre></details>}
  </div></div>;
}
