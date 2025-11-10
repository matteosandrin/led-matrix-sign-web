/**
 * Blink animation for arriving trains (20-30 seconds)
 * Matches MTABlinkAnimation from Python implementation
 */

import { MTA_RED_AMBER } from "../utils/constants";

export class BlinkAnimation {
  private isRunning: boolean = false;
  private startTime: number = 0;
  private animationId: number | null = null;
  private duration = 15000; // 15 seconds
  private fps = 6;
  private textTimeFraction = 2 / 3; // Show text 2/3 of the time

  private ctx: CanvasRenderingContext2D;
  private text: string;
  private x: number;
  private y: number;
  private width: number;
  private height: number;
  private font: string;
  private onComplete: () => void;
  private onFrame?: () => void;

  constructor(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    font: string,
    onComplete: () => void,
    onFrame?: () => void,
  ) {
    this.ctx = ctx;
    this.text = text;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.font = font;
    this.onComplete = onComplete;
    this.onFrame = onFrame;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = Date.now();
    this.animate();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private animate = (): void => {
    if (!this.isRunning) return;

    const elapsed = Date.now() - this.startTime;

    // Check if animation is complete
    if (elapsed >= this.duration) {
      // Draw final text frame and stop
      this.drawText();
      this.isRunning = false;

      // Trigger frame update before completing
      if (this.onFrame) {
        this.onFrame();
      }

      this.onComplete();
      return;
    }

    // Calculate current frame within the second
    const frameRate = 1000 / this.fps; // ms per frame
    const currentFrame = Math.floor((elapsed % 1000) / frameRate);
    const textFrameCount = Math.floor(this.textTimeFraction * this.fps);

    // Show text for first 2/3 of frames, blank for last 1/3
    if (currentFrame < textFrameCount) {
      this.drawText();
    } else {
      this.drawBlank();
    }

    // Trigger frame update callback (for WebGL rendering)
    if (this.onFrame) {
      this.onFrame();
    }

    // Schedule next frame
    this.animationId = requestAnimationFrame(this.animate);
  };

  private drawText(): void {
    this.ctx.font = this.font;
    this.ctx.fillStyle = MTA_RED_AMBER;
    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "bottom";
    this.ctx.fillText(this.text, this.x + this.width, this.y + this.height - 1);
  }

  private drawBlank(): void {
    // Clear the area where the text would be
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(this.x, this.y, this.width, this.height);
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
