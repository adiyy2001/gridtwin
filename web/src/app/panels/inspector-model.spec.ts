import {
  busPlacement,
  describeConfirmation,
  switchGroupForBay,
  switchGroupsForBranch,
  switchGroupsForBus,
  switchGroupsForSwitch,
  switchKindLabel,
  switchSides,
} from './inspector-model';
import type { NodeCondition, Position } from '../model/api-types';
import { branchState, busState, substationFixture } from '../testing/fixtures';

describe('inspector model', () => {
  const substation = substationFixture();
  const positions = new Map<string, Position>([
    ['L2-4.QA1', 'OPEN'],
    ['CPL.QA1', 'CLOSED'],
  ]);

  it('lists the switches of the bay of a branch with breakers first', () => {
    const groups = switchGroupsForBranch(substation, branchState({ id: 'L2-4' }), positions);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.bayName).toBe('Line to bus 2');
    expect(groups[0]?.rows.map((row) => row.id)).toEqual(['L2-4.QA1', 'L2-4.QB1', 'L2-4.QE1']);
  });

  it('takes the position from the live state and offers the opposite action', () => {
    const rows = switchGroupsForBranch(substation, branchState({ id: 'L2-4' }), positions)[0]?.rows;
    expect(rows?.[0]).toMatchObject({
      position: 'OPEN',
      targetPosition: 'CLOSED',
      actionLabel: 'Close breaker',
    });
  });

  it('falls back to the initial position when the live state does not list the switch', () => {
    const rows = switchGroupsForBranch(substation, branchState({ id: 'L2-4' }), new Map())[0]?.rows;
    expect(rows?.find((row) => row.id === 'L2-4.QB1')).toMatchObject({
      position: 'OPEN',
      actionLabel: 'Close disconnector',
    });
  });

  it('has no switches for a branch outside the substation', () => {
    expect(switchGroupsForBranch(substation, branchState({ id: 'L1-2' }), positions)).toEqual([]);
  });

  it('has no switches without a substation', () => {
    expect(switchGroupsForBranch(undefined, branchState(), positions)).toEqual([]);
    expect(switchGroupsForBus(null, busState(), positions)).toEqual([]);
  });

  it('lists the coupler switches for a busbar bus', () => {
    const groups = switchGroupsForBus(substation, busState({ number: 40 }), positions);
    expect(groups.map((group) => group.bayId)).toEqual(['CPL']);
    expect(groups[0]?.rows[0]?.id).toBe('CPL.QA1');
  });

  it('has no switches for a bus outside the substation', () => {
    expect(switchGroupsForBus(substation, busState({ number: 1 }), positions)).toEqual([]);
  });

  it('builds a group for a given bay', () => {
    const coupler = substation.bays.find((bay) => bay.id === 'CPL');
    expect(
      coupler === undefined ? 0 : switchGroupForBay(substation, coupler, positions).rows.length,
    ).toBe(2);
  });

  it('names the busbar of a bus', () => {
    expect(busPlacement(substation, busState({ number: 40 }))).toBe('Busbar 2');
    expect(busPlacement(substation, busState({ number: 1 }))).toBeNull();
    expect(busPlacement(undefined, busState({ number: 4 }))).toBeNull();
  });

  it('describes opening a switch', () => {
    const confirmation = describeConfirmation(substation, 'CPL.QA1', 'OPEN');
    expect(confirmation.title).toBe('Open breaker CPL.QA1?');
    expect(confirmation.message).toContain('Bus coupler');
    expect(confirmation.message).toContain('opened');
    expect(confirmation.confirmLabel).toBe('Open breaker');
  });

  it('describes closing an earthing switch', () => {
    const confirmation = describeConfirmation(substation, 'L2-4.QE1', 'CLOSED');
    expect(confirmation.title).toBe('Close earthing switch L2-4.QE1?');
    expect(confirmation.message).toContain('closed');
  });

  it('describes an unknown switch', () => {
    const confirmation = describeConfirmation(substation, 'X', 'OPEN');
    expect(confirmation.title).toBe('Open switch X?');
    expect(confirmation.message).not.toContain('in bay');
  });

  it('lists the bay of a selected switch', () => {
    const description = substation.switches.find((entry) => entry.id === 'L2-4.QA1');
    if (description === undefined) {
      throw new Error('fixture switch missing');
    }
    const groups = switchGroupsForSwitch(substation, description, positions);
    expect(groups.map((group) => group.bayId)).toEqual(['L2-4']);
    expect(switchGroupsForSwitch(null, description, positions)).toEqual([]);
    expect(
      switchGroupsForSwitch(substation, { ...description, bay: 'unknown' }, positions),
    ).toEqual([]);
  });

  it('names the kind of a switch', () => {
    expect(switchKindLabel('BREAKER')).toBe('Breaker');
    expect(switchKindLabel('EARTHING_SWITCH')).toBe('Earthing switch');
  });

  it('describes the nodes on both sides of a switch and skips the earth', () => {
    const conditions = new Map<string, NodeCondition>([
      ['L2-4.A', 'ENERGIZED'],
      ['L2-4.B', 'EARTHED'],
    ]);
    const breaker = substation.switches.find((entry) => entry.id === 'L2-4.QA1');
    const earthing = substation.switches.find((entry) => entry.id === 'L2-4.QE1');
    if (breaker === undefined || earthing === undefined) {
      throw new Error('fixture switch missing');
    }
    expect(switchSides(breaker, conditions)).toEqual([
      { node: 'L2-4.A', condition: 'energized' },
      { node: 'L2-4.B', condition: 'earthed' },
    ]);
    expect(switchSides({ ...earthing, nodeA: 'L2-4.B', nodeB: 'EARTH' }, conditions)).toEqual([
      { node: 'L2-4.B', condition: 'earthed' },
    ]);
    expect(switchSides(breaker, new Map())).toEqual([
      { node: 'L2-4.A', condition: 'de-energized' },
      { node: 'L2-4.B', condition: 'de-energized' },
    ]);
  });
});
