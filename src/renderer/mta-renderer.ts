/**
 * MTA content renderer - displays train predictions on LED matrix
 */

import type { TrainTime } from '../data/types';
import { CanvasRenderer } from './canvas-renderer';
import { TextRenderer } from './text-renderer';
import { ImageRenderer } from './image-renderer';
import { BlinkAnimation } from './blink-animation';
import {
  MTA_GREEN,
  MTA_RED_AMBER,
  DISPLAY_WIDTH,
  ROW_Y_POSITIONS,
  ICON_SIZE,
  FONT_SIZE,
  FONT_FAMILY,
} from '../utils/constants';

export class MTARenderer {
  private canvasRenderer: CanvasRenderer;
  private textRenderer: TextRenderer;
  private imageRenderer: ImageRenderer;
  private blinkAnimation: BlinkAnimation | null = null;
  private onAnimationFrame?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvasRenderer = new CanvasRenderer(canvas);
    this.textRenderer = new TextRenderer(this.canvasRenderer.getContext());
    this.imageRenderer = new ImageRenderer();
  }

  /**
   * Set callback to be called on each animation frame (for WebGL rendering)
   */
  setAnimationFrameCallback(callback: () => void): void {
    this.onAnimationFrame = callback;
  }

  /**
   * Initialize renderer (load fonts and icons)
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.textRenderer.waitForFont(),
      this.imageRenderer.preloadIcons(),
    ]);
  }

  /**
   * Render MTA arrival content
   */
  async render(predictions: TrainTime[]): Promise<void> {
    const ctx = this.canvasRenderer.getContext();

    // Check if we should start blink animation
    const shouldBlink = predictions.length > 0 &&
                        predictions[0].time > 20 &&
                        predictions[0].time <= 30;

    this.canvasRenderer.clear();

    // Render up to 2 predictions
    const displayCount = Math.min(predictions.length, 2);

    for (let i = 0; i < displayCount; i++) {
      await this.renderTrainRow(predictions[i], i, ctx);
    }

    // Sync canvas state
    this.canvasRenderer.sync();

    // Start blink animation if needed
    if (shouldBlink && !this.blinkAnimation?.isActive()) {
      this.startBlinkAnimation(ctx);
    }
  }

  /**
   * Render a single train row
   */
  private async renderTrainRow(
    train: TrainTime,
    rowIndex: number,
    ctx: CanvasRenderingContext2D
  ): Promise<void> {
    const y = ROW_Y_POSITIONS[rowIndex];
    let xCursor = 0;

    // Calculate minutes from seconds
    const minutes = Math.round(train.time / 60);

    // Determine color (red/amber if train is arriving in ≤30 seconds AND it's the first train)
    const isArriving = train.time <= 30 && rowIndex === 0;
    const textColor = isArriving ? MTA_RED_AMBER : MTA_GREEN;

    // 1. Draw train number (e.g., "1.", "2.")
    const trainNumber = `${train.display_order + 1}.`;
    const numberWidth = this.textRenderer.drawText(
      trainNumber,
      xCursor,
      y,
      textColor
    );
    xCursor += numberWidth;

    // 2. Draw route icon (16x16)
    await this.imageRenderer.drawIcon(
      ctx,
      train.route_id,
      xCursor,
      y - 5,
      train.is_express
    );
    xCursor += ICON_SIZE + 1; // Icon width + 1px spacing

    // 3. Calculate space for minutes text (right-aligned)
    const minutesText = `${minutes}min`;
    const minutesWidth = this.textRenderer.measureText(minutesText);

    // 4. Calculate available width for destination
    const availableWidth = DISPLAY_WIDTH - xCursor - minutesWidth - 1; // -1 for padding

    // 5. Truncate destination text to fit
    const truncatedDestination = this.textRenderer.truncateTextSmart(
      train.long_name,
      availableWidth
    );

    // 6. Draw destination text
    this.textRenderer.drawText(
      truncatedDestination,
      xCursor,
      y,
      textColor
    );

    // 7. Draw minutes (right-aligned)
    this.textRenderer.drawText(
      minutesText,
      DISPLAY_WIDTH - 1,
      y,
      textColor,
      { align: 'right' }
    );
  }

  /**
   * Start blink animation for arriving train
   */
  private startBlinkAnimation(ctx: CanvasRenderingContext2D): void {
    const text = '0min';
    const font = `${FONT_SIZE}px ${FONT_FAMILY}, monospace`;
    const textWidth = this.textRenderer.measureText(text);
    const x = DISPLAY_WIDTH - textWidth - 1;
    const y = ROW_Y_POSITIONS[0];
    const height = 16;

    this.blinkAnimation = new BlinkAnimation(
      ctx,
      text,
      x,
      y,
      textWidth,
      height,
      font,
      () => {
        // Animation complete callback
        this.blinkAnimation = null;
      },
      () => {
        // Frame callback - trigger WebGL render
        if (this.onAnimationFrame) {
          this.onAnimationFrame();
        }
      }
    );

    this.blinkAnimation.start();
  }

  /**
   * Clear the display
   */
  clear(): void {
    this.canvasRenderer.clear();
    if (this.blinkAnimation?.isActive()) {
      this.blinkAnimation.stop();
      this.blinkAnimation = null;
    }
  }
}
