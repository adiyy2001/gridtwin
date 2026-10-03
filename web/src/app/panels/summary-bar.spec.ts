import { TestBed } from '@angular/core/testing';

import { SummaryBar } from './summary-bar';
import { TwinStore } from '../core/twin-store';
import { twinState } from '../testing/fixtures';
import { fakeTwin } from '../testing/providers';

describe('SummaryBar', () => {
  it('shows nothing before the first state', async () => {
    TestBed.configureTestingModule({ providers: fakeTwin().providers });
    const fixture = TestBed.createComponent(SummaryBar);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.item')).toHaveLength(0);
  });

  it('shows the totals of the displayed state', async () => {
    const twin = fakeTwin();
    TestBed.configureTestingModule({ providers: twin.providers });
    await TestBed.inject(TwinStore).start();
    const fixture = TestBed.createComponent(SummaryBar);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('100.0 MW');
    expect(text).toContain('80.0%');
    expect(text).toContain('Converged');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.alarm')).toHaveLength(0);
  });

  it('marks overloads, shed load and a failed solution', async () => {
    const twin = fakeTwin();
    twin.api.created = {
      ...twin.api.created,
      state: {
        version: 1,
        state: twinState({
          converged: false,
          summary: {
            ...twinState().summary,
            overloadedBranches: 2,
            maxLoading: 1.3,
            shedLoadMw: 40,
          },
        }),
      },
    };
    TestBed.configureTestingModule({ providers: twin.providers });
    await TestBed.inject(TwinStore).start();
    const fixture = TestBed.createComponent(SummaryBar);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.alarm')).toHaveLength(4);
    expect(element.textContent).toContain('No solution');
  });
});
