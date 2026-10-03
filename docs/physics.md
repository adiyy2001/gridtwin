# Physics and numerics

This is the model behind gridtwin: what is solved, with which equations, and which simplifications the solver makes. It is a steady-state, balanced, positive-sequence model of a small transmission network. It is an educational model. It does not describe any real grid.

The code that implements each section is named in brackets. The decisions behind the choices are in the [ADRs](adr/README.md).

## 1. Per-unit system

All power flow quantities are per unit on the system base of the case data, 100 MVA for both IEEE cases. Voltage magnitudes are per unit of the bus base voltage. Reports convert back to MW, MVAr, kV and kA at the edge (`ResultAssembler`).

The current of a branch end in kA is

$$I_{kA} = \frac{|I_{pu}| \, S_{base}}{\sqrt{3} \, V_{base,kV}}$$

with the base voltage of the bus at that end, so a transformer reports different currents on its two sides.

The IEEE 14 case has no base voltages in its data. The repository assigns 132 kV to buses 1 to 5 and 33 kV to buses 6 to 14, which follows the three transformers. These levels only label the UI and scale the kA values. They do not change the power flow (ADR 0006).

## 2. Branch model and the admittance matrix

Every line and transformer is a pi circuit with an ideal transformer on the from side. With series impedance $r + jx$, total line charging susceptance $b_c$, tap ratio $\tau$ and phase shift $\varphi$:

$$y_s = \frac{1}{r + jx}, \qquad t = \tau \, e^{j\varphi}$$

$$Y_{ff} = \frac{y_s + j b_c / 2}{\tau^2}, \quad Y_{ft} = -\frac{y_s}{\overline{t}}, \quad Y_{tf} = -\frac{y_s}{t}, \quad Y_{tt} = y_s + j \frac{b_c}{2}$$

A plain line has $\tau = 1$ and $\varphi = 0$. This is the convention MATPOWER uses, which is why the results can be compared with it number by number (`BranchAdmittances`).

The bus admittance matrix $Y_{bus}$ collects the four terms of every in-service branch and adds the constant-admittance shunts on the diagonal. It is stored row by row with only the non-zero entries (`Ybus`). A unit test checks it against a hand-computed 3-bus example.

## 3. Power flow equations

With $G + jB = Y_{bus}$ and $\theta_{ik} = \theta_i - \theta_k$, the power injected into bus $i$ is

$$P_i = V_i \sum_k V_k \left( G_{ik} \cos\theta_{ik} + B_{ik} \sin\theta_{ik} \right)$$

$$Q_i = V_i \sum_k V_k \left( G_{ik} \sin\theta_{ik} - B_{ik} \cos\theta_{ik} \right)$$

The specified injection of a bus is generation minus load. Loads are constant power. The reference (slack) bus fixes the angle at the angle in the case data and its voltage magnitude. A PV bus fixes the magnitude and the active generation. A PQ bus fixes both powers.

The unknowns are the angles of all non-slack buses and the magnitudes of the PQ buses. IEEE 14 has 13 angles and 9 magnitudes (22 unknowns). IEEE 30 has 29 angles and 24 magnitudes (53 unknowns).

## 4. Newton-Raphson

The mismatch vector is the specified minus the calculated injection:

$$\Delta F = \begin{bmatrix} P^{sp} - P(V,\theta) \\ Q^{sp} - Q(V,\theta) \end{bmatrix}$$

Each iteration solves

$$J \, \Delta x = \Delta F, \qquad x \leftarrow x + \Delta x, \qquad J = \begin{bmatrix} \partial P / \partial \theta & \partial P / \partial V \\ \partial Q / \partial \theta & \partial Q / \partial V \end{bmatrix}$$

The Jacobian is analytic and only has an entry where $Y_{bus}$ has one. For $i \ne k$:

$$\frac{\partial P_i}{\partial \theta_k} = V_i V_k \left( G_{ik} \sin\theta_{ik} - B_{ik} \cos\theta_{ik} \right), \qquad \frac{\partial P_i}{\partial V_k} = V_i \left( G_{ik} \cos\theta_{ik} + B_{ik} \sin\theta_{ik} \right)$$

$$\frac{\partial Q_i}{\partial \theta_k} = -V_i V_k \left( G_{ik} \cos\theta_{ik} + B_{ik} \sin\theta_{ik} \right), \qquad \frac{\partial Q_i}{\partial V_k} = V_i \left( G_{ik} \sin\theta_{ik} - B_{ik} \cos\theta_{ik} \right)$$

and on the diagonal:

$$\frac{\partial P_i}{\partial \theta_i} = -Q_i - B_{ii} V_i^2, \qquad \frac{\partial P_i}{\partial V_i} = \frac{P_i}{V_i} + G_{ii} V_i$$

$$\frac{\partial Q_i}{\partial \theta_i} = P_i - G_{ii} V_i^2, \qquad \frac{\partial Q_i}{\partial V_i} = \frac{Q_i}{V_i} - B_{ii} V_i$$

A test compares every entry with a central finite difference of the injection equations (`Jacobian`, `JacobianFiniteDifferenceTest`).

The linear system is solved with the sparse LU of EJML behind the `SparseLinearSolver` port. EJML has no fill-reducing ordering, which is fine at 22 and 53 unknowns and would not be for a network with thousands of buses (ADR 0003).

Convergence and limits (ADR 0004):

- The solver stops when the largest absolute mismatch is at most $10^{-8}$ pu, or after 20 iterations. The mismatch after every iteration, starting with iteration 0, is part of the result.
- The twin that the UI drives iterates to $10^{-10}$ pu. At $10^{-8}$ an open and close roundtrip of a breaker differed from the original state by up to $1.04 \times 10^{-9}$ in one of 3000 random sequences, because Newton stops at the first iterate under the tolerance. The roundtrip property needs the tighter value.
- A flat start sets every magnitude to 1 pu (the setpoint at PV buses) and every angle to 0. A warm start takes the previous solution. A warm start that fails, or that ends below 0.5 pu at some bus, is repeated from a flat start. The second root of the equations near 0.4 pu is a real solution of the algebra and not an operating point, and a property test found the warm start landing on it.
- More than 20 iterations, a non-finite value, a voltage magnitude at or below zero or a singular Jacobian count as voltage collapse. The island is reported as collapsed with its mismatch history. The caller gets a result and not an exception.

## 5. Reactive limits

After a converged run, every in-service PV bus whose generators are outside their combined reactive range becomes a PQ bus fixed at the violated limit, all violators at once. The solve restarts from the current solution. The loop ends when nothing violates. A converted bus does not convert back. This is the behaviour of MATPOWER with `pf.enforce_q_lims = 1`.

The slack generator keeps its limits unenforced. Converting it would make another bus the angle reference and shift every angle. A slack output outside its active power range produces a warning, since real power limits are not enforced.

## 6. Results derived from the solution

With the complex voltages $V_f$ and $V_t$ at the ends of a branch:

$$S_f = V_f \, \overline{(Y_{ff} V_f + Y_{ft} V_t)}, \qquad S_t = V_t \, \overline{(Y_{tf} V_f + Y_{tt} V_t)}$$

- The loss of a branch is $S_f + S_t$. Summed over the network, generation equals load plus branch losses plus the power the shunt conductances consume: $\sum P_{gen} = \sum P_{load} + P_{loss} + P_{shunt}$. The property tests check this balance to $10^{-6}$ pu on random networks.
- Loading is the larger of $|S_f|$ and $|S_t|$ divided by the rating in MVA.
- The slack output is the generation the reference bus needs to close the balance.

### Ratings

Neither IEEE case carries thermal ratings. The repository assigns a synthetic rating to every branch from the base case at 100% load without reactive limits:

$$\text{rating} = \max\left( 5 \left\lceil \frac{1.25 \, S_{peak}}{5} \right\rceil, \; 20 \right) \text{ MVA}$$

where $S_{peak}$ is the larger apparent power at the two ends. The floor exists because many branches carry less than 10 MVA and would turn into violations after any disturbance. The ratings are committed in the case files and a test checks that the policy reproduces them (ADR 0006).

## 7. Load factor

The slider scales all active and reactive loads by one factor between 0.5 and 1.5. Generators keep their setpoints and the slack absorbs the difference. With reactive limits enforced, MATPOWER converges IEEE 14 up to a factor of 1.6 and diverges at 1.8. It converges IEEE 30 at 1.5 with a lowest voltage of 0.707 pu and diverges at 1.6. The slider range of 0.5 to 1.5 stays inside the range where both references converge.

## 8. Node-breaker topology

Bus 4 of IEEE 14 is replaced by a fictional double busbar substation. Its data (22 nodes, 35 switches, six feeder bays and a bus coupler) is in `cases/src/main/resources/cases/ieee14.substation.json`. Nothing in it describes a real installation.

Busbars BB1 and BB2 carry bus numbers 4 and 40. Six feeder bays (three lines, two transformers and the load) each have a breaker, a disconnector to each busbar, a disconnector towards the equipment and an earthing switch. A bus coupler bay joins the busbars.

The topology processor turns switch positions into the bus-branch model of section 3 (ADR 0005):

1. Nodes joined by a closed breaker or disconnector merge into one electrical bus. The merge is a union-find with union by size and path compression (Tarjan 1975). A closed earthing switch marks its node set as earthed and merges nothing.
2. A node set takes the lowest bus number of the busbars it contains. With the coupler closed the substation is bus 4. With it open there are two buses, 4 and 40.
3. A branch end is connected when its node set contains a busbar. A branch with a disconnected end is out of service, and the charging current of the connected end is ignored. The UI shows such a line as de-energized.
4. Buses linked by in-service branches form islands. An island is energized when it holds at least one in-service generator with a positive maximum output on a bus that is not earthed. Every other island is de-energized: voltages and flows are zero and its loads count as shed.
5. Each energized island has one slack. It is the generator of the case's original reference bus when that generator is in the island and in service, and otherwise the in-service generator with the largest maximum output, with the lowest bus number breaking a tie.
6. Each energized island is solved on its own with section 4. A collapsed island reports its own collapse and the others are solved normally.

### Interlocks

A switching command is refused with a reason that the UI shows.

| Rule | Reason code |
| --- | --- |
| A disconnector operates only while its bay breaker is open. | `BREAKER_CLOSED` |
| An earthing switch closes only on a de-energized node set. | `SECTION_ENERGIZED` |
| A closing operation must not join an earthed node set to a live one. | `EARTHED_SECTION_WOULD_BE_ENERGIZED` |

A node set counts as live when it is part of an energized island, or when it holds the terminal of an in-service generator, or of a branch that is still fed from its far end. Because of the last case, earthing a line that is only open at the breaker is refused while the other end keeps it energized. Breakers and earthing switches always open. Two energized islands can be joined without a synchronism check, since dynamics are out of scope.

## 9. Contingency analysis

N-1 removes one branch or one generator at a time and solves the network again, warm-started from the base case. Equipment that is already out of service gets no outage. IEEE 14 has 20 branches and 5 generators and IEEE 30 has 41 branches and 6 generators (ADR 0009).

Each outage is classified into a tier and gets a score (ADR 0017). Results rank by tier, then by score, then by outage id, so the order is identical on every run.

| Tier | Meaning |
| --- | --- |
| `NON_CONVERGED` | at least one island of the post-outage network collapsed |
| `BLACKOUT` | nothing is energized or no load is served |
| `DEGRADED` | a violation, shed load or a slack above its limit |
| `SECURE` | nothing to report |

Violations are a branch above 100% of its rating, a bus voltage outside 0.9 to 1.1 pu, a slack above its maximum output, load that is not served and a collapsed island. The score is

$$\text{score} = \sum_{\text{branches}} (\ell - 1)^2 \; + \sum_{\text{buses}} \left( \frac{\delta}{0.1} \right)^2 \; + \; 10 \, \frac{P_{shed}}{P_{load}} \; + \sum_{\text{islands}} \left( \frac{P_{slack} - P_{max}}{P_{max}} \right)^2$$

with $\ell$ the loading of an overloaded branch and $\delta$ the voltage excursion beyond the band in pu. The score has no unit. It only orders outages inside a tier. The weight 10 on shed load is a judgement call: losing 10% of the load counts as much as one line at 200% of its rating.

The outages are independent CPU-bound tasks, so they run on a dedicated `ForkJoinPool` with one worker per core. Virtual threads would not help, since a computing virtual thread occupies its carrier thread like a platform thread does. A property test checks that the parallel report equals the sequential one.

## 10. Cascade

The cascade is an educational simplification (ADR 0018). It starts from an initial outage and repeats:

1. Solve the network.
2. If some branch is above the trip threshold (120% of its rating by default), trip the single worst one. A tie goes to the lower branch id.
3. Rebuild the islands with the rules of section 8 and go back to 1.

It ends as `STABLE` when no branch is above the threshold, as `BLACKOUT` when no load is served, as `NON_CONVERGED` when an island collapses, or as `STEP_LIMIT` after 50 steps. Every step stores its full solution, so the front end replays a cascade without solving anything.

Not modelled: protection delays and the order in which relays operate, frequency and voltage dynamics, generator trips, load shedding schemes, reconnection and thermal time constants. A branch trips the instant it passes the threshold. The result shows the order in which a purely static overload would spread. It does not predict how a real grid behaves.

## Sources

- W. F. Tinney and C. E. Hart, "Power flow solution by Newton's method", IEEE Transactions on Power Apparatus and Systems, vol. PAS-86, no. 11, pp. 1449-1460, 1967. The polar Newton-Raphson formulation.
- J. J. Grainger and W. D. Stevenson, Power System Analysis, McGraw-Hill, 1994. Bus admittance matrix, power flow equations and per-unit quantities.
- A. J. Wood, B. F. Wollenberg and G. B. Sheble, Power Generation, Operation, and Control, 3rd edition, Wiley, 2013. Branch flows, losses and contingency analysis.
- R. D. Zimmerman, C. E. Murillo-Sanchez and R. J. Thomas, "MATPOWER: steady-state operations, planning, and analysis tools for power systems research and education", IEEE Transactions on Power Systems, vol. 26, no. 1, pp. 12-19, 2011. The branch model convention, the reactive limit handling and the reference solutions.
- The University of Washington Power Systems Test Case Archive, the origin of the IEEE 14 and IEEE 30 bus data in the IEEE Common Data Format, as converted by MATPOWER 8.1.
- G. C. Ejebe and B. F. Wollenberg, "Automatic contingency selection", IEEE Transactions on Power Apparatus and Systems, vol. PAS-98, no. 1, pp. 97-109, 1979. Ranking outages with performance indices.
- R. E. Tarjan, "Efficiency of a good but not linear set union algorithm", Journal of the ACM, vol. 22, no. 2, pp. 215-225, 1975. Union-find.
- I. Dobson, B. A. Carreras, V. E. Lynch and D. E. Newman, "Complex systems analysis of series of blackouts: cascading failure, critical points, and self-organization", Chaos, vol. 17, 026103, 2007. Background on cascading outages.
