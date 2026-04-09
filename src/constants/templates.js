export const DEFAULT_EMPTY_CONFIG = {
  port: 7890,
  'socks-port': 7891,
  'allow-lan': true,
  mode: 'Rule',
  'log-level': 'info',
  proxies: [],
  'proxy-groups': [],
  'rule-providers': {},
  rules: []
};

export const PROTOCOL_SCHEMAS = {
  ss: [
    {key: 'cipher', label: '加密方式 (cipher)', type: 'string'},
    {key: 'password', label: '密码 (password)', type: 'string'},
    {key: 'plugin', label: '插件 (plugin)', type: 'string'},
    {key: 'plugin-opts', label: '插件选项 (plugin-opts)', type: 'json'},
    {key: 'udp', label: 'UDP转发 (udp)', type: 'boolean'}
  ],
  vmess: [
    {key: 'uuid', label: 'UUID (uuid)', type: 'string'},
    {key: 'alterId', label: '额外ID (alterId)', type: 'number'},
    {key: 'cipher', label: '加密方式 (cipher)', type: 'string'},
    {key: 'network', label: '传输协议 (network)', type: 'string'},
    {key: 'tls', label: '开启TLS (tls)', type: 'boolean'},
    {key: 'servername', label: 'SNI (servername)', type: 'string'},
    {key: 'skip-cert-verify', label: '跳过证书验证 (skip-cert-verify)', type: 'boolean'},
    {key: 'ws-opts', label: 'ws-opts', type: 'json'},
    {key: 'grpc-opts', label: 'grpc-opts', type: 'json'}
  ],
  vless: [
    {key: 'uuid', label: 'UUID (uuid)', type: 'string'},
    {key: 'flow', label: '流控 (flow)', type: 'string'},
    {key: 'network', label: '传输协议 (network)', type: 'string'},
    {key: 'tls', label: '开启TLS (tls)', type: 'boolean'},
    {key: 'servername', label: 'SNI (servername)', type: 'string'},
    {key: 'skip-cert-verify', label: '跳过证书验证 (skip-cert-verify)', type: 'boolean'},
    {key: 'client-fingerprint', label: '客户端指纹 (client-fingerprint)', type: 'string'},
    {key: 'ws-opts', label: 'ws-opts', type: 'json'},
    {key: 'grpc-opts', label: 'grpc-opts', type: 'json'}
  ],
  trojan: [
    {key: 'password', label: '密码 (password)', type: 'string'},
    {key: 'network', label: '传输协议 (network)', type: 'string'},
    {key: 'sni', label: 'SNI (sni)', type: 'string'},
    {key: 'skip-cert-verify', label: '跳过证书验证 (skip-cert-verify)', type: 'boolean'},
    {key: 'udp', label: 'UDP转发 (udp)', type: 'boolean'},
    {key: 'alpn', label: 'ALPN (alpn)', type: 'json'},
    {key: 'ws-opts', label: 'ws-opts', type: 'json'},
    {key: 'grpc-opts', label: 'grpc-opts', type: 'json'}
  ],
  hysteria2: [
    {key: 'password', label: '密码 (password)', type: 'string'},
    {key: 'sni', label: 'SNI (sni)', type: 'string'},
    {key: 'skip-cert-verify', label: '跳过证书验证 (skip-cert-verify)', type: 'boolean'},
    {key: 'ports', label: '端口范围 (ports)', type: 'string'},
    {key: 'obfs', label: '混淆类型 (obfs)', type: 'string'},
    {key: 'obfs-password', label: '混淆密码 (obfs-password)', type: 'string'},
    {key: 'up', label: '上行速度 (up)', type: 'string'},
    {key: 'down', label: '下行速度 (down)', type: 'string'}
  ],
  tuic: [
    {key: 'uuid', label: 'UUID (uuid)', type: 'string'},
    {key: 'password', label: '密码 (password)', type: 'string'},
    {key: 'sni', label: 'SNI (sni)', type: 'string'},
    {key: 'skip-cert-verify', label: '跳过证书验证 (skip-cert-verify)', type: 'boolean'},
    {key: 'udp-relay-mode', label: 'UDP模式 (udp-relay-mode)', type: 'string'},
    {key: 'congestion-controller', label: '拥塞控制 (congestion-controller)', type: 'string'},
    {key: 'alpn', label: 'ALPN (alpn)', type: 'json'}
  ],
  wireguard: [
    {key: 'ip', label: '本地IP (ip)', type: 'string'},
    {key: 'ipv6', label: '本地IPv6 (ipv6)', type: 'string'},
    {key: 'public-key', label: '公钥 (public-key)', type: 'string'},
    {key: 'private-key', label: '私钥 (private-key)', type: 'string'},
    {key: 'udp', label: 'UDP转发 (udp)', type: 'boolean'},
    {key: 'mtu', label: 'MTU (mtu)', type: 'number'}
  ]
};

export const RULE_PROVIDER_TEMPLATES = [
  { label: '自定义 / 空白 (默认)', data: { type: 'http', behavior: 'domain', format: 'mrs', url: '', path: './rule_provider/custom.mrs', interval: 86400 } },
  { label: 'YouTube 域名 (MetaCubeX/mrs)', name: 'youtube', data: { type: 'http', behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.mrs', path: './rule_provider/youtube.mrs', interval: 86400 } },
  { label: '国内 IP 直连 (MetaCubeX/mrs)', name: 'cn-ip', data: { type: 'http', behavior: 'ipcidr', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.mrs', path: './rule_provider/cn.mrs', interval: 86400 } },
  { label: 'Telegram IP (MetaCubeX/mrs)', name: 'telegram-ip', data: { type: 'http', behavior: 'ipcidr', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.mrs', path: './rule_provider/telegram.mrs', interval: 86400 } },
  { label: '本地文件规则 (YAML格式)', name: 'my-local-rules', data: { type: 'file', behavior: 'classical', format: 'yaml', path: './rule_provider/my-local-rules.yaml' } }
];
