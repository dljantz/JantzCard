
import React, { useMemo, useState, useRef, useEffect } from 'react';
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

  const [minOverride, setMinOverride] = useState<string | null>(null);
  const [maxOverride, setMaxOverride] = useState<string | null>(null);
  const cycleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ignoreNextClickRef = useRef(false);

  // Reset overrides when preselection is cleared
  useEffect(() => {
    if (!preselection) {
      setMinOverride(null);
      setMaxOverride(null);
    }
  }, [preselection]);

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

  // Apply overrides
  const effectiveRedIntervals = useMemo(() => {
    const intervals = [...redIntervals];
    if (minOverride && intervals.length > 0) {
      intervals[0] = minOverride;
    }
    return intervals;
  }, [redIntervals, minOverride]);

  const effectiveGreenIntervals = useMemo(() => {
    const intervals = [...greenIntervals];
    if (maxOverride && intervals.length > 0) {
      intervals[intervals.length - 1] = maxOverride;
    }
    return intervals;
  }, [greenIntervals, maxOverride]);

  const startCycling = (currentLabel: string | null, direction: 'up' | 'down') => {
    if (!currentLabel) return;

    // Don't cycle if we are already at absolute limits and not overriding
    // (If we ARE overriding, we might want to cycle back, but the requirement is to cycle OUTWARDS)
    // Actually, "cycle up or down through the interval list".
    // "Min functionality: press and hold makes it get shorter and shorter".

    let currentIndex = intervalLabels.indexOf(currentLabel);
    if (currentIndex === -1) return;

    cycleTimerRef.current = setInterval(() => {
      if (direction === 'up') {
        if (currentIndex < intervalLabels.length - 1) {
          currentIndex++;
          setMaxOverride(intervalLabels[currentIndex]);
        }
      } else {
        if (currentIndex > 0) {
          currentIndex--;
          setMinOverride(intervalLabels[currentIndex]);
        }
      }
    }, 1000);
  };

  const stopCycling = (intervalToSelect?: string | null) => {
    if (cycleTimerRef.current) {
      clearInterval(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
    // If an interval is provided (onMouseUp/onTouchEnd), select it immediately
    if (intervalToSelect) {
      ignoreNextClickRef.current = true;
      onSelect(intervalToSelect);
    }
  };

  const getCyclingHandlers = (interval: string | null, isMin: boolean, isMax: boolean) => {
    if (isDisabled || !interval) return {};

    // Edge case: don't cycle if already at absolute limits
    if (isMin && interval === intervalLabels[0]) return {};
    if (isMax && interval === intervalLabels[intervalLabels.length - 1]) return {};

    // Use current overrides if available, otherwise use the passed interval
    // Actually, the 'interval' passed here IS the one currently being rendered (which includes overrides)
    // So we can just pass 'interval' to stopCycling

    if (isMin) {
      return {
        onMouseDown: () => startCycling(interval, 'down'),
        onMouseUp: () => stopCycling(interval),
        onMouseLeave: () => stopCycling(), // Don't select on leave, just stop
        onTouchStart: () => startCycling(interval, 'down'),
        onTouchEnd: (e: React.TouchEvent) => {
          e.preventDefault(); // Prevent ghost clicks
          stopCycling(interval);
        },
      };
    }
    if (isMax) {
      return {
        onMouseDown: () => startCycling(interval, 'up'),
        onMouseUp: () => stopCycling(interval),
        onMouseLeave: () => stopCycling(),
        onTouchStart: () => startCycling(interval, 'up'),
        onTouchEnd: (e: React.TouchEvent) => {
          e.preventDefault();
          stopCycling(interval);
        },
      };
    }
    return {};
  };

  const getButtonTooltip = (interval: string | null, isCenter: boolean, isMin: boolean, isMax: boolean) => {
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

    // Cycling tooltips
    if (isMax) {
      if (maxOverride && preselection === maxOverride) return "Deselect all buttons to reset this button";
      if (interval === intervalLabels[intervalLabels.length - 1]) return undefined; // Max limit
      return "Press and hold for longer interval options";
    }
    if (isMin) {
      if (minOverride && preselection === minOverride) return "Deselect all buttons to reset this button";
      if (interval === intervalLabels[0]) return undefined; // Min limit
      return "Press and hold for shorter interval options";
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
    const allIntervals = [...effectiveRedIntervals, centerInterval, ...effectiveGreenIntervals];
    const allColors = [...RED_INTERVAL_COLORS, YELLOW_INTERVAL_COLOR, ...GREEN_INTERVAL_COLORS];

    return (
      <div className={`w-full grid grid-cols-11 gap-1 md:gap-2 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {allIntervals.map((interval, index) => {
          // The center element in single row layout with 11 items (5 red, 1 center, 5 green) is index 5
          const isCenter = index === 5;
          const isMin = index === 0;
          const isMax = index === 10;

          return (
            <IntervalButton
              key={interval ? `all-${interval}` : `all-empty-${index}`}
              interval={interval}
              backgroundColor={allColors[index]}
              isSelected={preselection === interval}
              onClick={(e) => {
                e.stopPropagation();
                if (ignoreNextClickRef.current) {
                  ignoreNextClickRef.current = false;
                  return;
                }
                if (interval) onSelect(interval);
              }}
              size="small"
              title={getButtonTooltip(interval, isCenter, isMin, isMax)}
              disabled={isDisabled}
              isBold={interval === lastIntendedInterval}
              {...getCyclingHandlers(interval, isMin, isMax)}
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
          {effectiveRedIntervals.map((interval, index) => {
            const isMin = index === 0;
            return (
              <IntervalButton
                key={`r-${index}`}
                interval={interval}
                backgroundColor={RED_INTERVAL_COLORS[index]}
                isSelected={preselection === interval}
                onClick={(e) => {
                  e.stopPropagation();
                  if (ignoreNextClickRef.current) {
                    ignoreNextClickRef.current = false;
                    return;
                  }
                  if (interval) onSelect(interval);
                }}
                size="default"
                title={getButtonTooltip(interval, false, isMin, false)}
                disabled={isDisabled}
                isBold={interval === lastIntendedInterval}
                {...getCyclingHandlers(interval, isMin, false)}
              />
            );
          })}
        </div>

        {/* Middle Row */}
        <div className="w-full">
          <IntervalButton
            interval={centerInterval}
            backgroundColor={YELLOW_INTERVAL_COLOR}
            isSelected={preselection === centerInterval}
            onClick={(e) => {
              e.stopPropagation();
              // No cycling for center button, but consistency
              if (ignoreNextClickRef.current) {
                ignoreNextClickRef.current = false;
                return;
              }
              if (centerInterval) onSelect(centerInterval);
            }}
            title={getButtonTooltip(centerInterval, true, false, false)}
            // Pass false/false for isMin/isMax as it is center
            size="default"
            disabled={isDisabled}
            isBold={centerInterval === lastIntendedInterval}
          />
        </div>

        {/* Bottom Row */}
        <div className="w-full grid grid-cols-5 gap-2 md:gap-4">
          {effectiveGreenIntervals.map((interval, index) => {
            const isMax = index === 4;
            return (
              <IntervalButton
                key={`g-${index}`}
                interval={interval}
                backgroundColor={GREEN_INTERVAL_COLORS[index]}
                isSelected={preselection === interval}
                onClick={(e) => {
                  e.stopPropagation();
                  if (ignoreNextClickRef.current) {
                    ignoreNextClickRef.current = false;
                    return;
                  }
                  if (interval) onSelect(interval);
                }}
                size="default"
                title={getButtonTooltip(interval, false, false, isMax)}
                disabled={isDisabled}
                isBold={interval === lastIntendedInterval}
                {...getCyclingHandlers(interval, false, isMax)}
              />
            )
          })}
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