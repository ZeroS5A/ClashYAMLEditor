export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Fall back for HTTP-hosted router UIs. */ }
  }
  const input = document.createElement('textarea');
  input.value = text; input.style.position = 'fixed'; input.style.left = '-10000px';
  document.body.append(input); input.select();
  const copied = document.execCommand('copy'); input.remove();
  if (!copied) throw new Error('浏览器拒绝复制，请手动选中复制');
}
export function downloadText(text, filename = 'config.yaml') {
  const href = URL.createObjectURL(new Blob([text], { type: 'text/yaml;charset=utf-8' }));
  const link = document.createElement('a'); link.href = href; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
