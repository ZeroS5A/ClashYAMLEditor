export function splitRuleParts(value) {
  if (typeof value !== 'string') throw new Error('规则必须为字符串');
  const parts = [];
  let start = 0, depth = 0, quote = '', escaped = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '(') depth++;
    if (c === ')') { depth--; if (depth < 0) throw new Error('规则括号不匹配'); }
    if (c === ',' && depth === 0) { parts.push(value.slice(start, i)); start = i + 1; }
  }
  if (depth || quote) throw new Error('规则括号或引号未闭合');
  parts.push(value.slice(start));
  return parts;
}

export function parseRuleString(str) {
  try {
    const parts = splitRuleParts(str);
    const type = parts[0].trim();
    const targetIndex = type === 'MATCH' ? 1 : 2;
    if (!parts[targetIndex]?.trim()) throw new Error('规则缺少目标');
    return { type, payload: type === 'MATCH' ? '' : parts[1], target: parts[targetIndex].trim(), extra: parts.slice(targetIndex + 1).join(','), raw: str };
  } catch (error) {
    return { type: 'UNKNOWN', payload: String(str), target: '', extra: '', raw: String(str), error: error.message };
  }
}

export function updateRuleTarget(rule, oldName, newName) {
  const parsed = parseRuleString(rule);
  if (parsed.error || parsed.type === 'SUB-RULE' || parsed.target !== oldName) return rule;
  const parts = splitRuleParts(rule);
  parts[parsed.type === 'MATCH' ? 1 : 2] = newName;
  return parts.join(',');
}

export function ruleProviderNames(rule) {
  return [...String(rule).matchAll(/(?:^|[(,])\s*RULE-SET\s*,\s*([^,()]+)/g)].map(m => m[1].trim());
}

export function renameRuleProvider(rule, oldName, newName) {
  return rule.replace(/(^|[(,])(\s*RULE-SET\s*,\s*)([^,()]+)/g, (all, prefix, label, name) => name.trim() === oldName ? `${prefix}${label}${newName}` : all);
}

export function insertBeforeMatch(rules, rule) {
  const index = rules.findIndex(r => parseRuleString(r).type === 'MATCH');
  const next = [...rules];
  next.splice(index < 0 ? next.length : index, 0, rule);
  return next;
}

export function deduplicateRules(rules) {
  const unique = [...new Set(rules)];
  return unique.length === rules.length ? rules : unique;
}
