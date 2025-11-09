/**
 * MTA data provider - loads historical data and calculates predictions
 */

import type { HistoricalData, TrainTime, Station } from './types';
import { DayType } from './types';
import { MAX_NUM_PREDICTIONS } from '../utils/constants';

export class MTAProvider {
  private historicalData: HistoricalData | null = null;
  private stations: Station[] = [];
  private lastSecondTrain: TrainTime | null = null;

  async loadData(): Promise<void> {
    // Load historical data
    const histResponse = await fetch('/historical-data.json');
    this.historicalData = await histResponse.json();

    // Load stations
    const stationsResponse = await fetch('/stations.json');
    this.stations = await stationsResponse.json();
  }

  getStations(): Station[] {
    return this.stations;
  }

  getStation(stopId: string): Station | undefined {
    return this.stations.find(s => s.stop_id === stopId);
  }

  /**
   * Get predictions for a given stop ID and direction
   */
  getPredictions(stopId: string, direction: number | null = null): TrainTime[] {
    if (!this.historicalData) {
      return [];
    }

    const historicalTimes = this.historicalData[stopId];
    if (!historicalTimes) {
      return [];
    }

    const now = new Date();
    const currentDayType = this.getDayType(now);
    const currentSecondsFromMidnight = this.getSecondsFromMidnight(now);

    // Filter and convert historical times to predictions
    const predictions: TrainTime[] = [];

    for (const histTime of historicalTimes) {
      // Filter by day type
      if (histTime.day_type !== currentDayType) {
        continue;
      }

      // Filter by direction if specified
      if (direction !== null && histTime.direction_id !== direction.toString()) {
        continue;
      }

      // Calculate wait time
      let waitTime = histTime.departure_time - currentSecondsFromMidnight;

      // Handle times that wrap past midnight
      if (waitTime < 0) {
        waitTime += 24 * 3600;
      }

      // Only show trains in the next hour
      if (waitTime > 3600) {
        continue;
      }

      // Skip trains that have already left (negative times after adjustment)
      if (waitTime < 0) {
        continue;
      }

      // Check if this is an express train
      const isExpress = this.isExpressTrain(histTime.route_id, histTime.trip_id);

      predictions.push({
        route_id: histTime.route_id,
        direction_id: histTime.direction_id,
        long_name: histTime.long_name,
        time: waitTime,
        display_order: 0, // Will be set after sorting
        trip_id: histTime.trip_id,
        is_express: isExpress,
      });
    }

    // Sort by time and assign display order
    predictions.sort((a, b) => a.time - b.time);
    predictions.forEach((p, i) => {
      p.display_order = i;
    });

    // Return top N predictions
    return predictions.slice(0, MAX_NUM_PREDICTIONS);
  }

  /**
   * Get the second train to display (rotates through predictions)
   */
  getSecondTrain(predictions: TrainTime[]): TrainTime | null {
    if (!predictions || predictions.length < 2) {
      return null;
    }

    if (this.lastSecondTrain === null) {
      this.lastSecondTrain = predictions[1];
      return predictions[1];
    }

    // Find the last displayed train in current predictions
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i].display_order === this.lastSecondTrain.display_order) {
        let nextId = i + 1;
        if (nextId >= predictions.length) {
          nextId = 1; // Skip back to second train, never show first
        }
        this.lastSecondTrain = predictions[nextId];
        return predictions[nextId];
      }
    }

    // If not found, return second train
    this.lastSecondTrain = predictions[1];
    return predictions[1];
  }

  /**
   * Get current day type
   */
  private getDayType(date: Date): DayType {
    const day = date.getDay();
    if (day === 0) return DayType.SUNDAY;
    if (day === 6) return DayType.SATURDAY;
    return DayType.WEEKDAY;
  }

  /**
   * Get seconds from midnight
   */
  private getSecondsFromMidnight(date: Date): number {
    return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  }

  /**
   * Check if a train is express (simplified - checks for express in trip_id)
   */
  private isExpressTrain(routeId: string, tripId: string): boolean {
    // Routes 4 and 6 have express service
    if (routeId !== '4' && routeId !== '6') {
      return false;
    }
    // Express trains typically have different patterns in trip IDs
    // This is a simplified check - in reality, you'd need schedule data
    return tripId.includes('_X') || tripId.includes('EXPRESS');
  }
}
