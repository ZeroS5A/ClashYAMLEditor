// --- 高度健壮的 Base64 解码器 ---
export const safeDecodeBase64 = (str) => {
  try {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(window.atob(s)));
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
      const qType = url.searchParams.get('type') || url.searchParams.get('obfs');
      if (qType) proxy.network = qType;

      const security = url.searchParams.get('security');
      if (security === 'tls' || security === 'reality') proxy.tls = true;

      const sni = url.searchParams.get('sni') || url.searchParams.get('peer');
      if (sni) {
          if (proxy.type === 'vmess' || proxy.type === 'vless') proxy.servername = sni;
          else proxy.sni = sni;
      }

      const fp = url.searchParams.get('fp');
      if (fp) proxy['client-fingerprint'] = fp;

      const alpn = url.searchParams.get('alpn');
      if (alpn) proxy.alpn = alpn.split(',').map(s => s.trim());

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

      if (qType === 'ws') {
        const path = url.searchParams.get('path');
        const host = url.searchParams.get('host');
        if (path || host) {
          proxy['ws-opts'] = {};
          if (path) proxy['ws-opts'].path = path;
          if (host) proxy['ws-opts'].headers = { Host: host };
        }
      }

      if (qType === 'grpc') {
        const serviceName = url.searchParams.get('serviceName');
        if (serviceName) {
          proxy['grpc-opts'] = { 'grpc-service-name': serviceName };
        }
      }

      const obfsParam = url.searchParams.get('obfsParam');
      if (obfsParam) proxy['obfs-password'] = obfsParam;
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
      const url = new URL(link);
      let type = 'trojan';
      if (link.startsWith('vless://')) type = 'vless';
      if (link.startsWith('hysteria2://') || link.startsWith('hy2://')) type = 'hysteria2';

      const proxy = {
        name: decodeURIComponent(url.hash.slice(1)) || `${type}-${Math.floor(Math.random()*1000)}`,
        type: type,
        server: url.hostname,
        port: Number(url.port) || 443,
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
      if (mainPart.includes('#')) {
        const parts = mainPart.split('#');
        name = decodeURIComponent(parts[1]);
        mainPart = parts[0];
      }
      if (mainPart.includes('@')) {
        const parts = mainPart.split('@');
        const credentials = safeDecodeBase64(parts[0]);
        const serverInfo = parts[1].split(':');
        const credParts = credentials.split(':');
        return { name, type: 'ss', server: serverInfo[0], port: Number(serverInfo[1].replace('/','')), cipher: credParts[0], password: credParts[1] };
      } else {
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
