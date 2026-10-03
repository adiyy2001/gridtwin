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

## Implementation notes from milestone 3

The rules above are implemented in `dev.gridtwin.domain.topology` (processor, interlocks) and `dev.gridtwin.domain.twin` (state, per-island solver). The fictional substation is data, in `cases/src/main/resources/cases/ieee14.substation.json`: 22 nodes, 35 switches, six feeder bays and the coupler.

Things the first version of this record left open:

- Electrical bus numbers. Every busbar carries a bus number (4 and 40 for the two busbars of the IEEE 14 substation). A node set takes the lowest number of the busbars it contains, so a closed coupler leaves one bus 4 and no bus 40. The lowest busbar number must equal the case bus the substation replaces, which is why bus 4 always exists. The substation must not sit on the reference bus.
- Terminals. A bay has one equipment terminal: a branch end, the load of the bus (all loads at the bus move together) or a generator. A terminal is connected when its node set contains a busbar and is not earthed. A branch with a disconnected end is out of service and is reported against the substation's own bus number. A disconnected load is not part of any island. It is listed in `Topology.disconnectedLoads` and counted as shed. A disconnected generator is taken out of service.
- Earthed sets. A node set with a closed earthing switch is earthed. When it contains a busbar, that bus exists but forms its own de-energized island and none of its terminals are connected.
- Live sections. An energized island makes every node set connected to it live. A set without a busbar is also live when it holds the terminal of a branch whose own status is on and whose far end is in an energized island, or the terminal of a generator that is in service with a positive Pmax. This is what refuses an earthing switch on a line that is open at the breaker but still fed from the other end.
- Interlocks. The disconnector rule applies to opening and to closing, and the coupler bay follows its own breaker. Closing a breaker or a disconnector is refused when one side is earthed and the other is live, in either order. Closing a switch whose two ends are already in one node set is accepted. Operating a switch that already has the requested position is accepted without a change. Two energized islands can be joined without a synchronism check, which is out of scope. Refusals are a sealed interface with the codes `UNKNOWN_SWITCH`, `BREAKER_CLOSED`, `SECTION_ENERGIZED` and `EARTHED_SECTION_WOULD_BE_ENERGIZED`, each with a readable message.
- Islands. Islands are numbered `I1`, `I2` and so on by their lowest bus. Each energized island gets its own `Network` with exactly one reference bus (the slack), PV buses where an in-service generator sits, and PQ buses elsewhere. `PowerFlow` solves each one, with the warm start of the previous solution (keyed by bus number, so merged and split buses are fine). A collapsed island reports its own collapse and sheds its load. The others are solved as usual.
- Solver tolerance. `TwinSolver.standard()` iterates to a mismatch of 1e-10 pu instead of the 1e-8 of the brief. The reason is the open and close property: with 1e-8 a roundtrip differed by up to 1.04e-9 in one of 3000 random sequences, because Newton stops at the first iterate below the tolerance and the state error is about the mismatch divided by the Jacobian. At 1e-10 the roundtrip agrees to 1e-9 in 9000 random sequences. The 1e-8 limit stays the default of `PowerFlow` and is what the MATPOWER validation uses.
- Load factor. `TwinState` accepts 0.5 to 1.5, the range of the slider.
