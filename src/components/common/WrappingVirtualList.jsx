import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function MeasuredRow({ item, index, itemId, top, onMeasure, renderItem }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    const observer = new ResizeObserver(() => onMeasure(itemId, Math.ceil(element.getBoundingClientRect().height)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [itemId, onMeasure]);
  return <div ref={ref} role="listitem" style={{ position: 'absolute', top, left: 0, right: 0 }}>{renderItem(item, index)}</div>;
}

// Measure wrapped names so long members can use their full height without rendering the entire list.
export default function WrappingVirtualList({ items, renderItem, itemKey, estimatedRowHeight = 64, height = 320, resetKey, scrollToIndex, label, className = 'px-3', testId = 'wrapping-member-list' }) {
  const ref = useRef(null);
  const [viewport, setViewport] = useState({ width: 0, height: typeof height === 'number' ? height : 480 });
  const [position, setPosition] = useState({ resetKey, top: 0 });
  const [measurements, setMeasurements] = useState({ width: 0, sizes: new Map() });
  useEffect(() => {
    const element = ref.current;
    const observer = new ResizeObserver(() => setViewport({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { ref.current.scrollTop = 0; }, [resetKey]);
  const measure = useCallback((id, size) => {
    if (!size) return;
    setMeasurements(previous => {
      const current = previous.width === viewport.width ? previous.sizes : new Map();
      if (current.get(id) === size) return previous;
      const sizes = new Map(current);
      sizes.set(id, size);
      return { width: viewport.width, sizes };
    });
  }, [viewport.width]);
  const offsets = useMemo(() => {
    const sizes = measurements.width === viewport.width ? measurements.sizes : new Map();
    const next = [0];
    items.forEach(item => next.push(next[next.length - 1] + (sizes.get(itemKey(item)) || estimatedRowHeight)));
    return next;
  }, [items, itemKey, estimatedRowHeight, measurements, viewport.width]);
  const scrollTarget = Number.isInteger(scrollToIndex) && scrollToIndex >= 0 ? offsets[scrollToIndex] : undefined;
  useEffect(() => { if (scrollTarget !== undefined) ref.current.scrollTop = scrollTarget; }, [scrollTarget]);
  const top = Math.min(position.resetKey === resetKey ? position.top : 0, Math.max(0, offsets.at(-1) - viewport.height));
  const indexAt = value => {
    let low = 0, high = items.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (offsets[middle + 1] <= value) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  const start = Math.max(0, indexAt(top) - 3);
  const end = Math.min(items.length, indexAt(top + viewport.height) + 4);
  return <div ref={ref} role="list" aria-label={label} data-testid={testId} onScroll={e => setPosition({ resetKey, top: e.currentTarget.scrollTop })} className={`overflow-y-auto custom-scrollbar ${className}`} style={{ height, overflowAnchor: 'none' }}>
    <div style={{ height: offsets.at(-1), position: 'relative' }}>
      {items.slice(start, end).map((item, offset) => <MeasuredRow key={JSON.stringify([itemKey(item), start + offset])} itemId={itemKey(item)} item={item} index={start + offset} top={offsets[start + offset]} onMeasure={measure} renderItem={renderItem} />)}
    </div>
  </div>;
}
