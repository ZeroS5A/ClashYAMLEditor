import { useState, useRef, useEffect, useMemo, useDeferredValue } from 'react';
import Modal from '../common/Modal';
import VirtualList from '../common/VirtualList';
import { yamlAsync } from '../../utils/yamlAsync';
import { fetchText, mapConcurrent } from '../../utils/network';

export default function LinkImportModal({ existingProxies, onImport, onClose }) {
  const [step, setStep] = useState('input'), [text, setText] = useState('');
  const [items, setItems] = useState([]), [selected, setSelected] = useState(new Set());
  const [filter, setFilter] = useState(''), [errors, setErrors] = useState([]), [mode, setMode] = useState('update');
  const controllerRef = useRef(null), deferredFilter = useDeferredValue(filter);
  useEffect(() => () => controllerRef.current?.abort(), []);
  const existing = useMemo(() => new Map(existingProxies.map(p => [p.name, p])), [existingProxies]);
  const visible = useMemo(() => items.filter(item => !deferredFilter || (item.proxy?.name || '').toLowerCase().includes(deferredFilter.toLowerCase()) || (item.proxy?.server || '').toLowerCase().includes(deferredFilter.toLowerCase())), [items, deferredFilter]);
  const count = items.filter(item => item.proxy && selected.has(item.id)).length;
  const collisions = useMemo(() => {
    const frequencies = new Map();
    for (const item of items) if (item.proxy) frequencies.set(item.proxy.name, (frequencies.get(item.proxy.name) || 0) + 1);
    return items.filter(item => item.proxy && (existing.has(item.proxy.name) || frequencies.get(item.proxy.name) > 1)).length;
  }, [items, existing]);
  const cancel = () => { controllerRef.current?.abort(); setStep('input'); };
  const parse = async () => {
    controllerRef.current?.abort(); const controller = new AbortController(); controllerRef.current = controller;
    setStep('parsing'); setErrors([]);
    try {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean), urls = lines.filter(l => /^https?:\/\//i.test(l));
      const local = lines.filter(l => !/^https?:\/\//i.test(l)).join('\n');
      const results = await mapConcurrent(urls, async url => {
        try { const content = await fetchText(url, { signal: controller.signal }); return { data: await yamlAsync('subscription', content, controller.signal) }; }
        catch (e) { if (controller.signal.aborted) throw e; return { error: `${new URL(url).host}: ${e.message}` }; }
      });
      if (local) {
        try { results.push({ data: await yamlAsync('subscription', local, controller.signal) }); }
        catch (e) { if (controller.signal.aborted) throw e; results.push({ error: e.message }); }
      }
      if (controller.signal.aborted) return;
      const parsed = results.flatMap(result => result.data || []).map((item, id) => ({ ...item, id }));
      setItems(parsed); setSelected(new Set(parsed.filter(item => item.proxy).map(item => item.id)));
      setErrors(results.filter(r => r.error).map(r => r.error)); setStep('preview');
    } catch (e) { if (!controller.signal.aborted) { setErrors([e.message]); setStep('input'); } }
  };
  const toggle = id => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  return <Modal title="导入／更新节点" onClose={onClose} customFooter={<div className="p-4 border-t dark:border-slate-700 flex justify-between gap-3"><button onClick={onClose} className="px-4 py-2 border rounded">关闭</button>{step === 'preview' ? <div className="flex gap-2"><button onClick={() => setStep('input')} className="px-4 py-2 border rounded">返回输入</button><button disabled={!count} onClick={() => onImport(items.filter(item => item.proxy && selected.has(item.id)).map(item => item.proxy), mode)} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-40">导入全部已选 {count} 条</button></div> : step === 'parsing' ? <button onClick={cancel} className="px-4 py-2 border rounded">取消请求</button> : <button disabled={!text.trim()} onClick={parse} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-40">解析并预览</button>}</div>}>
    <div className="space-y-4"><p className="text-sm text-slate-500">支持多行分享链接、Base64 节点列表、Clash YAML 或 HTTP(S) 订阅。订阅更新只修改静态节点，保留自定义策略组、规则和已有高级字段；原生订阅源请使用代理集合。</p>
      {step === 'input' && <textarea aria-label="节点或订阅内容" value={text} onChange={e => setText(e.target.value)} className="w-full h-56 p-4 border rounded font-mono text-sm bg-transparent" />}
      {step === 'parsing' && <p role="status">正在获取订阅并解析，可随时取消…</p>}
      {!!errors.length && <p role="alert" className="text-red-500 text-sm whitespace-pre-wrap">{errors.join('\n')}</p>}
      {step === 'preview' && <>
        <p className="text-sm">成功 {items.filter(i => i.proxy).length} · 失败 {items.filter(i => !i.proxy).length} · 名称冲突 {collisions} · 全部已选 {count}（含搜索隐藏项）</p>
        <label className="text-sm block">同名处理<select value={mode} onChange={e => setMode(e.target.value)} className="ml-3 p-2 border rounded bg-transparent"><option value="update">更新已有节点，保留额外字段</option><option value="keep">保留双方，自动添加名称后缀</option><option value="new">仅添加新名称</option></select></label>
        <div className="flex flex-wrap gap-2"><button onClick={() => setSelected(new Set(visible.filter(i => i.proxy).map(i => i.id)))} className="px-3 py-1 border rounded text-sm">选择搜索结果</button><button onClick={() => setSelected(new Set())} className="px-3 py-1 border rounded text-sm">全不选</button><input aria-label="搜索导入预览" value={filter} onChange={e => setFilter(e.target.value)} placeholder="搜索名称／服务器" className="flex-1 p-2 border rounded bg-transparent text-sm" /></div>
        <VirtualList items={visible} height={360} rowHeight={88} resetKey={deferredFilter} itemKey={i => i.id} renderItem={item => <div className="flex items-center gap-3 p-3 border-b dark:border-slate-700 h-full"><input type="checkbox" aria-label={item.proxy ? `选择 ${item.proxy.name}` : '无效节点'} checked={selected.has(item.id)} disabled={!item.proxy} onChange={() => toggle(item.id)} />{item.proxy ? <div className="min-w-0 flex-1"><input aria-label="预览节点名称" value={item.proxy.name} onChange={e => setItems(prev => prev.map(i => i.id === item.id ? { ...i, proxy: { ...i.proxy, name: e.target.value } } : i))} className="w-full bg-transparent text-sm font-medium" /><p className="text-xs text-slate-500 truncate">{item.proxy.type} · {item.proxy.server}:{item.proxy.port} · {existing.has(item.proxy.name) ? '更新' : '新增'}</p></div> : <span className="text-red-500 text-xs">{item.error}</span>}</div>} />
      </>}
    </div>
  </Modal>;
}
