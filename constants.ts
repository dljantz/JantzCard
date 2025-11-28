import { StudyInterval } from "./types";

export const STUDY_INTERVALS: StudyInterval[] = [
  { label: '1s', ms: 1000 },
  { label: '2s', ms: 2 * 1000 },
  { label: '5s', ms: 5 * 1000 },
  { label: '10s', ms: 10 * 1000 },
  { label: '30s', ms: 30 * 1000 },
  { label: '1m', ms: 60 * 1000 },
  { label: '2m', ms: 2 * 60 * 1000 },
  { label: '5m', ms: 5 * 60 * 1000 },
  { label: '10m', ms: 10 * 60 * 1000 },
  { label: '30m', ms: 30 * 60 * 1000 },
  { label: '1hr', ms: 60 * 60 * 1000 },
  { label: '3hr', ms: 3 * 60 * 60 * 1000 },
  { label: '6hr', ms: 6 * 60 * 60 * 1000 },
  { label: '12hr', ms: 12 * 60 * 60 * 1000 },
  { label: '1d', ms: 24 * 60 * 60 * 1000 },
  { label: '2d', ms: 2 * 24 * 60 * 60 * 1000 },
  { label: '4d', ms: 4 * 24 * 60 * 60 * 1000 },
  { label: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '2w', ms: 14 * 24 * 60 * 60 * 1000 },
  { label: '1mo', ms: 30 * 24 * 60 * 60 * 1000 },
  { label: '2mo', ms: 2 * 30 * 24 * 60 * 60 * 1000 },
  { label: '3mo', ms: 3 * 30 * 24 * 60 * 60 * 1000 },
  { label: '6mo', ms: 6 * 30 * 24 * 60 * 60 * 1000 },
  { label: '1yr', ms: 365 * 24 * 60 * 60 * 1000 },
  { label: '2yr', ms: 2 * 365 * 24 * 60 * 60 * 1000 },
  { label: '5yr', ms: 5 * 365 * 24 * 60 * 60 * 1000 },
  { label: '10yr', ms: 10 * 365 * 24 * 60 * 60 * 1000 },
  { label: '20yr', ms: 20 * 365 * 24 * 60 * 60 * 1000 },
  { label: '40yr', ms: 40 * 365 * 24 * 60 * 60 * 1000 },
  { label: 'infinite', ms: Number.MAX_SAFE_INTEGER },
];

// Constants for IntervalSelector
export const DEFAULT_CENTER_INTERVAL = '10m';
export const RED_INTERVAL_COLORS = ['#F00000', '#D81800', '#C03000', '#A84800', '#906000'];
export const YELLOW_INTERVAL_COLOR = '#787800';
export const GREEN_INTERVAL_COLORS = ['#607818', '#487830', '#307848', '#187860', '#007878'];