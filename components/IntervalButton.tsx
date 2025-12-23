
import React from 'react';

interface IntervalButtonProps {
  interval: string | null; // Allow null for placeholders
  backgroundColor: string;
  isSelected: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  size?: 'default' | 'small';
  disabled?: boolean;
  isBold?: boolean;
  onMouseDown?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseUp?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onTouchStart?: (event: React.TouchEvent<HTMLButtonElement>) => void;
  onTouchEnd?: (event: React.TouchEvent<HTMLButtonElement>) => void;
}

const IntervalButton: React.FC<IntervalButtonProps> = ({
  interval,
  backgroundColor,
  isSelected,
  onClick,
  title,
  size = 'default',
  disabled = false,
  isBold = false,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchEnd
}) => {

  const sizeClasses = {
    default: "h-8 md:h-10 text-lg",
    small: "h-6 md:h-8 text-sm"
  };

  const placeholderSizeClasses = {
    default: "h-8 md:h-10",
    small: "h-6 md:h-8"
  }

  if (!interval) {
    // Render an empty placeholder to maintain grid layout with the correct height
    return <div className={`w-full ${placeholderSizeClasses[size]}`}></div>;
  }

  const fontWeight = isBold ? "font-black" : "font-bold";
  const baseClasses = `w-full flex items-center justify-center rounded-md text-white ${fontWeight} transition-all duration-150 ease-in-out focus:outline-none transform select-none touch-manipulation`;

  // State-dependent classes for scaling and rings.
  const stateClasses = isSelected
    ? 'ring-4 ring-white/70 shadow-lg brightness-125'
    : 'hover:brightness-110';

  const disabledClasses = disabled ? 'cursor-not-allowed' : '';

  const colorClass = `bg-[${backgroundColor}]`;

  const finalClasses = [
    baseClasses,
    sizeClasses[size],
    stateClasses,
    colorClass,
    disabledClasses,
  ].join(' ');


  return (
    <button
      onClick={onClick}
      className={finalClasses}
      aria-pressed={isSelected}
      disabled={!interval || disabled}
      title={title}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {interval}
    </button>
  );
};

export default IntervalButton;