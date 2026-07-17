import React, { useState, useCallback, useRef } from 'react';
import { Server, Link as LinkIcon, Plus, Edit, Trash2, Trash, Activity, Share2, Copy, Check, Zap, AlertCircle, X } from 'lucide-react';
import ScrollingText from './ScrollingText';
import Modal from './Modal';
import ProxyEditorModal from './ProxyEditorModal';
import { parseProxyLink, fetchSubscriptionContent } from '../utils/parser';
import { generateShareLink, testProxyLatency } from '../utils/shareLink';

const TabProxies = ({ config, setConfig, showAlert, showConfirm, showToast }) => {
  const proxies = config.proxies;
  const controllerUrl = config['external-controller'] || '127.0.0.1:9090';

  // ---- 弹窗状态 ----
  const [editingProxy, setEditingProxy] = useState(null);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [isImportingLinks, setIsImportingLinks] = useState(false);

  // ---- 连通性测试状态 ----
  const [testResults, setTestResults] = useState({});     // { proxyName: { delay, error } }
  const [isTesting, setIsTesting] = useState(false);
  const [testProgress, setTestProgress] = useState({ done: 0, total: 0 });
  const abortRef = useRef(null);

  // ---- 导出分享状态 ----
  const [shareTarget, setShareTarget] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [shareError, setShareError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareQrVisible, setShareQrVisible] = useState(false);

  // ================================================================
  //  节点 CRUD（同之前）
  // ================================================================

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
  }, [setConfig, showAlert, showToast]);

  const deleteProxy = useCallback((proxyName) => {
    showConfirm(`确定要彻底删除节点 [${proxyName}] 吗？`, () => {
      setConfig(prev => {
        const newProxies = prev.proxies.filter(p => p.name !== proxyName);
        const newGroups = prev['proxy-groups'].map(g => ({
          ...g, proxies: (g.proxies || []).filter(name => name !== proxyName)
        }));
        return { ...prev, proxies: newProxies, 'proxy-groups': newGroups };
      });
      // 清理测试结果
      setTestResults(prev => { const r = { ...prev }; delete r[proxyName]; return r; });
      showToast(`节点 [${proxyName}] 已删除`);
    });
  }, [setConfig, showConfirm, showToast]);

  const handleClearAllProxies = useCallback(() => {
    if (proxies.length === 0) { showAlert("当前没有任何节点，无需清空。"); return; }
    showConfirm(
      `确定要清空全部 ${proxies.length} 个节点吗？\n所有节点将被删除，策略组中引用这些节点的条目也将被清理。\n此操作不可撤销！`,
      () => {
        setConfig(prev => {
          const newGroups = prev['proxy-groups'].map(g => ({
            ...g, proxies: (g.proxies || []).filter(name => !prev.proxies.some(p => p.name === name))
          }));
          return { ...prev, proxies: [], 'proxy-groups': newGroups };
        });
        setTestResults({});
        showToast(`已清空全部节点`);
      }, "清空全部节点"
    );
  }, [proxies, setConfig, showAlert, showConfirm, showToast]);

  // ================================================================
  //  链接批量导入（含三级判重）
  // ================================================================

  const handleImportLinks = useCallback(async () => {
    const lines = linkText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;
    setIsImportingLinks(true);
    let allProxyLinks = [];
    const subUrls = [], directLinks = [];
    lines.forEach(line => { (/^https?:\/\//i.test(line) ? subUrls : directLinks).push(line); });
    const subErrors = [];
    for (const url of subUrls) {
      try { const links = await fetchSubscriptionContent(url); allProxyLinks.push(...links); }
      catch (e) { console.warn("订阅获取失败:", url, e); subErrors.push(url); }
    }
    allProxyLinks.push(...directLinks);
    const parsedProxies = [], parseErrors = [];
    allProxyLinks.forEach(link => {
      try { const proxy = parseProxyLink(link); Object.keys(proxy).forEach(k => proxy[k] === undefined && delete proxy[k]); parsedProxies.push(proxy); }
      catch (e) { parseErrors.push({ link, error: e.message }); }
    });

    if (parsedProxies.length > 0) {
      let addedCount = 0, updatedCount = 0, renamedCount = 0, batchDedupCount = 0;
      const getCredential = (p) => p.uuid || p.password || '';
      const normalizePort = (p) => { const port = p.port; return port === undefined || port === null ? '' : String(port); };
      const findExistingIndex = (proxy, proxyList) => {
        const cred = getCredential(proxy), port = normalizePort(proxy);
        if (cred && port) { const idx = proxyList.findIndex(p => p.type === proxy.type && p.server === proxy.server && normalizePort(p) === port && getCredential(p) === cred); if (idx !== -1) return { idx, level: 'credential' }; }
        if (port) { const idx = proxyList.findIndex(p => p.type === proxy.type && p.server === proxy.server && normalizePort(p) === port); if (idx !== -1) return { idx, level: 'endpoint' }; }
        if (proxy.name) { const idx = proxyList.findIndex(p => p.name === proxy.name); if (idx !== -1) return { idx, level: 'name' }; }
        return null;
      };

      setConfig(prev => {
        let newProxies = [...prev.proxies];
        const dedupedParsed = [];
        parsedProxies.forEach(proxy => { const match = findExistingIndex(proxy, dedupedParsed); if (match && match.level === 'credential') { dedupedParsed[match.idx] = proxy; batchDedupCount++; } else { dedupedParsed.push(proxy); } });
        dedupedParsed.forEach(proxy => {
          const match = findExistingIndex(proxy, newProxies);
          if (match) {
            if (match.level === 'credential' || match.level === 'endpoint') { if (newProxies[match.idx].name !== proxy.name) renamedCount++; newProxies[match.idx] = proxy; updatedCount++; }
            else if (match.level === 'name') { proxy.name = proxy.name + ` (${proxy.server}:${normalizePort(proxy)})`; newProxies.push(proxy); addedCount++; }
          } else { newProxies.push(proxy); addedCount++; }
        });
        return { ...prev, proxies: newProxies };
      });

      let msg = `成功解析 ${parsedProxies.length} 条节点`;
      const details = [];
      if (addedCount > 0) details.push(`新增 ${addedCount}`);
      if (updatedCount > 0) { let d = `更新 ${updatedCount}`; if (renamedCount > 0) d += `（其中 ${renamedCount} 个名称已同步更新）`; details.push(d); }
      if (batchDedupCount > 0) details.push(`批次内去重 ${batchDedupCount}`);
      if (details.length > 0) msg += `（${details.join('，')}）`;
      if (subErrors.length > 0) msg += `，${subErrors.length} 个订阅链接获取失败`;
      if (parseErrors.length > 0) msg += `，${parseErrors.length} 条链接解析失败`;
      showToast(msg);
      setLinkModalVisible(false); setLinkText('');
    } else {
      let msg = "未能成功解析任何节点。请检查链接格式。";
      if (subErrors.length > 0 && subUrls.length > 0) msg = `所有订阅链接获取失败（共 ${subErrors.length} 个），请检查网络或链接是否正确。`;
      showAlert(msg);
    }
    setIsImportingLinks(false);
  }, [linkText, setConfig, showAlert, showToast]);

  // ================================================================
  //  连通性测试
  // ================================================================

  const handleStartTest = useCallback(async () => {
    if (!controllerUrl) {
      showAlert("未设置 external-controller，请在「基础设置」中先配置控制器地址（如 127.0.0.1:9090）");
      return;
    }
    if (proxies.length === 0) { showAlert("当前没有节点可供测试"); return; }

    setIsTesting(true);
    setTestResults({});
    setTestProgress({ done: 0, total: proxies.length });

    const controller = new AbortController();
    abortRef.current = controller;

    const results = {};
    for (let i = 0; i < proxies.length; i++) {
      if (controller.signal.aborted) break;
      const proxy = proxies[i];
      const result = await testProxyLatency(proxy.name, controllerUrl);
      results[proxy.name] = result;
      setTestResults({ ...results });
      setTestProgress({ done: i + 1, total: proxies.length });
    }

    abortRef.current = null;
    setIsTesting(false);
    const successCount = Object.values(results).filter(r => r.success).length;
    showToast(`测试完成：${successCount}/${proxies.length} 个节点可达`);
  }, [proxies, controllerUrl, showAlert, showToast]);

  const handleStopTest = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setIsTesting(false);
    showToast("测试已中止");
  }, [showToast]);

  // 延迟色码
  const getDelayColor = (delay) => {
    if (!delay) return 'text-slate-400';
    if (delay < 200) return 'text-emerald-500';
    if (delay < 500) return 'text-amber-500';
    if (delay < 1000) return 'text-orange-500';
    return 'text-red-500';
  };
  const getDelayBadge = (name) => {
    const r = testResults[name];
    if (!r) return null;
    if (!r.success) return <span className="text-[10px] text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded" title={r.error}>失败</span>;
    const cls = getDelayColor(r.delay);
    return <span className={`text-[10px] font-bold ${cls} bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded`}>{r.delay}ms</span>;
  };

  // ================================================================
  //  节点导出/分享
  // ================================================================

  const handleOpenShare = useCallback((proxy) => {
    setShareTarget(proxy);
    setLinkCopied(false);
    setShareQrVisible(false);
    try {
      const link = generateShareLink(proxy);
      setShareLink(link);
      setShareError('');
    } catch (e) {
      setShareLink('');
      setShareError(e.message);
    }
  }, []);

  const handleCopyShareLink = useCallback(() => {
    if (!shareLink) return;
    try {
      navigator.clipboard.writeText(shareLink).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }).catch(() => {
        // 降级方案
        const ta = document.createElement('textarea');
        ta.value = shareLink; ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      });
    } catch (_) { showAlert("复制失败"); }
  }, [shareLink, showAlert]);

  // ================================================================
  //  JSX
  // ================================================================

  return (
    <div className="pb-8">
      {/* ---- 链接导入弹窗 ---- */}
      {linkModalVisible && (
        <Modal
          title="通过链接批量导入/更新节点"
          onClose={() => { if (!isImportingLinks) setLinkModalVisible(false); }}
          onSave={isImportingLinks ? undefined : handleImportLinks}
          saveText={isImportingLinks ? "获取中..." : "解析并导入"}
          widthClass="max-w-2xl"
        >
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">支持粘贴多行节点链接，自动识别常用的分享格式。</p>
          <p className="text-xs text-blue-500 dark:text-blue-400 mb-4">也支持粘贴 http/https 订阅链接，自动获取并解析批量节点。</p>
          {isImportingLinks && (
            <div className="flex items-center gap-2 mb-3 text-sm text-blue-600 dark:text-blue-400">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              正在获取订阅内容...
            </div>
          )}
          <textarea value={linkText} onChange={(e) => setLinkText(e.target.value)}
            placeholder={"vmess://...\ntrojan://...\nss://...\n\nhttps://example.com/sub"}
            className="w-full h-48 font-mono text-sm p-4 border rounded-xl bg-slate-50 dark:bg-slate-950 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none custom-scrollbar whitespace-pre-wrap disabled:opacity-50"
            disabled={isImportingLinks} />
        </Modal>
      )}

      {/* ---- 节点编辑器弹窗 ---- */}
      {editingProxy && (
        <ProxyEditorModal proxy={editingProxy.data}
          onClose={() => setEditingProxy(null)}
          onSave={(data) => saveProxy(editingProxy.originalName, data)}
          showAlert={showAlert} parseProxyLink={parseProxyLink} />
      )}

      {/* ---- 导出分享弹窗 ---- */}
      {shareTarget && (
        <Modal
          title={`导出节点: ${shareTarget.name}`}
          onClose={() => setShareTarget(null)}
          widthClass="max-w-lg"
          customFooter={
            <div className="p-5 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={handleCopyShareLink}
                disabled={!!shareError}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  linkCopied
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                } disabled:opacity-40`}
              >
                {linkCopied ? <><Check className="w-4 h-4" /> 已复制</> : <><Copy className="w-4 h-4" /> 复制链接</>}
              </button>
              {!shareError && (
                <button
                  onClick={() => setShareQrVisible(!shareQrVisible)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> {shareQrVisible ? '隐藏二维码' : '生成二维码'}
                </button>
              )}
              <button
                onClick={() => setShareTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                关闭
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">下方为该节点的分享链接，可复制发送给他人导入。</p>
            {shareError ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {shareError}
              </div>
            ) : (
              <>
                <pre className="font-mono text-xs bg-slate-50 dark:bg-slate-950 border dark:border-slate-700 p-4 rounded-xl whitespace-pre-wrap break-all max-h-40 overflow-y-auto">{shareLink}</pre>

                {/* 二维码 */}
                {shareQrVisible && (
                  <div className="flex flex-col items-center gap-3 p-4 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareLink)}`}
                      alt="节点分享二维码"
                      className="w-[220px] h-[220px] rounded-lg"
                      onError={(e) => { e.target.style.display = 'none'; showAlert('二维码加载失败，请检查网络连接'); }}
                    />
                    <span className="text-xs text-slate-400">扫描二维码即可导入节点</span>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ---- 页面头部 ---- */}
      <div className="sticky top-0 z-20 bg-slate-100/90 dark:bg-slate-950/90 backdrop-blur-md px-4 md:px-8 py-4 mb-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Server className="w-6 h-6 text-blue-500" /> 节点管理 ({proxies.length})
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setEditingProxy({ originalName: null, data: { name: '新节点', type: 'ss', server: '1.2.3.4', port: 443 } })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> 添加单个节点
          </button>
          
          <button onClick={() => setLinkModalVisible(true)}
            className="px-4 py-2 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 dark:bg-slate-900 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 transition-colors">
            <LinkIcon className="w-4 h-4" /> 通过链接导入/更新节点
          </button>

          {/* 连通性测试按钮 */}
          {isTesting ? (
            <button onClick={handleStopTest}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-2 transition-colors">
              <X className="w-4 h-4" /> 停止测试 ({testProgress.done}/{testProgress.total})
            </button>
          ) : (
            <button onClick={handleStartTest}
              className="px-4 py-2 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:bg-slate-900 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30 rounded-lg flex items-center gap-2 transition-colors">
              <Zap className="w-4 h-4" /> 连通性测试
            </button>
          )}

          <button onClick={handleClearAllProxies}
            className="px-4 py-2 bg-white border border-red-200 text-red-500 hover:bg-red-50 dark:bg-slate-900 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 rounded-lg flex items-center gap-2 transition-colors">
            <Trash className="w-4 h-4" /> 清空全部节点
          </button>
        </div>
      </div>

      {/* ---- 测试进度条 ---- */}
      {isTesting && (
        <div className="px-4 md:px-8 mb-4">
          <div className="flex items-center gap-3 text-sm text-slate-500 mb-2">
            <Activity className="w-4 h-4 animate-pulse text-amber-500" />
            正在测试节点延迟（通过 Clash REST API）...
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${testProgress.total > 0 ? (testProgress.done / testProgress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* ---- 节点卡片网格 ---- */}
      <div className="px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {proxies.map((proxy, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-hidden mb-4">
              <div className="flex items-center gap-2 mb-2">
                <ScrollingText text={String(proxy.name)} className="font-bold text-lg text-slate-800 dark:text-white" />
                {getDelayBadge(proxy.name)}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-mono truncate" title={`${String(proxy.server)}:${String(proxy.port)}`}>
                {String(proxy.server)}:{String(proxy.port)}
              </p>
            </div>
            <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/60">
              <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-md uppercase shrink-0">
                {String(proxy.type)}
              </span>
              <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                {/* 分享按钮 */}
                <button onClick={() => handleOpenShare(proxy)}
                  className="p-1.5 text-slate-400 hover:text-emerald-500 bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors" title="导出分享链接">
                  <Share2 className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingProxy({ originalName: proxy.name, data: JSON.parse(JSON.stringify(proxy)) })}
                  className="p-1.5 text-slate-400 hover:text-blue-500 bg-slate-50 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors" title="编辑">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => deleteProxy(proxy.name)}
                  className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors" title="删除">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {proxies.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed dark:border-slate-800 rounded-2xl">
            暂无节点，请添加、粘贴链接或导入配置
          </div>
        )}
      </div>
    </div>
  );
};

export default TabProxies;
