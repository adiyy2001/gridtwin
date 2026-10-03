describe('gridtwin smoke test', () => {
  beforeEach(() => {
    cy.openApp();
  });

  it('loads the application and labels it as an educational model', () => {
    cy.title().should('contain', 'gridtwin');
    cy.get('[data-testid="educational-label"]').should('be.visible').and('contain', 'Educational model');
    cy.get('[data-testid="connection"]').should('contain', 'Live');
    cy.get('[data-bus]').should('have.length', 14);
    cy.get('[data-branch]').should('have.length', 20);
  });

  it('changes the numbers when the load slider moves', () => {
    cy.get('[data-testid="summary"]').should('contain', '259.0 MW');
    cy.get('#load-range').invoke('val', 130).trigger('input');
    cy.get('[data-testid="load-value"]').should('contain', '130%');
    cy.get('[data-testid="summary"]').should('contain', '336.7 MW');
    cy.get('[data-testid="notice"]').should('contain', 'Load at 130%');
  });

  it('operates the bus coupler after a confirmation and shows the overload', () => {
    cy.get('[data-entry="bus-4"]').click();
    cy.get('[data-switch="CPL.QA1"]').click();
    cy.get('[data-action="confirm"]').should('be.visible');
    cy.get('[data-action="cancel"]').click();
    cy.get('[data-testid="connection"]').should('contain', 'version 1');
    cy.get('[data-switch="CPL.QA1"]').click();
    cy.get('[data-action="confirm"]').click();
    cy.get('[data-testid="connection"]').should('contain', 'version 2');
    cy.get('[data-branch="L2-4"]').should('have.attr', 'data-band', 'overloaded');
    cy.get('[data-testid="notice"]').should('contain', '1 overloaded branch');
  });

  it('shows the reason when an operation is refused', () => {
    cy.get('[data-entry="bus-4"]').click();
    cy.get('[data-switch="CPL.QB1"]').click();
    cy.get('[data-action="confirm"]').click();
    cy.get('[data-testid="notice"]').should('contain', 'Refused or failed');
    cy.get('[data-testid="connection"]').should('contain', 'version 1');
  });

  it('runs N-1, sorts the table and previews a row', () => {
    cy.get('[data-action="run-n1"]').click();
    cy.get('[data-testid="n1-table"] tr.contingency').should('have.length', 25);
    cy.get('[data-sort="maxLoading"]').click();
    cy.get('[data-sort="maxLoading"]').closest('th').should('have.attr', 'aria-sort', 'descending');
    cy.get('tr.contingency').first().click();
    cy.get('.view-banner').should('contain', 'not applied');
    cy.get('tr.contingency').first().should('have.attr', 'aria-current', 'true');
    cy.get('.view-banner button').click();
    cy.get('.view-banner').should('not.exist');
  });

  it('runs a cascade and replays its steps with the scrubber', () => {
    cy.get('[data-action="run-cascade"]').click();
    cy.get('[data-testid="cascade-result"]').should('contain', 'trips');
    cy.get('[data-testid="cascade-step"]').should('contain', 'Step 0 of');
    cy.get('#cascade-range').invoke('val', 1).trigger('input');
    cy.get('[data-testid="cascade-step"]').should('contain', 'Step 1 of');
    cy.get('.view-banner').should('contain', 'Cascade replay, step 1');
    cy.get('[data-action="play"]').click();
    cy.get('[data-action="play"]').should('contain', 'Pause');
  });

  it('keeps the particles running on the network view', () => {
    cy.get('gt-particle-layer canvas').should('have.attr', 'data-particles').and('not.equal', '0');
  });
});
