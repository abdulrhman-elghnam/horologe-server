import { ServiceUnavailableException } from '@nestjs/common';

import { AppController } from './app.controller.js';

describe('AppController', () => {
  const build = (dbUp: boolean, redisUp: boolean) =>
    new AppController(
      { query: vi.fn(() => (dbUp ? Promise.resolve([{}]) : Promise.reject(new Error('down')))) } as never,
      { ping: vi.fn(() => Promise.resolve(redisUp)) } as never,
    );

  it('reports ok when Postgres and Redis answer', async () => {
    await expect(build(true, true).health()).resolves.toEqual({ status: 'ok', database: true, redis: true });
  });

  it('fails when a dependency is down', async () => {
    await expect(build(true, false).health()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
