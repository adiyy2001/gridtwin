# 0027 Stretch goals were not built

Status: accepted

## Context

I had three stretch goals: a fast decoupled power flow with a speed and accuracy comparison, IEEE 30 as a second selectable network with its own substation, and weighted least squares state estimation. When the scope grew, stretch goals were cut, and tests and correctness never were.

## Decision

None of the three is built. The time went to the validation against MATPOWER (every solution at four load factors, with and without reactive limits, and every N-1 outage), to the interlocks and the islanding rules, to the keyboard operation of the diagram and to a 3D scene that the end-to-end tests can inspect. Those are the parts a reviewer can check against a reference.

IEEE 30 is already in the repository as a solved and validated network. The solver, the contingency analysis and the benchmarks run on it. What is missing is a substation for it and a case selector in the UI, so the web application only offers IEEE 14.

## Alternatives

A fast decoupled power flow reuses the existing admittance matrix, and the comparison would be an honest benchmark. It would also have added a second solver to validate. The existing solver is already fast enough for IEEE 30 (the README quotes the measured time), so there is no speed problem for it to fix.

## Consequences

The README lists the three goals under what comes next. The API addresses cases by id and the substation is data, so a second substation is a new JSON file and a selector in the UI.
