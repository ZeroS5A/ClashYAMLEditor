import React from 'react';
import { AlertCircle, RefreshCw, RotateCcw, Home } from 'lucide-react';

/**
 * 渲染错误边界。
 *
 * 没有它时，任意一个渲染期异常（例如组件未定义、数据结构不符预期）都会让
 * React 卸载整棵树，用户看到的是纯白页面且无法自救。
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // 保留控制台堆栈，方便定位
    console.error('[ErrorBoundary] 渲染出错:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    const { onReset, onHome, resetText = '重置为空白配置' } = this.props;

    return (
      <div className="min-h-full p-6 md:p-10 flex items-start justify-center">
        <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-red-100 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20">
            <h2 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> 页面渲染出错了
            </h2>
            <p className="text-sm text-red-600/90 dark:text-red-400/80 mt-2 leading-relaxed">
              该功能遇到了意外错误，已被安全拦截，其余数据没有丢失。你可以先重试；
              如果反复失败，再重置配置。
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">错误信息</div>
              <pre className="text-xs font-mono bg-slate-50 dark:bg-slate-950 border dark:border-slate-800 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto custom-scrollbar">
                {String(error?.message || error)}
              </pre>
            </div>

            {errorInfo?.componentStack && (
              <details className="text-xs text-slate-500 dark:text-slate-400">
                <summary className="cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200">查看组件堆栈</summary>
                <pre className="mt-2 font-mono bg-slate-50 dark:bg-slate-950 border dark:border-slate-800 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap max-h-52 overflow-y-auto custom-scrollbar">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={this.handleRetry}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> 重试
              </button>
              {onHome && (
                <button onClick={() => { this.handleRetry(); onHome(); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
                  <Home className="w-4 h-4" /> 返回导入页
                </button>
              )}
              {onReset && (
                <button onClick={() => { this.handleRetry(); onReset(); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> {resetText}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
