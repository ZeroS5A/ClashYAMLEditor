import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml, dumpYaml } from '../src/utils/yaml.js';
import { normalizeConfig } from '../src/utils/configShape.js';
import { createEditorState, editorReducer, HISTORY_LIMIT } from '../src/utils/history.js';
import { parseProxyLink, parseSubscriptionText, encodeBase64 } from '../src/utils/parser.js';
import { generateShareLink } from '../src/utils/shareLink.js';
import { parseRuleString, updateRuleTarget, insertBeforeMatch, deduplicateRules } from '../src/utils/rules.js';
import { replaceOutbound, deleteOutbounds, renameProviderReferences, deleteProvider } from '../src/utils/references.js';
import { mergeProxies, parseExtraFields } from '../src/utils/editing.js';
import { validateConfig } from '../src/utils/validation.js';
import { fetchText, mapConcurrent } from '../src/utils/network.js';

const base = () => parseYaml('proxies: []\nproxy-groups: []\nrules: [MATCH,DIRECT]'.replace('rules: [MATCH,DIRECT]', 'rules: ["MATCH,DIRECT"]'));
test('YAML preserves unknown fields, Unicode, false and zero without network defaults', () => {
  const config = parseYaml('mode: Rule\nport: 0\ncustom: {nested: [你好, false, 0]}\nproxy-groups:\n  - {name: G, type: select, proxies: [DIRECT], lazy: false, tolerance: 0, extension: {x: 1}}');
  assert.deepEqual(parseYaml(dumpYaml(config)), config);
  assert.equal(config['allow-lan'], undefined);
  assert.equal(config.dns, undefined);
});
test('invalid structures, cyclic aliases and alias amplification reject atomically', () => {
  for (const yaml of ['', '[]', 'rules: [1]', 'proxy-groups: [{name: G, type: select, proxies: [null]}]', 'proxy-providers: {x: {health-check: []}}', 'custom: &x {self: *x}']) assert.throws(() => parseYaml(yaml));
  let previous = [1]; const config = {};
  for (let i = 0; i < 22; i++) { previous = [previous, previous]; config[`a${i}`] = previous; }
  assert.equal(normalizeConfig(config).ok, false);
});
test('history keeps fast edits distinct, undo/redo branches correctly, and stays bounded', () => {
  let state = createEditorState({ n: 0 });
  const edit = n => { state = editorReducer(state, { type: 'edit', updater: { n } }); };
  edit(1); edit(2);
  state = editorReducer(state, { type: 'undo' }); assert.equal(state.config.n, 1);
  state = editorReducer(state, { type: 'redo' }); assert.equal(state.config.n, 2);
  state = editorReducer(state, { type: 'undo' }); edit(3);
  assert.equal(state.redo.length, 0);
  assert.equal(editorReducer(state, { type: 'edit', updater: x => x }), state);
  for (let n = 4; n < 100; n++) edit(n);
  assert.equal(state.undo.length, HISTORY_LIMIT);
});
const nodes = [
  {name:'SS 中文',type:'ss',server:'2001:db8::1',port:443,cipher:'aes-128-gcm',password:'密:码% @',plugin:'obfs','plugin-opts':{mode:'tls',host:'host.example'}},
  {name:'VLESS',type:'vless',server:'example.com',port:443,uuid:'u',network:'ws',tls:true,servername:'sni.example','client-fingerprint':'chrome',alpn:['h2','http/1.1'],'skip-cert-verify':false,'ws-opts':{path:'/路径?a=b',headers:{Host:'host.example'}}},
  {name:'Trojan',type:'trojan',server:'2001:db8::2',port:443,password:'p:%2F @中文',sni:'s.example',network:'grpc','grpc-opts':{'grpc-service-name':'service'},'skip-cert-verify':false},
  {name:'TUIC',type:'tuic',server:'example.com',port:443,uuid:'uuid',password:'p:@%中文',alpn:['h3'],'udp-relay-mode':'native','congestion-controller':'bbr'},
  {name:'Hy2',type:'hysteria2',server:'example.com',port:443,ports:'443,500-600',password:'p:%中文',obfs:'salamander','obfs-password':'obfs password',sni:'example.com','skip-cert-verify':true},
  {name:'VMess 中文',type:'vmess',server:'example.com',port:443,uuid:'u',alterId:0,cipher:'auto',network:'ws',tls:true,servername:'sni.example','client-fingerprint':'chrome',alpn:['h2'],'skip-cert-verify':false,'ws-opts':{path:'/ws',headers:{Host:'host.example'}}},
  {name:'SSR',type:'ssr',server:'2001:db8::3',port:443,cipher:'aes-256-cfb',password:'密码',protocol:'auth_sha1_v4',obfs:'tls1.2_ticket_auth','obfs-param':'host','protocol-param':'x'},
];
for (const node of nodes) test(`${node.type} share link roundtrip preserves encoded credentials and options`, () => assert.deepEqual(parseProxyLink(generateShareLink(node)), node));
test('hy2 legacy jumping ports and unnamed links work without randomUUID', () => {
  const p = parseProxyLink('hy2://pass@example.com:443,500-600?sni=a#test');
  assert.equal(p.port, 443); assert.equal(p.ports,'443,500-600');
  assert.match(parseProxyLink('trojan://pass@example.com').name,/^trojan-/);
});
test('subscriptions parse Base64 and YAML, keep per-link failures without revealing URI', () => {
  const items = parseSubscriptionText(encodeBase64(generateShareLink(nodes[1]) + '\nss://bad'));
  assert.equal(items[0].proxy.name, 'VLESS'); assert.ok(items[1].error); assert.equal(items[1].link,'[节点链接已隐藏]');
  assert.deepEqual(parseSubscriptionText(dumpYaml({...base(),proxies:[nodes[0]]}))[0].proxy,nodes[0]);
});
test('logical rule commas and MATCH targets parse and update correctly', () => {
  const r='AND,((DOMAIN,a.example),(OR,((RULE-SET,A),(IP-CIDR,10.0.0.0/8)))),G,no-resolve';
  assert.equal(parseRuleString(r).target,'G');
  assert.equal(updateRuleTarget(r,'G','New'),r.replace(',G,no-resolve',',New,no-resolve'));
  assert.equal(updateRuleTarget('MATCH,G','G','New'),'MATCH,New');
  assert.equal(updateRuleTarget('SUB-RULE,(DOMAIN,a),G','G','New'),'SUB-RULE,(DOMAIN,a),G');
  assert.ok(parseRuleString('AND,((DOMAIN,a),G').error);
  assert.deepEqual(insertBeforeMatch(['DOMAIN,a,DIRECT','MATCH,DIRECT'],'DOMAIN,b,DIRECT'),['DOMAIN,a,DIRECT','DOMAIN,b,DIRECT','MATCH,DIRECT']);
});
test('rule deduplication preserves first occurrence, ordering, targets and exact original text', () => {
  const a = 'DOMAIN-SUFFIX,example.com,DIRECT';
  const b = 'DOMAIN-SUFFIX,example.com,REJECT';
  const logical = 'AND,((DOMAIN,a.example),(IP-CIDR,10.0.0.0/8)),DIRECT,no-resolve';
  const spaced = 'DOMAIN-SUFFIX, example.com,DIRECT';
  const original = [a, b, a, logical, logical, spaced, 'MATCH,DIRECT', a, 'MATCH,DIRECT'];
  assert.deepEqual(deduplicateRules(original), [a, b, logical, spaced, 'MATCH,DIRECT']);
  assert.equal(original.length, 9);
  const unique = [a, b];
  assert.equal(deduplicateRules(unique), unique);
  assert.deepEqual(deduplicateRules([]), []);
});

test('rename/delete updates nodes, groups, MATCH, subrules, DNS, provider and TUN references', () => {
  const c={...base(),proxies:[{...nodes[1],name:'N','dialer-proxy':'G'}],'proxy-groups':[{name:'G',type:'select',proxies:['N']},{name:'H',type:'select',proxies:['G'],use:['P']}],rules:['MATCH,G','AND,((RULE-SET,A),(DOMAIN,a)),G'],'sub-rules':{sub:['MATCH,G']},'rule-providers':{A:{type:'inline',behavior:'domain',payload:[]}},dns:{nameserver:['https://dns.example/dns-query#G&h3=true'],'nameserver-policy':{'rule-set:A,B':['1.1.1.1']},'fake-ip-filter':['rule-set:A,B','rule-set:AB']},tun:{'route-address-set':['A']},'proxy-providers':{P:{type:'inline',payload:[]}}};
  const renamed=replaceOutbound(c,'G','New');
  assert.equal(renamed.proxies[0]['dialer-proxy'],'New'); assert.equal(renamed.rules[0],'MATCH,New'); assert.equal(renamed['sub-rules'].sub[0],'MATCH,New'); assert.match(renamed.dns.nameserver[0],/#New&/);
  const removed=deleteOutbounds(c,new Set(['G']),'proxy-groups');
  assert.deepEqual(removed['proxy-groups'][0].proxies,[]); assert.equal(removed.rules[0],'MATCH,DIRECT');
  const rp=renameProviderReferences(c,'A','Z'); assert.match(rp.rules[1],/RULE-SET,Z/); assert.deepEqual(rp.tun['route-address-set'],['Z']); assert.deepEqual(rp.dns['fake-ip-filter'],['rule-set:Z,B','rule-set:AB']);
  const deleted=deleteProvider(c,'A'); assert.deepEqual(deleted.rules,['MATCH,G']); assert.deepEqual(deleted.dns['fake-ip-filter'],['rule-set:B','rule-set:AB']); assert.ok(deleted.dns['nameserver-policy']['rule-set:B']);
  assert.deepEqual(renameProviderReferences(c,'P','Q','proxy-providers')['proxy-groups'][1].use,['Q']);
  assert.deepEqual(deleteProvider(c,'P','proxy-providers')['proxy-groups'][1].use,[]);
  const custom={...c,custom:{proxy:'G','dialer-proxy':'G',proxies:['G']}};
  assert.equal(replaceOutbound(custom,'G','New').custom,custom.custom);
});
test('subscription merge retains local advanced fields and custom rules/groups in every mode', () => {
  const c={...base(),proxies:[{...nodes[1],custom:{x:1},'dialer-proxy':'DIRECT'}],'proxy-groups':[{name:'G',type:'select',proxies:['VLESS']}]};
  const incoming={...nodes[1],server:'new.example'};
  const update=mergeProxies(c,[incoming]); assert.equal(update.updated,1); assert.deepEqual(update.config.proxies[0].custom,{x:1}); assert.equal(update.config.rules,c.rules); assert.equal(update.config['proxy-groups'],c['proxy-groups']);
  assert.equal(mergeProxies(c,[incoming],'keep').config.proxies[1].name,'VLESS (2)');
  assert.equal(mergeProxies(c,[incoming],'new').config.proxies.length,1);
  assert.throws(() => parseExtraFields('{"name":"x"}',['name'])); assert.throws(() => parseExtraFields('[]'));
});
test('diagnostics catches cycles, invalid MRS and missing refs, handles long acyclic chains', () => {
  const c={...base(),'proxy-groups':[{name:'A',type:'select',proxies:['B']},{name:'B',type:'select',proxies:['A']}],'rule-providers':{bad:{type:'file',path:'custom.data',format:'mrs',behavior:'classical'}}};
  assert.ok(validateConfig(c).some(i=>i.message.includes('循环引用'))); assert.ok(validateConfig(c).some(i=>i.message.includes('MRS')));
  assert.ok(validateConfig({...base(),rules:['MATCH,missing']}).some(i=>i.level==='error'));
  const long={...base(),'proxy-groups':Array.from({length:15000},(_,i)=>({name:`G${i}`,type:'select',proxies:[i===14999?'DIRECT':`G${i+1}`]}))};
  assert.equal(validateConfig(long).filter(i=>i.level==='error').length,0);
  assert.equal(validateConfig({}).filter(i=>i.level==='error').length,0);
});
test('duplicate diagnostics identify the full rule and first occurrence within each rule list', () => {
  const rule = 'DOMAIN-SUFFIX,example.com,DIRECT';
  const c = { ...base(), rules: [rule, rule, rule, 'DOMAIN-SUFFIX,example.com,REJECT'],
    'sub-rules': { '工作.规则': [rule, rule] },
    dns: { 'fake-ip-filter-mode': 'rule', 'fake-ip-filter': [rule, rule] } };
  const duplicates = validateConfig(c).filter(i => i.message.startsWith('重复规则'));
  assert.deepEqual(duplicates.map(i => [i.path, i.related.path]), [
    ['rules[1]', 'rules[0]'], ['rules[2]', 'rules[0]'],
    ['sub-rules.工作.规则[1]', 'sub-rules.工作.规则[0]'],
    ['dns.fake-ip-filter[1]', 'dns.fake-ip-filter[0]'],
  ]);
  for (const issue of duplicates) {
    assert.equal(issue.rule, rule);
    assert.match(issue.message, /example\.com/);
    assert.match(issue.related.label, /第 1 条/);
  }
  assert.equal(duplicates[2].subject, '子规则「工作.规则」 · 第 2 条');
  assert.equal(duplicates[3].tab, 'dns');
  assert.equal(validateConfig({ ...c, rules: [rule], 'sub-rules': { sub: [rule] }, dns: {} }).filter(i => i.message.startsWith('重复规则')).length, 0);
});

test('all rule failures retain original text and MATCH warnings identify the first catch-all', () => {
  const rules = ['MATCH,DIRECT', 'AND,((DOMAIN,a.example),DIRECT', 'IP-CIDR,999.1.1.1/99,missing', 'RULE-SET,missing,DIRECT', 'SUB-RULE,(DOMAIN,a.example),missing', 'MATCH,DIRECT'];
  const issues = validateConfig({ ...base(), rules }).filter(i => i.path.startsWith('rules['));
  for (const issue of issues) {
    const index = Number(/\[(\d+)\]/.exec(issue.path)[1]);
    assert.equal(issue.rule, rules[index]);
    assert.equal(issue.subject, `主规则 · 第 ${index + 1} 条`);
    if (issue.message.includes('MATCH 后')) assert.equal(issue.related.path, 'rules[0]');
  }
  for (const text of ['括号', 'IP-CIDR', '出站', '规则集', '子规则', '重复规则：MATCH']) assert.ok(issues.some(i => i.message.includes(text)));
  const logical = 'AND,((DOMAIN,a.example),(IP-CIDR,10.0.0.0/8)),DIRECT';
  assert.equal(validateConfig({ ...base(), rules: [logical, logical] }).find(i => i.message.startsWith('重复规则')).rule, logical);
});

test('node and group diagnostics identify the affected name', () => {
  const issues = validateConfig({ ...base(), proxies: [{ name: '香港节点', type: 'ss' }], 'proxy-groups': [{ name: '视频分流', type: 'select', proxies: [] }] });
  assert.equal(issues.find(i => i.path === 'proxies[0].server').subject, '节点「香港节点」');
  assert.equal(issues.find(i => i.path === 'proxy-groups[0]').subject, '策略组「视频分流」');
});

test('network limits HTTP status, content length, streamed bytes, timeout and cancellation', async t => {
  t.mock.method(globalThis,'fetch',async()=>new Response('bad',{status:500})); await assert.rejects(fetchText('https://test'),/HTTP 500/);
  globalThis.fetch=async()=>new Response('abcd',{headers:{'content-length':'4'}}); await assert.rejects(fetchText('https://test',{maxBytes:3}),/大小限制/);
  globalThis.fetch=async()=>new Response('abcd'); await assert.rejects(fetchText('https://test',{maxBytes:3}),/大小限制/);
  globalThis.fetch=(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  await assert.rejects(fetchText('https://test',{timeout:10}),/超时/);
  const c=new AbortController(),pending=fetchText('https://test',{signal:c.signal}); c.abort(); await assert.rejects(pending,{name:'AbortError'});
  await assert.rejects(fetchText('file:///a'),/HTTP/);
});
test('subscription requests stay within concurrency limit and preserve input order', async()=>{
  let active=0,max=0;
  const result=await mapConcurrent([1,2,3,4,5,6],async n=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return n*2;},3);
  assert.equal(max,3); assert.deepEqual(result,[2,4,6,8,10,12]);
});
