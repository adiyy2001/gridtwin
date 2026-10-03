import { TestBed } from '@angular/core/testing';

import { Diagnostics } from './diagnostics';

describe('Diagnostics', () => {
  let diagnostics: Diagnostics;

  beforeEach(() => {
    vi.useFakeTimers();
    delete window.__gridtwin;
    diagnostics = TestBed.inject(Diagnostics);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records the time from the command to the second frame after it is applied', () => {
    vi.setSystemTime(0);
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValueOnce(100);
    diagnostics.beginCommand();
    diagnostics.commandApplied();
    now.mockReturnValue(142);
    vi.advanceTimersByTime(100);
    expect(window.__gridtwin?.latencies).toEqual([42]);
    now.mockRestore();
  });

  it('ignores an application without a started command and an abandoned command', () => {
    diagnostics.commandApplied();
    diagnostics.beginCommand();
    diagnostics.abandonCommand();
    diagnostics.commandApplied();
    vi.advanceTimersByTime(100);
    expect(window.__gridtwin?.latencies ?? []).toEqual([]);
  });

  it('exposes and withdraws named APIs', () => {
    const api = { ping: () => 'pong' };
    diagnostics.expose('scene', api);
    expect(window.__gridtwin?.['scene']).toBe(api);
    diagnostics.withdraw('scene');
    expect(window.__gridtwin?.['scene']).toBeUndefined();
    expect(window.__gridtwin?.latencies).toEqual([]);
  });
});
