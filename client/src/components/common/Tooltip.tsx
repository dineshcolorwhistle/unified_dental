import React, { useState, useRef, useEffect } from 'react';

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
 * Adheres to the exact sidebar tooltip visual design:
 * dark surface, subtle border, rounded corners, directional pointer arrow, and elevation.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  delay = 120,
  children,
  className = '',
  style,
  disabled = false,
}) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

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

  const positionClass = `app-tooltip-${position}`;

  return (
    <div
      className={`app-tooltip-container ${className}`}
      style={style}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      <div
        className={`app-tooltip-bubble ${positionClass} ${visible ? 'visible' : ''}`}
        role="tooltip"
      >
        {content}
      </div>
    </div>
  );
};
