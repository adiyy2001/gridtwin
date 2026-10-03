import { Component, signal } from '@angular/core';
import type { MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { PARTICLE_RADIUS, ParticleLayer, canvasTransform, drawParticles } from './particle-layer';
import type { ParticleFlow, ViewBox } from './particle-layer';

const flow: ParticleFlow = {
  id: 'L1-2',
  start: { x: 0, y: 0 },
  end: { x: 100, y: 0 },
  direction: 1,
  speed: 10,
  spacing: 20,
  colour: '#123456',
};

describe('canvasTransform', () => {
  const viewBox: ViewBox = { x: 10, y: 20, width: 200, height: 100 };

  it('scales to fit the smaller side', () => {
    expect(canvasTransform(viewBox, 400, 400).scale).toBe(2);
  });

  it('centres the view box in the canvas', () => {
    const transform = canvasTransform(viewBox, 400, 400);
    const centreX = (10 + 100) * transform.scale + transform.offsetX;
    const centreY = (20 + 50) * transform.scale + transform.offsetY;
    expect(centreX).toBeCloseTo(200);
    expect(centreY).toBeCloseTo(200);
  });
});

describe('drawParticles', () => {
  function context() {
    return {
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: '' as string | CanvasGradient | CanvasPattern,
    };
  }

  it('draws one circle per particle in the colour of the flow', () => {
    const target = context();
    const drawn = drawParticles(target, [flow], 0, { scale: 1, offsetX: 0, offsetY: 0 });
    expect(drawn).toBe(5);
    expect(target.arc).toHaveBeenCalledTimes(5);
    expect(target.fillStyle).toBe('#123456');
  });

  it('applies the transform to the positions', () => {
    const target = context();
    drawParticles(target, [flow], 0, { scale: 2, offsetX: 5, offsetY: 7 });
    expect(target.arc).toHaveBeenCalledWith(5, 7, PARTICLE_RADIUS * 2, 0, 2 * Math.PI);
  });

  it('draws nothing for a branch without flow', () => {
    const target = context();
    expect(
      drawParticles(target, [{ ...flow, direction: 0 }], 0, { scale: 1, offsetX: 0, offsetY: 0 }),
    ).toBe(0);
  });
});

@Component({
  imports: [ParticleLayer],
  template: `<gt-particle-layer [flows]="flows()" [viewBox]="viewBox" />`,
})
class Host {
  readonly flows = signal<readonly ParticleFlow[]>([flow]);
  readonly viewBox: ViewBox = { x: 0, y: 0, width: 100, height: 50 };
}

describe('ParticleLayer', () => {
  let getContext: MockInstance<HTMLCanvasElement['getContext']>;
  let context: Record<string, unknown>;

  beforeEach(() => {
    context = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
    };
    getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        readonly observe = vi.fn();
        readonly disconnect = vi.fn();
      },
    );
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(7));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      value: 150,
    });
  });

  afterEach(() => {
    getContext.mockRestore();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
    Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
  });

  it('reports how many flows it animates', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas');
    expect(canvas?.dataset['particles']).toBe('1');
    fixture.componentInstance.flows.set([]);
    await fixture.whenStable();
    expect(canvas?.dataset['particles']).toBe('0');
  });

  function runFrames(time: number): void {
    const callbacks = vi.mocked(requestAnimationFrame).mock.calls.map((call) => call[0]);
    callbacks.forEach((callback) => {
      callback(time);
    });
  }

  it('cancels its animation frame when destroyed', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.destroy();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
  });

  it('draws the particles on every animation frame', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const framesBefore = vi.mocked(requestAnimationFrame).mock.calls.length;
    runFrames(performance.now() + 500);
    expect(context['clearRect']).toHaveBeenCalled();
    expect(context['arc']).toHaveBeenCalled();
    expect(vi.mocked(requestAnimationFrame).mock.calls.length).toBeGreaterThan(framesBefore);
  });

  it('paints one static frame and does not loop when the user prefers reduced motion', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    expect(context['arc']).toHaveBeenCalled();
    const clears = vi.mocked(context['clearRect'] as ReturnType<typeof vi.fn>).mock.calls.length;
    runFrames(performance.now() + 500);
    expect(vi.mocked(context['clearRect'] as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      clears,
    );
  });

  it('does nothing without a 2d context', async () => {
    getContext.mockReturnValue(null);
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    expect(() => {
      runFrames(performance.now());
    }).not.toThrow();
  });
});
