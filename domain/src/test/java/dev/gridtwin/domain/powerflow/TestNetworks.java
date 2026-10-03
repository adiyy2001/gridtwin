package dev.gridtwin.domain.powerflow;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Load;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.model.Shunt;
import java.util.List;

final class TestNetworks {

    static final double BASE_MVA = 100.0;

    private TestNetworks() {}

    static Bus bus(int number, BusType type) {
        return new Bus(number, type, 132.0, 0.9, 1.1, 1.0, 0.0);
    }

    static Generator generator(String id, int bus, double activeMw, double qMin, double qMax) {
        return new Generator(id, bus, activeMw, 0.0, qMin, qMax, 0.0, 1000.0, 1.0, true);
    }

    static Branch line(String id, int from, int to, double resistance, double reactance) {
        return new Branch(id, from, to, resistance, reactance, 0.0, 200.0, 1.0, 0.0, true);
    }

    static Network twoBus(double loadMw, double loadMvar, double resistance, double reactance) {
        return new Network(
                "two-bus",
                BASE_MVA,
                List.of(bus(1, BusType.REFERENCE), bus(2, BusType.PQ)),
                List.of(new Load(2, loadMw, loadMvar)),
                List.of(),
                List.of(generator("G1", 1, 0.0, -500.0, 500.0)),
                List.of(line("L1-2", 1, 2, resistance, reactance)));
    }

    static Network threeBus(double qMaxOfSecondGenerator) {
        return new Network(
                "three-bus",
                BASE_MVA,
                List.of(bus(1, BusType.REFERENCE), bus(2, BusType.PV), bus(3, BusType.PQ)),
                List.of(new Load(2, 20.0, 10.0), new Load(3, 90.0, 40.0)),
                List.of(new Shunt(3, 0.0, 5.0)),
                List.of(
                        generator("G1", 1, 0.0, -500.0, 500.0),
                        new Generator(
                                "G2",
                                2,
                                60.0,
                                0.0,
                                -30.0,
                                qMaxOfSecondGenerator,
                                0.0,
                                200.0,
                                1.03,
                                true)),
                List.of(
                        line("L1-2", 1, 2, 0.02, 0.06),
                        line("L1-3", 1, 3, 0.03, 0.09),
                        line("L2-3", 2, 3, 0.025, 0.075)));
    }
}
