import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * 本地生成二维码，不依赖任何第三方接口。
 *
 * 分享链接中包含节点密码 / UUID 等凭证，若交给外部二维码接口渲染，
 * 会把凭证以 URL 明文形式发送出去。因此这里全部在浏览器内完成编码。
 */
const LocalQrCode = ({ value, size = 220, alt = '二维码' }) => {
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // 空值由渲染阶段直接处理，无需在 effect 里同步 setState
    if (!value) return;

    // 组件已卸载 / value 已变化时，丢弃过期结果
    let cancelled = false;

    const generate = async () => {
      try {
        const url = await QRCode.toDataURL(value, {
          errorCorrectionLevel: 'M',
          width: size,
          margin: 2,
        });
        if (!cancelled) {
          setDataUrl(url);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setDataUrl('');
          setError(err?.message || '二维码生成失败');
        }
      }
    };

    generate();
    return () => { cancelled = true; };
  }, [value, size]);

  if (!value) {
    return (
      <div className="w-[220px] h-[220px] flex items-center justify-center text-xs text-slate-400 border border-dashed dark:border-slate-700 rounded-lg">
        暂无分享链接
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="w-[220px] h-[220px] flex items-center justify-center text-center text-xs text-red-500 border border-red-200 dark:border-red-900/50 rounded-lg px-3"
        role="alert"
      >
        二维码生成失败：{error}
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div className="w-[220px] h-[220px] flex items-center justify-center text-xs text-slate-400 border border-dashed dark:border-slate-700 rounded-lg">
        正在生成二维码…
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className="w-[220px] h-[220px] rounded-lg bg-white"
    />
  );
};

export default LocalQrCode;
