# 0017 Severity index and contingency ranking

Status: accepted

## Context

N-1 analysis produces one solved snapshot per outage. The table in the UI has to put the outages in an order a person trusts: a collapse before an overload, an overload before a mild voltage dip, and the same order on every run. The requirement is a documented severity index. No standard index is given, and the classic overload performance index (a sum of powers of the loading ratio) says nothing about voltage, shed load or a collapsed solution.

## Decision

Every contingency result gets a tier and a score. Results are ranked by tier (worst first), then by score (largest first), then by outage id (alphabetical). The last rule is only a tie breaker, so a ranking is the same on every run and on every machine.

Tiers, from worst to best:

1. `NON_CONVERGED`: at least one island of the post-outage network did not converge. Its results are not used for any other term.
2. `BLACKOUT`: no island is energized, or no load is served.
3. `DEGRADED`: at least one violation, shed load or a slack above its limit.
4. `SECURE`: nothing to report.

Violations that are listed per outage: a branch loading above 100% of its rating, a bus voltage outside 0.9 to 1.1 pu, an island whose slack generator produces more than its Pmax, load that is not served, and an island that collapsed. Only energized buses and branches of converged islands are examined.

The score is the weighted sum of four terms, with the weights in `SeverityWeights.standard()`:

| Term | Formula | Weight |
| --- | --- | --- |
| Overload | sum over overloaded branches of (loading minus 1.0) squared | 1 |
| Voltage | sum over buses outside the band of (excursion divided by 0.1 pu) squared | 1 |
| Shed load | shed MW divided by total load MW | 10 |
| Slack | sum over islands of ((slack P minus Pmax) divided by Pmax) squared | 1 |

The units make the terms comparable. A branch at 130% of its rating adds 0.09. A bus at 0.85 pu adds 0.25. Shedding 5% of the load adds 0.5. The shed weight is the one judgement call: it says that losing 10% of the load is as bad as one line at 200%. The weights are a record, so a caller can pass others, and the tier order does not depend on them.

The base case is assessed with the same rules and returned next to the ranked list, so the UI can show an outage that adds nothing to a violation that already exists (the demo scenario has the line 2-4 above 100% with the coupler open).

## Alternatives

The overload performance index sum of (S divided by Smax) to the power 2n punishes loaded but not overloaded lines, and it needs a separate voltage index to be useful. A single score without tiers makes the collapse rank depend on weights, and a collapsed solution has no meaningful flows. Ranking by the number of violations treats a 101% line like a 200% line.

## Consequences

A collapse always ranks above a blackout, even when a blackout would hurt more in practice. Both sit at the top of the table, which is the part a reader needs. The score has no unit and is only meant for ordering. Changing a weight changes the order inside the `DEGRADED` tier and nothing else.

The IEEE 14 base case ranks the outage of the line 1-2 first because the case does not converge with it when reactive limits are enforced, and MATPOWER diverges on the same case (see ADR 0007).
