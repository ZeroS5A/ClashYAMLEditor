import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseYaml } from '../../src/utils/yaml.js';
import { parseProxyLink } from '../../src/utils/parser.js';

const config = {
  mode:'Rule',port:0,proxies:[{name:'N',type:'ss',server:'example.com',port:443,cipher:'aes-128-gcm',password:'秘密',custom:{keep:true}}],
  'proxy-groups':[{name:'G',type:'select',proxies:['N','DIRECT'],use:['P'],lazy:false,tolerance:0,custom:{keep:true}}],
  'proxy-providers':{P:{type:'http',url:'https://example.com/sub',interval:86400,header:{Authorization:['secret']},override:{udp:true}}},
  'rule-providers':{A:{type:'file',path:'custom.rules',format:'yaml',behavior:'classical',custom:{keep:true}}},
  rules:['RULE-SET,A,G','MATCH,N'],'sub-rules':{sub:['MATCH,G']},dns:{nameserver:['https://dns.example/dns-query#G']},
};
async function seed(page, value=config, extra={}) {
  await page.addInitScript(({value,extra})=>{
    localStorage.setItem('clash-editor:draft:v1',JSON.stringify({config:value,savedAt:Date.now(),...extra}));
  },{value,extra});
  await page.goto('/');
  await page.getByRole('button',{name:'保留草稿'}).click();
}
async function tab(page,label) {
  if (['DNS 设置', '透明代理与 TUN', '代理集合'].includes(label)) {
    const advanced = page.getByRole('button', { name: '高级设置', exact: true });
    if (await advanced.getAttribute('aria-expanded') === 'false') await advanced.click();
  }
  await page.getByRole('button',{name:new RegExp(`^${label}`)}).click();
}
async function exported(page) {
  await tab(page,'导出配置');
  await expect(page.getByRole('button',{name:'下载 YAML',exact:true})).toBeEnabled();
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'下载 YAML',exact:true}).click();
  return parseYaml(await readFile(await (await download).path(),'utf8'));
}
test('diagnostics show full duplicate rules, wrap on mobile, and locate both occurrences', async ({ page }) => {
  const rule = `AND,((${Array.from({ length: 12 }, (_, i) => `DOMAIN,website-${i}.example.com`).join('),(')})),DIRECT`;
  const rules = [rule, ...Array.from({ length: 120 }, (_, i) => `DOMAIN,unique-${i}.example.com,DIRECT`), rule];
  await seed(page, { ...config, rules });
  await tab(page, '配置体检');
  const list = page.getByRole('list', { name: '配置体检结果' });
  const duplicate = list.getByRole('listitem').filter({ hasText: '重复规则' });
  await expect(duplicate).toContainText('主规则 · 第 122 条');
  await expect(duplicate.locator('code')).toHaveText(rule);
  await expect(duplicate).toContainText('首次出现：主规则 · 第 1 条');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => duplicate.locator('code').evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
  await expect.poll(() => duplicate.locator('code').evaluate(el => el.scrollHeight - el.clientHeight)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await duplicate.getByRole('button', { name: '查看此规则', exact: true }).click();
  await expect(page.locator('[data-located="true"]').getByTestId('rule-order')).toHaveText('122.');
  await expect(page.locator('[data-located="true"]').getByTestId('rule-text')).toHaveText(rule);
  await expect(page.getByRole('button', { name: '编辑规则 122', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: '功能导航' }).selectOption('diagnostics');
  await duplicate.getByRole('button', { name: '首次出现：主规则 · 第 1 条', exact: true }).click();
  await expect(page.locator('[data-located="true"]').getByTestId('rule-order')).toHaveText('1.');
  await expect(page.getByRole('button', { name: '编辑规则 1', exact: true })).toBeVisible();
});

test('diagnostics refresh after bulk rule cleanup and undo without stale rows or overlap', async ({ page }, testInfo) => {
  const repeated = 'DOMAIN-SUFFIX,union.mi.com,DIRECT';
  const missing = 'DOMAIN,remaining.example.com,Missing';
  await seed(page, { ...config, rules: [...Array(80).fill(repeated), missing, 'MATCH,N'] });
  await tab(page, '配置体检');
  const list = page.getByRole('list', { name: '配置体检结果' });
  await expect(page.getByRole('status').filter({ hasText: '错误 1 · 警告 79' })).toBeVisible();
  await expect(list.getByRole('listitem')).toHaveCount(50);
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.getByText('第 2 / 2 页 · 共 82 项', { exact: true })).toBeVisible();
  await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(list).toContainText('尚未填写内核版本');
  await tab(page, '规则管理');
  await page.getByRole('button', { name: '清除重复', exact: true }).click();
  await tab(page, '配置体检');
  await expect(page.getByRole('status').filter({ hasText: '错误 1 · 警告 0' })).toBeVisible();
  await expect(list).not.toContainText('重复规则');
  await expect(list.locator('code')).toHaveText(missing);
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect.poll(() => list.getByRole('listitem').evaluateAll(rows => rows.every((row, i) => i === 0 || row.getBoundingClientRect().top >= rows[i - 1].getBoundingClientRect().bottom))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('diagnostics-after-cleanup.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '错误 1 · 警告 79' })).toBeVisible();
  await expect(page.getByText('第 1 / 2 页 · 共 82 项', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(list).toContainText('尚未填写内核版本');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list.locator('code')).toHaveText(missing);
  await expect(page.getByRole('button', { name: '下一页', exact: true })).toHaveCount(0);
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBe(0);
  const mutations = await list.evaluate(async el => {
    // A stable config should not keep rerendering or moving rows after cleanup.
    let changes = 0;
    const observer = new MutationObserver(records => { changes += records.length; });
    observer.observe(el, { attributes: true, childList: true, characterData: true, subtree: true });
    for (let i = 0; i < 45; i++) await new Promise(resolve => requestAnimationFrame(resolve));
    observer.disconnect();
    return changes;
  });
  expect(mutations).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => { const box = await list.boundingBox(); return box.y + box.height; }).toBeLessThanOrEqual(844);
  await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(list.getByRole('button', { name: '查看对应设置', exact: true }).last()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('diagnostics-mobile-after-cleanup.png'), animations: 'disabled' });
});

test('route cleanup removes all exact duplicates while searching and supports undo', async ({ page }) => {
  const a = 'DOMAIN-SUFFIX,example.com,DIRECT';
  const b = 'DOMAIN-SUFFIX,example.com,REJECT';
  const c = 'DOMAIN,other.example.com,G';
  const rules = [a, b, a, c, c, 'MATCH,N', 'MATCH,N'];
  await seed(page, { ...config, rules });
  await tab(page, '规则管理');
  const cleanup = page.getByRole('button', { name: '清除重复', exact: true });
  await expect(cleanup).toContainText('3');
  await page.getByRole('textbox', { name: '搜索规则' }).fill('other.example.com');
  await expect(page.getByRole('list', { name: '路由规则列表' }).getByRole('listitem')).toHaveCount(2);
  await cleanup.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(cleanup).toBeDisabled();
  await expect(page.getByText('已清除 3 条重复规则，保留首次出现项；可撤销恢复', { exact: true })).toBeVisible();
  const result = await exported(page);
  expect(result).toEqual({ ...config, rules: [a, b, c, 'MATCH,N'] });
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect((await exported(page)).rules).toEqual(rules);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  expect((await exported(page)).rules).toEqual([a, b, c, 'MATCH,N']);
});

test('route deletion requires confirmation, respects filtered indices, and can be undone', async ({ page }) => {
  const repeated = 'DOMAIN-SUFFIX,example.com,DIRECT';
  const rules = ['DOMAIN,other.example.com,DIRECT', repeated, repeated, 'MATCH,N'];
  await seed(page, { ...config, rules });
  await tab(page, '规则管理');
  await page.getByRole('textbox', { name: '搜索规则' }).fill('DOMAIN-SUFFIX');
  const list = page.getByRole('list', { name: '路由规则列表' });
  const remove = page.getByRole('button', { name: '删除规则 3', exact: true });
  const dialog = page.getByRole('dialog', { name: '删除路由规则' });
  await remove.click();
  await expect(dialog).toContainText('确定删除第 3 条路由规则？');
  await expect(dialog).toContainText(repeated);
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await remove.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await remove.click();
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(list.getByRole('listitem')).toHaveCount(1);
  expect((await exported(page)).rules).toEqual([rules[0], repeated, 'MATCH,N']);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect((await exported(page)).rules).toEqual(rules);
});

test('route rows keep separate numbers, raw rules and actions on one compact line', async ({ page }, testInfo) => {
  const name = '🍃 应用净化';
  const firstRule = `DOMAIN-SUFFIX,union.mi.com,${name}`;
  const payload = `AND,((${Array.from({ length: 10 }, (_, i) => `DOMAIN,website-${i}.example.com`).join('),(')})),${name},no-resolve`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page, { ...config, 'proxy-groups': [{ ...config['proxy-groups'][0], name }], rules: [firstRule, 'DOMAIN,ads.example.com,REJECT', payload, payload, ...Array.from({ length: 35 }, (_, i) => `DOMAIN,website-${i}.example.com,DIRECT`), 'MATCH,N'] });
  await tab(page, '规则管理');
  const list = page.getByRole('list', { name: '路由规则列表' });
  const first = list.getByTestId('rule-row').first();
  await expect(first.getByTestId('rule-order')).toHaveText('1.');
  await expect(first.getByTestId('rule-text')).toHaveText(firstRule);
  expect(await first.getByTestId('rule-text').getAttribute('title')).toBe(firstRule);
  expect((await first.boundingBox()).height).toBe(40);
  const fullyVisibleRows = await list.evaluate(el => {
    const bounds = el.getBoundingClientRect();
    return [...el.querySelectorAll('[data-testid="rule-row"]')].filter(row => {
      const box = row.getBoundingClientRect();
      return box.top >= bounds.top && box.bottom <= bounds.bottom;
    }).length;
  });
  expect(fullyVisibleRows).toBeGreaterThanOrEqual(10);
  await page.screenshot({ path: testInfo.outputPath('routes-desktop.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /规则集 .* 折叠/ }).click();
  const row = list.getByTestId('rule-row').filter({ has: page.getByRole('button', { name: '编辑规则 4', exact: true }) });
  await expect(row.getByTestId('rule-text')).toHaveText(payload);
  await expect(row).toHaveAttribute('title', '与第 3 条规则重复');
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    expect((await row.boundingBox()).height).toBe(40);
    expect(await row.getByTestId('rule-text').evaluate(el => getComputedStyle(el).whiteSpace)).toBe('nowrap');
    const centers = await row.evaluate(el => [...el.querySelectorAll('[data-testid="rule-order"], [data-testid="rule-text"], button')].map(child => {
      const box = child.getBoundingClientRect(); return box.y + box.height / 2;
    }));
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page.getByRole('button', { name: '清除重复', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`routes-mobile-${colorScheme}.png`), animations: 'disabled' });
  }
});

test('group viewport follows desktop window height, remains usable on mobile, and virtualizes 2000 rows',async({page})=>{
  await seed(page,{...config,'proxy-groups':Array.from({length:2000},(_,i)=>({name:`G${i}`,type:'select',proxies:['DIRECT']})),rules:['MATCH,DIRECT']});
  await page.setViewportSize({width:1280,height:1000}); await tab(page,'策略组管理');
  const list=page.getByTestId('virtual-list');
  await expect.poll(async()=> (await list.boundingBox()).height).toBeGreaterThan(700);
  const large=(await list.boundingBox()).height;
  await page.setViewportSize({width:1280,height:600});
  await expect.poll(async()=> (await list.boundingBox()).height).toBeLessThan(large-300);
  expect(await list.locator(':scope > div > div').count()).toBeLessThan(25);
  await list.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await expect(list).toContainText('G1999');
  expect(await list.locator(':scope > div > div').count()).toBeLessThan(25);
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('combobox',{name:'功能导航'})).toBeVisible();
  await expect.poll(async()=> (await list.boundingBox()).height).toBeGreaterThan(300);
  const box=await list.boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(845);
  await page.getByRole('combobox',{name:'功能导航'}).selectOption('export');
  await expect(page.getByRole('heading',{name:'导出配置'})).toBeVisible();
});
test('editing group and provider keeps advanced fields, updates all references, and undo restores them',async({page})=>{
  await seed(page); await tab(page,'策略组管理');
  await page.getByRole('button',{name:'编辑',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'编辑策略组'});
  await dialog.getByLabel('策略组名称').fill('Renamed');
  await expect(dialog.getByLabel('策略组名称')).toBeFocused();
  await dialog.getByRole('button',{name:'保存',exact:true}).click();
  const after=await exported(page);
  expect(after['proxy-groups'][0]).toEqual({...config['proxy-groups'][0],name:'Renamed'});
  expect(after['sub-rules'].sub).toEqual(['MATCH,Renamed']);expect(after.dns.nameserver[0]).toContain('#Renamed');
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  expect((await exported(page))['proxy-groups'][0]).toEqual(config['proxy-groups'][0]);
  await tab(page,'代理集合'); await page.getByRole('button',{name:'编辑 P',exact:true}).click();
  await page.getByRole('dialog').getByLabel('代理集合名称').fill('Q');
  await page.getByRole('button',{name:'保存代理集合参数'}).click();
  const provider=await exported(page);
  expect(provider['proxy-providers'].Q).toEqual(config['proxy-providers'].P);expect(provider['proxy-groups'][0].use).toEqual(['Q']);
});
test('offline YAML edits copy and download directly; invalid import keeps original',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await seed(page); await tab(page,'导出配置');
  const source=page.getByRole('textbox',{name:'配置源码'});
  await expect(source).toBeEnabled();
  const current=await source.inputValue();await source.fill(current.replace('port: 0','port: 8000'));
  await page.getByRole('button',{name:'复制 YAML',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'应用源码修改'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/下载未校验|下载源码备份/})).toHaveCount(0);
  await expect(source).toHaveValue(/port: 8000/);
  await page.getByRole('button',{name:'复制 YAML',exact:true}).click();
  const copied=await page.evaluate(()=>navigator.clipboard.readText());
  expect(parseYaml(copied).port).toBe(8000);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载 YAML',exact:true}).click();
  expect((await readFile(await (await download).path(),'utf8')).replaceAll('\r\n','\n')).toEqual(copied.replaceAll('\r\n','\n'));
  await tab(page,'导入配置');await page.getByRole('textbox',{name:'导入 YAML'}).fill('proxy-groups: [null]');await page.getByRole('button',{name:'解析并导入'}).click();
  await expect(page.getByRole('alert')).toContainText('应为键值对');
  expect((await exported(page)).port).toBe(8000);
});

test('configuration errors and invalid YAML only advise and never block exporting visible text', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await seed(page, { ...config, rules: ['MATCH,Missing'] });
  await tab(page, '导出配置');
  const source = page.getByRole('textbox', { name: '配置源码' });
  await expect(page.getByRole('status').filter({ hasText: '仍可直接复制或下载' })).toBeVisible();
  for (const draft of [null, '# keep this comment\nport: [invalid YAML']) {
    if (draft !== null) {
      await source.fill(draft);
      await page.getByText(/发现 .* 项配置提示/).click();
      await expect(page.getByText(/YAML 解析提示/)).toBeVisible();
    }
    const visible = await source.inputValue();
    await page.getByRole('button', { name: '复制 YAML', exact: true }).click();
    expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe(visible);
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载 YAML', exact: true }).click();
    const file = await downloaded;
    expect(file.suggestedFilename()).toBe('config.yaml');
    expect(await readFile(await file.path(), 'utf8')).toBe(visible);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '导出配置', exact: true })).toBeVisible();
  }
});

test('visual edits export the latest YAML while manual export edits can be kept or reset', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await seed(page);
  await tab(page, '基础设置');
  await page.getByRole('spinbutton', { name: 'port', exact: true }).fill('8123');
  await page.getByRole('button', { name: '保存基础设置' }).click();
  expect((await exported(page)).port).toBe(8123);
  const source = page.getByRole('textbox', { name: '配置源码' });
  const draft = (await source.inputValue()) + '\n# manually edited';
  await source.fill(draft);
  await tab(page, '基础设置');
  await page.getByRole('spinbutton', { name: 'port', exact: true }).fill('8124');
  await page.getByRole('button', { name: '保存基础设置' }).click();
  await tab(page, '导出配置');
  await expect(page.getByText('其他页面的配置已更新。', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '复制 YAML', exact: true }).click();
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe(draft);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '恢复编辑器配置', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确定', exact: true }).click();
  expect((await exported(page)).port).toBe(8124);
  await expect(source).not.toHaveValue(/manually edited/);
});
test('persistence reports quota failures, retries, saves raw draft, and supports new undo branches',async({page})=>{
  await page.addInitScript(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key==='clash-editor:draft:v1' && window.quotaFail)throw new DOMException('full','QuotaExceededError');return original.call(this,key,value);};
  });
  await seed(page);await page.evaluate(()=>{window.quotaFail=true;});
  await tab(page,'基础设置');await page.getByRole('spinbutton',{name:'port',exact:true}).fill('9000');await page.getByRole('button',{name:'保存基础设置'}).click();
  await expect(page.getByRole('status').first()).toContainText('存储空间不足');
  await page.evaluate(()=>{window.quotaFail=false;});await page.getByRole('button',{name:'重试保存'}).click();await expect(page.getByRole('status').first()).toContainText('已保存');
  await page.getByRole('button',{name:'撤销',exact:true}).click();await page.getByRole('spinbutton',{name:'port',exact:true}).fill('9100');await page.getByRole('button',{name:'保存基础设置'}).click();
  await expect(page.getByRole('button',{name:'重做',exact:true})).toBeDisabled();
  await tab(page,'导出配置');const source=page.getByRole('textbox',{name:'配置源码'});await expect(source).toBeEnabled();await source.fill((await source.inputValue())+'\n# pending source');
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('clash-editor:draft:v1')).sourceDraft?.text)).toContain('# pending source');
  // Remove the seed script by opening a fresh page in the same storage context.
  const restored=await page.context().newPage();await restored.goto('/');await tab(restored,'导出配置');await expect(restored.getByRole('textbox',{name:'配置源码'})).toHaveValue(/# pending source/);
  await restored.getByRole('checkbox',{name:'记住草稿（含凭证）'}).uncheck();
  expect(await restored.evaluate(()=>localStorage.getItem('clash-editor:draft:v1'))).toBeNull();await restored.close();
});
test('50000 rules keep DOM bounded after scrolling and filtering',async({page})=>{
  await seed(page,{...config,rules:[...Array.from({length:50000},(_,i)=>`DOMAIN,host${i}.example,DIRECT`),'MATCH,DIRECT']});
  await tab(page,'规则管理');const list=page.getByTestId('virtual-list').last();expect(await list.locator(':scope > div > div').count()).toBeLessThan(30);
  await list.evaluate(el=>{el.scrollTop=el.scrollHeight;});await expect(list.getByTestId('rule-order').last()).toHaveText('50001.');await expect(list.getByTestId('rule-text').last()).toHaveText('MATCH,DIRECT');
  await page.getByRole('textbox',{name:'搜索规则'}).fill('host12345.');await expect(list).toContainText('host12345.example');await expect(list.locator(':scope > div > div')).toHaveCount(1);
});
test('rule list fills remaining height and provider cards reflow and collapse with large collections',async({page})=>{
  await page.setViewportSize({width:1920,height:1000});
  const providers=Object.fromEntries(Array.from({length:240},(_,i)=>[`R${i}`,{type:'file',path:`rules/${i}.yaml`,format:'yaml',behavior:'domain'}]));
  await seed(page,{...config,'rule-providers':providers,rules:[...Array.from({length:1000},(_,i)=>`DOMAIN,host${i}.example,DIRECT`),'MATCH,DIRECT']});
  await tab(page,'规则管理');
  const grid=page.getByTestId('provider-grid'),routes=page.getByTestId('virtual-list').last();
  const firstRowCount=()=>grid.getByRole('heading',{level:3}).evaluateAll(nodes=>{
    const top=nodes[0]?.getBoundingClientRect().top;
    return nodes.filter(n=>Math.abs(n.getBoundingClientRect().top-top)<1).length;
  });
  await expect.poll(firstRowCount).toBeGreaterThanOrEqual(4);
  const high=(await routes.boundingBox()).height;
  await page.setViewportSize({width:1920,height:600});
  await expect.poll(async()=>(await routes.boundingBox()).height).toBeLessThan(high-180);
  const expanded=(await routes.boundingBox()).height;
  await page.getByRole('button',{name:'规则集 (240) 折叠'}).click();
  await expect(page.getByRole('button',{name:'规则集 (240) 展开'})).toHaveAttribute('aria-expanded','false');
  await expect(grid).toHaveCount(0);
  await expect.poll(async()=>(await routes.boundingBox()).height).toBeGreaterThan(expanded+80);
  await page.getByRole('button',{name:'添加规则集',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'编辑规则集'})).toBeVisible();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'规则集 (240) 展开'}).click();
  await page.setViewportSize({width:1000,height:900});
  await expect.poll(firstRowCount).toBe(2);
  const providerList=grid.getByTestId('virtual-list');await providerList.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await expect(grid.getByRole('heading',{name:'R239',exact:true})).toBeVisible();
  expect(await grid.getByRole('heading',{level:3}).count()).toBeLessThan(50);
  await page.setViewportSize({width:390,height:844});await expect.poll(firstRowCount).toBe(1);
  await expect.poll(async()=>(await routes.boundingBox()).height).toBeGreaterThan(150);
  const box=await routes.boundingBox();expect(box.y+box.height).toBeLessThan(844);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await routes.evaluate(el=>{el.scrollTop=el.scrollHeight;});await expect(routes.getByTestId('rule-order').last()).toHaveText('1001.');await expect(routes.getByTestId('rule-text').last()).toHaveText('MATCH,DIRECT');
});

test('long group members wrap, stay virtualized, and retain ordering and advanced fields after editing', async ({ page }) => {
  const longName = '香港专线｜流媒体解锁｜游戏加速｜'.repeat(10);
  const proxies = Array.from({ length: 600 }, (_, i) => ({ ...config.proxies[0], name: i === 0 ? longName : `节点 ${i}｜东京专线｜高速低延迟` }));
  const group = { ...config['proxy-groups'][0], proxies: [longName, proxies[1].name, 'DIRECT'] };
  await page.setViewportSize({ width: 1280, height: 1000 });
  await seed(page, { ...config, proxies, 'proxy-groups': [group], rules: ['MATCH,G'], 'sub-rules': {} });
  await tab(page, '策略组管理');
  const tag = page.getByTestId('group-member-tag').first();
  await expect(tag).toHaveText(longName);
  expect((await tag.boundingBox()).height).toBeGreaterThan(40);
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '编辑策略组' });
  const members = dialog.getByRole('list', { name: '可选组成员' });
  expect(await members.getByRole('listitem').count()).toBeLessThan(25);
  const selected = dialog.getByRole('list', { name: '已选组成员' });
  const name = selected.getByTestId('selected-member-name').first();
  await expect(name).toHaveText(longName);
  expect((await name.boundingBox()).height).toBeGreaterThan(48);
  // Resizing forces wrapped rows to be remeasured rather than clipping the longer names.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => name.evaluate(el => el.scrollHeight - el.clientHeight)).toBe(0);
  await expect.poll(() => dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
  await selected.getByRole('button', { name: `下移 ${longName}`, exact: true }).click();
  await expect(selected.getByTestId('selected-member-name').first()).toHaveText(proxies[1].name);
  await selected.getByRole('button', { name: '移除 DIRECT', exact: true }).click();
  await members.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(members.getByRole('checkbox', { name: `选择成员 ${proxies[599].name}`, exact: true })).toBeVisible();
  expect(await members.getByRole('listitem').count()).toBeLessThan(25);
  await members.getByRole('checkbox', { name: `选择成员 ${proxies[599].name}`, exact: true }).check();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 1000 });
  const after = await exported(page);
  expect(after['proxy-groups'][0]).toEqual({ ...group, proxies: [proxies[1].name, longName, proxies[599].name] });
});

test('share card fits a narrow screen and copies the complete link and YAML with a local QR code', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const proxy = { ...config.proxies[0], name: '香港专线｜高速低延迟｜流媒体解锁｜'.repeat(4) };
  await seed(page, { ...config, proxies: [proxy], 'proxy-groups': [], rules: ['MATCH,DIRECT'], 'sub-rules': {} });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('combobox', { name: '功能导航' }).selectOption('proxies');
  await page.getByRole('button', { name: `分享 ${proxy.name}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '分享节点' });
  await expect(dialog.getByRole('img', { name: '二维码' })).toHaveAttribute('src', /^data:image\/png;base64,/);
  expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
  const copy = dialog.getByRole('button', { name: '复制分享链接', exact: true });
  const box = await copy.boundingBox();
  expect(box.y + box.height).toBeLessThan(844);
  await copy.click();
  const linked = parseProxyLink(await page.evaluate(() => navigator.clipboard.readText()));
  expect(linked.name).toBe(proxy.name); expect(linked.password).toBe(proxy.password);
  await dialog.getByRole('button', { name: '复制完整 YAML 节点片段', exact: true }).click();
  expect(parseYaml(await page.evaluate(() => navigator.clipboard.readText())).proxies[0]).toEqual(proxy);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: `分享 ${proxy.name}`, exact: true })).toBeFocused();
});
