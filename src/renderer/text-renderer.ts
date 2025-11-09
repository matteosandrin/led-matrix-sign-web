/**
 * Text rendering with MTASans font and smart truncation
 */

import { FONT_SIZE, FONT_FAMILY, ABBREVIATIONS } from '../utils/constants';

export class TextRenderer {
  private ctx: CanvasRenderingContext2D;
  private fontLoaded: boolean = false;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /**
   * Wait for font to load
   */
  async waitForFont(): Promise<void> {
    if (this.fontLoaded) return;

    try {
      await document.fonts.load(`${FONT_SIZE}px ${FONT_FAMILY}`);
      this.fontLoaded = true;
    } catch (error) {
      console.warn('Font loading failed, using fallback', error);
      this.fontLoaded = true; // Continue anyway
    }
  }

  /**
   * Draw text at specified position
   */
  drawText(
    text: string,
    x: number,
    y: number,
    color: string,
    options: {
      align?: 'left' | 'right';
      baseline?: 'top' | 'middle' | 'bottom';
    } = {}
  ): number {
    const { align = 'left', baseline = 'top' } = options;

    this.ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}, monospace`;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;

    this.ctx.fillText(text, x, y);

    return this.measureText(text);
  }

  /**
   * Measure text width
   */
  measureText(text: string): number {
    this.ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}, monospace`;
    return this.ctx.measureText(text).width;
  }

  /**
   * Smart text truncation to fit available width
   * Based on Python truncate_text_smart function
   */
  truncateTextSmart(text: string, availableWidth: number): string {
    // If it fits, return as-is
    if (this.measureText(text) <= availableWidth) {
      return text;
    }

    // Step 1: Remove hyphenated suffixes
    if (text.includes('-')) {
      const parts = text.split('-');
      const withoutSuffix = parts[0];
      if (this.measureText(withoutSuffix) <= availableWidth) {
        return withoutSuffix;
      }
    }

    // Step 2: Apply abbreviations
    let abbreviated = text;
    for (const [full, abbr] of Object.entries(ABBREVIATIONS)) {
      abbreviated = abbreviated.replace(full, abbr);
    }
    if (this.measureText(abbreviated) <= availableWidth) {
      return abbreviated;
    }

    // Step 3: Remove words from the end
    const words = abbreviated.split(' ');
    for (let i = words.length - 1; i > 0; i--) {
      const truncated = words.slice(0, i).join(' ');
      if (this.measureText(truncated) <= availableWidth) {
        return truncated;
      }
    }

    // Step 4: Character-by-character truncation
    for (let i = abbreviated.length - 1; i > 0; i--) {
      const truncated = abbreviated.substring(0, i);
      if (this.measureText(truncated) <= availableWidth) {
        return truncated;
      }
    }

    return '';
  }

  /**
   * Get text dimensions
   */
  getTextDimensions(text: string): { width: number; height: number } {
    this.ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}, monospace`;
    const metrics = this.ctx.measureText(text);
    return {
      width: metrics.width,
      // Use actualBoundingBox if available, otherwise use font size
      height: metrics.actualBoundingBoxAscent !== undefined
        ? metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
        : FONT_SIZE,
    };
  }
}
