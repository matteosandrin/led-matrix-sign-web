/**
 * MTA data provider - loads historical data and calculates predictions
 */

import type { HistoricalData, TrainTime, Station } from "./types";
import { DayType } from "./types";
import { MAX_NUM_PREDICTIONS } from "../utils/constants";

interface CompressedHistoricalData {
  names: string[];
  data: {
    [stopId: string]: [string, string, number, number, string][];
    // Format: [route_id, direction_id, name_index, departure_time, day_type_short]
  };
}

export class MTAProvider {
  private historicalData: HistoricalData | null = null;
  private stations: Station[] = [];
  private childStationIds: Set<string> = new Set();
  private lastSecondTrain: TrainTime | null = null;

  async loadData(): Promise<void> {
    // Load historical data (compressed format)
    const histResponse = await fetch("/historical-data.json");
    const compressedData: CompressedHistoricalData = await histResponse.json();

    // Decompress data
    this.historicalData = this.decompressHistoricalData(compressedData);

    // Load stations
    const stationsResponse = await fetch("/stations.json");
    this.stations = await stationsResponse.json();

    // Build set of all child station IDs for filtering
    this.buildChildStationSet();
  }

  /**
   * Decompress the historical data from compact format
   */
  private decompressHistoricalData(
    compressed: CompressedHistoricalData,
  ): HistoricalData {
    const dayTypeMap: Record<string, DayType> = {
      w: DayType.WEEKDAY,
      s: DayType.SATURDAY,
      u: DayType.SUNDAY,
    };

    const decompressed: HistoricalData = {};

    for (const stopId in compressed.data) {
      decompressed[stopId] = compressed.data[stopId].map((entry) => ({
        route_id: entry[0],
        direction_id: entry[1],
        long_name: compressed.names[entry[2]],
        departure_time: entry[3],
        trip_id: "", // Not stored in compressed format
        day_type: dayTypeMap[entry[4]] || (entry[4] as DayType),
      }));
    }

    return decompressed;
  }

  /**
   * Build a set of all station IDs that are children of other stations
   */
  private buildChildStationSet(): void {
    this.childStationIds.clear();
    for (const station of this.stations) {
      if (station.children) {
        for (const childId of station.children) {
          this.childStationIds.add(childId);
        }
      }
    }
  }

  /**
   * Get stations for display (excludes child stations)
   */
  getStations(): Station[] {
    return this.stations.filter(
      (station) => !this.childStationIds.has(station.stop_id),
    );
  }

  getStation(stopId: string): Station | undefined {
    return this.stations.find((s) => s.stop_id === stopId);
  }

  /**
   * Get predictions for a given stop ID and direction
   * Includes predictions from child stations if any
   */
  getPredictions(stopId: string, direction: number | null = null): TrainTime[] {
    if (!this.historicalData) {
      return [];
    }

    // Get all station IDs to check (parent + children)
    const stationIdsToCheck = [stopId];
    const station = this.getStation(stopId);
    if (station?.children) {
      stationIdsToCheck.push(...station.children);
    }

    const now = new Date();
    const currentDayType = this.getDayType(now);
    const currentSecondsFromMidnight = this.getSecondsFromMidnight(now);

    // Collect predictions from all relevant stations
    const predictions: TrainTime[] = [];

    for (const stationId of stationIdsToCheck) {
      const historicalTimes = this.historicalData[stationId];
      if (!historicalTimes) {
        continue;
      }

      for (const histTime of historicalTimes) {
        // Filter by day type
        if (histTime.day_type !== currentDayType) {
          continue;
        }

        // Filter by direction if specified
        if (
          direction !== null &&
          histTime.direction_id !== direction.toString()
        ) {
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
        const isExpress = this.isExpressTrain(
          histTime.route_id,
          histTime.trip_id,
        );

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
    if (routeId !== "4" && routeId !== "6") {
      return false;
    }
    // Express trains typically have different patterns in trip IDs
    // This is a simplified check - in reality, you'd need schedule data
    return tripId.includes("_X") || tripId.includes("EXPRESS");
  }
}
