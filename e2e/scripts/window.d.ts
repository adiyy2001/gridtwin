interface GridtwinSceneItem {
  id: string;
  kind: string;
  position: string | null;
  condition: string;
  selected: boolean;
  hovered: boolean;
}

interface GridtwinScreenPoint {
  x: number;
  y: number;
  clientX: number;
  clientY: number;
}

interface GridtwinFrameStats {
  width: number;
  height: number;
  nonBackgroundRatio: number;
  hash: string;
  renderer: string;
}

interface GridtwinFrameMeasurement {
  width: number;
  height: number;
  frames: number;
  durationMs: number;
  averageFps: number;
  medianFrameMs: number;
  p95FrameMs: number;
  renderer: string;
}

interface GridtwinFrameMeasureOptions {
  width?: number;
  height?: number;
  durationMs?: number;
}

interface GridtwinScene {
  describe(): { webgl: boolean; animating: boolean; items: GridtwinSceneItem[] };
  screenPointOf(id: string): GridtwinScreenPoint | null;
  focusOn(id: string): boolean;
  frameStats(): GridtwinFrameStats | null;
  measureFrames(options?: GridtwinFrameMeasureOptions): Promise<GridtwinFrameMeasurement>;
}

interface GridtwinHook {
  latencies: number[];
  scene?: GridtwinScene;
}

interface Window {
  __gridtwin?: GridtwinHook;
}
