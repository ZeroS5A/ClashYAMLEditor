import React, { useState, useRef } from 'react';

const ScrollingText = ({ text, className }) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [overflowWidth, setOverflowWidth] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (containerRef.current && textRef.current) {
      const overflow = textRef.current.scrollWidth - containerRef.current.clientWidth;
      setOverflowWidth(overflow > 0 ? overflow : 0);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setOverflowWidth(0);
  };

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={textRef}
        className="inline-block"
        style={{
          transform: isHovered && overflowWidth > 0 ? `translateX(-${overflowWidth}px)` : 'translateX(0)',
          transitionProperty: 'transform',
          transitionDuration: isHovered && overflowWidth > 0 ? `${Math.max(1.5, overflowWidth / 40)}s` : '0.3s',
          transitionTimingFunction: 'linear'
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default ScrollingText;
