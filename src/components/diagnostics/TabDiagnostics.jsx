import { useEffect, useMemo, useRef, useState } from 'react';
import { validateConfig } from '../../utils/validation';

const levels = { error: '错误', warning: '警告', info: '提示' };
const issueKey = issue => JSON.stringify([issue.level, issue.path, issue.message, issue.rule]);
const PAGE_SIZE = 50;

export default function TabDiagnostics({ config, target, onNavigate }) {
  const issues = useMemo(() => validateConfig(config, target), [config, target]);
  const listRef = useRef(null);
  const [pagination, setPagination] = useState({ issues: null, page: 0 });
  const pageCount = Math.max(1, Math.ceil(issues.length / PAGE_SIZE));
  const page = pagination.issues === issues ? Math.min(pagination.page, pageCount - 1) : 0;
  const visible = issues.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0; }, [issues, page]);
  const counts = issues.reduce((all, item) => ({ ...all, [item.level]: (all[item.level] || 0) + 1 }), {});
  return <div className="p-4 md:p-8 h-full min-h-0 flex flex-col gap-5 max-w-5xl mx-auto"><h2 className="text-2xl font-bold shrink-0">配置体检</h2>
    <p className="text-sm text-slate-500 shrink-0">检查字段、名称、引用、循环依赖及常见内核限制。静态检查不能替代路由器上的内核启动校验。</p>
    <p role="status" className="font-medium shrink-0">错误 {counts.error || 0} · 警告 {counts.warning || 0} · 提示 {counts.info || 0}</p>
    {/* Natural document flow keeps deleting results independent of row measurements. */}
    <div ref={listRef} role="list" aria-label="配置体检结果" data-testid="diagnostics-list" className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-xl ${issues.length ? 'border dark:border-slate-700' : ''}`}>
      {visible.map((issue, index) => <div key={JSON.stringify([issueKey(issue), page * PAGE_SIZE + index])} role="listitem" className="p-4 space-y-2 border-b last:border-b-0 dark:border-slate-700 bg-white dark:bg-slate-900 text-left [overflow-wrap:anywhere]">
      <p className="text-xs text-slate-500">{issue.subject || issue.path}</p>
      <p className={`text-sm font-medium ${issue.level === 'error' ? 'text-red-600' : issue.level === 'warning' ? 'text-amber-600' : 'text-slate-500'}`}>{levels[issue.level]} · {issue.message}</p>
      {issue.rule !== undefined && <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3"><p className="text-xs text-slate-500 mb-1">完整规则</p><code className="block text-xs whitespace-pre-wrap break-all text-slate-700 dark:text-slate-200">{issue.rule}</code></div>}
      <p className="text-xs font-mono text-slate-500">配置位置：{issue.path}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-blue-600 dark:text-blue-400">
        <button onClick={() => onNavigate(issue.tab, issue.path)} className="underline py-1">{issue.rule !== undefined ? '查看此规则' : '查看对应设置'}</button>
        {issue.related && <button onClick={() => onNavigate(issue.tab, issue.related.path)} className="underline py-1">{issue.related.label}</button>}
      </div>
      </div>)}
      {!issues.length && <p className="text-sm text-emerald-600">未发现配置问题。</p>}
    </div>
    {pageCount > 1 && <div className="flex items-center justify-between gap-2 text-xs shrink-0">
      <span className="text-slate-500">第 {page + 1} / {pageCount} 页 · 共 {issues.length} 项</span>
      <div className="flex gap-2">
        <button disabled={!page} onClick={() => setPagination({ issues, page: page - 1 })} className="px-3 py-2 border rounded-lg dark:border-slate-700 disabled:opacity-30">上一页</button>
        <button disabled={page === pageCount - 1} onClick={() => setPagination({ issues, page: page + 1 })} className="px-3 py-2 border rounded-lg dark:border-slate-700 disabled:opacity-30">下一页</button>
      </div>
    </div>}
  </div>;
}
