import { useEffect, useMemo, useRef, useState } from 'react';
import VirtualList from './VirtualList';

// Measure the available panel width so virtual rows follow the actual card column count.
export default function VirtualGrid({ items, renderItem, itemKey, minCardWidth = 280, cardHeight = 132, gap = 16 }) {
  const ref = useRef(null);
  const [columns, setColumns] = useState(1);
  useEffect(() => {
    const element = ref.current;
    const observer = new ResizeObserver(() => {
      setColumns(Math.max(1, Math.floor((element.clientWidth + gap) / (minCardWidth + gap))));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [minCardWidth, gap]);
  const rows = useMemo(() => Array.from({ length: Math.ceil(items.length / columns) }, (_, i) => items.slice(i * columns, (i + 1) * columns)), [items, columns]);
  const rowHeight = cardHeight + gap;
  return <div ref={ref} className="min-h-0 overflow-hidden" style={{ height: rows.length * rowHeight }} data-testid="provider-grid">
    <VirtualList items={rows} height="100%" rowHeight={rowHeight} resetKey={columns} renderItem={(row, rowIndex) => <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap, paddingBottom: gap }}>
      {row.map((item, column) => <div className="min-w-0 h-full" key={itemKey(item)}>{renderItem(item, rowIndex * columns + column)}</div>)}
    </div>} />
  </div>;
}
