package dev.gridtwin.domain.model;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public record Network(
        String id,
        double baseMva,
        List<Bus> buses,
        List<Load> loads,
        List<Shunt> shunts,
        List<Generator> generators,
        List<Branch> branches) {

    public Network {
        if (baseMva <= 0) {
            throw new IllegalArgumentException("base MVA must be positive");
        }
        buses = List.copyOf(buses);
        loads = List.copyOf(loads);
        shunts = List.copyOf(shunts);
        generators = List.copyOf(generators);
        branches = List.copyOf(branches);
        Set<Integer> busNumbers = requireUnique(buses.stream().map(Bus::number), "bus number");
        requireUnique(generators.stream().map(Generator::id), "generator id");
        requireUnique(branches.stream().map(Branch::id), "branch id");
        requireKnownBuses(busNumbers, loads.stream().map(Load::bus), "load");
        requireKnownBuses(busNumbers, shunts.stream().map(Shunt::bus), "shunt");
        requireKnownBuses(busNumbers, generators.stream().map(Generator::bus), "generator");
        requireKnownBuses(
                busNumbers,
                branches.stream().flatMap(branch -> Stream.of(branch.from(), branch.to())),
                "branch");
        if (buses.stream().filter(bus -> bus.type() == BusType.REFERENCE).count() != 1) {
            throw new IllegalArgumentException("a network needs exactly one reference bus");
        }
    }

    public Optional<Bus> findBus(int number) {
        return this.buses.stream().filter(bus -> bus.number() == number).findFirst();
    }

    public Optional<Branch> findBranch(String branchId) {
        return this.branches.stream().filter(branch -> branch.id().equals(branchId)).findFirst();
    }

    public Bus referenceBus() {
        return this.buses.stream()
                .filter(bus -> bus.type() == BusType.REFERENCE)
                .findFirst()
                .orElseThrow();
    }

    public Network withLoadFactor(double factor) {
        if (factor < 0) {
            throw new IllegalArgumentException("load factor must not be negative");
        }
        return new Network(
                this.id,
                this.baseMva,
                this.buses,
                this.loads.stream().map(load -> load.scaled(factor)).toList(),
                this.shunts,
                this.generators,
                this.branches);
    }

    public Network withBranches(List<Branch> replacement) {
        return new Network(
                this.id,
                this.baseMva,
                this.buses,
                this.loads,
                this.shunts,
                this.generators,
                replacement);
    }

    public double totalLoadMw() {
        return this.loads.stream().mapToDouble(Load::activePowerMw).sum();
    }

    private static <T> Set<T> requireUnique(Stream<T> values, String description) {
        return values.collect(
                        Collectors.toMap(
                                Function.identity(),
                                value -> true,
                                (first, second) -> {
                                    throw new IllegalArgumentException("duplicate " + description);
                                }))
                .keySet();
    }

    private static void requireKnownBuses(
            Set<Integer> known, Stream<Integer> referenced, String owner) {
        referenced
                .filter(number -> !known.contains(number))
                .findFirst()
                .ifPresent(
                        number -> {
                            throw new IllegalArgumentException(
                                    owner + " refers to unknown bus " + number);
                        });
    }
}
