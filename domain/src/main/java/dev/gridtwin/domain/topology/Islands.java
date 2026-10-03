package dev.gridtwin.domain.topology;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Network;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;

final class Islands {

    private static final Comparator<Generator> SLACK_ORDER =
            Comparator.comparingDouble(Generator::activeMaxMw)
                    .reversed()
                    .thenComparingInt(Generator::bus)
                    .thenComparing(Generator::id);

    private Islands() {}

    static List<Island> detect(Network network) {
        List<Integer> numbers = network.buses().stream().map(Bus::number).sorted().toList();
        Map<Integer, Integer> index = new HashMap<>();
        for (int position = 0; position < numbers.size(); position++) {
            index.put(numbers.get(position), position);
        }
        UnionFind unionFind = new UnionFind(numbers.size());
        network.branches().stream()
                .filter(Branch::inService)
                .forEach(
                        branch ->
                                unionFind.union(index.get(branch.from()), index.get(branch.to())));
        Map<Integer, List<Integer>> byRoot = new TreeMap<>();
        for (int position = 0; position < numbers.size(); position++) {
            byRoot.computeIfAbsent(unionFind.find(position), root -> new ArrayList<>())
                    .add(numbers.get(position));
        }
        List<List<Integer>> members = new ArrayList<>(byRoot.values());
        members.sort((first, second) -> Integer.compare(first.get(0), second.get(0)));
        List<Island> islands = new ArrayList<>();
        for (int position = 0; position < members.size(); position++) {
            islands.add(build(network, "I" + (position + 1), members.get(position)));
        }
        return islands;
    }

    private static Island build(Network network, String id, List<Integer> buses) {
        Set<Integer> inside = new HashSet<>(buses);
        List<Generator> eligible =
                network.generators().stream()
                        .filter(generator -> inside.contains(generator.bus()))
                        .filter(Generator::canTakeSlack)
                        .toList();
        Optional<Generator> slack = pickSlack(network, eligible);
        if (slack.isEmpty()) {
            return new Island(id, buses, Optional.empty(), Optional.empty());
        }
        Slack chosen = new Slack(slack.get().bus(), slack.get().id());
        return new Island(
                id,
                buses,
                Optional.of(chosen),
                Optional.of(subNetwork(network, id, inside, chosen)));
    }

    private static Optional<Generator> pickSlack(Network network, List<Generator> eligible) {
        int reference = network.referenceBus().number();
        Optional<Generator> original =
                eligible.stream().filter(generator -> generator.bus() == reference).findFirst();
        return original.or(() -> eligible.stream().min(SLACK_ORDER));
    }

    private static Network subNetwork(
            Network network, String id, Set<Integer> inside, Slack slack) {
        Set<Integer> generatorBuses = new HashSet<>();
        network.generators().stream()
                .filter(Generator::inService)
                .forEach(generator -> generatorBuses.add(generator.bus()));
        List<Bus> buses =
                network.buses().stream()
                        .filter(bus -> inside.contains(bus.number()))
                        .map(bus -> bus.withType(typeOf(bus, slack, generatorBuses)))
                        .toList();
        return new Network(
                network.id() + "/" + id,
                network.baseMva(),
                buses,
                network.loads().stream().filter(load -> inside.contains(load.bus())).toList(),
                network.shunts().stream().filter(shunt -> inside.contains(shunt.bus())).toList(),
                network.generators().stream()
                        .filter(generator -> inside.contains(generator.bus()))
                        .toList(),
                network.branches().stream()
                        .filter(Branch::inService)
                        .filter(branch -> inside.contains(branch.from()))
                        .toList());
    }

    private static BusType typeOf(Bus bus, Slack slack, Set<Integer> generatorBuses) {
        if (bus.number() == slack.bus()) {
            return BusType.REFERENCE;
        }
        return generatorBuses.contains(bus.number()) ? BusType.PV : BusType.PQ;
    }
}
