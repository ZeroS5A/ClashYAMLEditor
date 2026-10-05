import { Share2, Server, Copy, FileCode2, Link, QrCode, AlertCircle } from 'lucide-react';
import Modal from '../common/Modal';
import LocalQrCode from '../common/LocalQrCode';
import { shareLinkWarnings } from '../../utils/shareLink';
import { dumpYaml } from '../../utils/yaml';

export default function ProxyShareModal({ share, onClose, onCopy }) {
  const { proxy, link, error } = share;
  const warnings = shareLinkWarnings(proxy);
  return <Modal title="分享节点" subtitle="复制链接或扫码导入到其他客户端" icon={Share2} onClose={onClose} widthClass="max-w-4xl" customFooter={
    <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0">
      <button type="button" onClick={() => onCopy(dumpYaml({ proxies: [proxy] }))} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><FileCode2 className="w-4 h-4 shrink-0" />复制完整 YAML 节点片段</button>
      {!error && <button type="button" onClick={() => onCopy(link)} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm shadow-blue-600/20 transition-colors"><Copy className="w-4 h-4" />复制分享链接</button>}
    </div>
  }>
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/20 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl p-3 bg-white/80 dark:bg-slate-900/70 text-blue-600 dark:text-blue-400 shrink-0"><Server className="w-5 h-5" /></div>
          <div className="min-w-0 space-y-2">
            <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">{proxy.type}</span>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white break-all">{proxy.name}</h3>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 break-all">{proxy.server}:{proxy.port}</p>
          </div>
        </div>
      </div>
      {warnings.length > 0 && <div className="flex gap-2.5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><div className="min-w-0 text-xs leading-relaxed break-words"><p className="font-semibold mb-1">部分字段需要通过 YAML 分享</p><p>分享链接可能丢失：{warnings.join('、')}。复制完整 YAML 节点片段可保留这些设置。</p></div></div>}
      {error ? <div role="alert" className="flex items-start gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><p className="break-words">{error}</p></div> :
        <div className="grid sm:grid-cols-[minmax(0,1fr)_256px] gap-4 items-start">
          <section className="min-w-0 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800"><Link className="w-4 h-4 text-blue-500" /><h3 className="text-sm font-semibold">分享链接</h3><span className="ml-auto text-[11px] text-slate-400">{proxy.type}://</span></div>
            <pre aria-label="节点分享链接" className="p-4 bg-slate-50 dark:bg-slate-950/50 text-xs leading-6 font-mono text-slate-600 dark:text-slate-300 break-all whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar">{link}</pre>
          </section>
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col items-center bg-slate-50/60 dark:bg-slate-950/30">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><QrCode className="w-4 h-4 text-blue-500" />扫码导入</h3>
            <div className="bg-white rounded-xl p-0.5 shadow-sm border border-slate-100"><LocalQrCode value={link} /></div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">二维码在本地生成</p>
          </section>
        </div>}
      <p className="text-xs text-slate-400 dark:text-slate-500">分享链接和二维码包含节点凭证，请妥善分享。</p>
    </div>
  </Modal>;
}
