import { DEFAULT_EMPTY_CONFIG } from '../constants/templates';

/**
 * 校验并规范化从用户处导入的配置对象。
 *
 * 目的：YAML 是用户可控的，`proxies: {}` / `rules: "abc"` 这类写法会让后续
 * 的 `.map` / `.length` 直接抛错并整页崩溃。这里统一收口成可信形状。
 *
 * @returns {{ ok: true, config: object, warnings: string[] } | { ok: false, error: string }}
 */
export const normalizeConfig = (parsed) => {
  if (parsed === null || parsed === undefined) {
    return { ok: false, error: '内容为空，没有可解析的配置' };
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      error: `顶层结构必须是键值对（当前是${Array.isArray(parsed) ? '数组' : typeof parsed}）`,
    };
  }

  const warnings = [];

  // 缺失 / 类型错误的一律回落到默认空值，保证下游可以安全使用
  const arrayField = (key) => {
    const value = parsed[key];
    if (value === undefined || value === null) return DEFAULT_EMPTY_CONFIG[key];
    if (Array.isArray(value)) return value;
    warnings.push(`字段「${key}」应为列表，已忽略无效内容`);
    return DEFAULT_EMPTY_CONFIG[key];
  };

  const mapField = (key) => {
    const value = parsed[key];
    if (value === undefined || value === null) return DEFAULT_EMPTY_CONFIG[key];
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    warnings.push(`字段「${key}」应为键值对，已忽略无效内容`);
    return DEFAULT_EMPTY_CONFIG[key];
  };

  const proxies = arrayField('proxies');
  const proxyGroups = arrayField('proxy-groups');
  const rules = arrayField('rules');
  const ruleProviders = mapField('rule-providers');

  // 过滤器不能是单个对象，否则 Clash 侧会报错，这里提前提示
  const filters = parsed.filters;
  if (filters !== undefined && filters !== null && (typeof filters !== 'object' || Array.isArray(filters))) {
    warnings.push('字段「filters」应为键值对，已忽略无效内容');
  }

  // 丢弃明显不是节点的条目，避免卡片渲染时再次抛错
  const validProxies = proxies.filter((p) => {
    if (p && typeof p === 'object' && !Array.isArray(p)) return true;
    warnings.push('已忽略 1 条格式不正确的节点（不是键值对）');
    return false;
  });

  const validGroups = proxyGroups.filter((g) => {
    if (g && typeof g === 'object' && !Array.isArray(g)) return true;
    warnings.push('已忽略 1 个格式不正确的策略组（不是键值对）');
    return false;
  });

  const normalized = {
    ...DEFAULT_EMPTY_CONFIG,
    ...parsed,
    proxies: validProxies,
    'proxy-groups': validGroups,
    'rule-providers': ruleProviders,
    rules,
  };

  if (filters !== undefined && filters !== null && (typeof filters !== 'object' || Array.isArray(filters))) {
    delete normalized.filters;
  }

  return { ok: true, config: normalized, warnings };
};

/** 判断一个对象能否安全地作为配置传入各标签页（用于恢复本地草稿时兜底） */
export const isUsableConfig = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const arrayKeys = ['proxies', 'proxy-groups', 'rules'];
  if (!arrayKeys.every((k) => Array.isArray(value[k]))) return false;
  const providers = value['rule-providers'];
  return providers === undefined || providers === null || (typeof providers === 'object' && !Array.isArray(providers));
};
