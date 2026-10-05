import SectionEditor from '../common/SectionEditor';
export default function TabBasic({ config, setConfig, showAlert, target, setTarget }) {
  return <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
    <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-6 space-y-4"><h2 className="text-xl font-bold">目标环境</h2><p className="text-sm text-slate-500">环境信息只用于编辑器校验，不写入 Clash 配置。版本用于记录和核对，尚未提供逐版本功能矩阵。</p>
      <div className="grid md:grid-cols-3 gap-4">
        <label className="text-sm">部署方式<select aria-label="部署方式" value={target.environment} onChange={e => setTarget({ ...target, environment: e.target.value })} className="block w-full p-3 border rounded-lg bg-transparent"><option value="openclash">OpenClash 管理</option><option value="standalone">独立 Mihomo</option></select></label>
        <label className="text-sm">内核类别<select aria-label="内核类别" value={target.core} onChange={e => setTarget({ ...target, core: e.target.value })} className="block w-full p-3 border rounded-lg bg-transparent"><option value="mihomo">Mihomo / Meta</option><option value="smart">Smart</option><option value="clash">旧 Clash</option></select></label>
        <label className="text-sm">实际内核版本<input value={target.version} onChange={e => setTarget({ ...target, version: e.target.value })} className="block w-full p-3 border rounded-lg bg-transparent" placeholder="例如 1.19.x" /></label>
      </div>
      {target.environment === 'openclash' && <p className="text-sm text-amber-600">OpenClash 可能覆写 DNS、端口、TUN 和模式，请核对原始配置与最终运行配置。</p>}
    </div>
    <SectionEditor config={config} setConfig={setConfig} showAlert={showAlert} title="基础设置" advanced={false} description="留空表示删除字段并使用内核默认值。输入端口 0 表示关闭对应监听。" fields={[
      { key: 'mixed-port', type: 'number' }, { key: 'port', type: 'number' }, { key: 'socks-port', type: 'number' }, { key: 'external-controller' }, { key: 'secret', label: '控制器密码（secret）', type: 'password' },
      { key: 'allow-lan', type: 'boolean' }, { key: 'bind-address' }, { key: 'mode', options: ['rule', 'global', 'direct'] }, { key: 'log-level', options: ['debug', 'info', 'warning', 'error', 'silent'] },
    ]} />
  </div>;
}
