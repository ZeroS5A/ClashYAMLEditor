import React, { useState, useCallback, useEffect } from 'react';
import { Server, Link as LinkIcon, Plus, Edit, Trash2, Trash, Share2, Copy, Check, AlertCircle, CheckSquare, X } from 'lucide-react';
import Modal from './Modal';
import ScrollingText from './ScrollingText';
import LocalQrCode from './LocalQrCode';
import ProxyEditorModal from './ProxyEditorModal';
import LinkImportModal from './LinkImportModal';
import { parseProxyLink } from '../utils/parser';
import { generateShareLink } from '../utils/shareLink';

const TabProxies = ({ config, setConfig, showAlert, showConfirm, showToast }) => {
  const proxies = config.proxies;

  // ---- 弹窗状态 ----
  const [editingProxy, setEditingProxy] = useState(null);
  const [linkModalVisible, setLinkModalVisible] = useState(false);

  // ---- 导出分享状态 ----
  const [shareTarget, setShareTarget] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [shareError, setShareError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareQrVisible, setShareQrVisible] = useState(false);

  // ---- 批量选择/删除状态 ----
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNames, setSelectedNames] = useState(() => new Set());
  const selectedCount = selectedNames.size;
  const allSelected = proxies.length > 0 && selectedCount === proxies.length;

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
        showToast(`已清空全部节点`);
      }, "清空全部节点"
    );
  }, [proxies, setConfig, showAlert, showConfirm, showToast]);

  // ================================================================
  //  批量选择删除
  // ================================================================

  // 外部改动（导入 / 清空 / 重命名）后，丢弃已不存在的选择
  useEffect(() => {
    setSelectedNames(prev => {
      if (prev.size === 0) return prev;
      const validNames = new Set(proxies.map(p => p.name));
      const next = new Set([...prev].filter(name => validNames.has(name)));
      return next.size === prev.size ? prev : next;
    });
  }, [proxies]);

  // 节点被全部删除后，自动退出多选模式
  useEffect(() => {
    if (selectionMode && proxies.length === 0) setSelectionMode(false);
  }, [selectionMode, proxies.length]);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      if (prev) setSelectedNames(new Set()); // 退出多选时清空已选
      return !prev;
    });
  }, []);

  const toggleProxySelected = useCallback((proxyName) => {
    setSelectedNames(prev => {
      const next = new Set(prev);
      if (next.has(proxyName)) next.delete(proxyName);
      else next.add(proxyName);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedNames(prev =>
      (proxies.length > 0 && prev.size === proxies.length)
        ? new Set()
        : new Set(proxies.map(p => p.name))
    );
  }, [proxies]);

  const handleDeleteSelected = useCallback(() => {
    const names = proxies.filter(p => selectedNames.has(p.name)).map(p => p.name);
    if (names.length === 0) { showAlert("请先勾选要删除的节点。"); return; }

    const nameSet = new Set(names);
    const preview = names.slice(0, 5).map(n => `· ${n}`).join('\n');
    const more = names.length > 5 ? `\n… 等共 ${names.length} 个节点` : '';

    showConfirm(
      `确定要删除选中的 ${names.length} 个节点吗？\n${preview}${more}\n策略组中引用这些节点的条目也将被清理。\n此操作不可撤销！`,
      () => {
        setConfig(prev => {
          const newProxies = prev.proxies.filter(p => !nameSet.has(p.name));
          const newGroups = prev['proxy-groups'].map(g => ({
            ...g, proxies: (g.proxies || []).filter(name => !nameSet.has(name))
          }));
          return { ...prev, proxies: newProxies, 'proxy-groups': newGroups };
        });
        setSelectedNames(new Set());
        showToast(`已删除 ${names.length} 个节点`);
      },
      `删除选中的 ${names.length} 个节点`
    );
  }, [proxies, selectedNames, setConfig, showAlert, showConfirm, showToast]);

  // ================================================================
  //  链接批量导入（仅按名称匹配：同名更新，不同名新增）
  // ================================================================

  const handleImportLinks = useCallback((proxiesToImport) => {
    let added = 0, updated = 0;

    setConfig(prev => {
      let newProxies = [...prev.proxies];

      proxiesToImport.forEach(proxy => {
        const { _status, _oldName, ...cleanProxy } = proxy;
        const idx = newProxies.findIndex(p => p.name === cleanProxy.name);
        if (idx !== -1) {
          newProxies[idx] = cleanProxy;
          updated++;
        } else {
          newProxies.push(cleanProxy);
          added++;
        }
      });

      return { ...prev, proxies: newProxies };
    });

    showToast(`已导入 ${proxiesToImport.length} 条节点（新增 ${added}，更新 ${updated}）`);
    setLinkModalVisible(false);
  }, [setConfig, showToast]);

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
    } catch { showAlert("复制失败"); }
  }, [shareLink, showAlert]);

  // ================================================================
  //  JSX
  // ================================================================

  return (
    <div className="pb-8">
      {/* ---- 链接导入弹窗 ---- */}
      {linkModalVisible && (
        <LinkImportModal
          existingProxies={proxies}
          onImport={handleImportLinks}
          onClose={() => setLinkModalVisible(false)}
        />
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

                {/* 二维码（本地生成，不经过任何第三方接口） */}
                {shareQrVisible && (
                  <div className="flex flex-col items-center gap-3 p-4 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl">
                    <LocalQrCode value={shareLink} size={220} alt="节点分享二维码" />
                    <span className="text-xs text-slate-400">扫描二维码即可导入节点（本地生成，凭证不外发）</span>
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

          <button onClick={handleClearAllProxies}
            className="px-4 py-2 bg-white border border-red-200 text-red-500 hover:bg-red-50 dark:bg-slate-900 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap">
            <Trash className="w-4 h-4" /> 清空全部节点
          </button>

          {/* 多选模式开关 */}
          <button onClick={toggleSelectionMode}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap ${
              selectionMode
                ? 'bg-slate-600 hover:bg-slate-700 text-white border border-slate-600'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}>
            {selectionMode ? <><X className="w-4 h-4" /> 退出多选</> : <><CheckSquare className="w-4 h-4" /> 多选删除</>}
          </button>
        </div>
      </div>

      {/* ---- 多选操作条 ---- */}
      {selectionMode && (
        <div className="px-4 md:px-8 mb-4">
          <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                已选 <span className="text-blue-600 dark:text-blue-400 font-bold">{selectedCount}</span> / {proxies.length} 个节点
              </span>
              <span className="hidden md:inline text-xs text-slate-400">勾选节点卡片左上角的复选框，或直接点击卡片</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleToggleSelectAll} disabled={proxies.length === 0}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 whitespace-nowrap">
                {allSelected ? '全不选' : '全选'}
              </button>
              <button onClick={handleDeleteSelected} disabled={selectedCount === 0}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-40 whitespace-nowrap">
                <Trash2 className="w-4 h-4" /> 删除选中{selectedCount > 0 ? ` (${selectedCount})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- 节点卡片网格 ---- */}
      <div className="px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {proxies.map((proxy, idx) => {
          const isSelected = selectionMode && selectedNames.has(proxy.name);
          return (
          <div key={idx}
            onClick={selectionMode ? () => toggleProxySelected(proxy.name) : undefined}
            className={`bg-white dark:bg-slate-900 border p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full overflow-hidden ${
              isSelected
                ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/40 bg-blue-50/40 dark:bg-blue-950/20'
                : 'dark:border-slate-800'
            } ${selectionMode ? 'cursor-pointer select-none' : ''}`}>
            <div className="flex-1 overflow-hidden mb-4">
              {selectionMode && (
                <div className="flex items-start gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedNames.has(proxy.name)}
                    onChange={() => toggleProxySelected(proxy.name)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 w-4 h-4 shrink-0 accent-blue-600 cursor-pointer"
                    title="选中该节点"
                  />
                  {isSelected && <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">已选中</span>}
                </div>
              )}
              <ScrollingText text={String(proxy.name)} className="font-bold text-lg text-slate-800 dark:text-white mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400 font-mono truncate" title={`${String(proxy.server)}:${String(proxy.port)}`}>
                {String(proxy.server)}:{String(proxy.port)}
              </p>
            </div>
            <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/60">
              <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-md uppercase shrink-0">
                {String(proxy.type)}
              </span>
              {/* 多选模式下阻止按钮点击冒泡到卡片，避免误切换选中状态 */}
              <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}>
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
          );
        })}
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
