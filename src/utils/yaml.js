import { load, dump, JSON_SCHEMA } from 'js-yaml';
import { normalizeConfig } from './configShape.js';

export const MAX_TEXT_BYTES = 20 * 1024 * 1024;
export function parseYaml(text) {
  if (new TextEncoder().encode(text).length > MAX_TEXT_BYTES) throw new Error('配置超过 20 MiB，请拆分规则集后重试');
  const result = normalizeConfig(load(text, { schema: JSON_SCHEMA }));
  if (!result.ok) throw new Error(result.error);
  return result.config;
}
export const dumpYaml = config => dump(config, { schema: JSON_SCHEMA, indent: 2, lineWidth: -1, noRefs: true });
