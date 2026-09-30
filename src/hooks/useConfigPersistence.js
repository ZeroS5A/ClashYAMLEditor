import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_EMPTY_CONFIG } from '../constants/templates';
import { isUsableConfig } from '../utils/configShape';
import { HistoryManager, isDestructive } from '../utils/history';

const DRAFT_KEY = 'clash-editor:draft:v1';
const SAVE_DEBOUNCE_MS = 600;

const safeParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const serialize = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

/**
 * 配置持久化 + 撤销/重做。
 *
 * - 编辑内容自动写入 localStorage，误刷新后可恢复
 * - 保留最近若干步，支持撤销/重做（连续拖拽等同一次操作）
 * - 暴露 dirty，供离开页面前提醒
 */
const useConfigPersistence = () => {
  const [initial] = useState(() => {
    // 先看有没有可用的本地草稿，避免闪一下空白配置
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = safeParse(raw);
        if (parsed && isUsableConfig(parsed.config)) {
          return {
            config: parsed.config,
            pendingDraft: {
              savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : null,
            },
          };
        }
      }
    } catch {
      /* localStorage 不可用（隐私模式等）时静默忽略 */
    }
    return { config: DEFAULT_EMPTY_CONFIG, pendingDraft: null };
  });

  const [config, setConfigState] = useState(initial.config);
  const [pendingDraft, setPendingDraft] = useState(initial.pendingDraft);
  // 已成功落盘的快照；用 state 而非 ref，保证 dirty 能重新计算
  const [savedSnapshot, setSavedSnapshot] = useState(() => serialize(initial.config));

  const managerRef = useRef(null);
  if (managerRef.current === null) managerRef.current = new HistoryManager();
  const manager = managerRef.current;

  // 当前配置的最新已提交值，供撤销/重做同步读取
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);

  // 撤销/重做自身引起的变更不再进历史
  const suppressRecordRef = useRef(false);

  // ---- 包装 setConfig，保持与 useState 完全一致的调用语义 ----
  const setConfig = useCallback((updater) => {
    setConfigState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return prev;

      if (suppressRecordRef.current) {
        suppressRecordRef.current = false;
        // 撤销/重做结果仍需同步给 configRef
        configRef.current = next;
        return next;
      }

      // React 在开发模式可能重复调用 updater：只在最外层记录一次
      const outermost = !manager.recording;
      manager.recording = true;
      try {
        if (outermost) {
          manager.record(prev);
          if (isDestructive(prev, next)) manager.clearRedo();
        }
      } finally {
        manager.recording = false;
      }

      configRef.current = next;
      return next;
    });
  }, [manager]);

  const undo = useCallback(() => {
    const target = manager.undoStep(configRef.current);
    if (target === null) return;
    suppressRecordRef.current = true;
    configRef.current = target;
    setConfigState(target);
  }, [manager]);

  const redo = useCallback(() => {
    const target = manager.redoStep(configRef.current);
    if (target === null) return;
    suppressRecordRef.current = true;
    configRef.current = target;
    setConfigState(target);
  }, [manager]);

  // ---- 自动保存草稿 ----
  const lastSerializedRef = useRef(null);
  useEffect(() => {
    const serialized = serialize(config);
    if (lastSerializedRef.current === serialized) return;
    lastSerializedRef.current = serialized;

    const timer = setTimeout(() => {
      try {
        if (config === DEFAULT_EMPTY_CONFIG) {
          window.localStorage.removeItem(DRAFT_KEY);
        } else {
          window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), config }));
        }
        setSavedSnapshot(serialized);
      } catch {
        /* 配额不足或不可用时忽略，不影响编辑 */
      }
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [config]);

  const dirty = serialize(config) !== savedSnapshot;

  // ---- 离开前提醒（草稿写入有防抖，关闭过快仍可能丢）----
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // ---- 草稿恢复 / 丢弃 ----
  const keepDraft = useCallback(() => setPendingDraft(null), []);

  const discardDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* 忽略 */
    }
    setPendingDraft(null);
    manager.reset();
    suppressRecordRef.current = true;
    configRef.current = DEFAULT_EMPTY_CONFIG;
    setConfigState(DEFAULT_EMPTY_CONFIG);
    setSavedSnapshot(serialize(DEFAULT_EMPTY_CONFIG));
  }, [manager]);

  return {
    config,
    setConfig,
    undo,
    redo,
    canUndo: manager.canUndo,
    canRedo: manager.canRedo,
    dirty,
    pendingDraft,
    keepDraft,
    discardDraft,
  };
};

export default useConfigPersistence;
