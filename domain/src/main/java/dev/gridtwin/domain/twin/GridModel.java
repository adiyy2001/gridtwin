package dev.gridtwin.domain.twin;

import dev.gridtwin.domain.model.Branch;
import dev.gridtwin.domain.model.BusType;
import dev.gridtwin.domain.model.Generator;
import dev.gridtwin.domain.model.Network;
import dev.gridtwin.domain.topology.Substation;
import dev.gridtwin.domain.topology.Terminal;
import dev.gridtwin.domain.topology.TerminalKind;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public record GridModel(Network network, Substation substation) {

    public GridModel {
        int own = substation.busNumber();
        var bus =
                network.findBus(own)
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "the substation bus "
                                                        + own
                                                        + " is not in the network"));
        if (bus.type() == BusType.REFERENCE) {
            throw new IllegalArgumentException("the substation must not sit on the reference bus");
        }
        substation.busbars().stream()
                .map(busbar -> busbar.busNumber())
                .filter(number -> number != own)
                .filter(number -> network.findBus(number).isPresent())
                .findFirst()
                .ifPresent(
                        number -> {
                            throw new IllegalArgumentException(
                                    "busbar bus number "
                                            + number
                                            + " is already used in the network");
                        });
        if (network.shunts().stream().anyMatch(shunt -> shunt.bus() == own)) {
            throw new IllegalArgumentException("shunts at the substation bus are not supported");
        }
        requireTerminalsFor(
                TerminalKind.BRANCH,
                network.branches().stream()
                        .filter(branch -> branch.from() == own || branch.to() == own)
                        .map(Branch::id)
                        .collect(Collectors.toSet()),
                substation);
        requireTerminalsFor(
                TerminalKind.GENERATOR,
                network.generators().stream()
                        .filter(generator -> generator.bus() == own)
                        .map(Generator::id)
                        .collect(Collectors.toSet()),
                substation);
        requireLoadTerminal(network, substation);
    }

    public TwinState initialState() {
        return TwinState.initial(this);
    }

    private static void requireTerminalsFor(
            TerminalKind kind, Set<String> required, Substation substation) {
        List<String> terminals =
                substation.bays().stream()
                        .flatMap(bay -> bay.terminal().stream())
                        .filter(terminal -> terminal.kind() == kind)
                        .map(Terminal::equipmentId)
                        .toList();
        if (terminals.size() != Set.copyOf(terminals).size()) {
            throw new IllegalArgumentException("a " + kind + " has more than one terminal");
        }
        if (!Set.copyOf(terminals).equals(required)) {
            throw new IllegalArgumentException(
                    "the "
                            + kind
                            + " terminals "
                            + terminals
                            + " do not match the equipment at the substation bus "
                            + required);
        }
    }

    private static void requireLoadTerminal(Network network, Substation substation) {
        long terminals =
                substation.bays().stream()
                        .flatMap(bay -> bay.terminal().stream())
                        .filter(terminal -> terminal.kind() == TerminalKind.LOAD)
                        .count();
        boolean loads =
                network.loads().stream().anyMatch(load -> load.bus() == substation.busNumber());
        if (terminals > 1 || (loads && terminals == 0)) {
            throw new IllegalArgumentException(
                    "the substation needs exactly one load terminal when there is load at its bus");
        }
    }
}
