import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import type { Material, Object3D, Texture } from 'three';

import type { BoxPart, CylinderPart, PartRole, ScenePlan, SwitchPlan, Vec3 } from './scene-plan';
import { planCenter } from './scene-plan';
import { bladeAngle, conductorColour, mixColours } from './scene-state';
import type { LabelState, LabelTone, SceneState } from './scene-state';

export interface LabelTexture {
  readonly texture: Texture;
  readonly aspect: number;
}

export interface LabelFactory {
  create(lines: readonly string[], tone: LabelTone): LabelTexture;
}

export interface SceneStats {
  readonly boxInstances: number;
  readonly cylinderInstances: number;
  readonly porcelainInstances: number;
  readonly bladeInstances: number;
  readonly conductorInstances: number;
  readonly proxies: number;
  readonly labels: number;
}

export interface SceneContents {
  readonly root: Group;
  readonly proxies: Group;
  readonly stats: SceneStats;
  apply(state: SceneState): void;
  advance(deltaMs: number): boolean;
  fadeLabels(viewer: Vector3): void;
  isAnimating(): boolean;
  bladeAngleOf(id: string): number | null;
  centerOf(id: string): Vector3 | null;
  dispose(): void;
}

export const EQUIPMENT_ID_KEY = 'equipmentId';
export const BLADE_SWING_MS = 320;
export const BRACKET_NAME = 'bracket';
export const LABEL_HIDDEN_WITHIN = 22;
export const LABEL_VISIBLE_BEYOND = 34;

const ROLE_COLOURS: Record<Exclude<PartRole, 'porcelain'>, number> = {
  steel: 0x8a929c,
  concrete: 0x9a978f,
  housing: 0x56707f,
  transformer: 0x58727a,
  radiator: 0x7f8f98,
  load: 0xb69b69,
  generator: 0xa4573f,
  tower: 0x707882,
};

const GRID_STEP = 4;
const GRID_COLOUR = 0x737770;
const STEEL_TINT = 0xdfe5ec;
const GROUND_COLOUR = 0x8b8d84;
const BRACKET_SELECTED = 0xffbf3f;
const BRACKET_HOVERED = 0xffffff;
const UNIT_Y = new Vector3(0, 1, 0);

function toVector(point: Vec3): Vector3 {
  return new Vector3(point.x, point.y, point.z);
}

function segmentMatrix(from: Vec3, to: Vec3, radius: number): Matrix4 {
  const start = toVector(from);
  const direction = toVector(to).sub(start);
  const length = direction.length();
  const matrix = new Matrix4();
  if (length === 0) {
    return matrix.makeScale(radius, 0.0001, radius);
  }
  const quaternion = new Quaternion().setFromUnitVectors(UNIT_Y, direction.clone().normalize());
  return matrix.compose(
    start.add(toVector(to)).multiplyScalar(0.5),
    quaternion,
    new Vector3(radius, length, radius),
  );
}

function boxMatrix(part: BoxPart): Matrix4 {
  return new Matrix4().compose(
    toVector(part.center),
    new Quaternion(),
    new Vector3(part.size.x, part.size.y, part.size.z),
  );
}

function bladeMatrix(plan: SwitchPlan, angle: number): Matrix4 {
  const hinge = toVector(plan.hinge);
  const toContact = toVector(plan.contact).sub(hinge);
  const length = toContact.length();
  const direction = toContact.clone().normalize();
  const swing = toVector(plan.swing);
  swing.sub(direction.clone().multiplyScalar(swing.dot(direction))).normalize();
  const opened = direction
    .clone()
    .multiplyScalar(Math.cos(angle))
    .add(swing.multiplyScalar(Math.sin(angle)))
    .normalize();
  const quaternion = new Quaternion().setFromUnitVectors(UNIT_Y, opened);
  return new Matrix4().compose(
    hinge,
    quaternion,
    new Vector3(plan.thickness, length, plan.thickness),
  );
}

function gridGeometry(width: number, depth: number, step: number): BufferGeometry {
  const positions: number[] = [];
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  for (let x = -halfWidth; x <= halfWidth; x += step) {
    positions.push(x, 0, -halfDepth, x, 0, halfDepth);
  }
  for (let z = -halfDepth; z <= halfDepth; z += step) {
    positions.push(-halfWidth, 0, z, halfWidth, 0, z);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
}

function enableShadows(mesh: Object3D): void {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

interface BladeSlot {
  readonly plan: SwitchPlan;
  readonly index: number;
  current: number;
  target: number;
}

class Disposables {
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: Texture[] = [];

  geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  material<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  texture(texture: Texture): Texture {
    this.textures.push(texture);
    return texture;
  }

  releaseTexture(texture: Texture): void {
    texture.dispose();
    const index = this.textures.indexOf(texture);
    if (index >= 0) {
      this.textures.splice(index, 1);
    }
  }

  disposeAll(): void {
    this.geometries.forEach((entry) => {
      entry.dispose();
    });
    this.materials.forEach((entry) => {
      entry.dispose();
    });
    this.textures.forEach((entry) => {
      entry.dispose();
    });
  }
}

interface LabelSlot {
  readonly sprite: Sprite;
  readonly width: number;
  key: string;
  texture: Texture | null;
}

export function buildSceneContents(plan: ScenePlan, labels: LabelFactory): SceneContents {
  const root = new Group();
  root.name = 'substation';
  const proxies = new Group();
  proxies.name = 'proxies';
  const disposables = new Disposables();
  const unitBox = disposables.geometry(new BoxGeometry(1, 1, 1));
  const unitCylinder = disposables.geometry(new CylinderGeometry(1, 1, 1, 18, 1));
  const bladeGeometry = disposables.geometry(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0));

  const partsMaterial = disposables.material(
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.45 }),
  );
  const porcelainMaterial = disposables.material(
    new MeshPhysicalMaterial({
      color: 0xc8b9a2,
      roughness: 0.3,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    }),
  );
  const conductorMaterial = disposables.material(
    new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.32,
      metalness: 0.75,
      emissive: 0x0a1626,
    }),
  );
  const bladeMaterial = disposables.material(
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.7 }),
  );

  const boxes = new InstancedMesh(unitBox, partsMaterial, Math.max(plan.boxes.length, 1));
  boxes.count = plan.boxes.length;
  plan.boxes.forEach((part, index) => {
    boxes.setMatrixAt(index, boxMatrix(part));
    boxes.setColorAt(
      index,
      new Color(ROLE_COLOURS[part.role === 'porcelain' ? 'steel' : part.role]),
    );
  });
  const solidCylinders = plan.cylinders.filter((part) => part.role !== 'porcelain');
  const porcelainCylinders = plan.cylinders.filter((part) => part.role === 'porcelain');
  const cylinders = new InstancedMesh(
    unitCylinder,
    partsMaterial,
    Math.max(solidCylinders.length, 1),
  );
  cylinders.count = solidCylinders.length;
  solidCylinders.forEach((part: CylinderPart, index) => {
    cylinders.setMatrixAt(index, segmentMatrix(part.from, part.to, part.radius));
    cylinders.setColorAt(
      index,
      new Color(ROLE_COLOURS[part.role === 'porcelain' ? 'steel' : part.role]),
    );
  });
  const porcelain = new InstancedMesh(
    unitCylinder,
    porcelainMaterial,
    Math.max(porcelainCylinders.length, 1),
  );
  porcelain.count = porcelainCylinders.length;
  porcelainCylinders.forEach((part, index) => {
    porcelain.setMatrixAt(index, segmentMatrix(part.from, part.to, part.radius));
  });

  const conductors = new InstancedMesh(
    unitCylinder,
    conductorMaterial,
    Math.max(plan.conductors.length + plan.busbars.length, 1),
  );
  conductors.count = plan.conductors.length + plan.busbars.length;
  plan.conductors.forEach((conductor, index) => {
    conductors.setMatrixAt(index, segmentMatrix(conductor.from, conductor.to, conductor.radius));
    conductors.setColorAt(index, new Color(0x808792));
  });
  const busbarIndexOffset = plan.conductors.length;
  plan.busbars.forEach((busbar, index) => {
    conductors.setMatrixAt(busbarIndexOffset + index, segmentMatrix(busbar.from, busbar.to, 0.24));
    conductors.setColorAt(busbarIndexOffset + index, new Color(0x808792));
  });

  const blades = new InstancedMesh(bladeGeometry, bladeMaterial, Math.max(plan.switches.length, 1));
  blades.count = plan.switches.length;
  const slots = new Map<string, BladeSlot>();
  plan.switches.forEach((entry, index) => {
    slots.set(entry.id, { plan: entry, index, current: 0, target: 0 });
    blades.setMatrixAt(index, bladeMatrix(entry, 0));
    blades.setColorAt(index, new Color(0x808792));
  });

  [boxes, cylinders, porcelain, conductors, blades].forEach((mesh) => {
    enableShadows(mesh);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor !== null) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.frustumCulled = false;
    root.add(mesh);
  });

  const ground = new Mesh(
    disposables.geometry(new PlaneGeometry(1, 1)),
    disposables.material(new MeshLambertMaterial({ color: GROUND_COLOUR })),
  );
  const center = planCenter(plan);
  const groundWidth = plan.bounds.max.x - plan.bounds.min.x + 56;
  const groundDepth = plan.bounds.max.z - plan.bounds.min.z + 40;
  ground.rotation.x = -Math.PI / 2;
  ground.scale.set(groundWidth, groundDepth, 1);
  ground.position.set(center.x, 0, center.z);
  ground.receiveShadow = true;
  root.add(ground);

  const grid = new LineSegments(
    disposables.geometry(gridGeometry(groundWidth, groundDepth, GRID_STEP)),
    disposables.material(
      new LineBasicMaterial({ color: GRID_COLOUR, transparent: true, opacity: 0.35 }),
    ),
  );
  grid.position.set(center.x, 0.02, center.z);
  root.add(grid);

  const proxyMaterial = disposables.material(new MeshBasicMaterial({ visible: false }));
  const proxyById = new Map<string, Mesh>();
  plan.hits.forEach((hit) => {
    const mesh = new Mesh(
      disposables.geometry(new BoxGeometry(hit.size.x, hit.size.y, hit.size.z)),
      proxyMaterial,
    );
    mesh.position.set(hit.center.x, hit.center.y, hit.center.z);
    mesh.userData[EQUIPMENT_ID_KEY] = hit.id;
    mesh.name = hit.id;
    proxies.add(mesh);
    proxyById.set(hit.id, mesh);
  });
  root.add(proxies);
  root.updateMatrixWorld(true);

  const bracketGeometry = disposables.geometry(new EdgesGeometry(new BoxGeometry(1, 1, 1)));
  const selectedBracketMaterial = disposables.material(
    new LineBasicMaterial({ color: BRACKET_SELECTED }),
  );
  const hoveredBracketMaterial = disposables.material(
    new LineBasicMaterial({ color: BRACKET_HOVERED }),
  );
  const glowMaterial = disposables.material(
    new MeshBasicMaterial({
      color: BRACKET_SELECTED,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  const brackets: { readonly frame: LineSegments; readonly glow: Mesh }[] = [];

  function bracketAt(
    index: number,
    hovered: boolean,
  ): { readonly frame: LineSegments; readonly glow: Mesh } {
    const existing = brackets[index];
    if (existing !== undefined) {
      existing.frame.material = hovered ? hoveredBracketMaterial : selectedBracketMaterial;
      return existing;
    }
    const frame = new LineSegments(
      bracketGeometry,
      hovered ? hoveredBracketMaterial : selectedBracketMaterial,
    );
    const glow = new Mesh(unitBox, glowMaterial);
    frame.name = BRACKET_NAME;
    glow.name = `${BRACKET_NAME}-glow`;
    root.add(frame);
    root.add(glow);
    const created = { frame, glow };
    brackets.push(created);
    return created;
  }

  function placeBrackets(state: SceneState): void {
    const marked = [...state.equipment.values()].filter((entry) => entry.selected || entry.hovered);
    marked.forEach((entry, index) => {
      const proxy = proxyById.get(entry.id);
      const bracket = bracketAt(index, !entry.selected);
      if (proxy === undefined) {
        bracket.frame.visible = false;
        bracket.glow.visible = false;
        return;
      }
      proxy.geometry.computeBoundingBox();
      const size = proxy.geometry.boundingBox;
      const width = size === null ? 1 : size.max.x - size.min.x;
      const height = size === null ? 1 : size.max.y - size.min.y;
      const depth = size === null ? 1 : size.max.z - size.min.z;
      bracket.frame.position.copy(proxy.position);
      bracket.frame.scale.set(width, height, depth);
      bracket.glow.position.copy(proxy.position);
      bracket.glow.scale.set(width, height, depth);
      bracket.frame.visible = true;
      bracket.glow.visible = entry.selected;
    });
    brackets.forEach((bracket, index) => {
      if (index >= marked.length) {
        bracket.frame.visible = false;
        bracket.glow.visible = false;
      }
    });
  }

  const labelSlots = new Map<string, LabelSlot>();
  function labelSlot(key: string, at: Vec3, width: number): LabelSlot {
    const existing = labelSlots.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const sprite = new Sprite(
      disposables.material(new SpriteMaterial({ transparent: true, depthWrite: false })),
    );
    sprite.center.set(0.5, 0);
    sprite.position.set(at.x, at.y, at.z);
    sprite.renderOrder = 10;
    root.add(sprite);
    const created: LabelSlot = { sprite, width, key: '', texture: null };
    labelSlots.set(key, created);
    return created;
  }

  function updateLabel(slot: LabelSlot, state: LabelState): void {
    const key = `${state.tone}|${state.lines.join('|')}`;
    if (slot.key === key) {
      return;
    }
    const made = labels.create(state.lines, state.tone);
    const previous = slot.texture;
    slot.texture = disposables.texture(made.texture);
    slot.key = key;
    const material = slot.sprite.material;
    material.map = made.texture;
    material.needsUpdate = true;
    slot.sprite.scale.set(slot.width, slot.width / made.aspect, 1);
    if (previous !== null) {
      disposables.releaseTexture(previous);
    }
  }

  let applied = false;
  let animating = false;

  function applyBlades(state: SceneState, snap: boolean): void {
    slots.forEach((slot, id) => {
      const equipment = state.equipment.get(id);
      if (equipment === undefined) {
        return;
      }
      slot.target = bladeAngle(equipment.position, slot.plan.openAngle);
      if (snap) {
        slot.current = slot.target;
        blades.setMatrixAt(slot.index, bladeMatrix(slot.plan, slot.current));
      }
      const colour = mixColours(
        conductorColour({
          condition: equipment.condition,
          overloaded: false,
          selected: equipment.selected,
          hovered: equipment.hovered,
        }),
        STEEL_TINT,
        equipment.selected || equipment.hovered ? 0 : 0.28,
      );
      blades.setColorAt(slot.index, new Color(colour));
    });
    blades.instanceMatrix.needsUpdate = true;
    if (blades.instanceColor !== null) {
      blades.instanceColor.needsUpdate = true;
    }
    animating = [...slots.values()].some((slot) => slot.current !== slot.target);
  }

  function applyConductors(state: SceneState): void {
    state.conductors.forEach((entry, index) => {
      conductors.setColorAt(index, new Color(conductorColour(entry)));
    });
    plan.busbars.forEach((busbar, index) => {
      const equipment = state.equipment.get(`busbar:${busbar.node}`);
      conductors.setColorAt(
        busbarIndexOffset + index,
        new Color(
          conductorColour({
            condition: equipment?.condition ?? 'DEENERGIZED',
            overloaded: false,
            selected: equipment?.selected ?? false,
            hovered: equipment?.hovered ?? false,
          }),
        ),
      );
    });
    if (conductors.instanceColor !== null) {
      conductors.instanceColor.needsUpdate = true;
    }
  }

  function applyLabels(state: SceneState): void {
    plan.bays.forEach((bay) => {
      const label = state.bayLabels.get(bay.id);
      if (label !== undefined) {
        updateLabel(labelSlot(`bay:${bay.id}`, bay.labelAt, 11.4), label);
      }
    });
    plan.busbars.forEach((busbar) => {
      const label = state.busbarLabels.get(busbar.node);
      if (label !== undefined) {
        updateLabel(
          labelSlot(
            `busbar:${busbar.node}`,
            { x: busbar.from.x + 6, y: busbar.from.y + 0.9, z: busbar.from.z },
            12,
          ),
          label,
        );
      }
    });
  }

  const stats: SceneStats = {
    boxInstances: plan.boxes.length,
    cylinderInstances: solidCylinders.length,
    porcelainInstances: porcelainCylinders.length,
    bladeInstances: plan.switches.length,
    conductorInstances: plan.conductors.length + plan.busbars.length,
    proxies: plan.hits.length,
    labels: plan.bays.length + plan.busbars.length,
  };

  return {
    root,
    proxies,
    stats,
    apply(state) {
      applyBlades(state, !applied);
      applyConductors(state);
      applyLabels(state);
      placeBrackets(state);
      applied = true;
    },
    advance(deltaMs) {
      if (!animating) {
        return false;
      }
      let moving = false;
      slots.forEach((slot) => {
        if (slot.current === slot.target) {
          return;
        }
        const step = (slot.plan.openAngle * deltaMs) / BLADE_SWING_MS;
        const difference = slot.target - slot.current;
        slot.current =
          Math.abs(difference) <= step ? slot.target : slot.current + Math.sign(difference) * step;
        blades.setMatrixAt(slot.index, bladeMatrix(slot.plan, slot.current));
        moving = moving || slot.current !== slot.target;
      });
      blades.instanceMatrix.needsUpdate = true;
      animating = moving;
      return moving;
    },
    fadeLabels(viewer) {
      labelSlots.forEach((slot) => {
        const distance = slot.sprite.position.distanceTo(viewer);
        const opacity = Math.min(
          Math.max(
            (distance - LABEL_HIDDEN_WITHIN) / (LABEL_VISIBLE_BEYOND - LABEL_HIDDEN_WITHIN),
            0,
          ),
          1,
        );
        slot.sprite.material.opacity = opacity;
        slot.sprite.visible = opacity > 0;
      });
    },
    isAnimating() {
      return animating;
    },
    bladeAngleOf(id) {
      return slots.get(id)?.current ?? null;
    },
    centerOf(id) {
      const proxy = proxyById.get(id);
      return proxy === undefined ? null : proxy.position.clone();
    },
    dispose() {
      disposables.disposeAll();
      labelSlots.forEach((slot) => {
        slot.sprite.material.dispose();
      });
    },
  };
}
