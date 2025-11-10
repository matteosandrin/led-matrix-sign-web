/**
 * Type definitions for MTA arrival board data structures
 */

export const DayType = {
  WEEKDAY: "weekday",
  SATURDAY: "saturday",
  SUNDAY: "sunday",
} as const;

export type DayType = (typeof DayType)[keyof typeof DayType];

export interface HistoricalTrainTime {
  route_id: string;
  direction_id: string;
  long_name: string;
  departure_time: number; // Seconds since midnight
  trip_id: string;
  day_type: DayType;
}

export interface TrainTime {
  route_id: string;
  direction_id: string;
  long_name: string;
  time: number; // Wait time in seconds
  display_order: number; // Position in list (0-5)
  stop_headsign?: string;
  trip_id: string;
  is_express: boolean;
}

export interface Station {
  stop_id: string;
  stop_name: string;
  latitude: number;
  longitude: number;
  north_direction_label: string;
  south_direction_label: string;
  routes: string[];
  children?: string[];
}

export interface HistoricalData {
  [stopId: string]: HistoricalTrainTime[];
}
