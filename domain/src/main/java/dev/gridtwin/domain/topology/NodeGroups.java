package dev.gridtwin.domain.topology;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

record NodeGroups(List<Group> groups) {

    record Group(String id, List<String> nodes, Optional<Integer> busNumber, boolean earthed) {

        Optional<Integer> connectedBus() {
            return this.earthed ? Optional.empty() : this.busNumber;
        }

        NodeSet toNodeSet(boolean live) {
            return new NodeSet(this.id, this.nodes, this.busNumber, this.earthed, live);
        }
    }

    static NodeGroups of(Substation substation, SwitchPositions positions) {
        List<String> nodeIds = substation.nodes().stream().map(Node::id).toList();
        Map<String, Integer> index = new HashMap<>();
        for (int position = 0; position < nodeIds.size(); position++) {
            index.put(nodeIds.get(position), position);
        }
        UnionFind unionFind = new UnionFind(nodeIds.size());
        Set<Integer> earthedNodes = new HashSet<>();
        for (Switch candidate : substation.switches()) {
            if (!positions.isClosed(candidate.id())) {
                continue;
            }
            if (candidate.isEarthing()) {
                earthedNodes.add(index.get(candidate.nodeA()));
            } else {
                unionFind.union(index.get(candidate.nodeA()), index.get(candidate.nodeB()));
            }
        }
        Set<Integer> earthedRoots = new HashSet<>();
        earthedNodes.forEach(node -> earthedRoots.add(unionFind.find(node)));
        Map<Integer, List<String>> membersByRoot = new LinkedHashMap<>();
        for (int position = 0; position < nodeIds.size(); position++) {
            membersByRoot
                    .computeIfAbsent(unionFind.find(position), root -> new ArrayList<>())
                    .add(nodeIds.get(position));
        }
        List<Group> groups = new ArrayList<>();
        membersByRoot.forEach(
                (root, members) ->
                        groups.add(
                                new Group(
                                        members.get(0),
                                        members,
                                        lowestBusbarBus(substation, members),
                                        earthedRoots.contains(root))));
        return new NodeGroups(groups);
    }

    Group groupOf(String nodeId) {
        return this.groups.stream()
                .filter(group -> group.nodes().contains(nodeId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("unknown node " + nodeId));
    }

    private static Optional<Integer> lowestBusbarBus(Substation substation, List<String> members) {
        return substation.busbars().stream()
                .filter(busbar -> members.contains(busbar.nodeId()))
                .map(Busbar::busNumber)
                .min(Integer::compare);
    }
}
