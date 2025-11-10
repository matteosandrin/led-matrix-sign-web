/**
 * Constants for MTA LED display
 */

// Display dimensions
export const DISPLAY_WIDTH = 160;
export const DISPLAY_HEIGHT = 32;
export const SCALE_FACTOR = 4; // Scale up for web display

// Colors
export const MTA_GREEN = '#D0FF00';
export const MTA_RED_AMBER = '#E28522';
export const BLACK = '#000000';

// Route colors (for icons)
export const ROUTE_COLORS: Record<string, string> = {
  '1': '#EE0900',
  '2': '#EE0900',
  '3': '#EE0900',
  '4': '#3CBE3C',
  '5': '#3CBE3C',
  '6': '#3CBE3C',
  '7': '#B200A2',
  'A': '#33BBFF',
  'C': '#33BBFF',
  'E': '#33BBFF',
  'G': '#AED92B',
  'B': '#FF6800',
  'D': '#FF6800',
  'F': '#FF6800',
  'M': '#FF6800',
  'J': '#B37F2D',
  'Z': '#B37F2D',
  'L': '#898888',
  'GS': '#545661',
  'N': '#FCBB0A',
  'Q': '#FCBB0A',
  'R': '#FCBB0A',
  'W': '#FCBB0A',
  'SI': '#33BBFF',
};

// Display constants
export const MAX_NUM_PREDICTIONS = 6;
export const REFRESH_INTERVAL = 5000; // 5 seconds

// Font settings
export const FONT_SIZE = 10;
export const FONT_FAMILY = 'MTASans';

// Layout
export const ROW_HEIGHT = 16;
export const ROW_Y_POSITIONS = [15, 31];
export const ICON_SIZE = 16;

// Text truncation
export const ABBREVIATIONS: Record<string, string> = {
  'center': 'ctr',
  'Center': 'Ctr',
  'junction': 'jct',
  'Junction': 'Jct',
};

export const DEFAULT_STATION = 'A20'; // 86th st B, C