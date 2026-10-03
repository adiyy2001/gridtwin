import { LiveAnnouncer } from '@angular/cdk/a11y';
import type { Provider } from '@angular/core';

import { TwinApi } from '../core/twin-api';
import { TwinSocket } from '../core/twin-socket';
import { FakeApi, FakeSocket } from './fakes';

export interface FakeTwin {
  readonly api: FakeApi;
  readonly socket: FakeSocket;
  readonly providers: Provider[];
}

export function fakeTwin(): FakeTwin {
  const api = new FakeApi();
  const socket = new FakeSocket();
  const announcer = { announce: () => Promise.resolve() };
  return {
    api,
    socket,
    providers: [
      { provide: TwinApi, useValue: api },
      { provide: TwinSocket, useValue: socket },
      { provide: LiveAnnouncer, useValue: announcer },
    ],
  };
}
