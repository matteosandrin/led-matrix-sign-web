/**
 * MTA LED Matrix Simulator - Main Application
 */

import { MTAProvider } from "./data/mta-provider";
import { MTARenderer } from "./renderer/mta-renderer";
import { WebGLLEDRenderer } from "./renderer/webgl-led-renderer";
import type { TrainTime, Station } from "./data/types";
import {
  REFRESH_INTERVAL,
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
  SCALE_FACTOR,
  DEFAULT_STATION,
} from "./utils/constants";
import "./style.css";

class MTASimulator {
  private provider: MTAProvider;
  private renderer: MTARenderer;
  private webglRenderer: WebGLLEDRenderer;
  private sourceCanvas: HTMLCanvasElement;
  private displayCanvas: HTMLCanvasElement;
  private currentStation: string;
  private currentDirection: number | null = null; // null = both directions
  private predictions: TrainTime[] = [];

  constructor() {
    const sourceCanvas = document.getElementById(
      "led-canvas",
    ) as HTMLCanvasElement;
    const displayCanvas = document.getElementById(
      "led-display",
    ) as HTMLCanvasElement;

    if (!sourceCanvas || !displayCanvas) {
      throw new Error("Canvas elements not found");
    }

    this.sourceCanvas = sourceCanvas;
    this.displayCanvas = displayCanvas;

    // Get station from URL parameter or use default
    this.currentStation = this.getStationFromURL() || DEFAULT_STATION;

    // Set up display canvas size
    this.displayCanvas.width = DISPLAY_WIDTH * SCALE_FACTOR;
    this.displayCanvas.height = DISPLAY_HEIGHT * SCALE_FACTOR;

    this.provider = new MTAProvider();
    this.renderer = new MTARenderer(sourceCanvas);
    this.webglRenderer = new WebGLLEDRenderer(
      displayCanvas,
      DISPLAY_WIDTH,
      DISPLAY_HEIGHT,
      {
        ledSize: 0.85,
        glowIntensity: 0.3,
        glowRadius: 1.5,
        separationGap: 0.15,
      },
    );

    // Set up animation frame callback to trigger WebGL render
    this.renderer.setAnimationFrameCallback(() => {
      this.webglRenderer.render(this.sourceCanvas);
    });
  }

  private getStationFromURL(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("station");
  }

  private shouldShowControls(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    const controls = urlParams.get("controls");
    // Do not show controls by default
    // Show controls if parameter is "true" or "1"
    return controls === "true" || controls === "1";
  }

  private applyControlsVisibility(): void {
    const controlsElement = document.querySelector(".controls") as HTMLElement;
    if (controlsElement) {
      controlsElement.style.display = this.shouldShowControls() ? "flex" : "none";
    }
  }

  async initialize(): Promise<void> {
    // Show loading state
    this.updateStatus("Loading data...");

    // Apply controls visibility based on URL parameter
    this.applyControlsVisibility();

    // Load data and initialize renderer
    await Promise.all([this.provider.loadData(), this.renderer.initialize()]);

    // Populate station selector
    this.populateStationSelector();

    // Set up event listeners
    this.setupEventListeners();

    // Initial render
    await this.refresh();

    // Start auto-refresh
    this.startAutoRefresh();

    this.updateStatus("Ready");
  }

  private populateStationSelector(): void {
    const selector = document.getElementById(
      "station-selector",
    ) as HTMLSelectElement;
    if (!selector) return;

    const stations = this.provider.getStations();

    // Sort stations alphabetically by name
    stations.sort((a, b) => a.stop_name.localeCompare(b.stop_name));

    // Clear existing options
    selector.innerHTML = "";

    // Add options
    for (const station of stations) {
      const option = document.createElement("option");
      option.value = station.stop_id;
      option.textContent = `${station.stop_name} (${station.routes.join(", ")})`;
      if (station.stop_id === this.currentStation) {
        option.selected = true;
      }
      selector.appendChild(option);
    }
  }

  private setupEventListeners(): void {
    // Station selector
    const stationSelector = document.getElementById(
      "station-selector",
    ) as HTMLSelectElement;
    if (stationSelector) {
      stationSelector.addEventListener("change", async (e) => {
        this.currentStation = (e.target as HTMLSelectElement).value;
        await this.refresh();
      });
    }

    // Direction buttons
    const uptownBtn = document.getElementById("uptown-btn");
    const downtownBtn = document.getElementById("downtown-btn");
    const bothBtn = document.getElementById("both-btn");

    if (uptownBtn) {
      uptownBtn.addEventListener("click", async () => {
        this.currentDirection = 0;
        this.updateDirectionButtons();
        await this.refresh();
      });
    }

    if (downtownBtn) {
      downtownBtn.addEventListener("click", async () => {
        this.currentDirection = 1;
        this.updateDirectionButtons();
        await this.refresh();
      });
    }

    if (bothBtn) {
      bothBtn.addEventListener("click", async () => {
        this.currentDirection = null;
        this.updateDirectionButtons();
        await this.refresh();
      });
    }
  }

  private updateDirectionButtons(): void {
    const uptownBtn = document.getElementById("uptown-btn");
    const downtownBtn = document.getElementById("downtown-btn");
    const bothBtn = document.getElementById("both-btn");

    [uptownBtn, downtownBtn, bothBtn].forEach((btn) => {
      btn?.classList.remove("active");
    });

    if (this.currentDirection === 0) {
      uptownBtn?.classList.add("active");
    } else if (this.currentDirection === 1) {
      downtownBtn?.classList.add("active");
    } else {
      bothBtn?.classList.add("active");
    }
  }

  private async refresh(): Promise<void> {
    // Get predictions
    this.predictions = this.provider.getPredictions(
      this.currentStation,
      this.currentDirection,
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

    // Render to source canvas (2D context)
    await this.renderer.render(displayPredictions);

    // Apply WebGL LED shader effect to display canvas
    this.webglRenderer.render(this.sourceCanvas);

    // Update info display
    this.updateInfo();
  }

  private updateInfo(): void {
    const station = this.provider.getStation(this.currentStation);
    if (!station) return;

    const infoDiv = document.getElementById("station-info");
    if (!infoDiv) return;

    const directionLabel = this.getDirectionLabel(station);
    const trainCount = this.predictions.length;

    infoDiv.innerHTML = `
      <strong>${station.stop_name}</strong> - ${station.routes.join(", ")}<br>
      Direction: ${directionLabel} | Upcoming trains: ${trainCount}
    `;
  }

  private getDirectionLabel(station: Station): string {
    if (this.currentDirection === 0) {
      return station.north_direction_label || "Uptown";
    } else if (this.currentDirection === 1) {
      return station.south_direction_label || "Downtown";
    } else {
      return "Both";
    }
  }

  private updateStatus(status: string): void {
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
      statusDiv.textContent = status;
    }
  }

  private startAutoRefresh(): void {
    // Refresh predictions every 5 seconds
    window.setInterval(async () => {
      await this.refresh();
    }, REFRESH_INTERVAL);
  }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  const app = new MTASimulator();
  try {
    await app.initialize();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
      statusDiv.textContent = `Error: ${error}`;
      statusDiv.style.color = "red";
    }
  }
});
