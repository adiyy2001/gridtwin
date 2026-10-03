import {
  busPlacement,
  describeConfirmation,
  switchGroupForBay,
  switchGroupsForBranch,
  switchGroupsForBus,
} from './inspector-model';
import type { Position } from '../model/api-types';
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
});
