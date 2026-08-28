import { AppController } from './app.controller.js';

describe('AppController', () => {
  it('reports that the API is healthy', () => {
    const controller = new AppController();

    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
