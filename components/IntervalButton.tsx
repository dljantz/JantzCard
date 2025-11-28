import React from 'react';

interface IntervalButtonProps {
  interval: string | null; // Allow null for placeholders
  backgroundColor: string;
  isSelected: boolean;
  onClick: () => void;
  title?: string;
  size?: 'default' | 'small';
  disabled?: boolean;
}

const IntervalButton: React.FC<IntervalButtonProps> = ({ interval, backgroundColor, isSelected, onClick, title, size = 'default', disabled = false }) => {
  
  const sizeClasses = {
    default: "h-16 md:h-20 text-2xl",
    small: "h-12 md:h-16 text-lg"
  };

  const placeholderSizeClasses = {
    default: "h-16 md:h-20",
    small: "h-12 md:h-16"
  }

  if (!interval) {
    // Render an empty placeholder to maintain grid layout with the correct height
    return <div className={`w-full ${placeholderSizeClasses[size]}`}></div>;
  }

  const baseClasses = "w-full flex items-center justify-center rounded-md text-white font-bold transition-all duration-150 ease-in-out focus:outline-none transform";
  
  // State-dependent classes for scaling and rings.
  const stateClasses = isSelected
    ? 'ring-2 ring-white/70 shadow-lg scale-110'
    : 'hover:scale-105';
  
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
    >
      {interval}
    </button>
  );
};

export default IntervalButton;