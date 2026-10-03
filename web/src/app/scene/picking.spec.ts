import { Group, Mesh, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';

import { StubLabels } from '../testing/scene-fakes';
import { fullSubstation } from '../testing/substation-fixture';
import {
  CLICK_MOVE_LIMIT_PX,
  CLICK_TIME_LIMIT_MS,
  ClickGesture,
  equipmentIdOf,
  firstEquipmentHit,
  toCanvasPoint,
  toNormalizedPoint,
} from './picking';
import { EQUIPMENT_ID_KEY, buildSceneContents } from './scene-builders';
import { buildScenePlan } from './scene-plan';

const rect = { left: 10, top: 20, width: 800, height: 400 };

describe('pointer maths', () => {
  it('maps the corners and the centre of the canvas to normalized device coordinates', () => {
    expect(toNormalizedPoint(10, 20, rect)).toEqual({ x: -1, y: 1 });
    expect(toNormalizedPoint(810, 420, rect)).toEqual({ x: 1, y: -1 });
    expect(toNormalizedPoint(410, 220, rect)).toEqual({ x: 0, y: -0 });
  });

  it('refuses a canvas without size', () => {
    expect(toNormalizedPoint(5, 5, { left: 0, top: 0, width: 0, height: 10 })).toBeNull();
    expect(toNormalizedPoint(5, 5, { left: 0, top: 0, width: 10, height: 0 })).toBeNull();
  });

  it('maps a normalized point back to canvas pixels', () => {
    expect(toCanvasPoint({ x: -1, y: 1 }, rect)).toEqual({ x: 0, y: 0 });
    expect(toCanvasPoint({ x: 1, y: -1 }, rect)).toEqual({ x: 800, y: 400 });
    const point = toNormalizedPoint(300, 120, rect);
    expect(point).not.toBeNull();
    if (point !== null) {
      const back = toCanvasPoint(point, rect);
      expect(back.x).toBeCloseTo(290);
      expect(back.y).toBeCloseTo(100);
    }
  });
});

describe('equipment lookup', () => {
  it('walks up to the parent that carries the id', () => {
    const parent = new Group();
    parent.userData[EQUIPMENT_ID_KEY] = 'L3-4.QA1';
    const child = new Group();
    parent.add(child);
    expect(equipmentIdOf(child)).toBe('L3-4.QA1');
    expect(equipmentIdOf(new Group())).toBeNull();
    expect(equipmentIdOf(null)).toBeNull();
  });

  it('ignores ids that are not strings', () => {
    const object = new Group();
    object.userData[EQUIPMENT_ID_KEY] = 7;
    expect(equipmentIdOf(object)).toBeNull();
  });

  it('takes the nearest hit that has an id', () => {
    const named = new Mesh();
    named.userData[EQUIPMENT_ID_KEY] = 'near';
    const other = new Mesh();
    other.userData[EQUIPMENT_ID_KEY] = 'far';
    const anonymous = new Mesh();
    const hits = [
      { distance: 9, object: other, point: new Vector3() },
      { distance: 4, object: anonymous, point: new Vector3() },
      { distance: 6, object: named, point: new Vector3() },
    ];
    expect(firstEquipmentHit(hits)).toBe('near');
    expect(firstEquipmentHit([])).toBeNull();
    expect(
      firstEquipmentHit([{ distance: 1, object: anonymous, point: new Vector3() }]),
    ).toBeNull();
  });
});

describe('picking in the substation scene', () => {
  const plan = buildScenePlan(fullSubstation());
  const contents = buildSceneContents(plan, new StubLabels());

  function pickFrom(position: Vector3, target: Vector3): string | null {
    const camera = new PerspectiveCamera(40, 16 / 9, 1, 600);
    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(0, 0), camera);
    return firstEquipmentHit(raycaster.intersectObjects(contents.proxies.children, false));
  }

  it('hits the breaker proxy when aiming at the breaker', () => {
    const center = contents.centerOf('CPL.QA1');
    expect(center).not.toBeNull();
    if (center !== null) {
      expect(pickFrom(center.clone().add(new Vector3(14, 0.5, 0)), center)).toBe('CPL.QA1');
    }
  });

  it('hits a busbar proxy when aiming at the middle of the busbar', () => {
    const center = contents.centerOf('busbar:BB1');
    expect(center).not.toBeNull();
    if (center !== null) {
      expect(pickFrom(center.clone().add(new Vector3(0, 12, -14)), center)).toBe('busbar:BB1');
    }
  });

  it('finds nothing in the sky', () => {
    expect(pickFrom(new Vector3(0, 40, 80), new Vector3(0, 200, -200))).toBeNull();
  });
});

describe('ClickGesture', () => {
  it('accepts a short press that did not move', () => {
    const gesture = new ClickGesture();
    gesture.begin(100, 100, 0);
    gesture.move(102, 101);
    expect(gesture.finish(120)).toBe(true);
  });

  it('rejects a drag', () => {
    const gesture = new ClickGesture();
    gesture.begin(100, 100, 0);
    gesture.move(100 + CLICK_MOVE_LIMIT_PX + 1, 100);
    expect(gesture.finish(50)).toBe(false);
  });

  it('rejects a long press', () => {
    const gesture = new ClickGesture();
    gesture.begin(0, 0, 0);
    expect(gesture.finish(CLICK_TIME_LIMIT_MS + 1)).toBe(false);
  });

  it('rejects a release without a press and a cancelled press', () => {
    const gesture = new ClickGesture();
    expect(gesture.finish(10)).toBe(false);
    gesture.begin(0, 0, 0);
    gesture.cancel();
    expect(gesture.finish(10)).toBe(false);
  });

  it('forgets the previous press', () => {
    const gesture = new ClickGesture();
    gesture.begin(0, 0, 0);
    gesture.move(50, 50);
    gesture.finish(10);
    gesture.begin(0, 0, 100);
    expect(gesture.finish(120)).toBe(true);
  });
});
