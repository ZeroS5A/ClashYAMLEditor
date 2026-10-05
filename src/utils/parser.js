import { parseYaml } from './yaml.js';
import { fetchText } from './network.js';
export { parseRuleString } from './rules.js';

export const safeDecodeBase64 = str => {
  try {
    const normalized = str.trim().replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
  } catch { throw new Error('Base64 数据损坏或不是有效 UTF-8'); }
};
export const encodeBase64 = str => {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};
const randomName = prefix => `${prefix}-${Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join('')}`;
export const formatHost = server => server.includes(':') && !server.startsWith('[') ? `[${server}]` : server;
function hostPort(value) {
  const match = value.replace(/\/$/, '').match(/^(\[[^\]]+\]|[^:]+):([0-9,-]+)$/);
  if (!match) throw new Error('服务器地址或端口格式无效；IPv6 地址需要方括号');
  const port = Number(match[2].split(/[,-]/)[0]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口必须为 1–65535');
  return { server: match[1].replace(/^\[|\]$/g, ''), port, ports: /[,-]/.test(match[2]) ? match[2] : undefined };
}
function applyQuery(url, proxy) {
  const q = url.searchParams;
  const get = (...keys) => keys.map(k => q.get(k)).find(v => v !== null && v !== '');
  const network = get('type', 'network');
  if (network && proxy.type !== 'hysteria2') proxy.network = network;
  const security = get('security');
  if (security || q.has('tls')) proxy.tls = security === 'tls' || security === 'reality' || get('tls') === 'true';
  const sni = get('sni', 'peer', 'servername');
  if (sni) proxy[['vmess', 'vless'].includes(proxy.type) ? 'servername' : 'sni'] = sni;
  const insecure = get('insecure', 'allowInsecure', 'skip-cert-verify');
  if (insecure !== undefined) proxy['skip-cert-verify'] = ['1', 'true'].includes(insecure);
  for (const key of ['flow', 'encryption', 'obfs', 'up', 'down', 'udp-relay-mode', 'congestion-controller', 'header-type']) if (q.has(key)) proxy[key] = q.get(key);
  const fp = get('fp', 'client-fingerprint'); if (fp) proxy['client-fingerprint'] = fp;
  const pin = get('pinSHA256', 'pinsha256', 'fingerprint'); if (pin) proxy.fingerprint = pin;
  const ports = get('mport', 'ports'); if (ports && proxy.type === 'hysteria2') proxy.ports = ports;
  const obfsPassword = get('obfs-password', 'obfsParam'); if (obfsPassword) proxy['obfs-password'] = obfsPassword;
  const alpn = get('alpn'); if (alpn) proxy.alpn = alpn.split(',').map(s => s.trim()).filter(Boolean);
  if (get('pbk')) proxy['reality-opts'] = { 'public-key': get('pbk'), ...(get('sid') ? { 'short-id': get('sid') } : {}) };
  for (const key of ['udp', 'tfo']) if (q.has(key)) proxy[key] = ['true', '1'].includes(q.get(key));
  const path = get('path'), host = get('host');
  if (proxy.network === 'ws' && (path || host)) proxy['ws-opts'] = { ...(path ? { path } : {}), ...(host ? { headers: { Host: host } } : {}) };
  if (proxy.network === 'grpc' && get('serviceName', 'service-name')) proxy['grpc-opts'] = { 'grpc-service-name': get('serviceName', 'service-name') };
  if (['http', 'h2'].includes(proxy.network) && (path || host)) proxy[`${proxy.network}-opts`] = { ...(path ? { path } : {}), ...(host ? { host: host.split(',') } : {}) };
}
export function parseProxyLink(link) {
  link = link.trim();
  const scheme = link.split(':')[0].toLowerCase();
  if (scheme === 'vmess') {
    const d = JSON.parse(safeDecodeBase64(link.slice(8)));
    const proxy = { name: d.ps || randomName('VMess'), type: 'vmess', server: d.add, port: Number(d.port), uuid: d.id, alterId: Number(d.aid) || 0, cipher: d.scy || 'auto', network: d.net || 'tcp', tls: d.tls === 'tls' };
    if (d.sni) proxy.servername = d.sni;
    if (d.fp) proxy['client-fingerprint'] = d.fp;
    if (d.alpn) proxy.alpn = d.alpn.split(',');
    if (d.insecure !== undefined) proxy['skip-cert-verify'] = !!d.insecure;
    if (d.net === 'ws') proxy['ws-opts'] = { path: d.path || '/', ...(d.host ? { headers: { Host: d.host } } : {}) };
    if (d.net === 'grpc') proxy['grpc-opts'] = { 'grpc-service-name': d.path || '' };
    return proxy;
  }
  if (scheme === 'ssr') {
    const decoded = safeDecodeBase64(link.slice(6)), [main, query = ''] = decoded.split('/?');
    const match = main.match(/^(.*):(\d+):([^:]+):([^:]+):([^:]+):([^:]+)$/);
    if (!match) throw new Error('SSR 链接格式不完整');
    const [, server, port, protocol, cipher, obfs, password] = match, q = new URLSearchParams(query);
    return { name: q.has('remarks') ? safeDecodeBase64(q.get('remarks')) : randomName('SSR'), type: 'ssr', server: server.replace(/^\[|\]$/g, ''), port: Number(port), protocol, cipher, obfs, password: safeDecodeBase64(password), ...(q.has('obfsparam') ? { 'obfs-param': safeDecodeBase64(q.get('obfsparam')) } : {}), ...(q.has('protoparam') ? { 'protocol-param': safeDecodeBase64(q.get('protoparam')) } : {}) };
  }
  if (scheme === 'ss') {
    let text = link.slice(5), name = randomName('SS');
    const hash = text.indexOf('#'); if (hash >= 0) { name = decodeURIComponent(text.slice(hash + 1)); text = text.slice(0, hash); }
    const question = text.indexOf('?'), q = new URLSearchParams(question >= 0 ? text.slice(question + 1) : '');
    if (question >= 0) text = text.slice(0, question);
    if (!text.includes('@')) text = safeDecodeBase64(text);
    const at = text.lastIndexOf('@'); if (at < 0) throw new Error('SS 链接缺少服务器地址');
    const credentials = text.slice(0, at);
    const decoded = credentials.includes(':') ? decodeURIComponent(credentials) : safeDecodeBase64(credentials);
    const colon = decoded.indexOf(':'); if (colon < 0) throw new Error('SS 链接缺少密码');
    const proxy = { name, type: 'ss', ...hostPort(text.slice(at + 1)), cipher: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
    delete proxy.ports;
    const plugin = q.get('plugin');
    if (plugin) {
      const [id, ...options] = plugin.split(';');
      proxy.plugin = id === 'obfs-local' || id === 'simple-obfs' ? 'obfs' : id;
      proxy['plugin-opts'] = Object.fromEntries(options.map(option => {
        const i = option.indexOf('='); const key = i < 0 ? option : option.slice(0, i), value = i < 0 ? true : option.slice(i + 1);
        return [key === 'obfs' ? 'mode' : key === 'obfs-host' ? 'host' : key, value];
      }));
    }
    return proxy;
  }
  if (!['trojan', 'vless', 'hysteria2', 'hy2', 'tuic'].includes(scheme)) throw new Error('不支持的协议或分享格式异常');
  const type = scheme === 'hy2' ? 'hysteria2' : scheme;
  // Normalize legacy multi-port authority before handing it to the URL parser.
  let normalized = link, legacyPorts;
  if (type === 'hysteria2') normalized = link.replace(/(@(?:\[[^\]]+\]|[^:/?#]+):)([0-9,-]+)/, (all, prefix, ports) => {
    if (/[,-]/.test(ports)) legacyPorts = ports;
    return prefix + ports.split(/[,-]/)[0];
  });
  const url = new URL(normalized), port = Number(url.port || 443);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口必须为 1–65535');
  const proxy = { name: decodeURIComponent(url.hash.slice(1)) || randomName(type), type, server: url.hostname.replace(/^\[|\]$/g, ''), port };
  if (type === 'vless') proxy.uuid = decodeURIComponent(url.username);
  else if (type === 'tuic') { proxy.uuid = decodeURIComponent(url.username); proxy.password = decodeURIComponent(url.password); }
  else proxy.password = decodeURIComponent(url.username + (url.password ? `:${url.password}` : ''));
  if (legacyPorts) proxy.ports = legacyPorts;
  applyQuery(url, proxy);
  return proxy;
}

export function parseSubscriptionText(text) {
  let content = text.trim();
  try { const decoded = safeDecodeBase64(content); if (/^(vmess|trojan|vless|ssr?|hysteria2|hy2|tuic):\/\//m.test(decoded)) content = decoded; } catch { /* Plain YAML or URI text. */ }
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.some(l => /^(vmess|trojan|vless|ssr?|hysteria2|hy2|tuic):\/\//i.test(l))) return lines.map(link => {
    try { return { proxy: parseProxyLink(link) }; } catch (error) { return { error: error.message, link: '[节点链接已隐藏]' }; }
  });
  const config = parseYaml(content);
  if (!config.proxies.length) throw new Error('订阅没有静态节点；代理集合请在代理集合页面管理');
  return config.proxies.map(proxy => ({ proxy }));
}
export async function fetchSubscriptionContent(url, options) { return parseSubscriptionText(await fetchText(url, options)); }
