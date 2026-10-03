package dev.gridtwin.domain.topology;

import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Network;
import java.util.Collections;
import java.util.SortedSet;
import java.util.TreeSet;

public record Outages(SortedSet<String> branchIds, SortedSet<String> generatorIds) {

    public Outages {
        branchIds = Collections.unmodifiableSortedSet(new TreeSet<>(branchIds));
        generatorIds = Collections.unmodifiableSortedSet(new TreeSet<>(generatorIds));
    }

    public static Outages none() {
        return new Outages(new TreeSet<>(), new TreeSet<>());
    }

    public Outages withBranch(String branchId) {
        SortedSet<String> next = new TreeSet<>(this.branchIds);
        next.add(branchId);
        return new Outages(next, this.generatorIds);
    }

    public Outages withGenerator(String generatorId) {
        SortedSet<String> next = new TreeSet<>(this.generatorIds);
        next.add(generatorId);
        return new Outages(this.branchIds, next);
    }

    public boolean isEmpty() {
        return this.branchIds.isEmpty() && this.generatorIds.isEmpty();
    }

    public int size() {
        return this.branchIds.size() + this.generatorIds.size();
    }

    public Network applyTo(Network network) {
        this.branchIds.forEach(
                id ->
                        network.findBranch(id)
                                .orElseThrow(
                                        () ->
                                                new IllegalArgumentException(
                                                        "unknown branch " + id)));
        this.generatorIds.stream()
                .filter(id -> network.generators().stream().noneMatch(g -> g.id().equals(id)))
                .findFirst()
                .ifPresent(
                        id -> {
                            throw new IllegalArgumentException("unknown generator " + id);
                        });
        Network withoutBranches =
                network.withBranches(
                        network.branches().stream()
                                .map(
                                        branch ->
                                                this.branchIds.contains(branch.id())
                                                        ? branch.withInService(false)
                                                        : branch)
                                .toList());
        return withoutBranches.withGenerators(
                withoutBranches.generators().stream().map(this::withoutIfListed).toList());
    }

    private Generator withoutIfListed(Generator generator) {
        return this.generatorIds.contains(generator.id())
                ? generator.withInService(false)
                : generator;
    }
}
