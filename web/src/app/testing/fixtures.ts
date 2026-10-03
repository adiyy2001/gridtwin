import type {
  BranchState,
  BusState,
  Cascade,
  CascadeStep,
  CaseDetail,
  ContingencyPreview,
  ContingencyReport,
  ContingencySummary,
  SessionCreated,
  TwinState,
  VersionedState,
} from '../model/api-types';

export function busState(overrides: Partial<BusState> = {}): BusState {
  return {
    number: 1,
    type: 'PQ',
    state: 'ENERGIZED',
    baseKv: 132,
    voltageMagnitude: 1.02,
    voltageKv: 134.64,
    angleDegrees: -2.5,
    activeGenerationMw: 0,
    reactiveGenerationMvar: 0,
    activeLoadMw: 20,
    reactiveLoadMvar: 5,
    ...overrides,
  };
}

export function branchState(overrides: Partial<BranchState> = {}): BranchState {
  return {
    id: 'L1-2',
    from: 1,
    to: 2,
    inService: true,
    energized: true,
    ratingMva: 100,
    activeFromMw: 60,
    reactiveFromMvar: 5,
    activeToMw: -59,
    reactiveToMvar: -4,
    currentFromKa: 0.27,
    currentToKa: 0.27,
    loading: 0.6,
    lossMw: 1,
    overloaded: false,
    ...overrides,
  };
}

export function twinState(overrides: Partial<TwinState> = {}): TwinState {
  return {
    caseId: 'mini',
    loadFactor: 1,
    converged: true,
    summary: {
      totalLoadMw: 100,
      servedLoadMw: 100,
      shedLoadMw: 0,
      totalGenerationMw: 103,
      totalLossMw: 3,
      maxLoading: 0.8,
      lowestVoltage: 0.99,
      overloadedBranches: 0,
    },
    warnings: [],
    switches: [
      { id: 'CPL.QA1', position: 'CLOSED' },
      { id: 'CPL.QB1', position: 'CLOSED' },
      { id: 'L2-4.QA1', position: 'CLOSED' },
    ],
    nodes: [],
    islands: [],
    buses: [
      busState({ number: 1, type: 'REFERENCE', activeGenerationMw: 103 }),
      busState({ number: 2, voltageMagnitude: 1.01 }),
      busState({ number: 4, voltageMagnitude: 0.99 }),
    ],
    branches: [
      branchState({ id: 'L1-2', from: 1, to: 2, loading: 0.6 }),
      branchState({ id: 'L2-4', from: 2, to: 4, loading: 0.8, activeFromMw: -30 }),
    ],
    generators: [],
    ...overrides,
  };
}

export function versioned(version: number, state: TwinState = twinState()): VersionedState {
  return { version, state };
}

export function sessionCreated(state: TwinState = twinState()): SessionCreated {
  return { sessionId: 'session-1', createdAt: '2026-10-03T12:00:00+02:00', state: versioned(1, state) };
}

export function caseDetail(): CaseDetail {
  return {
    id: 'mini',
    title: 'Mini test network',
    disclaimer: 'Educational model.',
    baseMva: 100,
    provenance: {
      source: 'test',
      ratingPolicy: 'test',
      voltagePolicy: 'test',
      layoutPolicy: 'test',
    },
    buses: [
      { number: 1, type: 'REFERENCE', baseKv: 132, voltageMin: 0.94, voltageMax: 1.06, x: 100, y: 100 },
      { number: 2, type: 'PQ', baseKv: 132, voltageMin: 0.94, voltageMax: 1.06, x: 300, y: 100 },
      { number: 4, type: 'PQ', baseKv: 132, voltageMin: 0.94, voltageMax: 1.06, x: 300, y: 300 },
    ],
    branches: [
      { id: 'L1-2', from: 1, to: 2, ratingMva: 100, tap: 1, shiftDegrees: 0, transformer: false },
      { id: 'L2-4', from: 2, to: 4, ratingMva: 100, tap: 1, shiftDegrees: 0, transformer: false },
    ],
    generators: [{ id: 'G1', bus: 1, activeMinMw: 0, activeMaxMw: 200, activeMw: 100 }],
    loads: [{ bus: 2, activeMw: 50, reactiveMvar: 10 }],
    substation: {
      id: 'S4',
      name: 'Substation 4',
      bus: 4,
      baseKv: 132,
      busbars: [
        { node: 'BB1', bus: 4, name: 'Busbar 1', row: 0 },
        { node: 'BB2', bus: 40, name: 'Busbar 2', row: 1 },
      ],
      nodes: ['BB1', 'BB2', 'L2-4.A', 'L2-4.B', 'L2-4.T'],
      bays: [
        {
          id: 'L2-4',
          name: 'Line to bus 2',
          kind: 'FEEDER',
          column: 0,
          terminal: { node: 'L2-4.T', kind: 'BRANCH', equipment: 'L2-4' },
        },
        { id: 'CPL', name: 'Bus coupler', kind: 'COUPLER', column: 1 },
      ],
      switches: [
        { id: 'L2-4.QB1', kind: 'DISCONNECTOR', bay: 'L2-4', nodeA: 'BB1', nodeB: 'L2-4.A', initialPosition: 'OPEN' },
        { id: 'L2-4.QA1', kind: 'BREAKER', bay: 'L2-4', nodeA: 'L2-4.A', nodeB: 'L2-4.B', initialPosition: 'CLOSED' },
        { id: 'L2-4.QE1', kind: 'EARTHING_SWITCH', bay: 'L2-4', nodeA: 'L2-4.B', nodeB: 'L2-4.B', initialPosition: 'OPEN' },
        { id: 'CPL.QA1', kind: 'BREAKER', bay: 'CPL', nodeA: 'BB1', nodeB: 'BB2', initialPosition: 'CLOSED' },
        { id: 'CPL.QB1', kind: 'DISCONNECTOR', bay: 'CPL', nodeA: 'BB1', nodeB: 'CPL.A', initialPosition: 'CLOSED' },
      ],
    },
  };
}

export function contingency(overrides: Partial<ContingencySummary> = {}): ContingencySummary {
  return {
    rank: 1,
    id: 'branch:L1-2',
    outage: { id: 'branch:L1-2', kind: 'BRANCH', equipmentId: 'L1-2' },
    severity: {
      tier: 'DEGRADED',
      score: 0.5,
      overloadTerm: 0.5,
      voltageTerm: 0,
      shedTerm: 0,
      slackTerm: 0,
    },
    converged: true,
    maxLoading: 1.1,
    lowestVoltage: 0.98,
    shedLoadMw: 0,
    overloadedBranches: ['L2-4'],
    violations: [],
    ...overrides,
  };
}

export function contingencyReport(
  rows: ContingencySummary[] = [
    contingency(),
    contingency({
      rank: 2,
      id: 'generator:G1',
      outage: { id: 'generator:G1', kind: 'GENERATOR', equipmentId: 'G1' },
      severity: { tier: 'SECURE', score: 0, overloadTerm: 0, voltageTerm: 0, shedTerm: 0, slackTerm: 0 },
      maxLoading: 0.7,
      overloadedBranches: [],
    }),
    contingency({
      rank: 3,
      id: 'branch:L2-4',
      outage: { id: 'branch:L2-4', kind: 'BRANCH', equipmentId: 'L2-4' },
      severity: { tier: 'NON_CONVERGED', score: 10, overloadTerm: 0, voltageTerm: 0, shedTerm: 10, slackTerm: 0 },
      converged: false,
      maxLoading: 0,
      lowestVoltage: null,
      shedLoadMw: 100,
      overloadedBranches: [],
    }),
  ],
  stateVersion = 1,
): ContingencyReport {
  return {
    stateVersion,
    loadFactor: 1,
    baseSeverity: { tier: 'SECURE', score: 0, overloadTerm: 0, voltageTerm: 0, shedTerm: 0, slackTerm: 0 },
    baseViolations: [],
    tiers: { secure: 1, degraded: 1, blackout: 0, nonConverged: 1 },
    contingencies: rows,
  };
}

export function contingencyPreview(stateVersion = 1): ContingencyPreview {
  return {
    stateVersion,
    contingency: contingency(),
    state: twinState({ branches: [branchState({ id: 'L1-2', energized: false, loading: 0 })] }),
  };
}

function step(index: number, tripped: string | null, loading: number): CascadeStep {
  return {
    index,
    tripped: tripped === null ? null : { id: `branch:${tripped}`, kind: 'BRANCH', equipmentId: tripped },
    loadingAtTrip: tripped === null ? null : 1.3,
    outOfServiceBranches: tripped === null ? [] : [tripped],
    outOfServiceGenerators: [],
    servedLoadMw: 100,
    state: twinState({
      summary: { ...twinState().summary, maxLoading: loading },
    }),
  };
}

export function cascade(stateVersion = 1): Cascade {
  return {
    stateVersion,
    tripThreshold: 1.2,
    end: 'STABLE',
    trippedCount: 2,
    label: 'Educational simplification.',
    steps: [step(0, null, 0.8), step(1, 'L2-4', 1.3), step(2, 'L1-2', 0.5)],
  };
}
