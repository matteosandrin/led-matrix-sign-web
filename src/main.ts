/**
 * MTA LED Matrix Simulator - Main Application
 */

import { MTAProvider } from './data/mta-provider';
import { MTARenderer } from './renderer/mta-renderer';
import type { TrainTime, Station } from './data/types';
import { REFRESH_INTERVAL } from './utils/constants';
import './style.css';

class MTASimulator {
  private provider: MTAProvider;
  private renderer: MTARenderer;
  private currentStation: string = 'A20'; // Default: 86 St B,C
  private currentDirection: number | null = null; // null = both directions
  private predictions: TrainTime[] = [];
  private refreshInterval: number | null = null;

  constructor() {
    const canvas = document.getElementById('led-canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Canvas element not found');
    }

    this.provider = new MTAProvider();
    this.renderer = new MTARenderer(canvas);
  }

  async initialize(): Promise<void> {
    // Show loading state
    this.updateStatus('Loading data...');

    // Load data and initialize renderer
    await Promise.all([
      this.provider.loadData(),
      this.renderer.initialize(),
    ]);

    // Populate station selector
    this.populateStationSelector();

    // Set up event listeners
    this.setupEventListeners();

    // Initial render
    await this.refresh();

    // Start auto-refresh
    this.startAutoRefresh();

    this.updateStatus('Ready');
  }

  private populateStationSelector(): void {
    const selector = document.getElementById('station-selector') as HTMLSelectElement;
    if (!selector) return;

    const stations = this.provider.getStations();

    // Sort stations alphabetically by name
    stations.sort((a, b) => a.stop_name.localeCompare(b.stop_name));

    // Clear existing options
    selector.innerHTML = '';

    // Add options
    for (const station of stations) {
      const option = document.createElement('option');
      option.value = station.stop_id;
      option.textContent = `${station.stop_name} (${station.routes.join(', ')})`;
      if (station.stop_id === this.currentStation) {
        option.selected = true;
      }
      selector.appendChild(option);
    }
  }

  private setupEventListeners(): void {
    // Station selector
    const stationSelector = document.getElementById('station-selector') as HTMLSelectElement;
    if (stationSelector) {
      stationSelector.addEventListener('change', async (e) => {
        this.currentStation = (e.target as HTMLSelectElement).value;
        await this.refresh();
      });
    }

    // Direction buttons
    const uptownBtn = document.getElementById('uptown-btn');
    const downtownBtn = document.getElementById('downtown-btn');
    const bothBtn = document.getElementById('both-btn');

    if (uptownBtn) {
      uptownBtn.addEventListener('click', async () => {
        this.currentDirection = 0;
        this.updateDirectionButtons();
        await this.refresh();
      });
    }

    if (downtownBtn) {
      downtownBtn.addEventListener('click', async () => {
        this.currentDirection = 1;
        this.updateDirectionButtons();
        await this.refresh();
      });
    }

    if (bothBtn) {
      bothBtn.addEventListener('click', async () => {
        this.currentDirection = null;
        this.updateDirectionButtons();
        await this.refresh();
      });
    }
  }

  private updateDirectionButtons(): void {
    const uptownBtn = document.getElementById('uptown-btn');
    const downtownBtn = document.getElementById('downtown-btn');
    const bothBtn = document.getElementById('both-btn');

    [uptownBtn, downtownBtn, bothBtn].forEach(btn => {
      btn?.classList.remove('active');
    });

    if (this.currentDirection === 0) {
      uptownBtn?.classList.add('active');
    } else if (this.currentDirection === 1) {
      downtownBtn?.classList.add('active');
    } else {
      bothBtn?.classList.add('active');
    }
  }

  private async refresh(): Promise<void> {
    // Get predictions
    this.predictions = this.provider.getPredictions(
      this.currentStation,
      this.currentDirection
    );

    // Get first and second train
    const displayPredictions: TrainTime[] = [];
    if (this.predictions.length > 0) {
      displayPredictions.push(this.predictions[0]);

      const secondTrain = this.provider.getSecondTrain(this.predictions);
      if (secondTrain) {
        displayPredictions.push(secondTrain);
      }
    }

    // Render
    await this.renderer.render(displayPredictions);

    // Update info display
    this.updateInfo();
  }

  private updateInfo(): void {
    const station = this.provider.getStation(this.currentStation);
    if (!station) return;

    const infoDiv = document.getElementById('station-info');
    if (!infoDiv) return;

    const directionLabel = this.getDirectionLabel(station);
    const trainCount = this.predictions.length;

    infoDiv.innerHTML = `
      <strong>${station.stop_name}</strong> - ${station.routes.join(', ')}<br>
      Direction: ${directionLabel} | Upcoming trains: ${trainCount}
    `;
  }

  private getDirectionLabel(station: Station): string {
    if (this.currentDirection === 0) {
      return station.north_direction_label || 'Uptown';
    } else if (this.currentDirection === 1) {
      return station.south_direction_label || 'Downtown';
    } else {
      return 'Both';
    }
  }

  private updateStatus(status: string): void {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      statusDiv.textContent = status;
    }
  }

  private startAutoRefresh(): void {
    // Refresh predictions every 5 seconds
    this.refreshInterval = window.setInterval(async () => {
      await this.refresh();
    }, REFRESH_INTERVAL);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const app = new MTASimulator();
  try {
    await app.initialize();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      statusDiv.textContent = `Error: ${error}`;
      statusDiv.style.color = 'red';
    }
  }
});
