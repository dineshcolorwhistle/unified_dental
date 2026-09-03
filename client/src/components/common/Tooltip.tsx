import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

/**
 * Universal application tooltip component.
 * Uses React Portal to mount into document.body, eliminating any clipping issues
 * caused by parent container overflow: hidden or overflow-x: hidden (cards, tables, modals).
 * Adheres to the exact sidebar tooltip visual design:
 * dark surface, subtle border, rounded corners, directional pointer arrow, and elevation.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  delay = 100,
  children,
  className = '',
  style,
  disabled = false,
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    actualPosition: TooltipPosition;
    arrowOffset?: number;
  }>({
    top: 0,
    left: 0,
    actualPosition: position,
  });

  const timerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const triggerRect = containerRef.current.getBoundingClientRect();
    const bubbleEl = bubbleRef.current;

    const bubbleWidth = bubbleEl ? bubbleEl.offsetWidth : 160;
    const bubbleHeight = bubbleEl ? bubbleEl.offsetHeight : 36;
    const gap = 8;

    let targetPos = position;

    // Viewport collision checks:
    // If top would go above top of viewport, flip to bottom
    if (targetPos === 'top' && triggerRect.top - bubbleHeight - gap < 8) {
      targetPos = 'bottom';
    } else if (targetPos === 'bottom' && triggerRect.bottom + bubbleHeight + gap > window.innerHeight - 8) {
      targetPos = 'top';
    }

    let top = 0;
    let left = 0;

    if (targetPos === 'top') {
      top = triggerRect.top - bubbleHeight - gap;
      left = triggerRect.left + triggerRect.width / 2 - bubbleWidth / 2;
    } else if (targetPos === 'bottom') {
      top = triggerRect.bottom + gap;
      left = triggerRect.left + triggerRect.width / 2 - bubbleWidth / 2;
    } else if (targetPos === 'left') {
      top = triggerRect.top + triggerRect.height / 2 - bubbleHeight / 2;
      left = triggerRect.left - bubbleWidth - gap;
    } else if (targetPos === 'right') {
      top = triggerRect.top + triggerRect.height / 2 - bubbleHeight / 2;
      left = triggerRect.right + gap;
    }

    // Horizontal clamping within viewport bounds
    const minLeft = 12;
    const maxLeft = window.innerWidth - bubbleWidth - 12;
    const clampedLeft = Math.max(minLeft, Math.min(left, maxLeft));

    // Calculate arrow position relative to bubble so it always points directly at trigger
    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    const arrowOffset = Math.max(12, Math.min(bubbleWidth - 12, triggerCenter - clampedLeft));

    setCoords({
      top,
      left: clampedLeft,
      actualPosition: targetPos,
      arrowOffset,
    });
  }, [position]);

  const showTooltip = () => {
    if (disabled || !content) return;
    timerRef.current = window.setTimeout(() => {
      setVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  };

  useLayoutEffect(() => {
    if (visible) {
      calculatePosition();
    }
  }, [visible, calculatePosition]);

  useEffect(() => {
    if (!visible) return;

    const handleScrollOrResize = () => {
      calculatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [visible, calculatePosition]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!content || disabled) {
    return <>{children}</>;
  }

  const positionClass = `app-tooltip-${coords.actualPosition}`;

  return (
    <div
      ref={containerRef}
      className={`app-tooltip-container ${className}`}
      style={style}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {visible &&
        createPortal(
          <div
            ref={bubbleRef}
            className={`app-tooltip-bubble app-tooltip-portal ${positionClass} visible`}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              ['--arrow-offset' as any]: coords.arrowOffset ? `${coords.arrowOffset}px` : '50%',
            }}
            role="tooltip"
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
};
