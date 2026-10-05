export const HISTORY_LIMIT = 60;
export const createEditorState = config => ({ config, undo: [], redo: [], revision: 0 });

export function editorReducer(state, action) {
  const cap = (stack, item) => [...stack.slice(-(HISTORY_LIMIT - 1)), item];
  if (action.type === 'reset') return createEditorState(action.config);
  if (action.type === 'edit') {
    const next = typeof action.updater === 'function' ? action.updater(state.config) : action.updater;
    if (next === state.config) return state;
    return { config: next, undo: cap(state.undo, state.config), redo: [], revision: state.revision + 1 };
  }
  if (action.type === 'undo' && state.undo.length) return { config: state.undo.at(-1), undo: state.undo.slice(0, -1), redo: cap(state.redo, state.config), revision: state.revision + 1 };
  if (action.type === 'redo' && state.redo.length) return { config: state.redo.at(-1), undo: cap(state.undo, state.config), redo: state.redo.slice(0, -1), revision: state.revision + 1 };
  return state;
}
