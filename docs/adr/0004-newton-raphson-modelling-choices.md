# 0004 Newton-Raphson modelling choices

Status: accepted

## Context

The solver has to reproduce MATPOWER to 1e-6 pu in voltage magnitude and 1e-4 degrees in angle. Small modelling differences (tap convention, reactive limit handling, slack choice) would show up as larger errors than that, so each one is fixed here.

## Decision

- Polar formulation with an analytic sparse Jacobian. Unknowns are the angles of all non-slack buses and the magnitudes of PQ buses.
- Convergence: the largest absolute P or Q mismatch, in per unit on the system base, is at most 1e-8. At most 20 iterations. The result carries the mismatch after every iteration, starting with iteration 0.
- Start: flat start (magnitude 1 at PQ buses, generator setpoint at PV buses, angle 0) or a warm start from a previous solution when the bus set is unchanged.
- Branch model: pi circuit with the tap ratio on the from side and an optional phase shift, using the MATPOWER convention. With `t = tap * exp(j * shift)`, the admittances are `Yff = (ys + j*b/2) / (tap^2)`, `Yft = -ys / conj(t)`, `Ytf = -ys / t` and `Ytt = ys + j*b/2`.
- Loads are constant power and shunts are constant admittance.
- Reactive limits: after convergence, every in-service PV generator outside its Q range is converted to PQ at the violated limit, all violators at once. The solve restarts from the current solution. The loop repeats until nothing violates. Converted buses are not converted back. This is the behaviour of MATPOWER with `pf.enforce_q_lims = 1`.
- The slack generator never has its Q limits enforced. MATPOWER would convert it to PQ and pick a new slack, which changes the angle reference. The reference pipeline widens the slack limits for this reason (ADR 0007).
- Real power limits are not enforced. When the slack output leaves the range of its generator, the result carries a warning.
- Divergence: more than 20 iterations, a non-finite value or a singular Jacobian marks the island as collapsed. The result carries the mismatch history and the island's buses are flagged. The caller gets a result and not an exception.

## Alternatives

Distributed slack would spread the imbalance over several generators. It is closer to operation practice and it is further from the reference data.

A rectangular formulation avoids trigonometric functions. The brief asks for polar form.

## Consequences

The solver follows MATPOWER's conventions, and the validation suite checks that it reaches the same numbers. It does not model reactive limits that relax again after a load decrease, so a generator that hit its limit at 150% load stays a PQ bus in that solve. Each solve starts from the topology it is given, so moving the load slider back down starts a fresh solve.

## Implementation notes from milestone 2

The validation suite (`MatpowerComparisonTest`) matches the references at load factors 0.5, 1.0, 1.2 and 1.5, with and without reactive limits, for both cases. Voltage magnitudes agree to 1e-6 pu and angles to 1e-4 degrees, as required, and so do branch flows, generator outputs, which generators sit at a limit and the losses. No tolerance had to be widened, including IEEE 30 at 150% with Q limits (lowest voltage 0.7072 pu).

Details the first version of this ADR left open:

- Reactive limits are tested per bus, not per generator. When several generators share a PV bus, their limits are summed, the whole bus converts, and each generator reports its own limit. A violation counts when it exceeds the limit by more than 5e-6 MVAr, which is MATPOWER's default.
- Generators at a reference or PV bus split the bus's reactive output in proportion to their reactive range, as MATPOWER does. At the reference bus the first in-service generator also takes the active power the others do not cover.
- A PV bus whose generators are all out of service is solved as a PQ bus. A PQ bus that has a generator keeps the generator's table output.
- Only the buses reachable from the reference bus through in-service branches are solved. The others are reported as de-energized with zero voltage and flows, and their load is reported as unserved load. Choosing a new slack for an island that has no reference bus is the topology processor's job (ADR 0005).
- The result carries `totalLossMw` for the branches only. Conductance of shunts is reported separately as `shuntConsumptionMw`, so generation equals load plus losses plus shunt consumption.
- `iterations` counts every Newton iteration over all reactive limit rounds. `mismatchHistory` belongs to the last Newton run.
- Branch currents in kA use the base voltage of the bus at each end.
- The synthetic ratings of ADR 0006 follow from the solution without reactive limits. IEEE 30 has a generator at its limit in the base case, so the limited solution would give other flows and other ratings.

