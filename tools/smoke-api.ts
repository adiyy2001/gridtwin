const COUPLER_BREAKER = 'CPL.QA1';
const CASCADE_TRIGGER = 'branch:L2-4';
const SOCKET_WAIT_MS = 5000;

const base = (process.argv[2] ?? 'http://127.0.0.1:18480').replace(/\/$/, '');

interface CaseSummary {
  id: string;
}

interface Branch {
  id: string;
  overloaded: boolean;
  loading: number;
}

interface VersionedState {
  version: number;
  state: { summary: { overloadedBranches: number }; branches: Branch[] };
}

interface SessionCreated {
  sessionId: string;
  state: VersionedState;
}

interface Refusal {
  code: string;
}

interface Contingency {
  id: string;
  severity: { tier: string };
}

interface ContingencyRanking {
  contingencies: Contingency[];
}

interface ContingencyPreview {
  id?: string;
}

interface CascadeResult {
  trippedCount: number;
  end: string;
}

interface Answer<T> {
  status: number;
  body: T;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<Answer<T>> {
  const headers: Record<string, string> = body === undefined ? {} : { 'content-type': 'application/json' };
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text === '' ? 'null' : text) as T };
}

function expect(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`smoke check failed: ${message}`);
  }
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function waitForVersion(socket: WebSocket, minimumVersion: number): Promise<VersionedState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => { reject(new Error(`no state with version ${minimumVersion} arrived over the WebSocket`)); },
      SOCKET_WAIT_MS,
    );
    const listener = (event: MessageEvent<string>): void => {
      const message = JSON.parse(event.data) as VersionedState;
      if (message.version >= minimumVersion) {
        clearTimeout(timer);
        socket.removeEventListener('message', listener);
        resolve(message);
      }
    };
    socket.addEventListener('message', listener);
  });
}

interface OpenSocket {
  socket: WebSocket;
  first: Promise<VersionedState>;
}

function openSocket(sessionId: string): Promise<OpenSocket> {
  const url = `${base.replace(/^http/, 'ws')}/ws/sessions/${sessionId}`;
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const first = new Promise<VersionedState>((resolveFirst) => {
      socket.addEventListener('message', (event: MessageEvent<string>) => { resolveFirst(JSON.parse(event.data) as VersionedState); }, { once: true });
    });
    socket.addEventListener('open', () => { resolve({ socket, first }); }, { once: true });
    socket.addEventListener('error', () => { reject(new Error(`cannot open ${url}`)); }, { once: true });
  });
}

async function main(): Promise<void> {
  const health = await call<unknown>('GET', '/q/health/ready');
  expect(health.status === 200, `health answered ${health.status}`);

  const cases = await call<CaseSummary[]>('GET', '/api/cases');
  expect(cases.status === 200 && cases.body.length > 0, 'the case list is empty');

  const created = await call<SessionCreated>('POST', '/api/sessions', { caseId: 'ieee14' });
  expect(created.status === 201, `session creation answered ${created.status}`);
  const sessionId = created.body.sessionId;
  const base1 = created.body.state;
  expect(base1.version === 1, 'a new session starts at version 1');
  expect(base1.state.summary.overloadedBranches === 0, 'the base case has no overloaded line');

  const { socket, first } = await openSocket(sessionId);
  const pushedFirst = await first;
  expect(pushedFirst.version === 1, 'the socket sends version 1 first');

  const nextPush = waitForVersion(socket, 2);
  const opened = await call<{ version: number }>('POST', `/api/sessions/${sessionId}/switches/${COUPLER_BREAKER}`, {
    position: 'OPEN',
  });
  expect(opened.status === 200, `opening the coupler answered ${opened.status}`);
  const pushed = await nextPush;
  expect(pushed.version === opened.body.version, 'the pushed version matches the REST answer');

  const state = await call<VersionedState>('GET', `/api/sessions/${sessionId}/state`);
  const overloaded = state.body.state.branches.filter((branch) => branch.overloaded);
  expect(overloaded.length === 1, `expected one overloaded line, found ${overloaded.length}`);

  const refused = await call<Refusal>('POST', `/api/sessions/${sessionId}/switches/CPL.QE1`, {
    position: 'CLOSED',
  });
  expect(refused.status === 409, `the earthing interlock answered ${refused.status}`);

  const ranking = await call<ContingencyRanking>('POST', `/api/sessions/${sessionId}/analyses/n-1`);
  expect(ranking.status === 200, `N-1 answered ${ranking.status}`);
  const top = ranking.body.contingencies[0];
  expect(top !== undefined, 'the ranking is empty');

  const preview = await call<ContingencyPreview>(
    'GET',
    `/api/sessions/${sessionId}/analyses/n-1/${encodeURIComponent(top.id)}`,
  );
  expect(preview.status === 200, `the preview answered ${preview.status}`);

  const cascade = await call<CascadeResult>('POST', `/api/sessions/${sessionId}/analyses/cascade`, {
    trigger: CASCADE_TRIGGER,
  });
  expect(cascade.status === 200, `the cascade answered ${cascade.status}`);

  socket.close();
  await call<null>('DELETE', `/api/sessions/${sessionId}`);
  const gone = await call<null>('GET', `/api/sessions/${sessionId}/state`);
  expect(gone.status === 404, `a deleted session answered ${gone.status}`);

  const worst = overloaded[0];
  expect(worst !== undefined, 'no overloaded line to report');
  console.log('gridtwin API smoke test');
  console.log(`  server               ${base}`);
  console.log(`  cases                ${cases.body.map((entry) => entry.id).join(', ')}`);
  console.log(`  session              ${sessionId}`);
  console.log(`  base case            version ${base1.version}, ${base1.state.summary.overloadedBranches} overloaded lines`);
  console.log(`  coupler opened       version ${opened.body.version} pushed over the WebSocket`);
  console.log(`  overloaded lines     ${overloaded.length}: ${worst.id} at ${percent(worst.loading)}`);
  console.log(`  earthing interlock   refused with 409: ${refused.body.code}`);
  console.log(`  N-1 ranking          ${ranking.body.contingencies.length} outages, worst ${top.id} (${top.severity.tier})`);
  console.log(`  preview              ${preview.body.id ?? top.id} answered 200`);
  console.log(`  cascade              ${cascade.body.trippedCount} trips from ${CASCADE_TRIGGER}, ends ${cascade.body.end}`);
  console.log('smoke test passed');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
