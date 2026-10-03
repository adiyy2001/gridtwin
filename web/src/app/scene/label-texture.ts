import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

import type { LabelFactory, LabelTexture } from './scene-builders';
import type { LabelTone } from './scene-state';

const WIDTH = 448;
const LINE_HEIGHT = 50;
const PADDING = 14;
const BORDER_WIDTH = 8;

const TONE_COLOURS: Record<LabelTone, string> = {
  energized: '#4aa3ff',
  deenergized: '#9aa1ab',
  earthed: '#c39cf0',
  alarm: '#ff6a5a',
};

function roundedRectangle(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(radius, 0);
  context.arcTo(width, 0, width, height, radius);
  context.arcTo(width, height, 0, height, radius);
  context.arcTo(0, height, 0, 0, radius);
  context.arcTo(0, 0, width, 0, radius);
  context.closePath();
}

export function createCanvasLabelFactory(): LabelFactory {
  return {
    create(lines: readonly string[], tone: LabelTone): LabelTexture {
      const canvas = document.createElement('canvas');
      const height = lines.length * LINE_HEIGHT + PADDING * 2;
      canvas.width = WIDTH;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (context !== null) {
        context.fillStyle = 'rgba(16, 24, 36, 0.9)';
        roundedRectangle(context, WIDTH, height, 18);
        context.fill();
        context.fillStyle = TONE_COLOURS[tone];
        context.fillRect(0, 10, BORDER_WIDTH, height - 20);
        context.textBaseline = 'middle';
        lines.forEach((line, index) => {
          context.font = `${index === 0 ? '700' : '500'} 34px system-ui, sans-serif`;
          context.fillStyle = index === 0 ? '#ffffff' : '#dfe6ef';
          context.fillText(
            line,
            BORDER_WIDTH + 18,
            PADDING + index * LINE_HEIGHT + LINE_HEIGHT / 2,
            WIDTH - 40,
          );
        });
      }
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = 4;
      return { texture, aspect: WIDTH / height };
    },
  };
}
