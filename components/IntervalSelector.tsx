
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { STUDY_INTERVALS, RED_INTERVAL_COLORS, YELLOW_INTERVAL_COLOR, GREEN_INTERVAL_COLORS, DEFAULT_CENTER_INTERVAL } from '../constants';
import IntervalButton from './IntervalButton';

interface IntervalSelectorProps {
  centerIntervalLabel: string;
  lastIntendedInterval?: string | null;
  onSelect: (interval: string) => void;
  preselection: string | null;
  isFlipped: boolean;
  isDisabled?: boolean;
}

const intervalLabels = STUDY_INTERVALS.map(i => i.label);

const IntervalSelector: React.FC<IntervalSelectorProps> = ({
  centerIntervalLabel,
  lastIntendedInterval,
  onSelect,
  preselection,
  isFlipped,
  isDisabled = false
}) => {
  const [leftOverride, setLeftOverride] = useState<string | null>(null);
  const [rightOverride, setRightOverride] = useState<string | null>(null);
  const cycleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ignoreNextClickRef = useRef(false);

  // Reset overrides when preselection is cleared
  useEffect(() => {
    if (!preselection) {
      setLeftOverride(null);
      setRightOverride(null);
    }
  }, [preselection]);

  // Determine Base Intervals
  const { centerInterval, baseLeftInterval, baseRightInterval } = useMemo(() => {
    const currentIndex = intervalLabels.indexOf(centerIntervalLabel);
    const centerIdx = currentIndex !== -1 ? currentIndex : intervalLabels.indexOf(DEFAULT_CENTER_INTERVAL);

    const center = intervalLabels[centerIdx];
    const left = centerIdx > 0 ? intervalLabels[centerIdx - 1] : null;
    const right = centerIdx < intervalLabels.length - 1 ? intervalLabels[centerIdx + 1] : null;

    return { centerInterval: center, baseLeftInterval: left, baseRightInterval: right };
  }, [centerIntervalLabel]);

  // Apply Overrides
  const leftInterval = leftOverride || baseLeftInterval;
  const rightInterval = rightOverride || baseRightInterval;

  const startCycling = (currentLabel: string | null, direction: 'shorter' | 'longer') => {
    if (!currentLabel) return;
    let currentIndex = intervalLabels.indexOf(currentLabel);
    if (currentIndex === -1) return;

    cycleTimerRef.current = setInterval(() => {
      if (direction === 'longer') {
        if (currentIndex < intervalLabels.length - 1) {
          currentIndex++;
          setRightOverride(intervalLabels[currentIndex]);
        }
      } else {
        if (currentIndex > 0) {
          currentIndex--;
          setLeftOverride(intervalLabels[currentIndex]);
        }
      }
    }, 500);
  };

  const stopCycling = (intervalToSelect?: string | null) => {
    if (cycleTimerRef.current) {
      clearInterval(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
    if (intervalToSelect) {
      ignoreNextClickRef.current = true;
      onSelect(intervalToSelect);
    }
  };

  const getButtonHandlers = (interval: string | null, position: 'left' | 'center' | 'right') => {
    if (isDisabled || !interval) return {};

    const handlers: any = {};

    // Cycling Logic
    if (position === 'left' && interval !== intervalLabels[0]) {
      handlers.onMouseDown = () => startCycling(interval, 'shorter');
      handlers.onTouchStart = () => startCycling(interval, 'shorter');
    } else if (position === 'right' && interval !== intervalLabels[intervalLabels.length - 1]) {
      handlers.onMouseDown = () => startCycling(interval, 'longer');
      handlers.onTouchStart = () => startCycling(interval, 'longer');
    }

    handlers.onMouseUp = () => stopCycling(interval);
    handlers.onMouseLeave = () => stopCycling();
    handlers.onTouchEnd = (e: React.TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      stopCycling(interval);
    };

    return handlers;
  };

  const getButtonTooltip = (interval: string | null, position: 'left' | 'center' | 'right') => {
    if (!interval) return undefined;
    if (position === 'center') {
      if (interval === lastIntendedInterval) return "Repeat last intended study interval";
      return "Repeat last actual study interval";
    }
    if (position === 'left') return "Press and hold for shorter interval options";
    if (position === 'right') return "Press and hold for longer interval options";
    return undefined;
  };

  const getPromptText = () => {
    if (isDisabled) return 'Saving...';
    if (!isFlipped) return 'How long will you remember this? Select an interval.';
    if (preselection) return `Click '${preselection}' again to confirm, or change your mind.`;
    return 'Your previous selection is cleared. Please select a new interval.';
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-2">
      <div className={`w-full grid grid-cols-3 gap-4 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>

        {/* Left Button (Red, Shorter) */}
        <IntervalButton
          interval={leftInterval}
          backgroundColor={RED_INTERVAL_COLORS[0]}
          isSelected={preselection === leftInterval}
          onClick={(e) => {
            e.stopPropagation();
            if (ignoreNextClickRef.current) { ignoreNextClickRef.current = false; return; }
            if (leftInterval) onSelect(leftInterval);
          }}
          title={getButtonTooltip(leftInterval, 'left')}
          disabled={isDisabled}
          isBold={leftInterval === lastIntendedInterval}
          {...getButtonHandlers(leftInterval, 'left')}
        />

        {/* Center Button (Yellow, Last Intended) */}
        <IntervalButton
          interval={centerInterval}
          backgroundColor={YELLOW_INTERVAL_COLOR}
          isSelected={preselection === centerInterval}
          onClick={(e) => {
            e.stopPropagation();
            if (ignoreNextClickRef.current) { ignoreNextClickRef.current = false; return; }
            if (centerInterval) onSelect(centerInterval);
          }}
          title={getButtonTooltip(centerInterval, 'center')}
          disabled={isDisabled}
          isBold={centerInterval === lastIntendedInterval}
          {...getButtonHandlers(centerInterval, 'center')}
        />

        {/* Right Button (Green, Longer) */}
        <IntervalButton
          interval={rightInterval}
          backgroundColor={GREEN_INTERVAL_COLORS[4]}
          isSelected={preselection === rightInterval}
          onClick={(e) => {
            e.stopPropagation();
            if (ignoreNextClickRef.current) { ignoreNextClickRef.current = false; return; }
            if (rightInterval) onSelect(rightInterval);
          }}
          title={getButtonTooltip(rightInterval, 'right')}
          disabled={isDisabled}
          isBold={rightInterval === lastIntendedInterval}
          {...getButtonHandlers(rightInterval, 'right')}
        />

      </div>
      <p className="text-center text-sm text-gray-400 mt-1 h-5">
        {getPromptText()}
      </p>
    </div>
  );
};

export default IntervalSelector;