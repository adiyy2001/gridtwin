function percentOf(text: string): number {
  const match = /([\d.]+)%/.exec(text);
  return match === null ? Number.NaN : Number(match[1]);
}

function operateInDiagram(switchId: string): void {
  cy.get(`[data-sld-switch="${switchId}"]`).click();
  cy.get('[data-action="confirm"]').click();
}

function showVersion(version: number): void {
  cy.get('[data-testid="connection"]').should('contain', `version ${version}`);
}

describe('single-line diagram', () => {
  beforeEach(() => {
    cy.openApp();
  });

  it('draws the substation with its busbars, switches and feeders', () => {
    cy.get('[data-sld-busbar]').should('have.length', 2);
    cy.get('[data-sld-switch]').should('have.length', 35);
    cy.get('[data-sld-terminal]').should('have.length', 6);
    cy.get('[data-sld-switch="L3-4.QA1"]')
      .should('have.attr', 'data-position', 'CLOSED')
      .and('have.attr', 'aria-label')
      .and('contain', 'Breaker QA1');
    cy.get('[data-sld-switch="L3-4.QB2"]').should('have.attr', 'data-position', 'OPEN');
  });

  it('opens a line breaker and moves the load to the parallel path', () => {
    cy.get('[data-entry="bus-4"]').should('exist');
    cy.get('.kind-switch button').contains('Branches').click();
    cy.get('[data-entry="branch-L2-3"]')
      .invoke('text')
      .then((text) => {
        const before = percentOf(text);
        operateInDiagram('L3-4.QA1');
        showVersion(2);
        cy.get('[data-sld-switch="L3-4.QA1"]').should('have.attr', 'data-position', 'OPEN');
        cy.get('[data-sld-terminal="L3-4"]').should('have.attr', 'data-condition', 'DEENERGIZED');
        cy.get('[data-branch="L3-4"]').should('have.attr', 'data-energized', 'false');
        cy.get('[data-entry="branch-L2-3"]')
          .invoke('text')
          .should((after) => {
            expect(percentOf(after)).to.be.greaterThan(before);
          });
      });
  });

  it('shows the line over its rating after the bus coupler opens', () => {
    operateInDiagram('CPL.QA1');
    showVersion(2);
    cy.get('[data-sld-terminal="L2-4"]').should('have.class', 'overloaded');
    cy.get('[data-sld-terminal="L2-4"]').invoke('attr', 'aria-label').should('contain', 'overloaded');
    cy.get('[data-branch="L2-4"]').should('have.attr', 'data-band', 'overloaded');
    cy.get('[data-testid="notice"]').should('contain', '1 overloaded branch');
  });

  it('shows the reason when a disconnector is operated under a closed breaker', () => {
    operateInDiagram('L3-4.QB1');
    cy.get('[data-testid="refusal"]').should('contain', 'Open the breaker first');
    cy.get('[data-testid="notice"]').should('contain', 'Refused or failed');
    showVersion(1);
    cy.get('[data-sld-switch="L3-4.QB1"]').should('have.attr', 'data-position', 'CLOSED');
    cy.get('[data-testid="refusal"] button').click();
    cy.get('[data-testid="refusal"]').should('not.exist');
  });

  it('refuses to earth a live section and earths an isolated one', () => {
    operateInDiagram('L3-4.QE1');
    cy.get('[data-testid="refusal"]').should('contain', 'De-energize it first');
    cy.get('[data-testid="refusal"] button').click();
    operateInDiagram('CPL.QA1');
    showVersion(2);
    operateInDiagram('CPL.QB1');
    showVersion(3);
    cy.get('[data-sld-switch="CPL.QE1"]').should('have.attr', 'data-condition', 'DEENERGIZED');
    operateInDiagram('CPL.QE1');
    showVersion(4);
    cy.get('[data-sld-switch="CPL.QE1"]')
      .should('have.attr', 'data-condition', 'EARTHED')
      .and('have.attr', 'data-position', 'CLOSED');
    cy.get('[data-sld-switch="CPL.QE1"]').invoke('attr', 'aria-label').should('contain', 'earthed');
  });

  it('keeps the diagram, the network view and the inspector on the same selection', () => {
    cy.get('[data-sld-terminal="L2-4"]').click();
    cy.get('[data-branch="L2-4"]').should('have.class', 'selected');
    cy.contains('h3', 'Branch L2-4').should('be.visible');
    cy.get('[data-details="branch"]').should('contain', 'Line');
    cy.get('[data-branch="L4-5"]').click();
    cy.get('[data-sld-terminal="L4-5"]').should('have.attr', 'aria-current', 'true');
    cy.get('[data-sld-terminal="L2-4"]').should('not.have.attr', 'aria-current');
    cy.get('[data-sld-switch="L4-5.QA1"]').click();
    cy.get('[data-action="cancel"]').click();
    cy.get('[data-details="switch"]').should('contain', 'Closed').and('contain', 'Line to bus 5');
    cy.get('[data-sld-switch="L4-5.QA1"]').should('have.attr', 'aria-current', 'true');
  });

  it('operates a line breaker with the keyboard only', () => {
    cy.get('[data-sld-busbar="BB1"]').focus();
    cy.focused().type('{rightarrow}');
    cy.focused().should('have.attr', 'data-sld-switch');
    cy.get('[data-sld-switch="L3-4.QA1"]').focus();
    cy.focused().type('{enter}');
    cy.get('[data-action="confirm"]').should('be.visible');
    cy.get('[data-action="confirm"]').focus();
    cy.focused().type('{enter}');
    showVersion(2);
    cy.get('[data-sld-terminal="L3-4"]').should('have.attr', 'data-condition', 'DEENERGIZED');
    cy.focused().should('have.attr', 'data-sld-switch', 'L3-4.QA1');
  });

  it('walks the diagram with the arrow keys', () => {
    cy.get('[data-sld-switch="L3-4.QB2"]').focus();
    cy.focused().type('{downarrow}');
    cy.focused().should('have.attr', 'data-sld-switch', 'L3-4.QA1');
    cy.focused().type('{downarrow}');
    cy.focused().should('have.attr', 'data-sld-switch', 'L3-4.QB9');
    cy.focused().type('{downarrow}');
    cy.focused().should('have.attr', 'data-sld-terminal', 'L3-4');
    cy.focused().type('{rightarrow}');
    cy.focused().should('have.attr', 'data-sld-switch', 'L3-4.QE1');
    cy.contains('h3', 'Earthing switch L3-4.QE1').should('be.visible');
    cy.focused().type('{leftarrow}');
    cy.focused().should('have.attr', 'data-sld-terminal', 'L3-4');
  });

  it('cancels with Escape and leaves the state alone', () => {
    cy.get('[data-sld-switch="L3-4.QA1"]').focus();
    cy.focused().type('{enter}');
    cy.get('[data-action="confirm"]').should('be.visible');
    cy.get('body').type('{esc}');
    cy.get('[data-action="confirm"]').should('not.exist');
    showVersion(1);
    cy.focused().should('have.attr', 'data-sld-switch', 'L3-4.QA1');
  });

  it('operates a switch from the inspector as well', () => {
    cy.get('[data-sld-switch="L3-4.QA1"]').click();
    cy.get('[data-action="cancel"]').click();
    cy.get('[data-switch="L3-4.QA1"]').click();
    cy.get('[data-action="confirm"]').click();
    showVersion(2);
    cy.get('[data-sld-switch="L3-4.QA1"]').should('have.attr', 'data-position', 'OPEN');
  });
});
