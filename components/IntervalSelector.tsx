
import React, { useMemo } from 'react';
import { STUDY_INTERVALS, RED_INTERVAL_COLORS, YELLOW_INTERVAL_COLOR, GREEN_INTERVAL_COLORS, DEFAULT_CENTER_INTERVAL } from '../constants';
import IntervalButton from './IntervalButton';
import useViewport from '../hooks/useViewport';

interface IntervalSelectorProps {
  centerIntervalLabel: string;
  lastIntendedInterval?: string | null;
  onSelect: (interval: string) => void;
  preselection: string | null;
  isFlipped: boolean;
  isDisabled?: boolean;
}

const intervalLabels = STUDY_INTERVALS.map(i => i.label);
const SHORT_SCREEN_HEIGHT_THRESHOLD = 500; // Switch to single-row layout below this height in pixels

const IntervalSelector: React.FC<IntervalSelectorProps> = ({ 
  centerIntervalLabel, 
  lastIntendedInterval,
  onSelect, 
  preselection, 
  isFlipped, 
  isDisabled = false 
}) => {
  const { height } = useViewport();
  const isShortScreen = height < SHORT_SCREEN_HEIGHT_THRESHOLD;

  const { redIntervals, centerInterval, greenIntervals } = useMemo(() => {
    const currentIndex = intervalLabels.indexOf(centerIntervalLabel);
    const centerIdx = currentIndex !== -1 ? currentIndex : intervalLabels.indexOf(DEFAULT_CENTER_INTERVAL);

    const reds = Array(5).fill(null).map((_, i) => {
      const index = centerIdx - (5 - i);
      return index >= 0 ? intervalLabels[index] : null;
    });

    const greens = Array(5).fill(null).map((_, i) => {
      const index = centerIdx + 1 + i;
      return index < intervalLabels.length ? intervalLabels[index] : null;
    });
    
    const center = intervalLabels[centerIdx];

    return { redIntervals: reds, centerInterval: center, greenIntervals: greens };
  }, [centerIntervalLabel]);

  const getButtonTooltip = (interval: string | null, isCenter: boolean) => {
    if (!interval) return undefined;

    const isIntended = interval === lastIntendedInterval;

    if (isCenter && isIntended) {
      return "Repeat last study interval";
    }
    if (isCenter) {
      return "Repeat last actual study interval";
    }
    if (isIntended) {
      return "Repeat last intended study interval";
    }
    return undefined;
  };

  const getPromptText = () => {
    if (isDisabled) {
      return 'Saving...'
    }
    if (!isFlipped) {
      return 'How long will you remember this? Select an interval.';
    }
    if (preselection) {
      return `Click '${preselection}' again to confirm, or change your mind.`;
    }
    return 'Your previous selection is cleared. Please select a new interval.';
  };

  const renderSingleRowLayout = () => {
    const allIntervals = [...redIntervals, centerInterval, ...greenIntervals];
    const allColors = [...RED_INTERVAL_COLORS, YELLOW_INTERVAL_COLOR, ...GREEN_INTERVAL_COLORS];
    
    return (
      <div className={`w-full grid grid-cols-11 gap-1 md:gap-2 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {allIntervals.map((interval, index) => {
          // The center element in single row layout with 11 items (5 red, 1 center, 5 green) is index 5
          const isCenter = index === 5;
          return (
            <IntervalButton
              key={interval ? `all-${interval}` : `all-empty-${index}`}
              interval={interval}
              backgroundColor={allColors[index]}
              isSelected={preselection === interval}
              onClick={() => interval && onSelect(interval)}
              size="small"
              title={getButtonTooltip(interval, isCenter)}
              disabled={isDisabled}
              isBold={interval === lastIntendedInterval}
            />
          );
        })}
      </div>
    );
  };

  const renderThreeRowLayout = () => {
    return (
      <div className={`w-full flex flex-col items-center gap-2 md:gap-4 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {/* Top Row */}
        <div className="w-full grid grid-cols-5 gap-2 md:gap-4">
          {redIntervals.map((interval, index) => (
            <IntervalButton
              key={interval ? `r-${interval}` : `r-empty-${index}`}
              interval={interval}
              backgroundColor={RED_INTERVAL_COLORS[index]}
              isSelected={preselection === interval}
              onClick={() => interval && onSelect(interval)}
              size="default"
              title={getButtonTooltip(interval, false)}
              disabled={isDisabled}
              isBold={interval === lastIntendedInterval}
            />
          ))}
        </div>

        {/* Middle Row */}
        <div className="w-full">
          <IntervalButton
            interval={centerInterval}
            backgroundColor={YELLOW_INTERVAL_COLOR}
            isSelected={preselection === centerInterval}
            onClick={() => centerInterval && onSelect(centerInterval)}
            title={getButtonTooltip(centerInterval, true)}
            size="default"
            disabled={isDisabled}
            isBold={centerInterval === lastIntendedInterval}
          />
        </div>

        {/* Bottom Row */}
        <div className="w-full grid grid-cols-5 gap-2 md:gap-4">
          {greenIntervals.map((interval, index) => (
            <IntervalButton
              key={interval ? `g-${interval}` : `g-empty-${index}`}
              interval={interval}
              backgroundColor={GREEN_INTERVAL_COLORS[index]}
              isSelected={preselection === interval}
              onClick={() => interval && onSelect(interval)}
              size="default"
              title={getButtonTooltip(interval, false)}
              disabled={isDisabled}
              isBold={interval === lastIntendedInterval}
            />
          ))}
        </div>
      </div>
    );
  };


  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-2 md:gap-4">
      {isShortScreen ? renderSingleRowLayout() : renderThreeRowLayout()}
      <p className="text-center text-sm text-gray-400 mt-1 h-5">
        {getPromptText()}
      </p>
    </div>
  );
};

export default IntervalSelector;