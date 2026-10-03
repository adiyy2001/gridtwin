import { clickSceneItem, sceneApi } from '../support/scene';
import type { SceneItem } from '../support/scene';

function expectItem<K extends keyof SceneItem>(id: string, field: K, value: SceneItem[K]): void {
  cy.window().should((win) => {
    const item = sceneApi(win)
      .describe()
      .items.find((entry) => entry.id === id);
    expect(item, `scene item ${id}`).to.not.equal(undefined);
    expect(item?.[field], `${field} of ${id}`).to.equal(value);
  });
}

function showVersion(version: number): void {
  cy.get('[data-testid="connection"]').should('contain', `version ${version}`);
}

function waitForScene(): void {
  cy.window().should((win) => {
    const description = sceneApi(win).describe();
    expect(description.webgl, 'WebGL scene').to.equal(true);
    expect(description.animating, 'blades settled').to.equal(false);
  });
}

describe('3D substation scene', () => {
  beforeEach(() => {
    cy.openApp();
    cy.get('[data-scene-canvas]').should('be.visible');
    waitForScene();
  });

  it('describes every switch of the diagram', () => {
    cy.get('[data-sld-switch]').then((switches) => {
      cy.window().should((win) => {
        const ids = sceneApi(win)
          .describe()
          .items.filter((item) => item.kind === 'switch')
          .map((item) => item.id);
        expect(ids).to.have.length(switches.length);
      });
    });
  });

  it('shows a line opened in the diagram as de-energized in the scene', () => {
    expectItem('terminal:L3-4', 'condition', 'ENERGIZED');
    cy.get('[data-sld-switch="L3-4.QA1"]').click();
    cy.get('[data-action="confirm"]').click();
    showVersion(2);
    cy.get('[data-sld-terminal="L3-4"]').should('have.attr', 'data-condition', 'DEENERGIZED');
    waitForScene();
    expectItem('terminal:L3-4', 'condition', 'DEENERGIZED');
    expectItem('L3-4.QA1', 'position', 'OPEN');
  });

  it('operates equipment from a click in the scene only after confirmation', () => {
    clickSceneItem('L3-4.QA1');
    cy.get('[data-action="confirm"]').should('be.visible');
    expectItem('L3-4.QA1', 'position', 'CLOSED');
    showVersion(1);
    cy.get('[data-action="confirm"]').click();
    showVersion(2);
    waitForScene();
    expectItem('L3-4.QA1', 'position', 'OPEN');
    cy.get('[data-sld-switch="L3-4.QA1"]').should('have.attr', 'data-position', 'OPEN');
  });

  it('marks the equipment picked in the scene as selected in the inspector', () => {
    clickSceneItem('terminal:L4-5');
    expectItem('terminal:L4-5', 'selected', true);
    cy.get('[data-sld-terminal="L4-5"]').should('have.class', 'selected');
  });
});
