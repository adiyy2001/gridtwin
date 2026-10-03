import { InstancedMesh, Matrix4, Mesh, Quaternion, Sprite, Vector3 } from 'three';
import type { Material, Object3D } from 'three';

import { branchState, busState } from '../testing/fixtures';
import { StubLabels } from '../testing/scene-fakes';
import { allSwitchPositions, fullSubstation } from '../testing/substation-fixture';
import { branchSelection, switchSelection } from '../model/selection';
import type { NodeCondition, Position } from '../model/api-types';
import type { Selection } from '../model/selection';
import {
  BLADE_SWING_MS,
  BRACKET_NAME,
  EQUIPMENT_ID_KEY,
  LABEL_HIDDEN_WITHIN,
  LABEL_VISIBLE_BEYOND,
  buildSceneContents,
} from './scene-builders';
import type { SceneContents } from './scene-builders';
import { buildScenePlan } from './scene-plan';
import { buildSceneState } from './scene-state';
import type { SceneState } from './scene-state';

const substation = fullSubstation();
const plan = buildScenePlan(substation, new Set(['T4-7']));

function stateOf(
  positions: Record<string, Position> = {},
  selection: Selection | null = null,
  hover: Selection | null = null,
  nodes: Record<string, NodeCondition> = {},
): SceneState {
  const merged = allSwitchPositions(substation);
  Object.entries(positions).forEach(([id, position]) => {
    merged.set(id, position);
  });
  return buildSceneState({
    plan,
    substation,
    nodeStates: new Map(substation.nodes.map((node) => [node, nodes[node] ?? 'ENERGIZED'])),
    positions: merged,
    branches: new Map([
      ['L2-4', branchState({ id: 'L2-4', from: 2, to: 4, overloaded: true, loading: 1.1 })],
    ]),
    buses: new Map([
      [4, busState({ number: 4 })],
      [40, busState({ number: 40 })],
    ]),
    selection,
    hover,
    operable: true,
  });
}

function meshesOf(contents: SceneContents): InstancedMesh[] {
  const found: InstancedMesh[] = [];
  contents.root.traverse((object: Object3D) => {
    if (object instanceof InstancedMesh) {
      found.push(object as InstancedMesh);
    }
  });
  return found;
}

function bladeMesh(contents: SceneContents): InstancedMesh {
  const mesh = meshesOf(contents).find((candidate) => candidate.count === plan.switches.length);
  if (mesh === undefined) {
    throw new Error('no blade mesh');
  }
  return mesh;
}

function bladeDirection(contents: SceneContents, id: string): Vector3 {
  const index = plan.switches.findIndex((entry) => entry.id === id);
  const matrix = new Matrix4();
  bladeMesh(contents).getMatrixAt(index, matrix);
  const rotation = new Quaternion();
  matrix.decompose(new Vector3(), rotation, new Vector3());
  return new Vector3(0, 1, 0).applyQuaternion(rotation);
}

function build(labels = new StubLabels()): { contents: SceneContents; labels: StubLabels } {
  return { contents: buildSceneContents(plan, labels), labels };
}

describe('buildSceneContents', () => {
  it('reports instance counts that match the plan', () => {
    const { contents } = build();
    expect(contents.stats.bladeInstances).toBe(plan.switches.length);
    expect(contents.stats.boxInstances).toBe(plan.boxes.length);
    expect(contents.stats.conductorInstances).toBe(plan.conductors.length + plan.busbars.length);
    expect(contents.stats.cylinderInstances + contents.stats.porcelainInstances).toBe(
      plan.cylinders.length,
    );
    expect(contents.stats.proxies).toBe(plan.hits.length);
    expect(contents.stats.labels).toBe(plan.bays.length + plan.busbars.length);
  });

  it('draws repeated parts as instanced meshes, not as one mesh each', () => {
    const { contents } = build();
    const instanced = meshesOf(contents);
    expect(instanced).toHaveLength(5);
    const objects = new Set<Object3D>();
    contents.root.traverse((object) => objects.add(object));
    expect(objects.size).toBeLessThan(
      plan.boxes.length + plan.cylinders.length + plan.conductors.length,
    );
    instanced.forEach((mesh) => {
      expect(mesh.castShadow).toBe(true);
    });
  });

  it('gives every plan hit an invisible proxy that carries the equipment id', () => {
    const { contents } = build();
    const ids = contents.proxies.children.map(
      (child) => child.userData[EQUIPMENT_ID_KEY] as unknown,
    );
    expect(ids).toEqual(plan.hits.map((hit) => hit.id));
    contents.proxies.children.forEach((child) => {
      expect(child).toBeInstanceOf(Mesh);
      const material = child instanceof Mesh ? (child.material as Material | Material[]) : null;
      expect(material !== null && !Array.isArray(material) && material.visible).toBe(false);
    });
  });

  it('finds the centre of a proxy and nothing for an unknown id', () => {
    const { contents } = build();
    const hit = plan.hits.find((candidate) => candidate.id === 'CPL.QA1');
    const center = contents.centerOf('CPL.QA1');
    expect(center?.x).toBeCloseTo(hit?.center.x ?? 0);
    expect(center?.y).toBeCloseTo(hit?.center.y ?? 0);
    expect(contents.centerOf('nope')).toBeNull();
  });

  it('puts a closed blade along the bay and an open blade at an angle after the first apply', () => {
    const { contents } = build();
    contents.apply(stateOf({ 'L3-4.QA1': 'OPEN' }));
    expect(contents.bladeAngleOf('L3-4.QA1')).toBeGreaterThan(0.5);
    expect(contents.bladeAngleOf('L3-4.QB9')).toBe(0);
    const closed = bladeDirection(contents, 'L3-4.QB9');
    expect(closed.z).toBeCloseTo(1);
    const opened = bladeDirection(contents, 'L3-4.QA1');
    expect(opened.y).toBeGreaterThan(0.3);
    expect(opened.z).toBeLessThan(0.95);
    expect(contents.isAnimating()).toBe(false);
  });

  it('animates a later change in steps and settles on the target', () => {
    const { contents } = build();
    contents.apply(stateOf());
    contents.apply(stateOf({ 'L3-4.QA1': 'OPEN' }));
    expect(contents.isAnimating()).toBe(true);
    expect(contents.bladeAngleOf('L3-4.QA1')).toBe(0);
    expect(contents.advance(BLADE_SWING_MS / 10)).toBe(true);
    const partway = contents.bladeAngleOf('L3-4.QA1') ?? 0;
    expect(partway).toBeGreaterThan(0);
    expect(partway).toBeLessThan(0.3);
    expect(contents.advance(BLADE_SWING_MS)).toBe(false);
    expect(contents.bladeAngleOf('L3-4.QA1')).toBeGreaterThan(0.5);
    expect(contents.isAnimating()).toBe(false);
    expect(contents.advance(16)).toBe(false);
  });

  it('closes a blade again', () => {
    const { contents } = build();
    contents.apply(stateOf({ 'L3-4.QA1': 'OPEN' }));
    contents.apply(stateOf());
    contents.advance(BLADE_SWING_MS * 2);
    expect(contents.bladeAngleOf('L3-4.QA1')).toBe(0);
  });

  it('returns null for the blade of an unknown switch', () => {
    expect(build().contents.bladeAngleOf('nope')).toBeNull();
  });

  it('colours instances by condition', () => {
    const { contents } = build();
    contents.apply(stateOf({}, null, null, { 'L3-4.A': 'DEENERGIZED' }));
    const conductors = meshesOf(contents).find(
      (mesh) => mesh.count === plan.conductors.length + plan.busbars.length,
    );
    const colours = conductors?.instanceColor?.array ?? [];
    const dead = plan.conductors.findIndex((conductor) => conductor.node === 'L3-4.A');
    const live = plan.conductors.findIndex((conductor) => conductor.node === 'L4-5.A');
    expect(colours.slice(dead * 3, dead * 3 + 3)).not.toEqual(
      colours.slice(live * 3, live * 3 + 3),
    );
  });

  it('shows a bracket only around selected and hovered equipment', () => {
    const { contents } = build();
    const brackets = (): number => {
      let visible = 0;
      contents.root.traverse((object) => {
        if (object.name === BRACKET_NAME && object.visible) {
          visible += 1;
        }
      });
      return visible;
    };
    contents.apply(stateOf());
    expect(brackets()).toBe(0);
    contents.apply(stateOf({}, switchSelection('L3-4.QA1')));
    expect(brackets()).toBe(1);
    contents.apply(stateOf({}, switchSelection('L3-4.QA1'), branchSelection('L2-4')));
    expect(brackets()).toBe(2);
    contents.apply(stateOf());
    expect(brackets()).toBe(0);
  });

  it('draws a label texture per label and redraws only when the text changes', () => {
    const { contents, labels } = build();
    contents.apply(stateOf());
    expect(labels.requests).toHaveLength(plan.bays.length + plan.busbars.length);
    contents.apply(stateOf());
    expect(labels.requests).toHaveLength(plan.bays.length + plan.busbars.length);
    contents.apply(stateOf({ 'CPL.QA1': 'OPEN' }));
    expect(labels.requests).toHaveLength(plan.bays.length + plan.busbars.length + 1);
  });

  it('fades labels out when the camera comes close', () => {
    const { contents } = build();
    contents.apply(stateOf());
    const sprites: Sprite[] = [];
    contents.root.traverse((object) => {
      if (object instanceof Sprite) {
        sprites.push(object as Sprite);
      }
    });
    expect(sprites).toHaveLength(plan.bays.length + plan.busbars.length);
    const sprite = sprites[0];
    if (sprite === undefined) {
      throw new Error('no label');
    }
    const far = sprite.position.clone().add(new Vector3(0, 0, LABEL_VISIBLE_BEYOND + 5));
    contents.fadeLabels(far);
    expect(sprite.material.opacity).toBe(1);
    expect(sprite.visible).toBe(true);
    const near = sprite.position.clone().add(new Vector3(0, 0, LABEL_HIDDEN_WITHIN - 2));
    contents.fadeLabels(near);
    expect(sprite.visible).toBe(false);
    const between = sprite.position
      .clone()
      .add(new Vector3(0, 0, (LABEL_HIDDEN_WITHIN + LABEL_VISIBLE_BEYOND) / 2));
    contents.fadeLabels(between);
    expect(sprite.material.opacity).toBeGreaterThan(0);
    expect(sprite.material.opacity).toBeLessThan(1);
  });

  it('disposes without throwing', () => {
    const { contents } = build();
    contents.apply(stateOf());
    expect(() => {
      contents.dispose();
    }).not.toThrow();
  });
});
