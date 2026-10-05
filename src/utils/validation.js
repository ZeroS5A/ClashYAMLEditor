import { normalizeConfig } from './configShape.js';
import { parseRuleString, ruleProviderNames } from './rules.js';

export const BUILTIN_OUTBOUNDS = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE'];
export const DEFAULT_TARGET = { environment: 'openclash', core: 'mihomo', version: '' };
export function nameError(config, name, originalName, kind) {
  if (!name?.trim() || /[,\r\n]/.test(name)) return '名称不能为空或包含逗号、换行';
  if (BUILTIN_OUTBOUNDS.includes(name)) return '名称与内置出站冲突';
  for (const key of ['proxies', 'proxy-groups']) if (config[key].some(p => p.name === name && !(key === kind && p.name === originalName))) return '节点或策略组名称已存在';
  return '';
}
export function validateConfig(config, target = DEFAULT_TARGET) {
  const shape = normalizeConfig(config);
  if (!shape.ok) return (shape.errors || [shape.error]).map(message => ({ level: 'error', path: message.split(':')[0], message, tab: 'import' }));
  config = shape.config;
  const issues = [];
  const add = (level, path, message, tab, details = {}) => {
    const item = /^(proxies|proxy-groups)\[(\d+)\]/.exec(path);
    const subject = item ? `${item[1] === 'proxies' ? '节点' : '策略组'}「${config[item[1]][Number(item[2])].name}」` : undefined;
    issues.push({ level, path, message, tab, ...(subject ? { subject } : {}), ...details });
  };
  const known = new Set(BUILTIN_OUTBOUNDS);
  const groups = new Map(config['proxy-groups'].map(g => [g.name, g]));
  const providers = config['rule-providers'] || {};
  for (const key of ['proxies', 'proxy-groups']) config[key].forEach((p, i) => {
    const path = `${key}[${i}]`;
    if (known.has(p.name) || /[,\r\n]/.test(p.name)) add('error', `${path}.name`, '名称重复、与内置出站冲突或包含分隔符', key === 'proxies' ? 'proxies' : 'groups');
    known.add(p.name);
  });
  const checkOutbound = (value, path, tab, details) => { if (value && !known.has(value)) add('error', path, `出站「${value}」不存在`, tab, details); };
  config.proxies.forEach((p, i) => {
    const path = `proxies[${i}]`;
    if (!['direct', 'reject', 'dns'].includes(p.type) && !(p.type === 'wireguard' && p.peers?.length)) {
      if (!p.server) add('error', `${path}.server`, '缺少服务器地址', 'proxies');
      if (!Number.isInteger(p.port) || p.port < 1 || p.port > 65535) add('error', `${path}.port`, '端口必须为 1–65535 的整数，跳跃端口应写入 ports', 'proxies');
    }
    const required = ({ ss: ['cipher', 'password'], ssr: ['cipher', 'password', 'protocol', 'obfs'], vmess: ['uuid'], vless: ['uuid'], trojan: ['password'], hysteria2: ['password'], tuic: ['uuid', 'password'], wireguard: ['private-key'] })[p.type] || [];
    for (const key of required) if (!p[key]) add('error', `${path}.${key}`, `协议 ${p.type} 缺少 ${key}`, 'proxies');
    checkOutbound(p['dialer-proxy'], `${path}.dialer-proxy`, 'proxies');
    if (p['skip-cert-verify']) add('warning', `${path}.skip-cert-verify`, '已跳过服务器证书验证', 'proxies');
    if (target.core === 'clash' && ['vless', 'hysteria2', 'tuic', 'wireguard', 'anytls'].includes(p.type)) add('error', `${path}.type`, `旧 Clash 内核不支持 ${p.type}，请选择实际使用的内核`, 'proxies');
  });
  config['proxy-groups'].forEach((g, i) => {
    const path = `proxy-groups[${i}]`;
    for (const n of g.proxies || []) checkOutbound(n, `${path}.proxies`, 'groups');
    for (const n of g.use || []) if (!config['proxy-providers']?.[n]) add('error', `${path}.use`, `代理集合「${n}」不存在`, 'groups');
    if (!(g.proxies?.length || g.use?.length || g['include-all'] || g['include-all-proxies'] || g['include-all-providers'])) add('error', path, '策略组没有节点或代理集合来源', 'groups');
    if (g.type === 'smart' && target.core !== 'smart') add('error', `${path}.type`, 'smart 策略组需要 Smart 内核', 'groups');
    if (g.type === 'relay' && target.core !== 'clash') add('warning', `${path}.type`, 'relay 已废弃，请按实际内核迁移至 dialer-proxy', 'groups');
    for (const field of ['interval', 'timeout', 'tolerance']) if (g[field] !== undefined && (!Number.isFinite(g[field]) || g[field] < 0)) add('error', `${path}.${field}`, '应为非负数', 'groups');
  });
  const graph = new Map([...config.proxies.map(p => [p.name, p['dialer-proxy'] ? [p['dialer-proxy']] : []]), ...[...groups].map(([name, g]) => [name, g.proxies || []])]);
  const visiting = new Set(), visited = new Set();
  for (const root of graph.keys()) {
    if (visited.has(root)) continue;
    const stack = [{ name: root, exit: false }];
    while (stack.length) {
      const { name, exit } = stack.pop();
      if (exit) { visiting.delete(name); visited.add(name); continue; }
      if (visiting.has(name)) { add('error', `outbound.${name}`, '检测到策略组／链式代理循环引用', groups.has(name) ? 'groups' : 'proxies'); continue; }
      if (visited.has(name)) continue;
      visiting.add(name); stack.push({ name, exit: true });
      for (const next of graph.get(name) || []) if (graph.has(next)) stack.push({ name: next, exit: false });
    }
  }
  const paths = new Map();
  for (const kind of ['rule-providers', 'proxy-providers']) for (const [name, p] of Object.entries(config[kind] || {})) {
    const path = `${kind}.${name}`, tab = kind === 'rule-providers' ? 'rules' : 'providers';
    if (!['http', 'file', 'inline'].includes(p.type)) add('error', `${path}.type`, '类型必须为 http、file 或 inline', tab);
    if (p.type === 'http') {
      try { const u = new URL(p.url); if (!['http:', 'https:'].includes(u.protocol)) throw new Error(); } catch { add('error', `${path}.url`, '需要有效的 HTTP(S) URL', tab); }
      if (p.interval !== undefined && (!Number.isInteger(p.interval) || p.interval < 1)) add('error', `${path}.interval`, '更新间隔应为正整数秒', tab);
    }
    if (p.type === 'file' && !p.path) add('error', `${path}.path`, '本地文件类型需要 path', tab);
    if (p.type === 'inline' && !Array.isArray(p.payload)) add('error', `${path}.payload`, 'inline 类型需要 payload 列表', tab);
    if (p.path) { if (paths.has(p.path)) add('error', `${path}.path`, `缓存路径与 ${paths.get(p.path)} 重复`, tab); paths.set(p.path, path); }
    if (kind === 'rule-providers') {
      if (!['domain', 'ipcidr', 'classical'].includes(p.behavior)) add('error', `${path}.behavior`, '无效的规则集行为', tab);
      if (!['mrs', 'text', 'yaml'].includes(p.format || 'yaml')) add('error', `${path}.format`, '无效的规则集格式', tab);
      if (p.format === 'mrs' && p.behavior === 'classical') add('error', `${path}.format`, 'MRS 不支持 classical', tab);
    }
    checkOutbound(p.proxy, `${path}.proxy`, tab);
    checkOutbound(p.override?.['dialer-proxy'], `${path}.override.dialer-proxy`, tab);
    if (p['health-check']?.enable && p['health-check'].interval < 30) add('warning', `${path}.health-check.interval`, '健康检查间隔过短，会增加路由器负载', tab);
  }
  function checkRules(rules, path, tab, dnsRules = false, label = '主规则') {
    const seen = new Map(); let matchIndex;
    const location = index => `${label} · 第 ${index + 1} 条`;
    rules.forEach((rule, i) => {
      const current = `${path}[${i}]`, p = parseRuleString(rule);
      const details = { subject: location(i), rule };
      const report = (level, message, extra = {}) => add(level, current, message, tab, { ...details, ...extra });
      if (p.error) { report('error', p.error); return; }
      if (matchIndex !== undefined) report('warning', `位于第 ${matchIndex + 1} 条 MATCH 后，通常不会被匹配`, {
        related: { path: `${path}[${matchIndex}]`, label: `前置 MATCH：${location(matchIndex)}` },
      });
      if (p.type === 'MATCH' && matchIndex === undefined) matchIndex = i;
      if (seen.has(rule)) {
        const firstIndex = seen.get(rule);
        report('warning', `重复规则：${p.payload.trim() || p.type}（与第 ${firstIndex + 1} 条规则完全相同）`, {
          related: { path: `${path}[${firstIndex}]`, label: `首次出现：${location(firstIndex)}` },
        });
      } else seen.set(rule, i);
      if (p.type === 'SUB-RULE') { if (!config['sub-rules']?.[p.target]) report('error', `子规则「${p.target}」不存在`); }
      else if (!dnsRules) checkOutbound(p.target, current, tab, details);
      if (['IP-CIDR', 'IP-CIDR6', 'SRC-IP-CIDR', 'SRC-IP-CIDR6'].includes(p.type)) {
        const [address, prefix, extra] = p.payload.trim().split('/');
        let validAddress = false;
        if (address.includes(':')) { try { new URL(`http://[${address}]`); validAddress = true; } catch { /* Invalid IPv6. */ } }
        else validAddress = address.split('.').length === 4 && address.split('.').every(n => /^\d{1,3}$/.test(n) && Number(n) <= 255);
        if (!validAddress || extra !== undefined || !/^\d+$/.test(prefix || '') || Number(prefix) > (address.includes(':') ? 128 : 32)) report('error', 'IP-CIDR 地址或前缀长度无效');
      }
      for (const n of ruleProviderNames(rule)) if (!providers[n]) report('error', `规则集「${n}」不存在`);
    });
  }
  checkRules(config.rules, 'rules', 'rules');
  for (const [name, rules] of Object.entries(config['sub-rules'] || {})) checkRules(rules, `sub-rules.${name}`, 'rules', false, `子规则「${name}」`);
  if (config.dns?.['fake-ip-filter-mode'] === 'rule') checkRules(config.dns['fake-ip-filter'] || [], 'dns.fake-ip-filter', 'dns', true, 'DNS Fake-IP 过滤');
  for (const field of ['nameserver', 'fallback', 'default-nameserver', 'proxy-server-nameserver', 'direct-nameserver']) for (const server of config.dns?.[field] || []) {
    const outbound = server.match(/#([^&]+)(?=&|$)/)?.[1];
    if (outbound && !known.has(outbound) && !['h3=true', 'disable-ipv4', 'disable-ipv6'].includes(outbound) && !outbound.includes('=')) add('warning', `dns.${field}`, `DNS 后缀「${outbound}」不是已定义出站；若它是网络接口，请核对路由器接口名称`, 'dns');
  }
  for (const field of ['nameserver-policy', 'proxy-server-nameserver-policy']) for (const key of Object.keys(config.dns?.[field] || {})) if (key.startsWith('rule-set:')) for (const n of key.slice(9).split(',')) if (!providers[n.trim()]) add('error', `dns.${field}.${key}`, `规则集「${n}」不存在`, 'dns');
  for (const field of ['route-address-set', 'route-exclude-address-set']) for (const n of config.tun?.[field] || []) if (!providers[n]) add('error', `tun.${field}`, `规则集「${n}」不存在`, 'network');
  for (const key of ['port', 'socks-port', 'mixed-port', 'redir-port', 'tproxy-port']) if (config[key] !== undefined && (!Number.isInteger(config[key]) || config[key] < 0 || config[key] > 65535)) add('error', key, '端口必须为 0–65535 的整数（0 表示关闭）', 'basic');
  if (config.dns?.['respect-rules'] && !config.dns['proxy-server-nameserver']?.length) add('error', 'dns.proxy-server-nameserver', 'respect-rules 需要配置节点域名 DNS', 'dns');
  if (config.tun?.['auto-redirect'] && !config.tun['auto-route']) add('error', 'tun.auto-redirect', 'auto-redirect 需要启用 auto-route', 'network');
  if (/^(0\.0\.0\.0|\[::\]):/.test(config['external-controller'] || '') && !config.secret) add('warning', 'external-controller', '控制器监听所有接口且未设置 secret', 'basic');
  if (target.environment === 'openclash') add('info', 'target.environment', 'OpenClash 可能覆写 DNS、端口、TUN 和模式；请同时核对插件设置及最终运行配置', 'basic');
  if (!target.version) add('info', 'target.version', '尚未填写内核版本；这里只按内核类别校验，不能替代目标内核启动检查', 'basic');
  return issues;
}
