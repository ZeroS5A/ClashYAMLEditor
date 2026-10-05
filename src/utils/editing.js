import { isMap } from './configShape.js';

export function parseExtraFields(text, reserved = []) {
  const value = JSON.parse(text || '{}');
  if (!isMap(value)) throw new Error('高级参数必须为 JSON 对象');
  for (const key of reserved) if (Object.hasOwn(value, key)) throw new Error(`高级参数不能重复设置 ${key}，请使用对应表单`);
  return value;
}
export function omitFields(value, fields) { return Object.fromEntries(Object.entries(value).filter(([key]) => !fields.includes(key))); }
export function mergeProxies(config, incoming, mode = 'update') {
  const proxies = [...config.proxies], positions = new Map(proxies.map((p, i) => [p.name, i]));
  const occupied = new Set([...positions.keys(), ...config['proxy-groups'].map(g => g.name), 'DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE']);
  let added = 0, updated = 0;
  for (const item of incoming) {
    const proxy = omitFields(item, ['_status', '_oldName', '_source']);
    let name = proxy.name;
    if (mode === 'keep' || (!positions.has(name) && occupied.has(name))) {
      let suffix = 2; while (occupied.has(name)) name = `${proxy.name} (${suffix++})`;
    }
    if (mode === 'new' && occupied.has(name)) continue;
    const index = positions.get(name);
    if (index !== undefined) { proxies[index] = { ...proxies[index], ...proxy, name }; updated++; }
    else { positions.set(name, proxies.length); occupied.add(name); proxies.push({ ...proxy, name }); added++; }
  }
  return { config: { ...config, proxies }, added, updated };
}
