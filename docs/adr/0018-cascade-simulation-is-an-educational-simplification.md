# 0018 The cascade simulation is an educational simplification

Status: accepted

## Context

The brief asks for a cascade replay: trip the worst branch above a threshold, solve again, repeat, and store the steps so the front end can replay them. A real cascade depends on protection settings, time, frequency and voltage dynamics. None of that is in a steady-state power flow, and dynamics are out of scope.

## Decision

`CascadeSimulation` follows these rules and the UI and the documents label it as an educational simplification.

- Step 0 is the unchanged base state. Step 1 applies the trigger, which is a branch or a generator outage. Every later step trips exactly one more branch.
- After each solve, the branch with the largest loading above the trip threshold (120% of its rating by default) trips. A tie goes to the lower branch id. Only branches of energized and converged islands count.
- The cascade ends when no branch is above the threshold (`STABLE`), when no load is served (`BLACKOUT`), when an island does not converge (`NON_CONVERGED`, the voltage collapse of ADR 0004), or after 50 steps counting the trigger (`STEP_LIMIT`).
- Each step keeps the full `GridSolution`, the outages applied so far, the tripped equipment and the loading it had when it tripped. The front end replays steps without solving.
- Islands are rebuilt after every trip with the rules of ADR 0005. An island without a generator goes dark and its load counts as shed. A trip is a branch status change, not a switching operation.
- Each solve warm-starts from the previous step.

The behaviour that is not modelled: protection delays and the order in which relays operate, generator trips on frequency or voltage, load shedding schemes, reconnection, and thermal time constants. A trip happens the instant the loading passes the threshold.

## Alternatives

Tripping every branch above the threshold at once is simpler and hides the order, which is the interesting part of a replay. Adding time and inverse-time protection curves would suggest a precision the model does not have.

## Consequences

The ratings policy of ADR 0006 sets the ratings at 125% of the base flow, so the cascade is easy to start. On IEEE 14 at base load, the outage of the line 2-4 trips the lines 4-5, 6-11 and 13-14 in this order and then ends with a collapsed island (`CascadeOnIeee14Test` holds both cases). At 120% load, the outage of the line 6-12 trips 6-13 and 9-14 and settles. Both are fixed in tests, so a change to the rules shows up as a failing test.

A cascade that ends in `NON_CONVERGED` shows the last solved step and the collapsed island. It is a collapse report, not an error.
