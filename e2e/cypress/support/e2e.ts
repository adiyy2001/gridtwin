Cypress.Commands.add('openApp', () => {
  cy.visit('/');
  cy.get('[data-bus]').should('have.length.at.least', 14);
});

declare global {
  namespace Cypress {
    interface Chainable {
      openApp(): Chainable<void>;
    }
  }
}

export {};
