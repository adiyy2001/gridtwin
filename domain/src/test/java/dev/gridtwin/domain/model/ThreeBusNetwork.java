package dev.gridtwin.domain.model;

import java.util.List;

final class ThreeBusNetwork {

    private ThreeBusNetwork() {}

    static Network create() {
        return new Network(
                "three-bus",
                100.0,
                buses(),
                List.of(new Load(2, 90.0, 30.0), new Load(3, 60.0, 20.0)),
                List.of(new Shunt(3, 0.0, 5.0)),
                List.of(generator("G1", 1)),
                List.of(branch("L1-2", 1, 2), branch("L1-3", 1, 3), branch("L2-3", 2, 3)));
    }

    static List<Bus> buses() {
        return List.of(
                new Bus(1, BusType.REFERENCE, 132.0, 0.95, 1.05, 1.02, 0.0),
                new Bus(2, BusType.PQ, 132.0, 0.95, 1.05, 1.0, 0.0),
                new Bus(3, BusType.PQ, 132.0, 0.95, 1.05, 1.0, 0.0));
    }

    static Generator generator(String id, int bus) {
        return new Generator(id, bus, 150.0, 0.0, -50.0, 80.0, 0.0, 300.0, 1.02, true);
    }

    static Branch branch(String id, int from, int to) {
        return new Branch(id, from, to, 0.02, 0.06, 0.0, 100.0, 1.0, 0.0, true);
    }

    static Network with(List<Bus> buses, List<Generator> generators, List<Branch> branches) {
        return new Network("variant", 100.0, buses, List.of(), List.of(), generators, branches);
    }
}
