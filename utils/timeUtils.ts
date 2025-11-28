import { STUDY_INTERVALS } from '../constants';
import { StudyInterval } from '../types';

/**
 * Finds the study interval that is closest to a given duration in milliseconds.
 * @param elapsedMs The actual time that has passed.
 * @returns The label of the closest study interval (e.g., "1d", "6hr").
 */
export const findClosestInterval = (elapsedMs: number): string => {
  // Guard against invalid elapsed time. Default to the first interval.
  if (elapsedMs <= 0 || !Number.isFinite(elapsedMs)) {
    return STUDY_INTERVALS[0].label;
  }

  let closestInterval: StudyInterval = STUDY_INTERVALS[0];
  let smallestDiff = Math.abs(elapsedMs - closestInterval.ms);

  // Iterate through all defined intervals to find the one with the minimum difference.
  for (const interval of STUDY_INTERVALS) {
    // The 'infinite' interval has MAX_SAFE_INTEGER ms, which would skew the comparison.
    // We exclude it from being a potential "closest" match for elapsed time.
    if (interval.label === 'infinite') {
      continue;
    }
    
    const currentDiff = Math.abs(elapsedMs - interval.ms);

    if (currentDiff < smallestDiff) {
      smallestDiff = currentDiff;
      closestInterval = interval;
    }
  }
  
  return closestInterval.label;
};
