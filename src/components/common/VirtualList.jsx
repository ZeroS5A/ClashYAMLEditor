import { useEffect, useRef, useState } from 'react';

// Fixed-height windows keep the DOM bounded even after scrolling through the complete list.
export default function VirtualList({ items, rowHeight = 72, height = 480, renderItem, itemKey, resetKey, scrollToIndex, className = '' }) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ resetKey, top: 0 });
  const [viewportHeight, setViewportHeight] = useState(typeof height === 'number' ? height : 480);
  useEffect(() => {
    const element = ref.current;
    const measure = () => setViewportHeight(element.clientHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { ref.current.scrollTop = 0; }, [resetKey]);
  useEffect(() => { if (Number.isInteger(scrollToIndex) && scrollToIndex >= 0) ref.current.scrollTop = scrollToIndex * rowHeight; }, [scrollToIndex, rowHeight]);
  const top = Math.min(position.resetKey === resetKey ? position.top : 0, Math.max(0, items.length * rowHeight - viewportHeight));
  const start = Math.max(0, Math.floor(top / rowHeight) - 6);
  const end = Math.min(items.length, start + Math.ceil(viewportHeight / rowHeight) + 12);
  return <div ref={ref} onScroll={e => setPosition({ resetKey, top: e.currentTarget.scrollTop })} className={`overflow-y-auto custom-scrollbar ${className}`} style={{ height }} data-testid="virtual-list">
    <div style={{ height: items.length * rowHeight, position: 'relative' }}>
      {items.slice(start, end).map((item, offset) => <div key={itemKey ? itemKey(item) : start + offset} style={{ position: 'absolute', top: (start + offset) * rowHeight, height: rowHeight, left: 0, right: 0 }}>{renderItem(item, start + offset)}</div>)}
    </div>
  </div>;
}
