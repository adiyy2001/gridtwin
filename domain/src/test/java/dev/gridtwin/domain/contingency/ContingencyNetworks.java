package dev.gridtwin.domain.contingency;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Load;
import dev.gridtwin.domain.model.Network;
import java.util.List;

public final class ContingencyNetworks {

    private ContingencyNetworks() {}

    static Bus bus(int number, BusType type) {
        return new Bus(number, type, 132.0, 0.9, 1.1, 1.0, 0.0);
    }

    static Generator generator(String id, int bus, double activeMw, double maxMw) {
        return new Generator(id, bus, activeMw, 0.0, -300.0, 300.0, 0.0, maxMw, 1.02, true);
    }

    static Branch line(String id, int from, int to, double reactance, double rating) {
        return new Branch(id, from, to, reactance / 5.0, reactance, 0.0, rating, 1.0, 0.0, true);
    }

    public static Network meshWithSpur(double spurLoadMw, double spurGeneratorMaxMw) {
        return new Network(
                "mesh-with-spur",
                100.0,
                List.of(
                        bus(1, BusType.REFERENCE),
                        bus(2, BusType.PV),
                        bus(3, BusType.PQ),
                        bus(4, BusType.PQ),
                        bus(5, BusType.PQ),
                        bus(6, BusType.PV)),
                List.of(
                        new Load(2, 20.0, 5.0),
                        new Load(3, 60.0, 15.0),
                        new Load(4, 50.0, 10.0),
                        new Load(5, spurLoadMw, 5.0)),
                List.of(),
                List.of(
                        generator("G1", 1, 0.0, 300.0),
                        generator("G2", 2, 60.0, 100.0),
                        generator("G6", 6, 0.0, spurGeneratorMaxMw)),
                List.of(
                        line("L1-2", 1, 2, 0.10, 200.0),
                        line("L1-3", 1, 3, 0.12, 200.0),
                        line("L2-3", 2, 3, 0.08, 200.0),
                        line("L2-4", 2, 4, 0.10, 200.0),
                        line("L3-4", 3, 4, 0.09, 200.0),
                        line("L4-5", 4, 5, 0.10, 200.0),
                        line("L5-6", 5, 6, 0.10, 200.0)));
    }

    public static Network parallelPair(double loadMw, double loadMvar, double ratingMva) {
        return new Network(
                "parallel-pair",
                100.0,
                List.of(bus(1, BusType.REFERENCE), bus(2, BusType.PQ)),
                List.of(new Load(2, loadMw, loadMvar)),
                List.of(),
                List.of(generator("G1", 1, 0.0, 2000.0)),
                List.of(line("LA", 1, 2, 0.05, ratingMva), line("LB", 1, 2, 0.05, ratingMva)));
    }
}
