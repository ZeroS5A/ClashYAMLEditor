import { useCallback, useEffect, useReducer, useState } from 'react';
import { DEFAULT_EMPTY_CONFIG } from '../constants/templates.js';
import { normalizeConfig } from '../utils/configShape.js';
import { createEditorState, editorReducer } from '../utils/history.js';

const DRAFT_KEY = 'clash-editor:draft:v1';
const PREF_KEY = 'clash-editor:remember';
export default function useConfigPersistence() {
  const [initial] = useState(() => {
    try {
      const remember = localStorage.getItem(PREF_KEY) !== 'false';
      const draft = remember && JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      const normalized = draft && normalizeConfig(draft.config);
      const sourceDraft = typeof draft?.sourceDraft?.text === 'string' && typeof draft?.sourceDraft?.baseText === 'string' ? draft.sourceDraft : null;
      if (normalized?.ok) return { config: normalized.config, sourceDraft, pendingDraft: { savedAt: draft.savedAt }, remember };
      return { config: DEFAULT_EMPTY_CONFIG, sourceDraft: null, pendingDraft: null, remember };
    } catch { return { config: DEFAULT_EMPTY_CONFIG, sourceDraft: null, pendingDraft: null, remember: true }; }
  });
  const [state, dispatch] = useReducer(editorReducer, initial.config, createEditorState);
  const [sourceDraft, setSourceDraft] = useState(initial.sourceDraft);
  const [pendingDraft, setPendingDraft] = useState(initial.pendingDraft);
  const [remember, setRemember] = useState(initial.remember);
  const [saved, setSaved] = useState({ config: initial.config, sourceDraft: initial.sourceDraft });
  const [saveError, setSaveError] = useState('');
  const [retry, setRetry] = useState(0);
  const config = state.config;
  const dirty = config !== saved.config || sourceDraft !== saved.sourceDraft;
  const setConfig = useCallback(updater => dispatch({ type: 'edit', updater }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  useEffect(() => {
    if (!remember) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), config, sourceDraft }));
        setSaved({ config, sourceDraft }); setSaveError('');
      } catch (error) { setSaveError(error.name === 'QuotaExceededError' ? '浏览器存储空间不足，请先下载配置' : '浏览器存储不可用，请先下载配置'); }
    }, 600);
    return () => clearTimeout(timer);
  }, [config, sourceDraft, remember, retry]);
  useEffect(() => {
    if (!dirty) return;
    const handler = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  const toggleRemember = useCallback(enabled => {
    setRemember(enabled);
    try { localStorage.setItem(PREF_KEY, String(enabled)); if (!enabled) localStorage.removeItem(DRAFT_KEY); setSaveError(''); }
    catch { setSaveError('无法修改浏览器存储设置'); }
  }, []);
  const discardDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { setSaveError('无法清除浏览器草稿'); }
    dispatch({ type: 'reset', config: DEFAULT_EMPTY_CONFIG }); setSourceDraft(null); setPendingDraft(null);
    setSaved({ config: DEFAULT_EMPTY_CONFIG, sourceDraft: null });
  }, []);
  const status = saveError || (!remember ? '草稿保存已关闭' : dirty ? '正在保存到浏览器…' : '已保存到浏览器');
  return { config, setConfig, undo, redo, canUndo: state.undo.length > 0, canRedo: state.redo.length > 0, dirty, status, saveError, remember, toggleRemember, retrySave: () => setRetry(n => n + 1), pendingDraft, keepDraft: () => setPendingDraft(null), discardDraft, sourceDraft, setSourceDraft };
}
