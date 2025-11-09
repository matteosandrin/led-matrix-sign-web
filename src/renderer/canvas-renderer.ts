/**
 * Canvas renderer for 160x32 LED matrix display
 */

import { DISPLAY_WIDTH, DISPLAY_HEIGHT, SCALE_FACTOR, BLACK } from '../utils/constants';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    this.ctx = ctx;

    // Set canvas size (actual pixels)
    this.canvas.width = DISPLAY_WIDTH;
    this.canvas.height = DISPLAY_HEIGHT;

    // Set display size (scaled for viewing)
    this.canvas.style.width = `${DISPLAY_WIDTH * SCALE_FACTOR}px`;
    this.canvas.style.height = `${DISPLAY_HEIGHT * SCALE_FACTOR}px`;

    // Disable image smoothing for pixel-perfect rendering
    this.ctx.imageSmoothingEnabled = false;

    // Initialize image data
    this.imageData = this.ctx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    this.clear();
  }

  /**
   * Clear the display to black
   */
  clear(): void {
    this.ctx.fillStyle = BLACK;
    this.ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
    this.imageData = this.ctx.getImageData(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
  }

  /**
   * Get the canvas context
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Set a pixel at (x, y) to the specified color
   */
  setPixel(x: number, y: number, color: string): void {
    if (x < 0 || x >= DISPLAY_WIDTH || y < 0 || y >= DISPLAY_HEIGHT) {
      return;
    }

    const rgb = this.hexToRgb(color);
    const index = (y * DISPLAY_WIDTH + x) * 4;
    this.imageData.data[index] = rgb.r;
    this.imageData.data[index + 1] = rgb.g;
    this.imageData.data[index + 2] = rgb.b;
    this.imageData.data[index + 3] = 255;
  }

  /**
   * Update the display with current image data
   */
  update(): void {
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * Sync image data from canvas (call after drawing operations)
   */
  sync(): void {
    this.imageData = this.ctx.getImageData(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
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
   * Parse RGB color string to components
   */
  parseRgb(color: string): { r: number; g: number; b: number } {
    if (color.startsWith('#')) {
      return this.hexToRgb(color);
    }
    // Handle rgb(r, g, b) format
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
      };
    }
    return { r: 0, g: 0, b: 0 };
  }
}
