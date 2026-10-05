export function yamlAsync(type, value, signal) {
  return new Promise((resolve, reject) => {
    let worker;
    const finish = (error, result) => { clearTimeout(timer); signal?.removeEventListener('abort', abort); worker?.terminate(); error ? reject(error) : resolve(result); };
    const abort = () => finish(new DOMException('已取消', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('处理超时，请缩小配置后重试')), 30000);
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    try {
      worker = new Worker(new URL('./yamlWorker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.result);
      worker.onerror = () => finish(new Error('解析工作线程加载失败，请检查本地静态资源'));
      worker.postMessage({ type, value });
    } catch (error) { finish(error); }
  });
}
