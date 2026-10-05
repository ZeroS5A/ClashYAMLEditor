import SectionEditor from '../common/SectionEditor';

const fields = [
  { key: 'enable', label: '启用 DNS', type: 'boolean' }, { key: 'listen', label: '监听地址（dns.listen）' },
  { key: 'enhanced-mode', label: 'DNS 模式', options: ['fake-ip', 'redir-host'] }, { key: 'ipv6', label: 'DNS IPv6', type: 'boolean' },
  { key: 'fake-ip-range' }, { key: 'fake-ip-filter-mode', options: ['blacklist', 'whitelist', 'rule'] },
  { key: 'respect-rules', label: 'DNS 请求遵循路由规则', type: 'boolean' }, { key: 'prefer-h3', type: 'boolean' },
  { key: 'default-nameserver', label: '引导 DNS（用于解析 DNS 服务器域名）', type: 'list' },
  { key: 'nameserver', label: '默认上游 DNS', type: 'list' }, { key: 'fallback', label: '后备 DNS', type: 'list' },
  { key: 'proxy-server-nameserver', label: '节点域名 DNS（respect-rules 启用时必须填写）', type: 'list' },
  { key: 'direct-nameserver', label: '直连域名 DNS', type: 'list' }, { key: 'fake-ip-filter', label: 'Fake-IP 过滤（每行一项；规则模式填写完整规则）', type: 'list' },
  { key: 'nameserver-policy', label: '域名 DNS 分流（JSON 对象）', type: 'json' },
  { key: 'proxy-server-nameserver-policy', type: 'json' }, { key: 'fallback-filter', type: 'json' },
];
export default function TabDns(props) {
  return <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
    <SectionEditor {...props} section="dns" fields={fields} title="DNS 设置" description="解析顺序：节点域名使用节点 DNS；普通域名优先匹配 nameserver-policy，再使用默认与后备 DNS。OpenClash 可能覆写这些设置，请核对插件 DNS 页面。" />
    <SectionEditor {...props} fields={[{ key: 'hosts', label: '静态 hosts 映射（JSON 对象）', type: 'json' }]} advanced={false} title="Hosts 设置" description={'例如 {"router.lan": "192.168.1.1"}。其他配置会完整保留。'} />
  </div>;
}
