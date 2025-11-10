/**
 * Image rendering for route icons with color application
 */

import { ICON_SIZE, ROUTE_COLORS } from "../utils/constants";

export class ImageRenderer {
  private iconCache: Map<string, HTMLImageElement> = new Map();
  private coloredIconCache: Map<string, HTMLCanvasElement> = new Map();

  /**
   * Load a route icon
   */
  async loadIcon(
    routeId: string,
    isExpress: boolean = false,
  ): Promise<HTMLImageElement> {
    const filename = this.getIconFilename(routeId, isExpress);
    const cacheKey = filename;

    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.iconCache.set(cacheKey, img);
        resolve(img);
      };
      img.onerror = () => {
        reject(new Error(`Failed to load icon: ${filename}`));
      };
      img.src = `/img/${filename}`;
    });
  }

  /**
   * Get icon with color applied
   */
  async getColoredIcon(
    routeId: string,
    isExpress: boolean = false,
  ): Promise<HTMLCanvasElement> {
    const color = ROUTE_COLORS[routeId] || "#FFFFFF";
    const cacheKey = `${routeId}_${isExpress}_${color}`;

    if (this.coloredIconCache.has(cacheKey)) {
      return this.coloredIconCache.get(cacheKey)!;
    }

    // Load the base icon
    const img = await this.loadIcon(routeId, isExpress);

    // Create a canvas to apply color
    const canvas = document.createElement("canvas");
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Could not get 2D context for icon coloring");
    }

    // Draw the original image
    ctx.drawImage(img, 0, 0, ICON_SIZE, ICON_SIZE);

    // Get image data
    const imageData = ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
    const data = imageData.data;

    // Parse target color
    const targetColor = this.hexToRgb(color);

    // Apply color to each pixel
    // Algorithm: (pixel_value / 255) * target_color per RGB channel
    for (let i = 0; i < data.length; i += 4) {
      const grayscale = data[i]; // Assuming grayscale image (R = G = B)
      const factor = grayscale / 255;

      data[i] = Math.round(factor * targetColor.r); // R
      data[i + 1] = Math.round(factor * targetColor.g); // G
      data[i + 2] = Math.round(factor * targetColor.b); // B
      // Alpha (data[i + 3]) remains unchanged
    }

    // Put the colored image data back
    ctx.putImageData(imageData, 0, 0);

    // Cache and return
    this.coloredIconCache.set(cacheKey, canvas);
    return canvas;
  }

  /**
   * Draw a colored route icon on the target canvas
   */
  async drawIcon(
    targetCtx: CanvasRenderingContext2D,
    routeId: string,
    x: number,
    y: number,
    isExpress: boolean = false,
  ): Promise<void> {
    const coloredIcon = await this.getColoredIcon(routeId, isExpress);
    targetCtx.drawImage(coloredIcon, x, y, ICON_SIZE, ICON_SIZE);
  }

  /**
   * Get the filename for a route icon
   */
  private getIconFilename(routeId: string, isExpress: boolean): string {
    if (isExpress && (routeId === "4" || routeId === "6")) {
      return `mta_${routeId}_express.png`;
    }
    return `mta_${routeId}.png`;
  }

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  /**
   * Preload all route icons
   */
  async preloadIcons(): Promise<void> {
    const routes = Object.keys(ROUTE_COLORS);
    const loadPromises: Promise<any>[] = [];

    for (const route of routes) {
      loadPromises.push(this.loadIcon(route, false));

      // Load express versions for routes 4 and 6
      if (route === "4" || route === "6") {
        loadPromises.push(this.loadIcon(route, true));
      }
    }

    await Promise.all(loadPromises);
  }
}
