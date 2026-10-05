export const isMap = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Reject malformed input atomically, without discarding user fields or injecting network defaults.
export function normalizeConfig(parsed) {
  const errors = [];
  if (!isMap(parsed)) return { ok: false, error: '顶层结构必须是键值对，且内容不能为空' };
  const active = new WeakSet(), visited = new WeakMap();
  function inspect(value, path, depth = 0) {
    if (!value || typeof value !== 'object') return 1;
    if (depth > 100 || active.has(value)) { errors.push(`${path}: 不支持循环引用或超过 100 层的嵌套`); return 0; }
    if (visited.has(value)) return visited.get(value);
    active.add(value);
    let size = 1;
    for (const [key, item] of Object.entries(value)) {
      size += inspect(item, `${path}.${key}`, depth + 1);
      if (size > 1000000) { errors.push(`${path}: 配置或 YAML 别名展开过大，请拆分配置`); break; }
    }
    visited.set(value, size);
    active.delete(value);
    return size;
  }
  inspect(parsed, 'config');
  const stringList = (value, path) => {
    if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) errors.push(`${path}: 应为字符串列表`);
  };
  for (const key of ['proxies', 'proxy-groups', 'rules']) if (parsed[key] !== undefined && !Array.isArray(parsed[key])) errors.push(`${key}: 应为列表`);
  for (const key of ['rule-providers', 'proxy-providers', 'dns', 'tun', 'sniffer', 'hosts', 'profile', 'sub-rules']) if (parsed[key] !== undefined && !isMap(parsed[key])) errors.push(`${key}: 应为键值对`);
  for (const key of ['proxies', 'proxy-groups']) {
    if (!Array.isArray(parsed[key])) continue;
    parsed[key].forEach((entry, index) => {
      const path = `${key}[${index}]`;
      if (!isMap(entry)) { errors.push(`${path}: 应为键值对`); return; }
      for (const field of ['name', 'type']) if (typeof entry[field] !== 'string' || !entry[field].trim()) errors.push(`${path}.${field}: 应为非空字符串`);
      if (key === 'proxies' && entry.server !== undefined && typeof entry.server !== 'string') errors.push(`${path}.server: 应为字符串`);
      for (const field of ['proxies', 'use']) if (entry[field] !== undefined) stringList(entry[field], `${path}.${field}`);
    });
  }
  if (parsed.rules !== undefined) stringList(parsed.rules, 'rules');
  if (isMap(parsed['sub-rules'])) for (const [name, rules] of Object.entries(parsed['sub-rules'])) stringList(rules, `sub-rules.${name}`);
  for (const key of ['rule-providers', 'proxy-providers']) {
    if (!isMap(parsed[key])) continue;
    for (const [name, provider] of Object.entries(parsed[key])) {
      if (!isMap(provider)) { errors.push(`${key}.${name}: 应为键值对`); continue; }
      for (const field of ['type', 'url', 'path', 'format', 'behavior']) if (provider[field] !== undefined && typeof provider[field] !== 'string') errors.push(`${key}.${name}.${field}: 应为字符串`);
      if (provider.payload !== undefined && !Array.isArray(provider.payload)) errors.push(`${key}.${name}.payload: 应为列表`);
      if (provider['health-check'] !== undefined && !isMap(provider['health-check'])) errors.push(`${key}.${name}.health-check: 应为键值对`);
    }
  }
  if (isMap(parsed.dns)) {
    for (const key of ['nameserver', 'fallback', 'default-nameserver', 'proxy-server-nameserver', 'direct-nameserver', 'fake-ip-filter']) if (parsed.dns[key] !== undefined) stringList(parsed.dns[key], `dns.${key}`);
    for (const key of ['nameserver-policy', 'proxy-server-nameserver-policy']) if (parsed.dns[key] !== undefined && !isMap(parsed.dns[key])) errors.push(`dns.${key}: 应为键值对`);
  }
  if (isMap(parsed.tun)) for (const key of ['route-address-set', 'route-exclude-address-set', 'dns-hijack', 'route-exclude-address']) if (parsed.tun[key] !== undefined) stringList(parsed.tun[key], `tun.${key}`);
  if (errors.length) return { ok: false, error: errors.slice(0, 30).join('\n'), errors };
  return { ok: true, config: { proxies: [], 'proxy-groups': [], 'rule-providers': {}, rules: [], ...parsed }, warnings: [] };
}
export const isUsableConfig = value => normalizeConfig(value).ok;
