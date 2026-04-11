import React, { useState } from 'react';
import Modal from './Modal';

const optionLabels = {
  new_name: "新版格式",
  scv: "跳过证书",
  udp: "启用 UDP",
  expand: "规则展开",
  emoji: "包含 Emoji",
  append_type: "附加协议"
};

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
  const [options, setOptions] = useState({
    new_name: true, scv: true, udp: true, expand: true, emoji: true, append_type: true
  });

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

    Object.keys(options).forEach(key => {
        if (options[key]) finalLink += `&${key}=true`;
    });

    finalLink += '&insert=false&fdn=false';
    setGeneratedLink(finalLink);
  };

  const handleFinalImport = () => {
      onConvert(generatedLink);
  };

  return (
    <Modal
      title="订阅转换 (Mihomo/MetaCubeX 增强)"
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
      widthClass="max-w-2xl"
    >
      <div className="space-y-4">
        {/* ... fields ... */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">订阅链接或节点 (批量导入)</label>
          <textarea rows="3" value={subUrl} onChange={(e) => setSubUrl(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" placeholder="https://example.com/sub?..." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">后端地址</label>
            <input type="text" value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">生成类型</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950">
              <option value="clash">Clash</option>
              <option value="clashmeta">Mihomo / Clash Meta</option>
              <option value="stash">Stash</option>
            </select>
          </div>
        </div>

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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-800">
            {Object.keys(options).map(key => (
                <label key={key} className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={options[key]} onChange={(e) => setOptions(prev => ({...prev, [key]: e.target.checked}))} />
                    <span>{optionLabels[key]}</span>
                </label>
            ))}
        </div>

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
