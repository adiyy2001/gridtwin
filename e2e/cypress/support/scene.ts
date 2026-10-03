export interface SceneItem {
  id: string;
  kind: string;
  position: string | null;
  condition: string;
  selected: boolean;
  hovered: boolean;
}

export interface SceneDescription {
  webgl: boolean;
  animating: boolean;
  items: SceneItem[];
}

export interface ScenePoint {
  clientX: number;
  clientY: number;
}

interface SceneApi {
  describe(): SceneDescription;
  screenPointOf(id: string): ScenePoint | null;
}

declare global {
  interface Window {
    __gridtwin?: { scene?: SceneApi };
  }
}

export function sceneApi(win: Window): SceneApi {
  const api = win.__gridtwin?.scene;
  if (api === undefined) {
    throw new Error('the 3D scene is not exposed yet');
  }
  return api;
}
