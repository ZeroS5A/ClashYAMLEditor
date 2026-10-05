import { parseYaml, dumpYaml } from './yaml.js';
import { parseSubscriptionText } from './parser.js';

self.onmessage = ({ data }) => {
  try {
    const result = data.type === 'parse' ? parseYaml(data.value) : data.type === 'subscription' ? parseSubscriptionText(data.value) : dumpYaml(data.value);
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error.message }); }
};
