import { TestBed } from '@angular/core/testing';

import { App } from './app';
import { TwinStore } from './core/twin-store';
import { ApiError } from './core/api-error';
import { fakeTwin } from './testing/providers';

describe('App', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts a session and shows the application shell', async () => {
    const twin = fakeTwin();
    TestBed.configureTestingModule({ providers: twin.providers });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(TestBed.inject(TwinStore).sessionId()).toBe('session-1');
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('gridtwin');
    expect(element.querySelector('[data-testid="educational-label"]')?.textContent).toBe(
      'Educational model',
    );
    expect(element.querySelectorAll('[data-bus]')).toHaveLength(3);
    expect(element.querySelector('footer')?.textContent).toContain('Mini test network');
  });

  it('has a landmark for the content and a skip link', async () => {
    const twin = fakeTwin();
    TestBed.configureTestingModule({ providers: twin.providers });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('main#main')).not.toBeNull();
    expect(element.querySelector('a.skip')?.getAttribute('href')).toBe('#main');
  });

  it('shows the label and disclaimer before the case has loaded', () => {
    const twin = fakeTwin();
    twin.api.failure = new ApiError(0, 'x', 'down', null);
    TestBed.configureTestingModule({ providers: twin.providers });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('footer')?.textContent).toContain(
      'educational model',
    );
  });
});
