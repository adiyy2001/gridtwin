package dev.gridtwin.validation.property;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Load;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.model.Shunt;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

public final class RandomNetworks {

    private static final double BASE_MVA = 100.0;

    private RandomNetworks() {}

    public static Network generate(Random random) {
        int busCount = 3 + random.nextInt(6);
        List<Bus> buses = new ArrayList<>();
        List<Generator> generators = new ArrayList<>();
        List<Load> loads = new ArrayList<>();
        List<Shunt> shunts = new ArrayList<>();
        for (int number = 1; number <= busCount; number++) {
            BusType type = busType(random, number);
            buses.add(new Bus(number, type, 132.0, 0.9, 1.1, 1.0, 0.0));
            if (number == 1) {
                generators.add(
                        new Generator("G1", 1, 0.0, 0.0, -999.0, 999.0, 0.0, 999.0, 1.02, true));
            } else if (type == BusType.PV) {
                generators.add(generator(random, number));
            } else {
                loads.add(load(random, number));
            }
            if (random.nextInt(4) == 0) {
                shunts.add(shunt(random, number));
            }
        }
        return new Network(
                "random-" + busCount,
                BASE_MVA,
                buses,
                loads,
                shunts,
                generators,
                branches(random, busCount));
    }

    private static BusType busType(Random random, int number) {
        if (number == 1) {
            return BusType.REFERENCE;
        }
        return random.nextInt(10) < 3 ? BusType.PV : BusType.PQ;
    }

    private static Generator generator(Random random, int bus) {
        double activeMw = 10.0 + 40.0 * random.nextDouble();
        double setpoint = 1.0 + 0.04 * random.nextDouble();
        double qMax = 5.0 + 60.0 * random.nextDouble();
        return new Generator(
                "G" + bus, bus, activeMw, 0.0, -20.0, qMax, 0.0, 200.0, setpoint, true);
    }

    private static Load load(Random random, int bus) {
        double activeMw = 5.0 + 35.0 * random.nextDouble();
        return new Load(bus, activeMw, activeMw * 0.3 * random.nextDouble());
    }

    private static Shunt shunt(Random random, int bus) {
        double conductance = random.nextBoolean() ? 0.0 : 2.0 * random.nextDouble();
        return new Shunt(bus, conductance, -5.0 + 15.0 * random.nextDouble());
    }

    private static List<Branch> branches(Random random, int busCount) {
        List<Branch> branches = new ArrayList<>();
        Set<String> used = new HashSet<>();
        for (int bus = 2; bus <= busCount; bus++) {
            int other = 1 + random.nextInt(bus - 1);
            branches.add(branch(random, other, bus));
            used.add(other + "-" + bus);
        }
        int extra = 1 + random.nextInt(busCount);
        for (int attempt = 0; attempt < extra; attempt++) {
            int first = 1 + random.nextInt(busCount);
            int second = 1 + random.nextInt(busCount);
            int low = Math.min(first, second);
            int high = Math.max(first, second);
            if (low != high && used.add(low + "-" + high)) {
                branches.add(branch(random, low, high));
            }
        }
        return branches;
    }

    private static Branch branch(Random random, int from, int to) {
        double reactance = 0.05 + 0.2 * random.nextDouble();
        double resistance = reactance * (0.05 + 0.3 * random.nextDouble());
        double charging = random.nextBoolean() ? 0.0 : 0.06 * random.nextDouble();
        double tap = random.nextInt(10) < 3 ? 0.95 + 0.1 * random.nextDouble() : 1.0;
        double shift = random.nextInt(10) < 2 ? -5.0 + 10.0 * random.nextDouble() : 0.0;
        return new Branch(
                "L" + from + "-" + to,
                from,
                to,
                resistance,
                reactance,
                charging,
                500.0,
                tap,
                shift,
                true);
    }
}
