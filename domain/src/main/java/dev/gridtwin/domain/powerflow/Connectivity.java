package dev.gridtwin.domain.powerflow;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.Bus;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Network;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class Connectivity {

    private Connectivity() {}

    static List<Integer> reachableFromReference(Network network) {
        Set<Integer> isolated = new HashSet<>();
        network.buses().stream()
                .filter(bus -> bus.type() == BusType.ISOLATED)
                .forEach(bus -> isolated.add(bus.number()));
        Map<Integer, List<Integer>> neighbours = new HashMap<>();
        network.branches().stream()
                .filter(Branch::inService)
                .forEach(
                        branch -> {
                            neighbours
                                    .computeIfAbsent(branch.from(), key -> new ArrayList<>())
                                    .add(branch.to());
                            neighbours
                                    .computeIfAbsent(branch.to(), key -> new ArrayList<>())
                                    .add(branch.from());
                        });
        int reference = network.referenceBus().number();
        Set<Integer> visited = new HashSet<>();
        Deque<Integer> queue = new ArrayDeque<>();
        if (!isolated.contains(reference)) {
            visited.add(reference);
            queue.add(reference);
        }
        while (!queue.isEmpty()) {
            int current = queue.poll();
            for (int next : neighbours.getOrDefault(current, List.of())) {
                if (!isolated.contains(next) && visited.add(next)) {
                    queue.add(next);
                }
            }
        }
        return network.buses().stream()
                .map(Bus::number)
                .filter(visited::contains)
                .sorted()
                .toList();
    }
}
