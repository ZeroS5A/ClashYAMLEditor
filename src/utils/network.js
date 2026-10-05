import { MAX_TEXT_BYTES } from './yaml.js';

export async function fetchText(url, { signal, timeout = 15000, maxBytes = MAX_TEXT_BYTES } = {}) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('仅支持 HTTP(S) 地址');
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('网络请求超时')), timeout);
  try {
    const response = await fetch(parsed.href, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('订阅内容超过大小限制');
    if (!response.body?.getReader) {
      const text = await response.text();
      if (new TextEncoder().encode(text).length > maxBytes) throw new Error('订阅内容超过大小限制');
      return text;
    }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let size = 0, text = '';
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('订阅内容超过大小限制'); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    if (error instanceof TypeError) throw new Error('请求失败：请检查网络、CORS、HTTPS 混合内容或后端证书');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

export async function mapConcurrent(items, task, concurrency = 3) {
  const result = new Array(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; result[index] = await task(items[index], index); }
  }));
  return result;
}
