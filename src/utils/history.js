/**
 * 撤销/重做历史。
 *
 * 之所以单独抽成纯函数：这部分逻辑决定「删错能不能救回来」，
 * 必须能脱离 React 直接测试。
 */

export const HISTORY_LIMIT = 60;
// 同一操作内连续多次变更（例如拖拽排序）合并为一步撤销
export const COALESCE_MS = 400;

export const createHistory = () => ({ undo: [], redo: [], recordedAt: 0 });

const pushCapped = (stack, item, limit = HISTORY_LIMIT) => [
  ...stack.slice(-(limit - 1)),
  item,
];

/** 取出 undo 的目标快照（不修改状态） */
export const peekUndo = (history) =>
  history.undo.length > 0 ? history.undo[history.undo.length - 1] : null;

/** 取出 redo 的目标快照（不修改状态） */
export const peekRedo = (history) =>
  history.redo.length > 0 ? history.redo[history.redo.length - 1] : null;

/**
 * 供 React 使用的历史管理器：内部按 COALESCE_MS 合并连续变更。
 *
 * 用类而非纯函数是因为需要持有「上次记录时间」这个跨调用的可变状态，
 * 放在组件外可以让 setConfig 回调保持稳定的引用。
 */
export class HistoryManager {
  constructor(limit = HISTORY_LIMIT) {
    this.limit = limit;
    this.undo = [];
    this.redo = [];
    this.lastRecordedAt = 0;
    // React 严格模式下 state updater 可能被重复调用，用它保证一次变更只记一步
    this.recording = false;
  }

  /** 记录一步变更前快照；返回是否真的新增了撤销点 */
  record(snapshot, now = Date.now()) {
    if (now - this.lastRecordedAt <= COALESCE_MS) {
      this.lastRecordedAt = now;
      return false;
    }
    this.lastRecordedAt = now;
    this.undo = pushCapped(this.undo, snapshot, this.limit);
    return true;
  }

  /** 取撤销目标，并把当前值压入重做栈 */
  undoStep(current, now = Date.now()) {
    if (this.undo.length === 0) return null;
    const target = this.undo[this.undo.length - 1];
    this.undo = this.undo.slice(0, -1);
    this.redo = pushCapped(this.redo, current, this.limit);
    this.lastRecordedAt = now;
    return target;
  }

  /** 取重做目标，并把当前值压回撤销栈 */
  redoStep(current, now = Date.now()) {
    if (this.redo.length === 0) return null;
    const target = this.redo[this.redo.length - 1];
    this.redo = this.redo.slice(0, -1);
    this.undo = pushCapped(this.undo, current, this.limit);
    this.lastRecordedAt = now;
    return target;
  }

  /** 清空重做分支（例如结构被破坏性修改后） */
  clearRedo() {
    this.redo = [];
  }

  reset() {
    this.undo = [];
    this.redo = [];
    this.lastRecordedAt = 0;
  }

  get canUndo() { return this.undo.length > 0; }
  get canRedo() { return this.redo.length > 0; }
}

/** 判断一次变更是否属于「破坏性缩减」（节点/规则变少），用于失效重做分支 */
export const isDestructive = (prev, next) =>
  ['proxies', 'proxy-groups', 'rules'].some((key) => {
    const before = Array.isArray(prev?.[key]) ? prev[key].length : 0;
    const after = Array.isArray(next?.[key]) ? next[key].length : 0;
    return after < before;
  });
