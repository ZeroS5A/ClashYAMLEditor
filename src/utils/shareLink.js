import { encodeBase64, formatHost } from './parser.js';

export function shareLinkWarnings(proxy) {
  const known = new Set(['name', 'type', 'server', 'port', 'password', 'uuid', 'cipher', 'network', 'tls', 'servername', 'sni', 'client-fingerprint', 'alpn', 'skip-cert-verify', 'ws-opts', 'grpc-opts', 'h2-opts', 'http-opts', 'reality-opts', 'flow', 'encryption', 'obfs', 'obfs-password', 'ports', 'up', 'down', 'fingerprint', 'udp', 'tfo', 'udp-relay-mode', 'congestion-controller', 'alterId', 'protocol', 'protocol-param', 'obfs-param', 'plugin', 'plugin-opts']);
  const missing = Object.keys(proxy).filter(k => !known.has(k));
  if (proxy['ws-opts'] && (Object.keys(proxy['ws-opts']).some(k => !['path', 'headers'].includes(k)) || Object.keys(proxy['ws-opts'].headers || {}).some(k => k !== 'Host'))) missing.push('ws-opts 高级字段');
  if (proxy.type === 'ss' && ['udp', 'tfo'].some(k => proxy[k] !== undefined)) missing.push('udp/tfo');
  return missing;
}
export function generateShareLink(proxy) {
  const { name, type, server, port } = proxy, host = formatHost(server || ''), hash = `#${encodeURIComponent(name || '')}`;
  if (type === 'vmess') return 'vmess://' + encodeBase64(JSON.stringify({ v: '2', ps: name, add: server, port, id: proxy.uuid, aid: proxy.alterId || 0, scy: proxy.cipher || 'auto', net: proxy.network || 'tcp', type: 'none', host: proxy['ws-opts']?.headers?.Host || '', path: proxy['ws-opts']?.path || proxy['grpc-opts']?.['grpc-service-name'] || '', tls: proxy.tls ? 'tls' : '', sni: proxy.servername || proxy.sni || '', fp: proxy['client-fingerprint'] || '', alpn: proxy.alpn?.join(',') || '', ...(proxy['skip-cert-verify'] !== undefined ? { insecure: proxy['skip-cert-verify'] } : {}) }));
  if (type === 'ss') {
    let link = `ss://${encodeBase64(`${proxy.cipher}:${proxy.password}`)}@${host}:${port}`;
    if (proxy.plugin) {
      const id = proxy.plugin === 'obfs' ? 'obfs-local' : proxy.plugin;
      const opts = proxy['plugin-opts'];
      const options = typeof opts === 'string' ? opts : Object.entries(opts || {}).map(([k, v]) => `${k === 'mode' && proxy.plugin === 'obfs' ? 'obfs' : k === 'host' && proxy.plugin === 'obfs' ? 'obfs-host' : k}${v === true ? '' : `=${v}`}`).join(';');
      link += `/?plugin=${encodeURIComponent(id + (options ? `;${options}` : ''))}`;
    }
    return link + hash;
  }
  if (type === 'ssr') {
    const q = new URLSearchParams({ remarks: encodeBase64(name || '') });
    if (proxy['obfs-param']) q.set('obfsparam', encodeBase64(proxy['obfs-param']));
    if (proxy['protocol-param']) q.set('protoparam', encodeBase64(proxy['protocol-param']));
    return 'ssr://' + encodeBase64(`${host}:${port}:${proxy.protocol}:${proxy.cipher}:${proxy.obfs}:${encodeBase64(proxy.password || '')}/?${q}`);
  }
  if (!['vless', 'trojan', 'hysteria2', 'tuic'].includes(type)) throw new Error(`协议 ${type} 请使用 YAML 节点片段导出`);
  const q = new URLSearchParams();
  const put = (k, v) => { if (v !== undefined && v !== null && v !== '') q.set(k, String(v)); };
  put('type', proxy.network);
  if (proxy['reality-opts']) q.set('security', 'reality'); else if (proxy.tls !== undefined) q.set('security', proxy.tls ? 'tls' : 'none');
  put('sni', proxy.servername || proxy.sni); put('fp', proxy['client-fingerprint']); put('alpn', proxy.alpn?.join(','));
  if (proxy['skip-cert-verify'] !== undefined) put('insecure', proxy['skip-cert-verify'] ? 1 : 0);
  for (const key of ['flow', 'encryption', 'obfs', 'obfs-password', 'up', 'down', 'udp', 'tfo', 'udp-relay-mode', 'congestion-controller']) put(key, proxy[key]);
  put('pinSHA256', proxy.fingerprint); put('mport', proxy.ports || (typeof port === 'string' && /[,-]/.test(port) ? port : undefined));
  put('pbk', proxy['reality-opts']?.['public-key']); put('sid', proxy['reality-opts']?.['short-id']);
  put('path', proxy['ws-opts']?.path || proxy['h2-opts']?.path || proxy['http-opts']?.path);
  put('host', proxy['ws-opts']?.headers?.Host || proxy['h2-opts']?.host?.join(',') || proxy['http-opts']?.host?.join(','));
  put('serviceName', proxy['grpc-opts']?.['grpc-service-name']);
  const user = type === 'vless' ? encodeURIComponent(proxy.uuid || '') : type === 'tuic' ? `${encodeURIComponent(proxy.uuid || '')}:${encodeURIComponent(proxy.password || '')}` : encodeURIComponent(proxy.password || '');
  return `${type}://${user}@${host}:${Number(String(port).split(/[,-]/)[0]) || 443}${q.size ? `?${q}` : ''}${hash}`;
}
