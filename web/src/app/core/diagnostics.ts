import { Injectable } from '@angular/core';

export interface GridtwinGlobal {
  latencies: number[];
  [name: string]: unknown;
}

declare global {
  interface Window {
    __gridtwin?: GridtwinGlobal;
  }
}

@Injectable({ providedIn: 'root' })
export class Diagnostics {
  private commandStartedAt: number | null = null;

  beginCommand(): void {
    this.commandStartedAt = performance.now();
  }

  commandApplied(): void {
    const started = this.commandStartedAt;
    if (started === null) {
      return;
    }
    this.commandStartedAt = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.record(performance.now() - started);
      });
    });
  }

  abandonCommand(): void {
    this.commandStartedAt = null;
  }

  expose(name: string, api: unknown): void {
    this.global()[name] = api;
  }

  withdraw(name: string): void {
    Reflect.deleteProperty(this.global(), name);
  }

  private record(milliseconds: number): void {
    this.global().latencies.push(milliseconds);
  }

  private global(): GridtwinGlobal {
    window.__gridtwin ??= { latencies: [] };
    return window.__gridtwin;
  }
}
