# 0005 Topology processor rules

Status: accepted

## Context

Bus 4 of IEEE 14 is replaced by a node-breaker substation. A topology processor has to turn switch states into the bus-branch model the power flow understands. The rules for what counts as energized, which generator takes the slack role and what a half-open branch means are not in the brief, so they are written down here before any code exists.

## Decision

Merging. Nodes joined by a closed breaker or a closed disconnector are merged with union-find into electrical buses. A closed earthing switch marks its node set as earthed and does not merge anything.

Branch ends. In the substation, a branch end is connected when its node set contains a busbar node. Ends on ordinary buses are always connected. A branch is in service when its own status is on and both ends are connected. A line that is open at one end is treated as out of service, so the charging current at the other end is ignored. The UI shows such a line as de-energized.

Islands. An island is a connected group of electrical buses linked by in-service branches. An island is energized when it contains at least one in-service generator with a positive Pmax on a bus that is not earthed. Every other island is de-energized: voltages are zero, flows are zero and its loads count as shed.

Slack. In an energized island, the generator of the case's original reference bus is the slack if it is in the island and in service. Otherwise the slack is the in-service generator with the largest Pmax, and the lowest bus number breaks ties. The island's reference angle is the angle that bus has in the case data.

Interlocks. A switching command is refused with a machine-readable reason and a message the UI shows.

- A disconnector operates only while its bay breaker is open.
- An earthing switch closes only when its node set is de-energized.
- A closing operation is refused when it would join an earthed node set to an energized one.
- Breakers always open. Earthing switches always open.

## Alternatives

Keeping the charging current of an open-ended line is physically right. It also needs a branch model with one end open, which the solver otherwise has no use for, and the brief asks for the line to show as de-energized.

Distributed slack, or choosing the slack by a user setting, adds options the educational model does not need.

## Consequences

Two islands that each contain a generator both energize, and each picks its own slack. An island that lost its only generator goes dark even when its loads are large. This is the behaviour the cascade replay relies on.
