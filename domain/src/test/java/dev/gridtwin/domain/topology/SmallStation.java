package dev.gridtwin.domain.topology;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Load;
import dev.gridtwin.domain.model.Network;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class SmallStation {

    public static final int STATION_BUS = 2;
    public static final int SECOND_BUSBAR_BUS = 20;
    public static final String COUPLER_BREAKER = "CPL.QA1";

    private SmallStation() {}

    public record BaySpec(String id, TerminalKind kind, String equipment, int busbar) {}

    public static List<BaySpec> baySpecs() {
        return List.of(
                new BaySpec("LA", TerminalKind.BRANCH, "L1-2", 1),
                new BaySpec("LB", TerminalKind.BRANCH, "L2-3", 1),
                new BaySpec("LC", TerminalKind.BRANCH, "L2-4", 2),
                new BaySpec("GS", TerminalKind.GENERATOR, "GS", 2),
                new BaySpec("LD", TerminalKind.LOAD, "", 2));
    }

    public static Network network() {
        return new Network(
                "small-station",
                100.0,
                List.of(
                        bus(1, BusType.REFERENCE),
                        bus(STATION_BUS, BusType.PQ),
                        bus(3, BusType.PQ),
                        bus(4, BusType.PV),
                        bus(5, BusType.PQ)),
                List.of(
                        new Load(STATION_BUS, 20.0, 5.0),
                        new Load(3, 30.0, 10.0),
                        new Load(5, 10.0, 2.0)),
                List.of(),
                List.of(
                        new Generator("G1", 1, 0.0, 0.0, -500.0, 500.0, 0.0, 500.0, 1.02, true),
                        new Generator("G4", 4, 20.0, 0.0, -50.0, 50.0, 0.0, 100.0, 1.02, true),
                        new Generator(
                                "GS", STATION_BUS, 20.0, 0.0, -30.0, 30.0, 0.0, 80.0, 1.01, true)),
                List.of(
                        line("L1-2", 1, STATION_BUS),
                        line("L2-3", STATION_BUS, 3),
                        line("L2-4", STATION_BUS, 4),
                        line("L3-5", 3, 5)));
    }

    public static Substation substation() {
        return substation(baySpecs());
    }

    public static Substation substation(List<BaySpec> specs) {
        List<Node> nodes = new ArrayList<>(List.of(new Node("BB1"), new Node("BB2")));
        List<Bay> bays = new ArrayList<>();
        List<Switch> switches = new ArrayList<>();
        int column = 0;
        for (BaySpec spec : specs) {
            for (String suffix : List.of("A", "B", "T")) {
                nodes.add(new Node(spec.id() + "." + suffix));
            }
            bays.add(
                    new Bay(
                            spec.id(),
                            spec.id(),
                            BayKind.FEEDER,
                            column++,
                            Optional.of(
                                    new Terminal(
                                            spec.id() + ".T", spec.kind(), spec.equipment()))));
            switches.add(
                    disconnector(
                            spec.id() + ".QB1",
                            spec.id(),
                            "BB1",
                            spec.id() + ".A",
                            spec.busbar() == 1));
            switches.add(
                    disconnector(
                            spec.id() + ".QB2",
                            spec.id(),
                            "BB2",
                            spec.id() + ".A",
                            spec.busbar() == 2));
            switches.add(
                    new Switch(
                            spec.id() + ".QA1",
                            SwitchKind.BREAKER,
                            spec.id(),
                            spec.id() + ".A",
                            spec.id() + ".B",
                            Position.CLOSED));
            switches.add(
                    disconnector(
                            spec.id() + ".QB9",
                            spec.id(),
                            spec.id() + ".B",
                            spec.id() + ".T",
                            true));
            switches.add(earthing(spec.id() + ".QE1", spec.id(), spec.id() + ".T"));
        }
        nodes.add(new Node("CPL.A"));
        nodes.add(new Node("CPL.B"));
        bays.add(new Bay("CPL", "Coupler", BayKind.COUPLER, column, Optional.empty()));
        switches.add(disconnector("CPL.QB1", "CPL", "BB1", "CPL.A", true));
        switches.add(
                new Switch(
                        COUPLER_BREAKER,
                        SwitchKind.BREAKER,
                        "CPL",
                        "CPL.A",
                        "CPL.B",
                        Position.CLOSED));
        switches.add(disconnector("CPL.QB2", "CPL", "CPL.B", "BB2", true));
        switches.add(earthing("CPL.QE1", "CPL", "CPL.A"));
        switches.add(earthing("CPL.QE2", "CPL", "CPL.B"));
        return new Substation(
                "small",
                "Small station",
                STATION_BUS,
                132.0,
                List.of(
                        new Busbar("BB1", STATION_BUS, "Busbar 1", 0),
                        new Busbar("BB2", SECOND_BUSBAR_BUS, "Busbar 2", 1)),
                nodes,
                bays,
                switches);
    }

    private static Switch disconnector(
            String id, String bay, String nodeA, String nodeB, boolean closed) {
        return new Switch(
                id,
                SwitchKind.DISCONNECTOR,
                bay,
                nodeA,
                nodeB,
                closed ? Position.CLOSED : Position.OPEN);
    }

    private static Switch earthing(String id, String bay, String node) {
        return new Switch(id, SwitchKind.EARTHING_SWITCH, bay, node, Switch.EARTH, Position.OPEN);
    }

    private static Bus bus(int number, BusType type) {
        return new Bus(number, type, 132.0, 0.9, 1.1, 1.0, 0.0);
    }

    private static Branch line(String id, int from, int to) {
        return new Branch(id, from, to, 0.01, 0.05, 0.0, 200.0, 1.0, 0.0, true);
    }
}
