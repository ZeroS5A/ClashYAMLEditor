import React, { useState } from 'react';
import Modal from './Modal';

// ---- 客户端类型 (target) ----
const targetOptions = [
  { group: "Clash 系列", items: [
    { value: "clash", label: "Clash" },
    { value: "clashr", label: "ClashR" },
  ]},
  { group: "Mihomo / Meta 系列", items: [
    { value: "clashmeta", label: "Mihomo / Clash Meta" },
    { value: "stash", label: "Stash" },
  ]},
  { group: "Surge 系列", items: [
    { value: "surge&ver=2", label: "Surge 2" },
    { value: "surge&ver=3", label: "Surge 3" },
    { value: "surge&ver=4", label: "Surge 4" },
    { value: "surge&ver=5", label: "Surge 5" },
  ]},
  { group: "Quantumult 系列", items: [
    { value: "quan", label: "Quantumult (完整配置)" },
    { value: "quanx", label: "Quantumult X (完整配置)" },
  ]},
  { group: "Shadowsocks 系列", items: [
    { value: "ss", label: "SS (SIP002)" },
    { value: "sssub", label: "SS Android (SIP008)" },
    { value: "ssd", label: "SSD" },
    { value: "ssr", label: "SSR" },
  ]},
  { group: "其他客户端", items: [
    { value: "v2ray", label: "V2Ray / Shadowrocket" },
    { value: "trojan", label: "Trojan" },
    { value: "loon", label: "Loon" },
    { value: "surfboard", label: "Surfboard" },
    { value: "singbox", label: "Sing-box" },
    { value: "mellow", label: "Mellow" },
  ]},
  { group: "通用输出", items: [
    { value: "mixed", label: "Mixed (所有节点单链接)" },
    { value: "auto", label: "Auto (根据 UA 自动判断)" },
  ]},
];

// ---- 布尔选项 ----
const optionLabels = {
  new_name: "新版格式",
  scv: "跳过证书验证",
  udp: "启用 UDP",
  tfo: "启用 TCP Fast Open",
  expand: "规则展开",
  emoji: "包含 Emoji",
  add_emoji: "添加 Emoji 前缀",
  remove_emoji: "移除原有 Emoji",
  append_type: "附加协议类型",
  append_info: "输出流量信息",
  sort: "节点排序",
  list: "节点列表模式",
  script: "Clash Script",
  classic: "Classical 规则",
  tls13: "TLS 1.3",
  fdn: "过滤不兼容节点",
  strict: "强制更新",
  insert: "插入 insert_url",
  prepend: "插入节点前置",
};

const defaultOptions = {
  new_name: true, scv: true, udp: true, tfo: false, expand: true,
  emoji: true, add_emoji: true, remove_emoji: false, append_type: true,
  append_info: true, sort: false, list: false, script: false,
  classic: false, tls13: false, fdn: false, strict: false,
  insert: false, prepend: true,
};

// ---- 远程配置预设 ----
const remoteConfigs = [
  {
    label: "最新 ACL4SSR 在线规则 (全量更新)",
    options: [
      { value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full_MultiMode.ini", label: "ACL4SSR (全分组-多模式-自动测速)" },
      { value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full_AdblockPlus.ini", label: "ACL4SSR (全分组-去广告拦截加强)" },
      { value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full_Netflix.ini", label: "ACL4SSR (全分组-奈飞/流媒体优化)" },
      { value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full_NoAuto.ini", label: "ACL4SSR (全分组-无自动测速版)" },
      { value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full_AdFilter.ini", label: "ACL4SSR (全分组-带国内广告过滤)" },
      { value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full_Google.ini", label: "ACL4SSR (全分组-谷歌加速专版)" },
      { value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full_Game.ini", label: "ACL4SSR (全分组-游戏加速分流)" },
      { value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_NoApple.ini", label: "ACL4SSR (不分流 Apple 服务版)" },
      { value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Mini_MultiMode.ini", label: "ACL4SSR (精简分组-多模式切换)" },
      { value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Mini.ini", label: "ACL4SSR (极简版-仅基础分流)" },
    ]
  },
  {
    label: "Mihomo / MetaCubeX 深度优化",
    options: [
      { value: "https://raw.githubusercontent.com/Aethersailor/Custom-Clash-Rules/main/Rules/Mihomo.ini", label: "Aethersailor (Mihomo 内核专用)" },
      { value: "https://raw.githubusercontent.com/KOP-XIAO/Clash-Config/master/Mihomo.ini", label: "KOP-XIAO (Mihomo 官方标准规则)" },
      { value: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/RemoteConfig/Special.ini", label: "BlackMatrix7 (精细化分流-全规则集)" },
      { value: "https://raw.githubusercontent.com/Aethersailor/Custom-Clash-Rules/main/Aether_Full.ini", label: "Aethersailor (Aether 全分组版)" },
    ]
  },
  {
    label: "其他去广告/极简模板",
    options: [
      { value: "https://raw.githubusercontent.com/AWAvenue/AWAvenue-Ads-Rule/main/Filters/AWAvenue-Ads-Rule-Clash.ini", label: "AWAvenue (黑洞全网去广告增强)" },
      { value: "https://raw.githubusercontent.com/DivineEngine/Profiles/master/Clash/Outbound.ini", label: "DivineEngine (神机规则-极简风格)" },
      { value: "https://raw.githubusercontent.com/KOP-XIAO/Clash-Config/master/Lite.ini", label: "KOP-XIAO (极致轻量方案)" },
    ]
  }
];

const SubscriptionConverterModal = ({ onClose, onConvert, showAlert }) => {
  const [subUrl, setSubUrl] = useState('');
  const [backendUrl, setBackendUrl] = useState('https://192.168.xx.xx:25500');
  const [target, setTarget] = useState('clash');
  const [configSelect, setConfigSelect] = useState('https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full_MultiMode.ini');
  const [customConfigUrl, setCustomConfigUrl] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [options, setOptions] = useState({ ...defaultOptions });

  // 额外文本参数
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [rename, setRename] = useState('');
  const [filename, setFilename] = useState('');
  const [interval, setInterval_] = useState('');
  const [token, setToken] = useState('');
  const [devId, setDevId] = useState('');

  const [showAdvanced, setShowAdvanced] = useState(false);

  const generateLink = () => {
    if (!subUrl) {
      showAlert('请输入订阅链接');
      return;
    }

    const sub = encodeURIComponent(subUrl.split('\n').map(l => l.trim()).filter(l => l !== '').join('|'));
    let configUrl = configSelect === 'custom' ? customConfigUrl : configSelect;

    if (!configUrl) {
        showAlert("请输入有效的远程配置 URL");
        return;
    }

    let finalLink = `${backendUrl}/sub?target=${target}&url=${sub}&config=${encodeURIComponent(configUrl)}`;

    // 布尔选项
    Object.entries(options).forEach(([key, val]) => {
        if (val) finalLink += `&${key}=true`;
        else if (key === 'insert') finalLink += `&${key}=false`; // insert 默认关闭时也显式传 false
    });

    // 额外文本参数
    if (include) finalLink += `&include=${encodeURIComponent(include)}`;
    if (exclude) finalLink += `&exclude=${encodeURIComponent(exclude)}`;
    if (rename) finalLink += `&rename=${encodeURIComponent(rename)}`;
    if (filename) finalLink += `&filename=${encodeURIComponent(filename)}`;
    if (interval) finalLink += `&interval=${encodeURIComponent(interval)}`;
    if (token) finalLink += `&token=${encodeURIComponent(token)}`;
    if (devId) finalLink += `&dev_id=${encodeURIComponent(devId)}`;

    setGeneratedLink(finalLink);
  };

  const handleFinalImport = () => {
      onConvert(generatedLink);
  };

  return (
    <Modal
      title="订阅转换 (基于SubConverter后端)"
      onClose={onClose}
      customFooter={
        <div className="p-5 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
            取消
          </button>
          <button onClick={generateLink} className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2">
            生成链接
          </button>
          {generatedLink && (
            <button onClick={handleFinalImport} className="px-4 py-2 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-2">
              导入配置
            </button>
          )}
        </div>
      }
      widthClass="max-w-3xl"
    >
      <div className="space-y-4">
        {/* 订阅链接 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">订阅链接或节点 (批量导入，多链接换行分隔)</label>
          <textarea rows="3" value={subUrl} onChange={(e) => setSubUrl(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" placeholder="https://example.com/sub?...&#10;ss://...&#10;vmess://..." />
        </div>

        {/* 后端地址 + 客户端类型 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">后端地址</label>
            <input type="text" value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">客户端类型 (Target)</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950">
              {targetOptions.map(group => (
                <optgroup key={group.group} label={group.group}>
                  {group.items.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* 远程配置 */}
        <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">远程配置</label>
            <select value={configSelect} onChange={(e) => setConfigSelect(e.target.value)} className="w-full p-3 mb-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950">
                {remoteConfigs.map(group => (
                    <optgroup key={group.label} label={group.label}>
                        {group.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </optgroup>
                ))}
                <option value="custom">自定义远程配置 URL...</option>
            </select>
            {configSelect === 'custom' && (
                <input type="text" value={customConfigUrl} onChange={(e) => setCustomConfigUrl(e.target.value)} placeholder="请输入自定义 .ini 规则配置链接" className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950" />
            )}
        </div>

        {/* 基础选项 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">基础选项</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-800">
            {['new_name', 'scv', 'udp', 'tfo', 'expand', 'emoji', 'add_emoji', 'remove_emoji', 'append_type', 'append_info', 'fdn'].map(key => (
                <label key={key} className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={options[key]} onChange={(e) => setOptions(prev => ({...prev, [key]: e.target.checked}))} />
                    <span>{optionLabels[key]}</span>
                </label>
            ))}
          </div>
        </div>

        {/* 高级选项折叠区 */}
        <div className="border dark:border-slate-700 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <span>高级选项 (节点筛选 / 重命名 / 更多)</span>
            <span className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>&#9660;</span>
          </button>
          {showAdvanced && (
            <div className="p-4 space-y-4 bg-white dark:bg-slate-900">
              {/* 节点筛选 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">include <span className="font-normal text-gray-400">(仅保留匹配节点，支持正则)</span></label>
                  <input type="text" value={include} onChange={(e) => setInclude(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950 text-sm font-mono" placeholder="例如: (?<=美).*(GIA|IPLC)" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">exclude <span className="font-normal text-gray-400">(排除匹配节点，支持正则)</span></label>
                  <input type="text" value={exclude} onChange={(e) => setExclude(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950 text-sm font-mono" placeholder="例如: (流量|官网|到期)" />
                </div>
              </div>

              {/* 重命名 */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">rename <span className="font-normal text-gray-400">(节点重命名，格式: 原名@新名)</span></label>
                <input type="text" value={rename} onChange={(e) => setRename(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950 text-sm font-mono" placeholder="例如: 中国@中" />
              </div>

              {/* API Token + 输出文件名 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">API Token <span className="font-normal text-gray-400">(公共后端可留空)</span></label>
                  <input type="text" value={token} onChange={(e) => setToken(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950 text-sm" placeholder="可选，用于认证" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">输出文件名 <span className="font-normal text-gray-400">(filename)</span></label>
                  <input type="text" value={filename} onChange={(e) => setFilename(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950 text-sm" placeholder="MyConfig" />
                </div>
              </div>

              {/* 更新间隔 + QuanX 设备 ID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">更新间隔 <span className="font-normal text-gray-400">(秒)</span></label>
                  <input type="number" value={interval} onChange={(e) => setInterval_(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950 text-sm" placeholder="例如: 86400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">QuantumultX 设备 ID <span className="font-normal text-gray-400">(dev_id)</span></label>
                  <input type="text" value={devId} onChange={(e) => setDevId(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950 text-sm" placeholder="可选" />
                </div>
              </div>

              {/* 更多开关 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border dark:border-slate-700">
                {['sort', 'list', 'script', 'classic', 'tls13', 'strict', 'insert', 'prepend'].map(key => (
                    <label key={key} className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" checked={options[key]} onChange={(e) => setOptions(prev => ({...prev, [key]: e.target.checked}))} />
                        <span>{optionLabels[key]}</span>
                    </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 生成结果 */}
        {generatedLink && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">已生成订阅链接:</p>
                <div className="font-mono text-xs break-all bg-white dark:bg-slate-950 p-2 rounded mb-4">{generatedLink}</div>
            </div>
        )}
      </div>
    </Modal>
  );
};

export default SubscriptionConverterModal;
