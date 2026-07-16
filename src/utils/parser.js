// --- 高度健壮的 Base64 解码器 ---
export const safeDecodeBase64 = (str) => {
  try {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const binary = window.atob(s);
    // 使用 TextDecoder 正确解码 UTF-8 字节序列（替代已废弃的 escape 方案）
    try {
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      return new TextDecoder('utf-8').decode(bytes);
    } catch (_) {
      // 旧浏览器降级：手动做百分号编码再交由 decodeURIComponent 转 UTF-8
      return decodeURIComponent(
        Array.prototype.map.call(binary, c =>
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join('')
      );
    }
  } catch (e) {
    try {
      let s = str.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      return window.atob(s);
    } catch (finalError) {
      throw new Error("Base64 数据损坏或存在无效字符");
    }
  }
};

// --- 核心解析引擎 (支持复杂参数提取) ---
export const parseProxyLink = (link) => {
  try {
    const applyQueryParams = (url, proxy) => {
      const proxyType = proxy.type;

      // --- 传输层 / 混淆类型 ---
      const qType = url.searchParams.get('type') || url.searchParams.get('obfs');
      if (qType) {
        if (proxyType === 'hysteria2') {
          // hysteria2 的 obfs 是混淆协议名称（如 salamander），不是传输层 network
          proxy.obfs = qType;
        } else {
          proxy.network = qType;
        }
      }

      // --- TLS / Reality 开关 ---
      const security = url.searchParams.get('security');
      if (security === 'tls' || security === 'reality') proxy.tls = true;

      // --- SNI ---
      const sni = url.searchParams.get('sni') || url.searchParams.get('peer');
      if (sni) {
        if (proxyType === 'vmess' || proxyType === 'vless') proxy.servername = sni;
        else proxy.sni = sni;
      }

      // --- 跳过证书验证 (insecure / allowInsecure) ---
      const insecure = url.searchParams.get('insecure') || url.searchParams.get('allowInsecure');
      if (insecure !== null) {
        proxy['skip-cert-verify'] = insecure === '1' || insecure === 'true';
      }

      // --- 流控 (vless 的 flow，如 xtls-rprx-vision) ---
      const flow = url.searchParams.get('flow');
      if (flow) proxy.flow = flow;

      // --- 加密方式 (vless 的 encryption，通常为 none) ---
      const encryption = url.searchParams.get('encryption');
      if (encryption) proxy.encryption = encryption;

      // --- TLS 指纹 / 证书固定 ---
      const fp = url.searchParams.get('fp');
      if (fp) proxy['client-fingerprint'] = fp;

      // hysteria2 专用：pinSHA256 → fingerprint（证书 SHA256 指纹）
      const pinSHA256 = url.searchParams.get('pinSHA256') || url.searchParams.get('pinsha256');
      if (pinSHA256) proxy.fingerprint = pinSHA256;

      // hysteria2 端口跳跃范围 (mport)
      const mport = url.searchParams.get('mport');
      if (mport && proxyType === 'hysteria2') proxy.ports = mport;

      // --- ALPN ---
      const alpn = url.searchParams.get('alpn');
      if (alpn) proxy.alpn = alpn.split(',').map(s => s.trim()).filter(Boolean);

      // --- Reality 参数 ---
      const pbk = url.searchParams.get('pbk');
      if (pbk) {
         proxy['reality-opts'] = proxy['reality-opts'] || {};
         proxy['reality-opts']['public-key'] = pbk;
      }

      const sid = url.searchParams.get('sid');
      if (sid) {
         proxy['reality-opts'] = proxy['reality-opts'] || {};
         proxy['reality-opts']['short-id'] = sid;
      }

      // --- WebSocket 选项 ---
      if (proxy.network === 'ws' || qType === 'ws') {
        const path = url.searchParams.get('path');
        const host = url.searchParams.get('host');
        if (path || host) {
          proxy['ws-opts'] = {};
          if (path) proxy['ws-opts'].path = path;
          if (host) proxy['ws-opts'].headers = { Host: host };
        }
      }

      // --- gRPC 选项（兼容 serviceName 和 kebab-case 的 service-name）---
      if (proxy.network === 'grpc' || qType === 'grpc') {
        const serviceName = url.searchParams.get('serviceName') || url.searchParams.get('service-name');
        if (serviceName) {
          proxy['grpc-opts'] = { 'grpc-service-name': serviceName };
        }
      }

      // --- h2 / http 传输的 host 与 path（非 ws/grpc 的通用传输参数）---
      if (proxy.network && proxy.network !== 'ws' && proxy.network !== 'grpc' && proxy.network !== 'tcp') {
        const host = url.searchParams.get('host');
        const path = url.searchParams.get('path');
        if (host || path) {
          const optsKey = proxy.network === 'h2' ? 'h2-opts' : `${proxy.network}-opts`;
          proxy[optsKey] = proxy[optsKey] || {};
          if (host) proxy[optsKey].host = host.split(',').map(s => s.trim());
          if (path) proxy[optsKey].path = path;
        }
      }

      // --- headerType (VLESS XTLS 使用的报文类型) ---
      const headerType = url.searchParams.get('headerType');
      if (headerType) proxy['header-type'] = headerType;

      // --- 混淆密码（兼容 camelCase obfsParam 和 kebab-case obfs-password）---
      const obfsPassword = url.searchParams.get('obfs-password') || url.searchParams.get('obfsParam');
      if (obfsPassword) proxy['obfs-password'] = obfsPassword;
    };

    if (link.startsWith('vmess://')) {
      const jsonStr = safeDecodeBase64(link.slice(8));
      const data = JSON.parse(jsonStr);
      const proxy = {
        name: data.ps || `VMess-${Math.floor(Math.random()*1000)}`,
        type: 'vmess',
        server: data.add,
        port: Number(data.port),
        uuid: data.id,
        alterId: Number(data.aid) || 0,
        cipher: data.scy || 'auto',
        network: data.net || 'tcp',
        tls: data.tls === 'tls'
      };
      if (data.sni) proxy.servername = data.sni;
      if (data.net === 'ws') {
         proxy['ws-opts'] = { path: data.path };
         if (data.host) proxy['ws-opts'].headers = { Host: data.host };
      }
      if (data.net === 'grpc') {
         proxy['grpc-opts'] = { 'grpc-service-name': data.path };
      }
      return proxy;
    }

    if (link.startsWith('trojan://') || link.startsWith('vless://') || link.startsWith('hysteria2://') || link.startsWith('hy2://')) {
      let type = 'trojan';
      if (link.startsWith('vless://')) type = 'vless';
      if (link.startsWith('hysteria2://') || link.startsWith('hy2://')) type = 'hysteria2';

      // hysteria2 支持端口跳跃（逗号分隔多端口），URL 标准解析器只取第一个，
      // 因此需要从原始链接中手动提取 host:port 段，保留完整端口字符串。
      let rawPort = '';
      if (type === 'hysteria2') {
        const afterProto = link.replace(/^[^:]+:\/\//, '');
        const atIdx = afterProto.lastIndexOf('@');
        const hostPort = atIdx !== -1 ? afterProto.slice(atIdx + 1) : afterProto;
        const hostPortClean = hostPort.split(/[?#]/)[0];
        if (hostPortClean.startsWith('[')) {
          const bracketEnd = hostPortClean.indexOf(']');
          rawPort = hostPortClean.slice(bracketEnd + 1).replace(/^:/, '');
        } else {
          const colonIdx = hostPortClean.lastIndexOf(':');
          rawPort = colonIdx !== -1 ? hostPortClean.slice(colonIdx + 1) : '';
        }
      }

      let url;
      try {
        url = new URL(link);
      } catch (e) {
        throw new Error("链接格式无效，无法解析 URL");
      }

      // 计算端口：hysteria2 保留原始端口字符串以支持端口跳跃
      let port;
      if (type === 'hysteria2' && rawPort) {
        if (rawPort.includes(',')) {
          port = rawPort; // 端口跳跃：保留原始逗号分隔字符串
        } else {
          port = Number(rawPort) || Number(url.port) || 443;
        }
      } else {
        port = Number(url.port) || 443;
      }

      const proxy = {
        name: decodeURIComponent(url.hash.slice(1)) || `${type}-${Math.floor(Math.random()*1000)}`,
        type: type,
        server: url.hostname,
        port: port,
      };

      if (type === 'trojan') {
          proxy.password = url.username || url.pathname.replace('//', '');
      } else if (type === 'vless') {
          proxy.uuid = url.username;
      } else if (type === 'hysteria2') {
          proxy.password = url.username;
      }

      applyQueryParams(url, proxy);
      return proxy;
    }

    if (link.startsWith('ss://')) {
      let mainPart = link.slice(5);
      let name = `SS-${Math.floor(Math.random()*1000)}`;

      // 提取 #fragment（名称）
      let queryPart = '';
      if (mainPart.includes('#')) {
        const fragIdx = mainPart.lastIndexOf('#');
        name = decodeURIComponent(mainPart.slice(fragIdx + 1));
        mainPart = mainPart.slice(0, fragIdx);
      }

      // 分离 ?query 部分（SIP003 插件参数）
      if (mainPart.includes('?')) {
        const qIdx = mainPart.indexOf('?');
        queryPart = mainPart.slice(qIdx + 1);
        mainPart = mainPart.slice(0, qIdx);
      }

      if (mainPart.includes('@')) {
        // SIP002 格式：ss://base64(method:password)@server:port
        const parts = mainPart.split('@');
        const credentials = safeDecodeBase64(parts[0]);
        // 去掉尾部斜杠（SS URI 有时带 /）
        const serverPart = parts[1].replace(/\/$/, '');
        const serverInfo = serverPart.split(':');
        const credParts = credentials.split(':');

        const proxy = {
          name, type: 'ss',
          server: serverInfo[0],
          port: Number(serverInfo[1]) || 443,
          cipher: credParts[0],
          password: credParts.slice(1).join(':'), // 密码可能包含冒号
        };

        // SIP003 插件参数（如 obfs-local）
        if (queryPart) {
          const qs = new URLSearchParams(queryPart);
          const pluginRaw = qs.get('plugin');
          if (pluginRaw) {
            // plugin 值通常形如 "obfs-local;obfs=http;obfs-host=example.com"
            const pluginDecoded = decodeURIComponent(pluginRaw);
            const semiIdx = pluginDecoded.indexOf(';');
            if (semiIdx !== -1) {
              proxy.plugin = pluginDecoded.slice(0, semiIdx);
              proxy['plugin-opts'] = pluginDecoded.slice(semiIdx + 1);
            } else {
              proxy.plugin = pluginDecoded;
            }
          }
        }

        return proxy;
      } else {
        // 旧式 base64 全编码格式：ss://base64(method:password@server:port)
        const decoded = safeDecodeBase64(mainPart);
        const match = decoded.match(/^(.*?):(.*?)@(.*):(\d+)$/);
        if (match) {
          return { name, type: 'ss', server: match[3], port: Number(match[4]), cipher: match[1], password: match[2] };
        }
      }
    }
    throw new Error("不支持的协议或分享格式异常");
  } catch (e) {
    throw new Error(e.message);
  }
};

// --- 订阅链接获取与解析 ---
export const fetchSubscriptionContent = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();

  // 尝试 base64 解码（大多数订阅返回 base64 编码的节点列表）
  try {
    const decoded = safeDecodeBase64(text.trim());
    // 验证解码结果是否包含有效的协议链接
    if (decoded.match(/(vmess|trojan|vless|ss|hysteria2|hy2):\/\//)) {
      return decoded.split('\n').map(l => l.trim()).filter(l => l);
    }
  } catch (e) {
    // 非 base64，尝试直接解析
  }

  // 直接按行分割（有些订阅直接返回明文链接）
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.some(l => /^(vmess|trojan|vless|ss|hysteria2|hy2):\/\//.test(l))) {
    return lines;
  }

  throw new Error("订阅内容无法解析为有效的节点链接");
};

export const parseRuleString = (str) => {
  if (typeof str !== 'string') {
    return { type: 'UNKNOWN', payload: JSON.stringify(str), target: '', extra: '' };
  }
  const parts = str.split(',');
  if (parts[0] === 'MATCH') return { type: 'MATCH', payload: '', target: parts[1] || '', extra: parts.slice(2).join(',') };
  return {
    type: parts[0] || 'DOMAIN-SUFFIX',
    payload: parts[1] || '',
    target: parts[2] || '',
    extra: parts.slice(3).join(',')
  };
};
