import { parseRuleString, updateRuleTarget, renameRuleProvider, ruleProviderNames } from './rules.js';

function mapRules(config, transform) {
  const result = { ...config, rules: config.rules.map(transform).filter(r => r !== null) };
  if (config['sub-rules']) result['sub-rules'] = Object.fromEntries(Object.entries(config['sub-rules']).map(([k, rules]) => [k, rules.map(transform).filter(r => r !== null)]));
  return result;
}

export function replaceOutbound(config, oldName, newName, removeMember = false) {
  const swapField = (value, key) => value[key] === oldName ? { ...value, [key]: newName } : value;
  const updated = { ...config,
    proxies: config.proxies.map(p => swapField(p, 'dialer-proxy')),
    'proxy-groups': config['proxy-groups'].map(g => g.proxies ? { ...g, proxies: g.proxies.filter(n => !(removeMember && n === oldName)).map(n => n === oldName ? newName : n) } : g),
  };
  for (const kind of ['proxy-providers', 'rule-providers']) if (config[kind]) updated[kind] = Object.fromEntries(Object.entries(config[kind]).map(([name, provider]) => {
    let value = swapField(provider, 'proxy');
    if (provider.override) value = { ...value, override: swapField(provider.override, 'dialer-proxy') };
    if (kind === 'proxy-providers' && provider.payload) value = { ...value, payload: provider.payload.map(p => p && typeof p === 'object' ? swapField(p, 'dialer-proxy') : p) };
    return [name, value];
  }));
  const next = mapRules(updated, r => updateRuleTarget(r, oldName, newName));
  if (config.dns) {
    next.dns = { ...next.dns };
    const swap = v => typeof v === 'string' ? v.replace(/#([^&]+)(?=&|$)/g, (all, name) => name === oldName ? `#${newName}` : all) : v;
    for (const key of ['nameserver', 'fallback', 'default-nameserver', 'proxy-server-nameserver', 'direct-nameserver']) if (Array.isArray(next.dns[key])) next.dns[key] = next.dns[key].map(swap);
    for (const key of ['nameserver-policy', 'proxy-server-nameserver-policy']) if (next.dns[key]) next.dns[key] = Object.fromEntries(Object.entries(next.dns[key]).map(([k, v]) => [k, Array.isArray(v) ? v.map(swap) : swap(v)]));
  }
  return next;
}

export function deleteOutbounds(config, names, kind = 'proxies') {
  let next = { ...config, [kind]: config[kind].filter(p => !names.has(p.name)) };
  for (const name of names) next = replaceOutbound(next, name, 'DIRECT', true);
  return next;
}

export function renameProviderReferences(config, oldName, newName, kind = 'rule-providers') {
  if (kind === 'proxy-providers') return { ...config, 'proxy-groups': config['proxy-groups'].map(g => g.use ? { ...g, use: g.use.map(n => n === oldName ? newName : n) } : g) };
  let next = mapRules(config, r => renameRuleProvider(r, oldName, newName));
  if (config.dns) {
    next.dns = { ...config.dns };
    for (const key of ['nameserver-policy', 'proxy-server-nameserver-policy']) if (config.dns[key]) next.dns[key] = Object.fromEntries(Object.entries(config.dns[key]).map(([k, v]) => [k.startsWith('rule-set:') ? `rule-set:${k.slice(9).split(',').map(n => n.trim() === oldName ? newName : n).join(',')}` : k, v]));
    if (config.dns['fake-ip-filter']) next.dns['fake-ip-filter'] = config.dns['fake-ip-filter'].map(r => r.startsWith('rule-set:') ? `rule-set:${r.slice(9).split(',').map(n => n.trim() === oldName ? newName : n).join(',')}` : renameRuleProvider(r, oldName, newName));
  }
  if (config.tun) {
    next.tun = { ...config.tun };
    for (const key of ['route-address-set', 'route-exclude-address-set']) if (config.tun[key]) next.tun[key] = config.tun[key].map(n => n === oldName ? newName : n);
  }
  return next;
}

export function deleteProvider(config, name, kind = 'rule-providers') {
  const providers = { ...config[kind] }; delete providers[name];
  let next = { ...config, [kind]: providers };
  if (kind === 'proxy-providers') return { ...next, 'proxy-groups': next['proxy-groups'].map(g => g.use ? { ...g, use: g.use.filter(n => n !== name) } : g) };
  next = mapRules(next, r => ruleProviderNames(r).includes(name) ? null : r);
  if (next.dns) {
    next.dns = { ...next.dns };
    for (const key of ['nameserver-policy', 'proxy-server-nameserver-policy']) if (next.dns[key]) next.dns[key] = Object.fromEntries(Object.entries(next.dns[key]).flatMap(([k, v]) => {
      if (!k.startsWith('rule-set:')) return [[k, v]];
      const remaining = k.slice(9).split(',').filter(n => n.trim() !== name);
      return remaining.length ? [[`rule-set:${remaining.join(',')}`, v]] : [];
    }));
    if (next.dns['fake-ip-filter']) next.dns['fake-ip-filter'] = next.dns['fake-ip-filter'].flatMap(r => {
      if (!r.startsWith('rule-set:')) return ruleProviderNames(r).includes(name) ? [] : [r];
      const remaining = r.slice(9).split(',').filter(n => n.trim() !== name);
      return remaining.length ? [`rule-set:${remaining.join(',')}`] : [];
    });
  }
  if (next.tun) {
    next.tun = { ...next.tun };
    for (const key of ['route-address-set', 'route-exclude-address-set']) if (next.tun[key]) next.tun[key] = next.tun[key].filter(n => n !== name);
  }
  return next;
}

export function outboundReferences(config, name) {
  const refs = [];
  function walk(value, path = '') {
    if (Array.isArray(value)) value.forEach((v, i) => {
      if (path.endsWith('.proxies') && v === name) refs.push(`${path}[${i}]`);
      walk(v, `${path}[${i}]`);
    });
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) {
      const next = path ? `${path}.${k}` : k;
      if (['proxy', 'dialer-proxy'].includes(k) && v === name) refs.push(next);
      if (k === 'rules' && Array.isArray(v)) v.forEach((r, i) => { if (parseRuleString(r).target === name) refs.push(`${next}[${i}]`); });
      walk(v, next);
    }
  }
  walk(config);
  for (const [key, rules] of Object.entries(config['sub-rules'] || {})) rules.forEach((r, i) => { if (parseRuleString(r).target === name) refs.push(`sub-rules.${key}[${i}]`); });
  return refs;
}
