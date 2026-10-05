import SectionEditor from '../common/SectionEditor';
export default function TabNetwork(props) {
  return <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
    <SectionEditor {...props} advanced={false} title="透明代理与网络" description="透明代理通过系统或路由器的转发规则自动接管应用流量，无需逐个应用配置代理。这里设置重定向端口、TPROXY 端口及出站接口；OpenClash 通常接管端口、路由与防火墙。" fields={[
      { key: 'redir-port', type: 'number' }, { key: 'tproxy-port', type: 'number' }, { key: 'interface-name', label: '出站接口（interface-name）' }, { key: 'ipv6', type: 'boolean' },
    ]} />
    <SectionEditor {...props} section="tun" title="TUN 设置" description="TUN 通过虚拟网卡接管 IP 流量，是实现透明代理的一种方式。这里设置虚拟网卡、协议栈、自动路由和 DNS 劫持；auto-redirect 依赖 auto-route，旁路由和插件托管环境请核对绕过网段。" fields={[
      { key: 'enable', type: 'boolean' }, { key: 'stack', options: ['system', 'gvisor', 'mixed'] }, { key: 'device' }, { key: 'mtu', type: 'number' },
      { key: 'auto-route', type: 'boolean' }, { key: 'auto-redirect', type: 'boolean' }, { key: 'auto-detect-interface', type: 'boolean' }, { key: 'strict-route', type: 'boolean' },
      { key: 'dns-hijack', type: 'list' }, { key: 'route-exclude-address', type: 'list' }, { key: 'route-address-set', type: 'list' }, { key: 'route-exclude-address-set', type: 'list' },
    ]} />
  </div>;
}
