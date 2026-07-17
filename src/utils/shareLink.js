// --- Base64 编码（UTF-8 安全）---
function base64Encode(str) {
  try {
    return btoa(String(str));
  } catch (_) {
    // 含非 ASCII 字符时走 UTF-8 路径
    const bytes = new TextEncoder().encode(String(str));
    return btoa(String.fromCharCode(...bytes));
  }
}

// --- 根据代理对象生成分享链接（parser.js 的逆向）---
export function generateShareLink(proxy) {
  const { name, type, server, port, ...rest } = proxy;
  const encodedName = name ? encodeURIComponent(String(name)) : '';

  // --- 构建查询字符串 ---
  const buildQuery = (overrides = {}) => {
    const parts = [];
    const skipKeys = new Set(['name', 'type', 'server', 'port', 'password', 'uuid', 'cipher']);
    const allParams = { ...rest, ...overrides };

    for (const [key, value] of Object.entries(allParams)) {
      if (value === undefined || value === null || value === '') continue;
      if (skipKeys.has(key)) continue;

      if (typeof value === 'boolean') {
        if (value) parts.push(`${key}=true`);
      } else if (typeof value === 'object') {
        // 展开 ws-opts → host + path
        if (key === 'ws-opts') {
          if (value.path) parts.push(`path=${encodeURIComponent(value.path)}`);
          if (value.headers?.Host) parts.push(`host=${encodeURIComponent(value.headers.Host)}`);
        }
        // 展开 grpc-opts → serviceName
        if (key === 'grpc-opts') {
          if (value['grpc-service-name']) parts.push(`serviceName=${encodeURIComponent(value['grpc-service-name'])}`);
        }
        // reality-opts → pbk, sid
        if (key === 'reality-opts') {
          if (value['public-key']) parts.push(`pbk=${encodeURIComponent(value['public-key'])}`);
          if (value['short-id']) parts.push(`sid=${encodeURIComponent(value['short-id'])}`);
        }
      } else if (typeof value === 'number') {
        parts.push(`${key}=${value}`);
      } else {
        parts.push(`${key}=${encodeURIComponent(String(value))}`);
      }
    }
    return parts.join('&');
  };

  switch (type) {
    // ============================================================
    //  VMess
    // ============================================================
    case 'vmess': {
      const vmessObj = {
        v: '2',
        ps: String(name || ''),
        add: String(server || ''),
        port: Number(port) || 443,
        id: String(rest.uuid || ''),
        aid: Number(rest.alterId) || 0,
        scy: String(rest.cipher || 'auto'),
        net: String(rest.network || 'tcp'),
        type: 'none',
        host: rest['ws-opts']?.headers?.Host || '',
        path: rest['ws-opts']?.path || rest['grpc-opts']?.['grpc-service-name'] || '',
        tls: rest.tls ? 'tls' : '',
        sni: rest.servername || rest.sni || '',
        alpn: Array.isArray(rest.alpn) ? rest.alpn.join(',') : (rest.alpn || ''),
        fp: rest['client-fingerprint'] || '',
      };
      return 'vmess://' + btoa(unescape(encodeURIComponent(JSON.stringify(vmessObj))));
    }

    // ============================================================
    //  Trojan / VLESS / Hysteria2
    // ============================================================
    case 'trojan':
    case 'vless':
    case 'hysteria2': {
      const scheme = type === 'hysteria2' ? 'hysteria2' : type;
      let userinfo;
      if (type === 'trojan') userinfo = rest.password || '';
      else if (type === 'vless') userinfo = rest.uuid || '';
      else userinfo = rest.password || ''; // hysteria2

      // 映射常见字段为 URI 参数
      const queryOverrides = {};
      if (type === 'vless') {
        if (rest.encryption) queryOverrides.encryption = rest.encryption;
        if (rest.flow) queryOverrides.flow = rest.flow;
      }
      if (rest.sni && type === 'vless' && rest.servername) {
        queryOverrides.sni = rest.servername;
      }
      if (rest['skip-cert-verify']) {
        queryOverrides.insecure = '1';
      }
      if (type === 'hysteria2' && rest.obfs) {
        queryOverrides.obfs = rest.obfs;
      }
      if (type === 'hysteria2' && rest.fingerprint) {
        queryOverrides.pinSHA256 = rest.fingerprint;
      }
      // 端口跳跃：hysteria2 的 port 可能是逗号分隔字符串
      let portStr = port;
      if (type === 'hysteria2' && typeof port === 'string' && port.includes(',')) {
        portStr = port;
      }

      const query = buildQuery(queryOverrides);
      let url = `${scheme}://${encodeURIComponent(userinfo)}@${server}:${portStr || 443}`;
      if (query) url += `?${query}`;
      if (encodedName) url += `#${encodedName}`;
      return url;
    }

    // ============================================================
    //  Shadowsocks
    // ============================================================
    case 'ss': {
      const method = rest.cipher || 'aes-256-gcm';
      const pass = rest.password || '';
      // SIP002: base64(method:password)
      const userinfo = btoa(`${method}:${pass}`);
      let url = `ss://${userinfo}@${server}:${port || 443}`;
      if (rest.plugin) {
        const pluginParams = rest['plugin-opts'] ? `;${rest['plugin-opts']}` : '';
        url += `/?plugin=${encodeURIComponent(rest.plugin + pluginParams)}`;
      }
      if (encodedName) url += `#${encodedName}`;
      return url;
    }

    // ============================================================
    //  SSR
    // ============================================================
    case 'ssr': {
      const pwdB64 = base64Encode(rest.password || '');
      const main = `${server}:${port || 443}:${rest.protocol || 'origin'}:${rest.cipher || 'aes-256-cfb'}:${rest.obfs || 'plain'}:${pwdB64}`;
      const params = [];
      if (rest['obfs-param']) params.push(`obfsparam=${base64Encode(rest['obfs-param'])}`);
      if (rest['protocol-param']) params.push(`protoparam=${base64Encode(rest['protocol-param'])}`);
      if (encodedName) params.push(`remarks=${base64Encode(name)}`);
      let url = 'ssr://' + base64Encode(main + (params.length > 0 ? '/?' + params.join('&') : ''));
      return url;
    }

    // ============================================================
    //  TUIC / WireGuard / 其他 → 简单 URI 格式
    // ============================================================
    case 'tuic': {
      const userinfo = `${rest.uuid || ''}:${rest.password || ''}`;
      const query = buildQuery();
      let url = `tuic://${encodeURIComponent(userinfo)}@${server}:${port || 443}`;
      if (query) url += `?${query}`;
      if (encodedName) url += `#${encodedName}`;
      return url;
    }

    default:
      throw new Error(`不支持的协议类型: ${type}（仅 vmess/trojan/vless/ss/ssr/hysteria2/tuic 可导出链接）`);
  }
}

