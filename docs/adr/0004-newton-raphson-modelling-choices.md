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
